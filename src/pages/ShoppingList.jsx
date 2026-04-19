import { useState, useRef, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Edit,
  Calendar as CalendarIcon,
  Banknote,
  CreditCard,
  Landmark,
  User,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  Undo2,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as DayPickerCalendar } from "@/components/ui/calendar";
import { parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { motion } from "framer-motion";
import { MexicoWallTimePicker } from "@/components/daily-cash/MexicoWallTimePicker";
import { listMenuItems } from "@/lib/local-dev-menu";
import { collectShoppingIngredientPillLabels, ingredientMatchKey } from "@/lib/menuIngredients";
import {
  isLocalFinanceMode,
  localListShoppingList,
  localCreateShoppingList,
  localUpdateShoppingList,
  localDeleteShoppingList,
  localListExpenses,
  localCreateExpense,
  localUpdateExpense,
  localDeleteExpense,
} from "@/lib/localDevFinance";
import { cn } from "@/lib/utils";
import {
  formatMexicoDateShortEn,
  formatMexicoMonthYearLabelEn,
  getMexicoDateKey,
  getMexicoNowDateKey,
  getMexicoNowTimeHHmm,
  getMexicoNowYearMonth,
  mexicoWallDateTimeToUtcIso,
  normalizeHHmm,
  withMexicoCreatedDateForPayload,
} from "@/lib/mexicoTime";
import {
  flushDailyCashPersistImmediate,
  setLedgerTimeOverride,
} from "@/lib/dailyCashLocal";
import { useDailyCashStoreSync } from "@/hooks/useDailyCashStoreSync";
import { useMonthUrlSync } from "@/hooks/useMonthUrlSync";

function escapeCsvField(value) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseDecimalInput(value, fallback = 0) {
  const n = parseFloat(String(value ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function formatMoneyCompact(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

/** Strip server fields so a deleted row can be re-created with the same data */
function shoppingListCreatePayloadFromRow(row) {
  const { id: _id, created_date: _c, updated_date: _u, ...rest } = row;
  return { ...rest };
}

function formatShoppingDueDate(iso) {
  if (!iso || String(iso).length < 8) return null;
  try {
    return formatMexicoDateShortEn(String(iso).slice(0, 10));
  } catch {
    return null;
  }
}

const expenseCategoryByShoppingCategory = {
  ingredients: "ingredients",
  supplies: "other",
  equipment: "equipment",
  cleaning: "other",
  other: "other",
  general_shopping: "other",
};

/** First pill in Register purchase grid; requires manual name in the field below */
const PURCHASE_PICK_SHOPPING = "__purchase_pick_shopping__";

const REGISTERED_MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const REGISTERED_PURCHASES_MIN_YEAR = 2020;

export default function ShoppingList() {
  const [mainTab, setMainTab] = useState("purchase");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [lastRemovedShoppingSnapshot, setLastRemovedShoppingSnapshot] = useState(null);
  const queryClient = useQueryClient();
  const quickAmountInputRef = useRef(null);
  const quickShoppingNameInputRef = useRef(null);

  /** Share the Daily Cash store so expense time overrides from here are visible in Cash. */
  useDailyCashStoreSync();

  const [quickMenuIngredient, setQuickMenuIngredient] = useState("");
  const [quickShoppingLabel, setQuickShoppingLabel] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickPurchaseDate, setQuickPurchaseDate] = useState(() => getMexicoNowDateKey());
  /** HH:mm on the Mexico business clock (same as Daily Cash / Finance). */
  const [quickPurchaseTime, setQuickPurchaseTime] = useState(() => getMexicoNowTimeHHmm());
  /** "cash" → company_cash, "card" → company_account (same as Finance expenses) */
  const [quickPurchasePayment, setQuickPurchasePayment] = useState("cash");
  const [purchaseDateOpen, setPurchaseDateOpen] = useState(false);

  const [quickAddBusy, setQuickAddBusy] = useState(null); // null | "all" | ingredient name
  const [recentPurchaseEntries, setRecentPurchaseEntries] = useState([]); // { id, name, amount }
  const [amountDraftById, setAmountDraftById] = useState({});

  const [formData, setFormData] = useState({
    item_name: "",
    quantity: 1,
    unit: "units",
    category: "ingredients",
    status: "pending",
    estimated_cost: 0,
    actual_cost: 0, // Added actual_cost
    supplier: "",
    notes: "",
    purchased_date: "",
    due_date: "",
    converted_to_expense: false, // Added converted_to_expense
    expense_id: "", // Added expense_id
  });

  const useLocalFinance = isLocalFinanceMode();

  const { data: shoppingItems = [], isLoading } = useQuery({
    queryKey: ["shoppingList", useLocalFinance ? "local" : "remote"],
    queryFn: () =>
      useLocalFinance ? localListShoppingList() : base44.entities.ShoppingList.list("-created_date"),
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["menuItems"],
    queryFn: () => listMenuItems(() => base44.entities.MenuItem.list()),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListExpenses() : base44.entities.Expense.list("-date")),
  });

  const shoppingPillLabels = useMemo(
    () => collectShoppingIngredientPillLabels(menuItems),
    [menuItems],
  );

  const shoppingPurchaseRows = useMemo(() => {
    return (expenses || [])
      .filter((e) => e.from_shopping_list)
      .map((e) => ({
        id: e.id,
        shoppingListId: e.shopping_list_id || "",
        name: e.name || "",
        amount: Number(e.amount || 0),
        dateIso: String(e.date || "").slice(0, 10),
      }))
      .sort((a, b) => {
        if (a.dateIso !== b.dateIso) return b.dateIso.localeCompare(a.dateIso);
        return a.name.localeCompare(b.name);
      });
  }, [expenses]);

  const [registeredPurchasesMonth, setRegisteredPurchasesMonth] = useState(() => getMexicoNowYearMonth());
  /* Shares ?month=YYYY-MM with Dashboard/Statistics so hopping between admin tabs keeps the period. */
  useMonthUrlSync(registeredPurchasesMonth, setRegisteredPurchasesMonth);

  const registeredPurchasesForMonth = useMemo(() => {
    const prefix = registeredPurchasesMonth;
    return shoppingPurchaseRows.filter((r) => r.dateIso && r.dateIso.slice(0, 7) === prefix);
  }, [shoppingPurchaseRows, registeredPurchasesMonth]);

  const registeredPurchasesMonthTotal = useMemo(
    () => registeredPurchasesForMonth.reduce((sum, r) => sum + r.amount, 0),
    [registeredPurchasesForMonth],
  );

  /** "rows" shows individual purchases, "products" shows totals grouped by product name. */
  const [registeredView, setRegisteredView] = useState(/** @type {"rows" | "products"} */ ("rows"));

  /* Group by normalized name (case-insensitive, trimmed) so "Water" and "water " collapse.
     Keep the longest/most-frequent display name to avoid showing a blank or lowercase version. */
  const registeredProductsForMonth = useMemo(() => {
    const byKey = new Map();
    for (const r of registeredPurchasesForMonth) {
      const raw = (r.name || "").trim();
      const key = raw.toLowerCase();
      if (!key) continue;
      const prev = byKey.get(key);
      if (prev) {
        prev.total += r.amount;
        prev.count += 1;
        prev.names.set(raw, (prev.names.get(raw) || 0) + 1);
      } else {
        byKey.set(key, { key, total: r.amount, count: 1, names: new Map([[raw, 1]]) });
      }
    }
    return Array.from(byKey.values())
      .map((g) => {
        let bestName = "";
        let bestCount = -1;
        for (const [n, c] of g.names) {
          if (c > bestCount || (c === bestCount && n.length > bestName.length)) {
            bestName = n;
            bestCount = c;
          }
        }
        return { key: g.key, name: bestName, total: g.total, count: g.count };
      })
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [registeredPurchasesForMonth]);

  const registeredMonthLabel = useMemo(
    () => formatMexicoMonthYearLabelEn(registeredPurchasesMonth),
    [registeredPurchasesMonth],
  );

  const parsedRegisteredMonth = useMemo(() => {
    const parts = registeredPurchasesMonth.split("-");
    const y = Number.parseInt(parts[0], 10);
    const mo = Number.parseInt(parts[1], 10);
    const now = new Date();
    const safeY = Number.isFinite(y) ? y : now.getFullYear();
    const safeM =
      Number.isFinite(mo) && mo >= 1 && mo <= 12 ? mo - 1 : now.getMonth();
    return { year: safeY, monthIndex: safeM };
  }, [registeredPurchasesMonth]);

  const [registeredMonthPopoverOpen, setRegisteredMonthPopoverOpen] = useState(false);
  const [editingRegisteredAmountId, setEditingRegisteredAmountId] = useState(null);
  const [editingRegisteredAmountDraft, setEditingRegisteredAmountDraft] = useState("");
  const [editingRegisteredDateId, setEditingRegisteredDateId] = useState(null);
  const [editingRegisteredDateDraft, setEditingRegisteredDateDraft] = useState("");

  const setRegisteredYearMonth = (year, monthIndex0) => {
    const mm = String(monthIndex0 + 1).padStart(2, "0");
    setRegisteredPurchasesMonth(`${year}-${mm}`);
  };

  const createItem = useMutation({
    mutationFn: (data) =>
      useLocalFinance ? localCreateShoppingList(data) : base44.entities.ShoppingList.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }) =>
      useLocalFinance ? localUpdateShoppingList(id, data) : base44.entities.ShoppingList.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: (id) =>
      useLocalFinance ? localDeleteShoppingList(id) : base44.entities.ShoppingList.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
    },
  });

  const createExpense = useMutation({
    mutationFn: (data) => {
      if (useLocalFinance) {
        return localCreateExpense(data);
      }
      const { created_date: explicitCreated, ...rest } = data;
      const base = withMexicoCreatedDateForPayload(rest);
      if (explicitCreated != null && String(explicitCreated).trim() !== "") {
        return base44.entities.Expense.create({ ...base, created_date: String(explicitCreated).trim() });
      }
      return base44.entities.Expense.create(base);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const patchExpenseRow = useMutation({
    mutationFn: async ({ id, ...patch }) => {
      if (useLocalFinance) {
        return localUpdateExpense(id, patch);
      }
      return base44.entities.Expense.update(id, patch);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const removeRegisteredPurchase = useMutation({
    mutationFn: async ({ expenseId, shoppingListId }) => {
      if (useLocalFinance) {
        await localDeleteExpense(expenseId);
      } else {
        await base44.entities.Expense.delete(expenseId);
      }
      if (shoppingListId) {
        const item = shoppingItems.find((i) => i.id === shoppingListId);
        if (item) {
          await updateItem.mutateAsync({
            id: shoppingListId,
            data: {
              ...item,
              converted_to_expense: false,
              expense_id: "",
            },
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
    },
  });

  useEffect(() => {
    setEditingRegisteredAmountId(null);
    setEditingRegisteredDateId(null);
  }, [registeredPurchasesMonth]);

  const startEditingRegisteredAmount = (r) => {
    setEditingRegisteredDateId(null);
    setEditingRegisteredAmountId(r.id);
    setEditingRegisteredAmountDraft(Number.isFinite(r.amount) ? String(r.amount) : "");
  };

  const startEditingRegisteredDate = (r) => {
    setEditingRegisteredAmountId(null);
    setEditingRegisteredDateId(r.id);
    setEditingRegisteredDateDraft(r.dateIso || getMexicoNowDateKey());
  };

  const commitRegisteredAmountEdit = async (r, valueOverride) => {
    const raw = String(valueOverride ?? editingRegisteredAmountDraft).trim().replace(",", ".");
    const n = parseFloat(raw);
    if (!Number.isFinite(n) || n < 0) {
      setEditingRegisteredAmountId(null);
      return;
    }
    if (Math.abs(n - r.amount) < 0.005) {
      setEditingRegisteredAmountId(null);
      return;
    }
    try {
      await patchExpenseRow.mutateAsync({ id: r.id, amount: n });
    } catch (e) {
      console.error(e);
      alert("Could not save amount.");
    }
    setEditingRegisteredAmountId(null);
  };

  const commitRegisteredDateEdit = async (r, valueOverride) => {
    const v = String(valueOverride ?? editingRegisteredDateDraft).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      setEditingRegisteredDateId(null);
      return;
    }
    if (v === r.dateIso) {
      setEditingRegisteredDateId(null);
      return;
    }
    try {
      await patchExpenseRow.mutateAsync({ id: r.id, date: v });
    } catch (e) {
      console.error(e);
      alert("Could not save date.");
    }
    setEditingRegisteredDateId(null);
  };

  const handleDeleteRegisteredRow = (r) => {
    if (!window.confirm("Remove this purchase from the register?")) return;
    removeRegisteredPurchase.mutate({ expenseId: r.id, shoppingListId: r.shoppingListId || undefined });
  };

  const categories = [
    { id: "all", name: "All", color: "bg-yellow-400/15 text-yellow-200", icon: "🛒" },
    { id: "ingredients", name: "Ingredients", color: "bg-yellow-400/20 text-yellow-400", icon: "🥫" },
    { id: "general_shopping", name: "Shopping", color: "bg-yellow-400/20 text-yellow-400", icon: "🛍️" },
    { id: "supplies", name: "Supplies", color: "bg-yellow-400/20 text-yellow-400", icon: "📦" },
    { id: "equipment", name: "Equipment", color: "bg-yellow-400/20 text-yellow-400", icon: "🔧" },
    { id: "cleaning", name: "Cleaning", color: "bg-yellow-400/20 text-yellow-400", icon: "🧹" },
    { id: "other", name: "Other", color: "bg-yellow-400/10 text-yellow-400/70", icon: "📌" },
  ];

  const units = [
    { value: "kg", label: "Kilograms (kg)" },
    { value: "g", label: "Grams (g)" },
    { value: "l", label: "Liters (L)" },
    { value: "ml", label: "Milliliters (ml)" },
    { value: "units", label: "Units" },
    { value: "pieces", label: "Pieces" },
    { value: "other", label: "Other" },
  ];

  const filterPillClass = (active) =>
    `flex h-7 max-w-[min(100%,14rem)] items-center gap-1 truncate px-2 py-1 text-xs font-medium transition-colors ${
      active
        ? "border border-transparent bg-yellow-400 text-black hover:bg-yellow-300 hover:text-black"
        : "border border-yellow-500/25 bg-[#1a1a1a] text-gray-300 shadow-none hover:!border-yellow-400/50 hover:!bg-[rgba(234,179,8,0.12)] hover:!text-yellow-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-yellow-500/40"
    }`;

  const hasPendingIngredient = (ing) => {
    const key = ingredientMatchKey(ing);
    if (!key) return false;
    return shoppingItems.some(
      (i) =>
        i.status === "pending" &&
        i.category === "ingredients" &&
        ingredientMatchKey(i.item_name) === key,
    );
  };

  const missingMenuIngredientsCount = shoppingPillLabels.filter((ing) => !hasPendingIngredient(ing)).length;

  const buildPendingIngredientPayload = (name) => ({
    item_name: String(name).trim(),
    quantity: 1,
    unit: "units",
    category: "ingredients",
    priority: "medium",
    status: "pending",
    estimated_cost: 0,
    actual_cost: 0,
    supplier: "",
    notes: "",
    purchased_date: "",
    due_date: "",
    converted_to_expense: false,
    expense_id: "",
  });

  const handleQuickAddIngredient = async (ing) => {
    if (hasPendingIngredient(ing) || quickAddBusy) return;
    setQuickAddBusy(ing);
    try {
      await createItem.mutateAsync(buildPendingIngredientPayload(ing));
      setLastRemovedShoppingSnapshot(null);
    } catch (e) {
      console.error(e);
      alert("Could not add this item. Please try again.");
    } finally {
      setQuickAddBusy(null);
    }
  };

  const handleQuickAddAllMissing = async () => {
    const toAdd = shoppingPillLabels.filter((ing) => !hasPendingIngredient(ing));
    if (toAdd.length === 0 || quickAddBusy) return;
    setQuickAddBusy("all");
    try {
      for (const ing of toAdd) {
        await createItem.mutateAsync(buildPendingIngredientPayload(ing));
      }
      setLastRemovedShoppingSnapshot(null);
    } catch (e) {
      console.error(e);
      alert("Could not finish adding all items. Check the list and try again.");
    } finally {
      setQuickAddBusy(null);
    }
  };

  const pendingItems = shoppingItems.filter((i) => i.status === "pending");

  const pendingListRows = useMemo(() => {
    const rows = shoppingItems.filter((i) => i.status === "pending");
    const dueKey = (d) => {
      const s = d && String(d).slice(0, 10);
      if (!s || s.length < 10) return "9999-12-31";
      return s;
    };
    return [...rows].sort((a, b) => {
      const da = dueKey(a.due_date);
      const db = dueKey(b.due_date);
      if (da !== db) return da.localeCompare(db);
      return String(a.item_name || "").localeCompare(String(b.item_name || ""), undefined, {
        sensitivity: "base",
      });
    });
  }, [shoppingItems]);

  const formCategories = useMemo(() => categories.filter((c) => c.id !== "all"), []);

  useEffect(() => {
    setAmountDraftById((prev) => {
      const next = { ...prev };
      for (const row of shoppingItems) {
        if (row.status !== "pending") continue;
        if (next[row.id] === undefined) {
          const v = Number(row.estimated_cost) > 0 ? String(Number(row.estimated_cost)) : "";
          next[row.id] = v;
        }
      }
      return next;
    });
  }, [shoppingItems]);

  const totalEstimatedCost = pendingItems.reduce((sum, i) => sum + (i.estimated_cost || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      ...formData,
      quantity: parseDecimalInput(formData.quantity, 0),
      actual_cost: parseDecimalInput(formData.actual_cost, 0),
      estimated_cost: parseDecimalInput(formData.estimated_cost, 0),
      priority: "medium",
      ...(editingItem ? {} : { status: "pending" }),
    };
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, data: payload }, { onSuccess: () => resetForm() });
    } else {
      createItem.mutate(payload, {
        onSuccess: () => {
          setLastRemovedShoppingSnapshot(null);
          resetForm();
        },
      });
    }
  };

  const handleQuickLogPurchase = async () => {
    const amount = parseDecimalInput(quickAmount, NaN);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid amount greater than zero.");
      return;
    }

    let itemName = "";
    let shoppingCategory = "ingredients";
    if (quickMenuIngredient === PURCHASE_PICK_SHOPPING) {
      if (!quickShoppingLabel.trim()) {
        alert("Enter a name for this purchase.");
        return;
      }
      itemName = quickShoppingLabel.trim();
      shoppingCategory = "general_shopping";
    } else if (quickMenuIngredient.trim()) {
      itemName = quickMenuIngredient.trim();
      shoppingCategory = "ingredients";
    } else {
      alert("Pick Shopping or an ingredient above.");
      return;
    }

    const dateStr = quickPurchaseDate || getMexicoNowDateKey();
    const createdIso = mexicoWallDateTimeToUtcIso(dateStr, normalizeHHmm(quickPurchaseTime));

    const listPayload = {
      item_name: itemName,
      quantity: 1,
      unit: "units",
      category: shoppingCategory,
      priority: "medium",
      status: "purchased",
      estimated_cost: amount,
      actual_cost: amount,
      purchased_date: dateStr,
      due_date: "",
      supplier: "",
      notes: "Quick entry from Shopping List",
      converted_to_expense: false,
    };

    try {
      const createdList = await createItem.mutateAsync(listPayload);
      const expensePayload = {
        name: itemName,
        category: expenseCategoryByShoppingCategory[shoppingCategory] || "other",
        amount,
        quantity: 1,
        unit: "units",
        date: dateStr,
        supplier: "",
        notes: "Quick purchase (Shopping List)",
        payment_source: quickPurchasePayment === "card" ? "company_account" : "company_cash",
        paid_by_company: true,
        from_shopping_list: true,
        shopping_list_id: createdList.id,
        is_recurring: false,
        contributors: [],
        ...(createdIso ? { created_date: createdIso } : {}),
      };
      const createdExpense = await createExpense.mutateAsync(expensePayload);
      const expenseId = createdExpense?.id;
      if (!expenseId) {
        throw new Error("Expense did not return an id.");
      }
      if (createdIso) {
        setLedgerTimeOverride(dateStr, `exp-${expenseId}`, createdIso);
        void flushDailyCashPersistImmediate();
      }
      // Patch only link fields — spreading the full record often breaks API validation.
      await updateItem.mutateAsync({
        id: createdList.id,
        data: {
          converted_to_expense: true,
          expense_id: expenseId,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.refetchQueries({
        queryKey: ["expenses"],
        type: "all",
      });
      queryClient.invalidateQueries({ queryKey: ["shoppingList"] });
      setRecentPurchaseEntries((prev) => [
        { id: `${createdList.id}-${dateStr}`, name: itemName, amount },
        ...prev.slice(0, 9),
      ]);
      setQuickAmount("");
      setQuickShoppingLabel("");
      setQuickMenuIngredient("");
    } catch (err) {
      console.error(err);
      const detail =
        err?.message ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        (typeof err?.response?.data === "string" ? err.response.data : null);
      alert(
        detail
          ? `Could not log purchase: ${detail}`
          : "Could not log purchase. Please try again.",
      );
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      ...item,
      due_date: item.due_date || "",
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    const row = shoppingItems.find((i) => i.id === id);
    if (!row) return;
    setLastRemovedShoppingSnapshot(shoppingListCreatePayloadFromRow(row));
    deleteItem.mutate(id);
  };

  const handleUndoLastRemove = async () => {
    if (!lastRemovedShoppingSnapshot || createItem.isPending) return;
    try {
      await createItem.mutateAsync(lastRemovedShoppingSnapshot);
      setLastRemovedShoppingSnapshot(null);
    } catch (e) {
      console.error(e);
      alert("Could not restore the row. Try again.");
    }
  };

  const readPurchaseAmountForItem = (item) => {
    const raw = amountDraftById[item.id];
    const n = parseDecimalInput(raw, NaN);
    if (Number.isFinite(n) && n >= 0) return n;
    return Number(item.estimated_cost || 0) || 0;
  };

  const finalizePurchaseFromList = async (item, paymentSource) => {
    const actualCost = readPurchaseAmountForItem(item);
    if (!Number.isFinite(actualCost) || actualCost <= 0) {
      window.alert("Enter an amount (MXN) in the row before marking as purchased.");
      return;
    }

    const today = getMexicoNowDateKey();
    const createdIso = mexicoWallDateTimeToUtcIso(today, getMexicoNowTimeHHmm());

    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: {
          status: "purchased",
          purchased_date: today,
          actual_cost: actualCost,
          estimated_cost: actualCost,
        },
      });

      const expenseData = {
        name: item.item_name,
        category: expenseCategoryByShoppingCategory[item.category] || "other",
        amount: actualCost,
        quantity: item.quantity,
        unit: item.unit,
        date: today,
        supplier: item.supplier || "",
        notes: item.notes || "",
        payment_source: paymentSource,
        paid_by_company: paymentSource === "company_cash" || paymentSource === "company_account",
        from_shopping_list: true,
        shopping_list_id: item.id,
        ...(createdIso ? { created_date: createdIso } : {}),
      };

      const createdExpense = await createExpense.mutateAsync(expenseData);

      if (createdIso && createdExpense?.id) {
        setLedgerTimeOverride(today, `exp-${createdExpense.id}`, createdIso);
        void flushDailyCashPersistImmediate();
      }

      await updateItem.mutateAsync({
        id: item.id,
        data: {
          converted_to_expense: true,
          expense_id: createdExpense.id,
        },
      });
    } catch (error) {
      console.error("Error:", error);
      window.alert("Could not record purchase. Try again.");
    }
  };

  const commitPendingRowEstimatedCost = async (item) => {
    const raw = amountDraftById[item.id];
    const n = parseDecimalInput(raw, NaN);
    if (!Number.isFinite(n) || n < 0) return;
    if (Math.abs(n - Number(item.estimated_cost || 0)) < 0.005) return;
    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: { estimated_cost: n },
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportShoppingPurchasesCsv = () => {
    const headers = ["Purchase", "Sum (MXN)", "Date (ISO)"];
    const rows = registeredPurchasesForMonth;
    const dataLines = rows.map((r) =>
      [r.name, formatMoneyCompact(r.amount), r.dateIso].map(escapeCsvField).join(","),
    );
    const totalLine = ["TOTAL", formatMoneyCompact(registeredPurchasesMonthTotal), ""].map(escapeCsvField).join(",");
    const csv = `\uFEFF${[headers.map(escapeCsvField).join(","), ...dataLines, totalLine].join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shopping-purchases-${registeredPurchasesMonth}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      item_name: "",
      quantity: 1,
      unit: "units",
      category: "ingredients",
      status: "pending",
      estimated_cost: 0,
      actual_cost: 0,
      supplier: "",
      notes: "",
      purchased_date: "",
      due_date: "",
      converted_to_expense: false,
      expense_id: "",
    });
    setEditingItem(null);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 bg-[#1a1a1a] py-5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-6 w-6 shrink-0 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold text-yellow-400">Shopping</h1>
              <p className="text-xs text-gray-400">
                Log ingredient costs on <strong className="text-gray-300">Register purchase</strong>, or plan buys on Shopping list.
              </p>
            </div>
          </div>
        </div>
      </div>

      {useLocalFinance && (
        <div className="border-b border-amber-500/25 bg-amber-950/35">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-xs leading-relaxed text-amber-100/90">
              <span className="font-semibold text-amber-200">Local finance dev mode.</span> Shopping and purchases are stored in
              this browser only because <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">VITE_LOCAL_DEV_FINANCE=true</code>.
              Remove it or set it to false and configure{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">VITE_BASE44_APP_ID</code> and{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-[10px]">VITE_BASE44_BACKEND_URL</code> to use the database.
            </p>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:space-y-7 lg:px-8 lg:py-7">
        <div className="flex w-full gap-1 rounded-xl border border-yellow-500/20 bg-[#242424] p-1">
          {[
            { id: "purchase", label: "Register purchase" },
            { id: "list", label: "Shopping list" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMainTab(tab.id);
                if (tab.id === "purchase") {
                  setShowForm(false);
                }
              }}
              className={cn(
                "min-w-0 flex-1 rounded-lg px-2 py-3 text-center text-sm font-medium transition-colors sm:px-4",
                mainTab === tab.id
                  ? "bg-yellow-400/20 text-yellow-200"
                  : "text-gray-400 hover:bg-yellow-500/10 hover:text-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {mainTab === "list" && (
          <>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-yellow-400">Your list</h2>
            <p className="mt-1 text-xs text-gray-500">
              {pendingItems.length} to buy
              {totalEstimatedCost > 0 ? ` · $${formatMoneyCompact(totalEstimatedCost)} MXN estimated` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!lastRemovedShoppingSnapshot || createItem.isPending}
              onClick={handleUndoLastRemove}
              className="h-9 gap-2 border-yellow-500/35 text-gray-100 hover:bg-yellow-500/10 disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" />
              Undo delete
            </Button>
            <Button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="h-9 gap-2 bg-yellow-400 text-black hover:bg-yellow-300"
            >
              <Plus className="h-4 w-4" />
              {showForm ? "Close form" : "Add to list"}
            </Button>
          </div>
        </div>

        {shoppingPillLabels.length > 0 && (
          <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-bold text-yellow-400">Quick add (menu + kitchen)</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Tap to add a pending line. Includes catalog ingredients from Menu Management plus common English kitchen
                  supplies. Names already pending are skipped.
                </p>
              </div>
              <Button
                type="button"
                disabled={quickAddBusy !== null || missingMenuIngredientsCount === 0}
                onClick={handleQuickAddAllMissing}
                className="h-9 shrink-0 gap-2 bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                {quickAddBusy === "all" ? "Adding…" : "Add all missing"}
              </Button>
            </div>
            <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto pr-1 [scrollbar-color:rgba(250,204,21,0.35)_transparent]">
              {shoppingPillLabels.map((ing) => {
                const onList = hasPendingIngredient(ing);
                const busyThis = quickAddBusy === ing;
                return (
                  <Button
                    key={`quick-add-${ing}`}
                    type="button"
                    variant="outline"
                    size="sm"
                    title={onList ? "Already on your pending list" : `Add ${ing}`}
                    disabled={quickAddBusy !== null || onList}
                    onClick={() => handleQuickAddIngredient(ing)}
                    className={
                      onList
                        ? "h-7 max-w-[min(100%,14rem)] cursor-not-allowed gap-1 border border-yellow-500/10 bg-[#1a1a1a]/90 px-2 py-1 text-xs text-gray-500 opacity-70"
                        : `${filterPillClass(false)} h-auto min-h-7 gap-1 disabled:opacity-50`
                    }
                  >
                    {!onList && <Plus className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />}
                    <span className="truncate">{onList ? `${ing} · on list` : ing}</span>
                    {busyThis && <span className="sr-only">Adding</span>}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
              <CardHeader>
                <CardTitle className="text-xl text-yellow-100">{editingItem ? "Edit item" : "Add to shopping list"}</CardTitle>
                <p className="text-xs text-gray-400">
                  Plan what you still need to buy. When you have paid, use the <strong className="text-gray-300">Register purchase</strong> tab to
                  post it to Finance.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="item_name" className="text-xs font-medium text-gray-400">
                      Item name *
                    </Label>
                    <Input
                      id="item_name"
                      required
                      value={formData.item_name}
                      onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                      placeholder="Flour, oil, napkins…"
                      className="border-yellow-500/20 bg-[#1a1a1a] text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-[6rem] space-y-2">
                      <Label htmlFor="quantity" className="text-xs font-medium text-gray-400">
                        Qty *
                      </Label>
                      <Input
                        id="quantity"
                        type="text"
                        inputMode="decimal"
                        required
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: e.target.value })
                        }
                        className="h-9 border-yellow-500/20 bg-[#1a1a1a] text-white [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <div className="min-w-[11rem] flex-1 space-y-2">
                      <Label htmlFor="due_date" className="text-xs font-medium text-gray-400">
                        Due <span className="text-gray-600">(optional)</span>
                      </Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={formData.due_date ? String(formData.due_date).slice(0, 10) : ""}
                        onChange={(e) => setFormData({ ...formData, due_date: e.target.value || "" })}
                        className="h-9 border-yellow-500/20 bg-[#1a1a1a] text-white [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-400">Category *</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {formCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, category: cat.id })}
                          className={cn(
                            filterPillClass(formData.category === cat.id),
                            "h-8 min-h-8 gap-1.5 px-2.5",
                          )}
                        >
                          <span aria-hidden>{cat.icon}</span>
                          <span className="truncate">{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-400">Unit *</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {units.map((u) => (
                        <button
                          key={u.value}
                          type="button"
                          onClick={() => setFormData({ ...formData, unit: u.value })}
                          className={cn(
                            filterPillClass(formData.unit === u.value),
                            "h-8 min-h-8 px-2.5 text-[11px]",
                          )}
                        >
                          {u.label.replace(/\s*\([^)]*\)\s*$/, "").trim() || u.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {editingItem ? (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-400">Status</Label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, status: "pending" })}
                          className={cn(
                            "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                            formData.status === "pending"
                              ? "border-yellow-400 bg-yellow-400/15 text-yellow-200"
                              : "border-yellow-500/20 bg-[#1a1a1a] text-gray-400 hover:border-yellow-500/40",
                          )}
                        >
                          <Circle className="h-4 w-4 opacity-80" aria-hidden />
                          To buy
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, status: "purchased" })}
                          className={cn(
                            "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
                            formData.status === "purchased"
                              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                              : "border-yellow-500/20 bg-[#1a1a1a] text-gray-400 hover:border-yellow-500/40",
                          )}
                        >
                          <CheckCircle2 className="h-4 w-4 opacity-90" aria-hidden />
                          Done
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {editingItem && formData.status === "purchased" ? (
                    <div className="space-y-2">
                      <Label htmlFor="actual_cost" className="text-xs font-medium text-gray-400">
                        Amount paid (MXN)
                      </Label>
                      <Input
                        id="actual_cost"
                        type="text"
                        inputMode="decimal"
                        value={formData.actual_cost || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, actual_cost: e.target.value })
                        }
                        placeholder="0"
                        className="h-9 max-w-[12rem] border-yellow-500/20 bg-[#1a1a1a] text-white [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="supplier" className="text-xs font-medium text-gray-400">
                        Supplier <span className="text-gray-600">(optional)</span>
                      </Label>
                      <Input
                        id="supplier"
                        value={formData.supplier}
                        onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                        placeholder="Supplier name…"
                        className="h-9 border-yellow-500/20 bg-[#1a1a1a] text-white placeholder:text-gray-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes" className="text-xs font-medium text-gray-400">
                        Notes <span className="text-gray-600">(optional)</span>
                      </Label>
                      <Input
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Short note…"
                        className="h-9 border-yellow-500/20 bg-[#1a1a1a] text-white placeholder:text-gray-500"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] leading-relaxed text-gray-500">
                    New lines are always <strong className="text-gray-400">To buy</strong>. Enter amounts and mark paid on the table below (fastest). Use{" "}
                    <strong className="text-gray-400">Register purchase</strong> to post straight to Finance.
                  </p>

                  <div className="flex gap-3 justify-end">
                    <Button type="button" variant="outline" onClick={resetForm} className="border-yellow-500/30 text-gray-200 hover:bg-yellow-500/10">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createItem.isPending || updateItem.isPending}
                      className="bg-yellow-400 text-black hover:bg-yellow-300"
                    >
                      {editingItem ? "Update" : "Save"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Pending list — spreadsheet-style table */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="mx-auto h-16 w-16 animate-spin rounded-full border-b-2 border-yellow-400"></div>
              <p className="mt-4 text-gray-400">Loading list…</p>
            </div>
          ) : pendingListRows.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-yellow-500/25 bg-[#1a1a1a] shadow-inner">
              <table className="w-full min-w-[44rem] border-collapse text-sm">
                <caption className="sr-only">Shopping list, pending items</caption>
                <thead>
                  <tr className="border-b border-yellow-500/25 bg-[#2a2818] text-left text-xs font-semibold uppercase tracking-wide text-yellow-200/90">
                    <th scope="col" className="px-3 py-2.5">
                      Item
                    </th>
                    <th scope="col" className="hidden px-2 py-2.5 sm:table-cell">
                      Category
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      Due
                    </th>
                    <th scope="col" className="px-2 py-2.5">
                      <span className="block">Sum</span>
                      <span className="block text-[10px] font-normal normal-case text-yellow-200/60">MXN</span>
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-center">
                      Pay
                    </th>
                    <th scope="col" className="px-2 py-2.5 text-right">
                      ···
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingListRows.map((item, idx) => {
                    const cat = categories.find((c) => c.id === item.category);
                    return (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-yellow-500/10 transition-colors hover:bg-yellow-500/[0.04]",
                        idx % 2 === 0 ? "bg-[#242424]/90" : "bg-[#1e1e18]/90",
                      )}
                    >
                      <td className="max-w-[13rem] px-3 py-2 align-middle font-medium text-gray-100">
                        <span className="line-clamp-2 leading-snug">{item.item_name}</span>
                        {(() => {
                          const q = Number(item.quantity);
                          const u = String(item.unit || "");
                          const show =
                            (Number.isFinite(q) && q !== 1) || (u.length > 0 && u !== "units");
                          return show ? (
                            <span className="mt-0.5 block text-[11px] font-normal text-gray-500">
                              {item.quantity} {item.unit}
                            </span>
                          ) : null;
                        })()}
                        <span className="mt-1 inline-flex sm:hidden">
                          {cat ? (
                            <span className={cn("rounded px-1.5 py-0.5 text-[10px]", cat.color)}>
                              {cat.icon} {cat.name}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="hidden max-w-[7rem] px-2 py-2 align-middle sm:table-cell">
                        {cat ? (
                          <span className={cn("inline-flex max-w-full items-center gap-1 truncate rounded px-2 py-0.5 text-[11px]", cat.color)}>
                            <span className="shrink-0">{cat.icon}</span>
                            <span className="truncate">{cat.name}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 align-middle text-[12px] text-gray-300">
                        {formatShoppingDueDate(item.due_date) ?? "—"}
                      </td>
                      <td className="w-[7rem] min-w-[6.5rem] px-1 py-1.5 align-middle">
                        <Input
                          type="text"
                          inputMode="decimal"
                          aria-label={`Amount for ${item.item_name}`}
                          value={amountDraftById[item.id] ?? ""}
                          onChange={(e) =>
                            setAmountDraftById((prev) => ({ ...prev, [item.id]: e.target.value }))
                          }
                          onBlur={() => commitPendingRowEstimatedCost(item)}
                          placeholder="0"
                          className={cn(
                            "h-8 border-yellow-500/25 bg-[#141414] px-2 text-[13px] text-white tabular-nums",
                            "[appearance:textfield] [-moz-appearance:textfield]",
                            "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                          )}
                        />
                      </td>
                      <td className="px-1 py-1.5 align-middle">
                        <div className="flex flex-wrap items-center justify-center gap-0.5">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title="Mark paid — company cash"
                            disabled={updateItem.isPending || createExpense.isPending}
                            onClick={() => finalizePurchaseFromList(item, "company_cash")}
                            className="h-8 w-8 border-yellow-500/35 text-yellow-200 hover:bg-yellow-500/15"
                          >
                            <Banknote className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title="Mark paid — company account / card"
                            disabled={updateItem.isPending || createExpense.isPending}
                            onClick={() => finalizePurchaseFromList(item, "company_account")}
                            className="h-8 w-8 border-yellow-500/35 text-yellow-200 hover:bg-yellow-500/15"
                          >
                            <Landmark className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title="Mark paid — individual"
                            disabled={updateItem.isPending || createExpense.isPending}
                            onClick={() => finalizePurchaseFromList(item, "individual")}
                            className="h-8 w-8 border-yellow-500/35 text-yellow-200 hover:bg-yellow-500/15"
                          >
                            <User className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 align-middle text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-yellow-500/30 text-gray-200 hover:bg-yellow-500/10"
                            onClick={() => handleEdit(item)}
                            aria-label="Edit row"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-yellow-500/30 text-red-400 hover:bg-red-950/40 hover:text-red-300"
                            onClick={() => handleDelete(item.id)}
                            aria-label="Remove row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
              <CardContent className="py-16 text-center">
                <ShoppingCart className="mx-auto mb-4 h-14 w-14 text-gray-500" />
                <p className="text-lg text-gray-400">Nothing left to buy</p>
                <p className="mt-1 text-sm text-gray-500">
                  Use <strong className="text-gray-400">Add to list</strong> or quick-add above, or open{" "}
                  <strong className="text-gray-400">Register purchase</strong> when you have already paid.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
          </>
        )}

        {mainTab === "purchase" && (
          <>
            <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
              <h2 className="text-sm font-bold text-yellow-400">Register purchase</h2>
              <p className="mt-1 text-xs text-gray-400">
                Pick <strong className="text-gray-300">Shopping</strong> for a custom name, or any menu line below. Then enter
                amount, whether you paid <strong className="text-gray-300">cash</strong> or <strong className="text-gray-300">card</strong>, the
                Mexico <strong className="text-gray-300">date and time</strong> of the purchase, then save. Use one date/time for several lines from the same trip.
              </p>
            </div>

            <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-yellow-100">Purchase</CardTitle>
                <p className="text-xs text-gray-400">
                  Same pill row: <strong className="text-gray-300">Shopping</strong> first (then type the name), or choose a catalog ingredient.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 pt-0">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium text-gray-400">1 — Pick purchase</Label>
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      Shopping is for anything not in the pills — you will name it below. Other pills use menu-derived names plus
                      kitchen quick picks (English).
                    </p>
                  </div>
                  <div className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-yellow-500/15 bg-[#1a1a1a]/80 p-3 [scrollbar-color:rgba(250,204,21,0.35)_transparent]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title="Custom purchase — enter name below"
                      onClick={() => {
                        setQuickMenuIngredient(PURCHASE_PICK_SHOPPING);
                        queueMicrotask(() => quickShoppingNameInputRef.current?.focus());
                      }}
                      className={filterPillClass(quickMenuIngredient === PURCHASE_PICK_SHOPPING)}
                    >
                      <span className="truncate">Shopping</span>
                    </Button>
                    {shoppingPillLabels.map((ing) => (
                      <Button
                        key={`purchase-pick-${ing}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        title={ing}
                        onClick={() => {
                          setQuickMenuIngredient(ing);
                          setQuickShoppingLabel("");
                          queueMicrotask(() => quickAmountInputRef.current?.focus());
                        }}
                        className={filterPillClass(quickMenuIngredient === ing)}
                      >
                        <span className="truncate">{ing}</span>
                      </Button>
                    ))}
                  </div>
                  {shoppingPillLabels.length === 0 && (
                    <p className="text-[11px] text-gray-500">
                      No quick picks available — use <strong className="text-gray-400">Shopping</strong> and type a name, or add
                      menu items under Menu Management.
                    </p>
                  )}
                </div>

                {quickMenuIngredient === PURCHASE_PICK_SHOPPING && (
                  <div className="space-y-2">
                    <Label htmlFor="quick-shopping-name" className="text-xs font-medium text-gray-400">
                      Purchase name <span className="text-amber-400/90">(required)</span>
                    </Label>
                    <Input
                      ref={quickShoppingNameInputRef}
                      id="quick-shopping-name"
                      value={quickShoppingLabel}
                      onChange={(e) => setQuickShoppingLabel(e.target.value)}
                      placeholder="e.g. wholesale run, packaging, services, supplies…"
                      autoComplete="off"
                      className="border-yellow-500/20 bg-[#1a1a1a] text-white placeholder:text-gray-500"
                      aria-required
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs font-medium text-gray-400">2 — Amount paid (MXN)</Label>
                    <Input
                      ref={quickAmountInputRef}
                      type="text"
                      inputMode="decimal"
                      value={quickAmount}
                      onChange={(e) => setQuickAmount(e.target.value)}
                      placeholder="0"
                      className={cn(
                        "border-yellow-500/20 bg-[#1a1a1a] text-white placeholder:text-gray-500 [appearance:textfield] [-moz-appearance:textfield]",
                        "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                      )}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label className="text-xs font-medium text-gray-400">Purchase date</Label>
                    <Popover open={purchaseDateOpen} onOpenChange={setPurchaseDateOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-yellow-500/20 bg-[#1a1a1a] px-3 py-2 text-sm shadow-sm transition-colors hover:border-yellow-500/35 hover:bg-[#202020] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-yellow-500/40"
                          aria-label="Choose purchase date"
                        >
                          <span className="tabular-nums text-gray-100">
                            {formatMexicoDateShortEn(quickPurchaseDate)}
                          </span>
                          <CalendarIcon className="h-4 w-4 shrink-0 text-yellow-400/85" aria-hidden />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto border border-yellow-500/25 bg-[#242424] p-0 text-gray-100 shadow-lg"
                        align="start"
                      >
                        <DayPickerCalendar
                          mode="single"
                          locale={enUS}
                          selected={parseISO(`${quickPurchaseDate}T12:00:00`)}
                          onSelect={(d) => {
                            if (d) {
                              setQuickPurchaseDate(getMexicoDateKey(d));
                              setPurchaseDateOpen(false);
                            }
                          }}
                          initialFocus
                          className="p-2"
                          classNames={{
                            months: "flex flex-col sm:flex-row",
                            month: "space-y-3",
                            caption: "flex justify-center pt-1 relative items-center",
                            caption_label: "text-sm font-medium text-yellow-200",
                            nav: "space-x-1 flex items-center",
                            nav_button: cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-md border border-yellow-500/25 bg-transparent p-0 text-yellow-300 opacity-80 hover:bg-yellow-500/10 hover:opacity-100",
                            ),
                            nav_button_previous: "absolute left-1",
                            nav_button_next: "absolute right-1",
                            head_cell: "w-8 text-[0.7rem] font-normal text-gray-500",
                            row: "mt-1 flex w-full",
                            cell: "relative p-0 text-center text-sm",
                            day: cn(
                              "h-8 w-8 rounded-md p-0 font-normal text-gray-200",
                              "hover:bg-yellow-500/15 hover:text-white focus:bg-yellow-500/15",
                            ),
                            day_selected:
                              "!bg-yellow-400 !text-black hover:!bg-yellow-300 hover:!text-black focus:!bg-yellow-400 focus:!text-black",
                            day_today: "bg-yellow-500/12 text-yellow-200",
                            day_outside: "text-gray-600 opacity-60",
                            day_disabled: "text-gray-600 opacity-40",
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                    <div className="mt-2 space-y-1.5">
                      <Label className="text-xs font-medium text-gray-400">Purchase time (Mexico)</Label>
                      <MexicoWallTimePicker
                        value={quickPurchaseTime}
                        onChange={(v) => setQuickPurchaseTime(v)}
                        className="w-full justify-center sm:justify-start"
                      />
                      <p className="text-[10px] text-gray-600">
                        Uses America/Mexico_City — same clock as Daily Cash and Finance.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-gray-400">3 — Paid with</Label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickPurchasePayment("cash")}
                      className={cn(
                        "inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors sm:max-w-[12rem]",
                        quickPurchasePayment === "cash"
                          ? "border-yellow-400 bg-yellow-400/15 text-yellow-100"
                          : "border-yellow-500/20 bg-[#1a1a1a] text-gray-400 hover:border-yellow-500/40 hover:text-gray-200",
                      )}
                    >
                      <Banknote className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickPurchasePayment("card")}
                      className={cn(
                        "inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors sm:max-w-[12rem]",
                        quickPurchasePayment === "card"
                          ? "border-yellow-400 bg-yellow-400/15 text-yellow-100"
                          : "border-yellow-500/20 bg-[#1a1a1a] text-gray-400 hover:border-yellow-500/40 hover:text-gray-200",
                      )}
                    >
                      <CreditCard className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      Card
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Cash posts to company cash; card posts to company account (same as Finance expenses).
                  </p>
                </div>

                <Button
                  type="button"
                  className="bg-yellow-400 text-black hover:bg-yellow-300"
                  disabled={createItem.isPending || createExpense.isPending || updateItem.isPending}
                  onClick={handleQuickLogPurchase}
                >
                  Register purchase
                </Button>

                {recentPurchaseEntries.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/10 bg-[#1a1a1a] p-3">
                    <p className="mb-2 text-xs font-semibold text-yellow-400/90">Recorded this session</p>
                    <ul className="max-h-44 space-y-1.5 overflow-y-auto text-xs [scrollbar-color:rgba(250,204,21,0.35)_transparent]">
                      {recentPurchaseEntries.map((e) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between gap-3 border-b border-yellow-500/5 pb-1.5 last:border-0 last:pb-0"
                        >
                          <span className="min-w-0 truncate text-gray-300">{e.name}</span>
                          <span className="shrink-0 tabular-nums font-medium text-yellow-400/90">${formatMoneyCompact(e.amount)} MXN</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Card className="border-2 border-yellow-500/35 bg-[#1c1c14] text-gray-200 shadow-none">
          <CardHeader className="flex flex-col gap-4 border-b border-yellow-500/25 bg-yellow-500/[0.12] pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base text-yellow-100">Registered purchases</CardTitle>
                <p className="mt-1 text-xs text-yellow-200/70">
                  Finance rows from this shopping flow. Pick a month to filter the table and the total.                   Click amount or date to edit (Enter or blur saves); use the trash icon to remove a row.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={registeredPurchasesForMonth.length === 0}
                onClick={handleExportShoppingPurchasesCsv}
                className="no-print h-9 shrink-0 gap-2 border border-yellow-400/40 bg-yellow-500/20 text-xs text-yellow-100 hover:bg-yellow-500/30 disabled:opacity-40"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Open in Excel
              </Button>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-yellow-200/85">Month</Label>
                <Popover open={registeredMonthPopoverOpen} onOpenChange={setRegisteredMonthPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-9 min-w-[12.5rem] items-center justify-between gap-2 rounded-lg border border-yellow-500/25 bg-[#1a1a1a] px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-yellow-500/40 hover:bg-[#222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/35"
                      aria-label="Select month for registered purchases"
                    >
                      <span className="tabular-nums text-gray-100">{registeredMonthLabel}</span>
                      <CalendarRange className="h-4 w-4 shrink-0 text-yellow-400/85" aria-hidden />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[min(calc(100vw-2rem),18rem)] border border-yellow-500/30 bg-[#1e1e18] p-3 text-gray-100 shadow-xl"
                    align="start"
                  >
                    <div className="mb-3 flex items-center justify-between border-b border-yellow-500/15 pb-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-yellow-500/20 text-yellow-400 transition-colors hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                        disabled={parsedRegisteredMonth.year <= REGISTERED_PURCHASES_MIN_YEAR}
                        aria-label="Previous year"
                        onClick={() =>
                          setRegisteredYearMonth(parsedRegisteredMonth.year - 1, parsedRegisteredMonth.monthIndex)
                        }
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-sm font-semibold tabular-nums text-yellow-100">
                        {parsedRegisteredMonth.year}
                      </span>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-yellow-500/20 text-yellow-400 transition-colors hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-30"
                        disabled={parsedRegisteredMonth.year >= new Date().getFullYear() + 1}
                        aria-label="Next year"
                        onClick={() =>
                          setRegisteredYearMonth(parsedRegisteredMonth.year + 1, parsedRegisteredMonth.monthIndex)
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {REGISTERED_MONTH_SHORT.map((label, i) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            setRegisteredYearMonth(parsedRegisteredMonth.year, i);
                            setRegisteredMonthPopoverOpen(false);
                          }}
                          className={cn(
                            "rounded-lg px-2 py-2 text-center text-xs font-medium transition-colors",
                            parsedRegisteredMonth.monthIndex === i
                              ? "bg-yellow-400 text-black shadow-sm hover:bg-yellow-300"
                              : "border border-transparent bg-[#2a2818] text-gray-200 hover:border-yellow-500/25 hover:bg-yellow-500/10 hover:text-yellow-50",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div
                role="tablist"
                aria-label="Registered purchases view"
                className="inline-flex h-9 shrink-0 items-center rounded-lg border border-yellow-500/25 bg-[#1a1a1a] p-0.5"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={registeredView === "rows"}
                  onClick={() => setRegisteredView("rows")}
                  className={cn(
                    "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                    registeredView === "rows"
                      ? "bg-yellow-400 text-black shadow-sm"
                      : "text-gray-300 hover:bg-yellow-500/10 hover:text-yellow-50",
                  )}
                >
                  By purchase
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={registeredView === "products"}
                  onClick={() => setRegisteredView("products")}
                  className={cn(
                    "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                    registeredView === "products"
                      ? "bg-yellow-400 text-black shadow-sm"
                      : "text-gray-300 hover:bg-yellow-500/10 hover:text-yellow-50",
                  )}
                >
                  By product
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {shoppingPurchaseRows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                No shopping-linked purchases in Finance yet. Use Register purchase or mark list lines as purchased.
              </p>
            ) : (
              <>
                <div className="px-4 pb-4 pt-4">
                  <div
                    className={cn(
                      "rounded-xl border-2 border-yellow-400/40 bg-gradient-to-br from-yellow-500/[0.12] via-[#1a1808] to-[#141410]",
                      "px-5 py-4 shadow-[inset_0_1px_0_0_rgba(250,204,21,0.15)]",
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-400/75">
                          Month total
                        </p>
                        <p className="text-sm font-medium text-yellow-100/95">{registeredMonthLabel}</p>
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {registeredPurchasesForMonth.length}{" "}
                          {registeredPurchasesForMonth.length === 1 ? "purchase" : "purchases"} in selection
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold tabular-nums tracking-tight text-yellow-300 sm:text-3xl">
                          ${formatMoneyCompact(registeredPurchasesMonthTotal)}
                          <span className="ml-1.5 text-sm font-medium text-yellow-500/65">MXN</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {registeredPurchasesForMonth.length === 0 ? (
                  <p className="border-t border-yellow-500/15 px-4 py-8 text-center text-sm text-gray-400">
                    No purchases in {registeredMonthLabel}. Choose another month or register a purchase for this period.
                  </p>
                ) : registeredView === "products" ? (
                  <div className="overflow-x-auto border-t border-yellow-500/15">
                    <table className="w-full min-w-[480px] border-collapse text-left text-[11px] sm:text-xs">
                      <thead>
                        <tr className="border-b border-yellow-500/40 bg-yellow-500/20 text-[10px] font-semibold uppercase tracking-wide text-yellow-100">
                          <th className="border-r border-yellow-500/30 px-3 py-2.5">Product</th>
                          <th className="border-r border-yellow-500/20 px-3 py-2.5 text-right">Total (MXN)</th>
                          <th className="px-3 py-2.5 text-right">Purchases</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registeredProductsForMonth.map((p, i) => {
                          const share =
                            registeredPurchasesMonthTotal > 0
                              ? (p.total / registeredPurchasesMonthTotal) * 100
                              : 0;
                          return (
                            <tr
                              key={p.key}
                              className={cn(
                                "border-b border-yellow-500/15 transition-colors hover:bg-yellow-500/[0.06]",
                                i % 2 === 1 && "bg-black/20",
                              )}
                            >
                              <td className="border-r border-yellow-500/15 px-3 py-2 font-medium text-yellow-100/95">
                                {p.name}
                              </td>
                              <td className="border-r border-yellow-500/15 px-3 py-2 text-right font-mono tabular-nums text-amber-200/90">
                                ${formatMoneyCompact(p.total)}
                                {share > 0 && (
                                  <span className="ml-2 text-[10px] font-normal text-gray-500">
                                    {share.toFixed(1)}%
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-gray-300">{p.count}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-yellow-500/30 bg-yellow-500/[0.08] text-sm font-semibold text-yellow-100">
                          <td className="border-r border-yellow-500/20 px-3 py-2.5">Month total</td>
                          <td className="border-r border-yellow-500/20 px-3 py-2.5 text-right font-mono tabular-nums">
                            ${formatMoneyCompact(registeredPurchasesMonthTotal)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-300">
                            {registeredPurchasesForMonth.length}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto border-t border-yellow-500/15">
                    <table className="w-full min-w-[560px] border-collapse text-left text-[11px] sm:text-xs">
                      <thead>
                        <tr className="border-b border-yellow-500/40 bg-yellow-500/20 text-[10px] font-semibold uppercase tracking-wide text-yellow-100">
                          <th className="border-r border-yellow-500/30 px-3 py-2.5">Purchase</th>
                          <th className="border-r border-yellow-500/20 px-3 py-2.5 text-right">Sum (MXN)</th>
                          <th className="border-r border-yellow-500/20 px-3 py-2.5">Date</th>
                          <th className="w-10 px-1 py-2.5 text-center">
                            <span className="sr-only">Delete</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {registeredPurchasesForMonth.map((r, i) => (
                          <tr
                            key={r.id}
                            className={cn(
                              "border-b border-yellow-500/15 transition-colors hover:bg-yellow-500/[0.06]",
                              i % 2 === 1 && "bg-black/20",
                            )}
                          >
                            <td className="border-r border-yellow-500/15 px-3 py-2 font-medium text-yellow-100/95">{r.name}</td>
                            <td className="border-r border-yellow-500/15 px-2 py-1.5 text-right align-middle">
                              {editingRegisteredAmountId === r.id ? (
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  autoFocus
                                  disabled={patchExpenseRow.isPending}
                                  value={editingRegisteredAmountDraft}
                                  onChange={(e) => setEditingRegisteredAmountDraft(e.target.value)}
                                  onBlur={(e) => void commitRegisteredAmountEdit(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void commitRegisteredAmountEdit(r, e.currentTarget.value);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingRegisteredAmountId(null);
                                    }
                                  }}
                                  className={cn(
                                    "h-8 border-yellow-500/40 bg-[#141410] text-right font-mono text-sm text-amber-200 [appearance:textfield] [-moz-appearance:textfield]",
                                    "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                  )}
                                  aria-label="Edit amount MXN"
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled={patchExpenseRow.isPending}
                                  onClick={() => startEditingRegisteredAmount(r)}
                                  className="min-h-8 w-full min-w-[5.5rem] rounded border border-transparent px-2 py-1 text-right font-mono tabular-nums text-amber-200/90 transition-colors hover:border-yellow-500/35 hover:bg-yellow-500/10"
                                >
                                  ${formatMoneyCompact(r.amount)}
                                </button>
                              )}
                            </td>
                            <td className="border-r border-yellow-500/15 px-2 py-1.5 align-middle">
                              {editingRegisteredDateId === r.id ? (
                                <Input
                                  type="date"
                                  autoFocus
                                  disabled={patchExpenseRow.isPending}
                                  value={editingRegisteredDateDraft}
                                  onChange={(e) => setEditingRegisteredDateDraft(e.target.value)}
                                  onBlur={(e) => void commitRegisteredDateEdit(r, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void commitRegisteredDateEdit(r, e.currentTarget.value);
                                    }
                                    if (e.key === "Escape") {
                                      setEditingRegisteredDateId(null);
                                    }
                                  }}
                                  className="h-8 border-yellow-500/40 bg-[#141410] text-sm text-gray-200 [color-scheme:dark]"
                                  aria-label="Edit purchase date"
                                />
                              ) : (
                                <button
                                  type="button"
                                  disabled={patchExpenseRow.isPending}
                                  onClick={() => startEditingRegisteredDate(r)}
                                  className="min-h-8 w-full min-w-[7.5rem] rounded border border-transparent px-2 py-1 text-left tabular-nums text-gray-300 transition-colors hover:border-yellow-500/35 hover:bg-yellow-500/10"
                                >
                                  {r.dateIso ? formatMexicoDateShortEn(r.dateIso) : "—"}
                                </button>
                              )}
                            </td>
                            <td className="px-1 py-1 text-center align-middle">
                              <button
                                type="button"
                                disabled={removeRegisteredPurchase.isPending || patchExpenseRow.isPending}
                                onClick={() => handleDeleteRegisteredRow(r)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 opacity-70 transition-colors hover:bg-red-950/45 hover:text-red-400 hover:opacity-100 disabled:opacity-30"
                                aria-label="Delete row"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.25} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-yellow-500/30 bg-yellow-500/[0.08] text-sm font-semibold text-yellow-100">
                          <td className="border-r border-yellow-500/20 px-3 py-2.5">Month total</td>
                          <td className="border-r border-yellow-500/20 px-3 py-2.5 text-right font-mono tabular-nums">
                            ${formatMoneyCompact(registeredPurchasesMonthTotal)}
                          </td>
                          <td className="border-r border-yellow-500/20 px-3 py-2.5 text-gray-500" />
                          <td className="px-1 py-2.5" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
