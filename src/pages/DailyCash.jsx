import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, endOfDay, isSameDay, startOfDay, subDays } from "date-fns";
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { appParams } from "@/lib/app-params";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { buildMergedCanonicalEvents, filterCanonicalEventsByDateRange } from "@/lib/mergedSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { listOrders, updateOrderEntity } from "@/lib/local-dev-orders";
import {
  isLocalFinanceMode,
  localCreateCompanyTransaction,
  localDeleteCompanyTransaction,
  localListCompanyTransactions,
  localListExpenses,
  localListShifts,
  localUpdateCompanyTransaction,
  localUpdateExpense,
} from "@/lib/localDevFinance";
import {
  addManualLine,
  getDetailOverrides,
  getManualLines,
  getOpeningBalance,
  removeManualLine,
  setDetailOverride,
  setOpeningBalance,
  updateManualLine,
} from "@/lib/dailyCashLocal";
import {
  dateFromMexicoDateKey,
  formatMexicoLongDateEn,
  formatMexicoTime,
  formatMexicoWeekdayLongEn,
  getMexicoDateKey,
  getMexicoNowDateKey,
  matchesMexicoCalendarDay,
} from "@/lib/mexicoTime";

/** Marks rows created from Daily Cash so they can be removed / undone from this page */
const DAILY_CASH_TX_MARKER = "los_tios:daily_cash";

function dayKey(d) {
  return getMexicoDateKey(d);
}

function formatMx(value) {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function rowTimeLabel(iso) {
  return formatMexicoTime(iso);
}

function matchesDay(isoDate, key) {
  return matchesMexicoCalendarDay(isoDate, key);
}

/** Map edited ledger detail back to Order.customer_name (display is `Order · ${name}`). */
function detailEditToCustomerName(text) {
  const t = text.trim();
  const prefix = "Order · ";
  if (t.startsWith(prefix)) {
    return t.slice(prefix.length).trim() || "Customer";
  }
  return t || "Customer";
}

function LedgerDetailCell({ displayDetail, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayDetail);
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDraft(displayDetail);
    }
  }, [displayDetail, editing]);

  const submit = () => {
    const p = onCommit(draft);
    Promise.resolve(p).finally(() => setEditing(false));
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (skipBlurCommit.current) {
            skipBlurCommit.current = false;
            return;
          }
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            skipBlurCommit.current = true;
            setDraft(displayDetail);
            setEditing(false);
          }
        }}
        className="h-8 border-yellow-500/40 bg-[#0f0f0c] text-sm text-gray-200"
      />
    );
  }

  return (
    <button
      type="button"
      className="w-full min-w-[6rem] rounded px-1 py-0.5 text-left text-gray-400 hover:bg-yellow-500/10 hover:text-gray-200"
      onClick={() => {
        skipBlurCommit.current = false;
        setDraft(displayDetail);
        setEditing(true);
      }}
    >
      {displayDetail || "—"}
    </button>
  );
}

/** Align with Loyverse overview: exclude voided / cancelled receipts */
function isLoyverseReceiptCompleted(receipt) {
  const status =
    receipt?.status ||
    receipt?.receipt_status ||
    (receipt?.canceled_at ? "cancelled" : "completed");
  return !String(status).toLowerCase().includes("cancel");
}

export default function DailyCash() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => dateFromMexicoDateKey(getMexicoNowDateKey()));
  const dayStr = dayKey(selectedDate);
  const useLocalFinance = isLocalFinanceMode();
  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" || !appParams.appId || !appParams.serverUrl);

  const dayWindow = useMemo(
    () => ({ start: startOfDay(selectedDate), end: endOfDay(selectedDate) }),
    [selectedDate],
  );

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });
  const appSettings = useMemo(() => getResolvedIntegrationSettings(settings[0] || {}), [settings]);

  const loyverseQuery = useQuery({
    queryKey: ["dailyCashLoyverse", settings[0]?.id || "none", dayStr],
    queryFn: () =>
      getLoyverseOverview(appSettings, {
        start: dayWindow.start,
        end: dayWindow.end,
      }),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });
  const loyverseOverview = loyverseQuery.data;

  const [openingInput, setOpeningInput] = useState("");
  const [storeTick, setStoreTick] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [manualNote, setManualNote] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDir, setManualDir] = useState("in");

  /** @type {null | { kind: 'legacy'; dayStr: string; line: object } | { kind: 'registered'; snapshot: object }} */
  const [lastRemovedManual, setLastRemovedManual] = useState(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), "-created_date"),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["companyTransactions", useLocalFinance ? "local" : "remote"],
    queryFn: () =>
      useLocalFinance
        ? localListCompanyTransactions()
        : base44.entities.CompanyTransaction.list("-date"),
  });

  const createCompanyTx = useMutation({
    mutationFn: (data) =>
      useLocalFinance ? localCreateCompanyTransaction(data) : base44.entities.CompanyTransaction.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyTransactions"] });
    },
  });

  const deleteCompanyTx = useMutation({
    mutationFn: (id) =>
      useLocalFinance ? localDeleteCompanyTransaction(id) : base44.entities.CompanyTransaction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyTransactions"] });
    },
  });

  const saveTransactionDescription = useMutation({
    mutationFn: ({ id, data }) =>
      useLocalFinance
        ? localUpdateCompanyTransaction(id, data)
        : base44.entities.CompanyTransaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyTransactions"] });
    },
  });

  const saveOrderDetail = useMutation({
    mutationFn: ({ id, data }) =>
      updateOrderEntity(id, data, (orderId, payload) => base44.entities.Order.update(orderId, payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const saveExpenseDetail = useMutation({
    mutationFn: ({ id, data }) =>
      useLocalFinance ? localUpdateExpense(id, data) : base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListExpenses() : base44.entities.Expense.list("-date")),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListShifts() : base44.entities.Shift.list("-date")),
  });

  const unpaidShiftLaborDay = useMemo(() => {
    return shifts
      .filter((s) => matchesDay(s.date, dayStr) && s.status !== "cancelled" && s.status !== "paid")
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }, [shifts, dayStr]);

  useEffect(() => {
    const v = getOpeningBalance(dayStr);
    setOpeningInput(v === null ? "" : String(v));
  }, [dayStr, storeTick]);

  const persistOpening = useCallback(() => {
    const trimmed = openingInput.trim();
    if (trimmed === "") {
      setOpeningBalance(dayStr, null);
    } else {
      const n = parseFloat(trimmed.replace(",", "."));
      if (Number.isFinite(n)) {
        setOpeningBalance(dayStr, n);
      }
    }
    setStoreTick((t) => t + 1);
  }, [dayStr, openingInput]);

  const manualLines = useMemo(() => getManualLines(dayStr), [dayStr, storeTick]);

  const detailOverrides = useMemo(() => getDetailOverrides(dayStr), [dayStr, storeTick]);

  const loyverseCashRows = useMemo(() => {
    if (!loyverseOverview?.receipts?.length) return [];
    const receipts = loyverseOverview.receipts.filter(isLoyverseReceiptCompleted);
    if (!receipts.length) return [];
    const { canonicalEvents } = buildMergedCanonicalEvents({
      receipts,
      clipPayments: [],
      contributionTransactions: [],
      stores: loyverseOverview.stores || [],
      paymentSource: "Cash",
      branch: "All branches",
      channel: "All channels",
    });
    const inRange = filterCanonicalEventsByDateRange(
      canonicalEvents,
      dayWindow.start,
      dayWindow.end,
    );
    return inRange
      .filter((e) => e.source === "loyverse")
      .map((event) => {
        const receipt = event.payload;
        const rid = receipt?.id ?? event.id;
        const parts = [];
        if (receipt?.receipt_number != null && String(receipt.receipt_number).trim() !== "") {
          parts.push(`#${receipt.receipt_number}`);
        }
        if (event.branch) {
          parts.push(event.branch);
        }
        const detail = parts.length > 0 ? parts.join(" · ") : "Sale (cash)";
        const timeIso = receipt?.created_at ?? receipt?.receipt_date ?? event.timestamp;
        return {
          id: `loyverse-${rid}`,
          sortTime: event.timestamp.getTime(),
          timeLabel: rowTimeLabel(timeIso),
          source: "Loyverse POS",
          detail,
          inAmount: event.amount,
          outAmount: null,
        };
      });
  }, [loyverseOverview, dayWindow.start, dayWindow.end]);

  const tableRows = useMemo(() => {
    const rows = [];

    for (const o of orders) {
      if (!matchesDay(o.created_date, dayStr)) continue;
      if (o.payment_method !== "cash" || o.status !== "delivered") continue;
      const amt = Number(o.total_amount || 0);
      rows.push({
        id: `order-${o.id}`,
        sortTime: new Date(o.created_date || 0).getTime(),
        timeLabel: rowTimeLabel(o.created_date),
        source: "Customer order",
        detail: o.customer_name ? `Order · ${o.customer_name}` : "Order (cash)",
        inAmount: amt,
        outAmount: null,
      });
    }

    for (const lv of loyverseCashRows) {
      rows.push(lv);
    }

    for (const t of transactions) {
      if (!matchesDay(t.date, dayStr)) continue;
      if (t.payment_method !== "cash") continue;
      const amt = Number(t.amount || 0);
      const isDailyCashRegistered =
        String(t.notes || "") === DAILY_CASH_TX_MARKER || String(t.notes || "").includes(DAILY_CASH_TX_MARKER);
      const whenIso = t.created_date || `${String(t.date).slice(0, 10)}T12:00:00`;
      if (t.type === "contribution") {
        rows.push({
          id: `tx-in-${t.id}`,
          sortTime: new Date(whenIso).getTime(),
          timeLabel: rowTimeLabel(whenIso),
          source: isDailyCashRegistered ? "Manual cash" : "Company transaction",
          detail: t.description || t.contributor_name || "Cash contribution",
          inAmount: amt,
          outAmount: null,
          isRegisteredManual: isDailyCashRegistered,
          transactionId: t.id,
        });
      } else if (t.type === "withdrawal") {
        rows.push({
          id: `tx-out-${t.id}`,
          sortTime: new Date(whenIso).getTime(),
          timeLabel: rowTimeLabel(whenIso),
          source: isDailyCashRegistered ? "Manual cash" : "Company transaction",
          detail: t.description || t.contributor_name || "Cash withdrawal",
          inAmount: null,
          outAmount: amt,
          isRegisteredManual: isDailyCashRegistered,
          transactionId: t.id,
        });
      }
    }

    for (const e of expenses) {
      if (!matchesDay(e.date, dayStr)) continue;
      if (e.payment_source !== "company_cash") continue;
      const amt = Number(e.amount || 0);
      const fromShopping = Boolean(e.from_shopping_list);
      const whenIso =
        e.created_date ||
        (e.date ? `${String(e.date).slice(0, 10)}T12:00:00` : `${dayStr}T12:00:00`);
      rows.push({
        id: `exp-${e.id}`,
        sortTime: new Date(whenIso).getTime(),
        timeLabel: rowTimeLabel(whenIso),
        source: fromShopping ? "Register purchase" : "Expense (cash)",
        detail: e.name || e.category || (fromShopping ? "Purchase" : "Expense"),
        inAmount: null,
        outAmount: amt,
      });
    }

    for (const m of manualLines) {
      const amt = Number(m.amount || 0);
      const isIn = m.direction === "in";
      rows.push({
        id: `man-${m.id}`,
        sortTime: new Date(m.createdAt || `${dayStr}T12:00:00`).getTime(),
        timeLabel: rowTimeLabel(m.createdAt),
        source: "Manual adjustment",
        detail: m.note || "Adjustment",
        inAmount: isIn ? amt : null,
        outAmount: isIn ? null : amt,
        isManual: true,
        manualId: m.id,
      });
    }

    rows.sort((a, b) => a.sortTime - b.sortTime);
    return rows;
  }, [orders, loyverseCashRows, transactions, expenses, manualLines, dayStr]);

  const totals = useMemo(() => {
    let cashIn = 0;
    let cashOut = 0;
    for (const r of tableRows) {
      if (r.inAmount) cashIn += r.inAmount;
      if (r.outAmount) cashOut += r.outAmount;
    }
    const net = cashIn - cashOut;
    const opening = getOpeningBalance(dayStr);
    const end =
      opening !== null && Number.isFinite(opening) ? opening + net : null;
    return { cashIn, cashOut, net, opening, end };
  }, [tableRows, dayStr, storeTick]);

  const goPrev = () => setSelectedDate((d) => subDays(d, 1));
  const goNext = () => setSelectedDate((d) => addDays(d, 1));
  const isToday = isSameDay(selectedDate, new Date());

  const handleRegisterManualCash = async () => {
    const n = parseFloat(String(manualAmount).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    const payload = {
      type: manualDir === "in" ? "contribution" : "withdrawal",
      contributor_name: "Manual cash",
      amount: n,
      date: dayStr,
      payment_method: "cash",
      description:
        manualNote.trim() || (manualDir === "in" ? "Cash in (manual)" : "Cash out (manual)"),
      notes: DAILY_CASH_TX_MARKER,
      reference_number: "",
    };
    try {
      await createCompanyTx.mutateAsync(payload);
      setManualNote("");
      setManualAmount("");
      setLastRemovedManual(null);
    } catch (e) {
      console.error(e);
      alert("Could not register cash. Check your connection and try again.");
    }
  };

  const handleRemoveRow = (row) => {
    if (row.isManual && row.manualId) {
      const full = manualLines.find((m) => m.id === row.manualId);
      removeManualLine(dayStr, row.manualId);
      setLastRemovedManual(full ? { kind: "legacy", dayStr, line: full } : null);
      setStoreTick((t) => t + 1);
      return;
    }
    if (row.isRegisteredManual && row.transactionId) {
      const snap = transactions.find((x) => x.id === row.transactionId);
      if (!snap) return;
      deleteCompanyTx.mutate(row.transactionId, {
        onSuccess: () => {
          setLastRemovedManual({ kind: "registered", snapshot: { ...snap } });
        },
      });
    }
  };

  const handleUndoManual = async () => {
    if (!lastRemovedManual) return;
    if (lastRemovedManual.kind === "legacy") {
      if (lastRemovedManual.dayStr !== dayStr) return;
      addManualLine(dayStr, lastRemovedManual.line);
      setLastRemovedManual(null);
      setStoreTick((t) => t + 1);
      return;
    }
    if (lastRemovedManual.kind === "registered" && lastRemovedManual.snapshot) {
      const { id: _id, created_date: _c, ...rest } = lastRemovedManual.snapshot;
      try {
        await createCompanyTx.mutateAsync(rest);
        setLastRemovedManual(null);
      } catch (e) {
        console.error(e);
        alert("Could not undo. Try again.");
      }
    }
  };

  const handleDetailCommit = useCallback(
    async (row, text) => {
      const trimmed = text.trim();
      const baseDetail = row.detail;

      try {
        if (row.id.startsWith("loyverse-")) {
          if (trimmed === baseDetail) {
            setDetailOverride(dayStr, row.id, null);
          } else {
            setDetailOverride(dayStr, row.id, trimmed);
          }
          setStoreTick((t) => t + 1);
          return;
        }

        if (row.id.startsWith("order-")) {
          const orderId = row.id.slice("order-".length);
          await saveOrderDetail.mutateAsync({
            id: orderId,
            data: { customer_name: detailEditToCustomerName(text) },
          });
          return;
        }

        if ((row.id.startsWith("tx-in-") || row.id.startsWith("tx-out-")) && row.transactionId) {
          const fallback = row.inAmount != null ? "Cash contribution" : "Cash withdrawal";
          await saveTransactionDescription.mutateAsync({
            id: row.transactionId,
            data: { description: trimmed || fallback },
          });
          return;
        }

        if (row.id.startsWith("exp-")) {
          const expId = row.id.slice("exp-".length);
          await saveExpenseDetail.mutateAsync({
            id: expId,
            data: { name: trimmed || "Expense" },
          });
          return;
        }

        if (row.isManual && row.manualId) {
          updateManualLine(dayStr, row.manualId, { note: trimmed || "Adjustment" });
          setStoreTick((t) => t + 1);
        }
      } catch (e) {
        console.error(e);
        alert("Could not save detail. Try again.");
      }
    },
    [dayStr, saveOrderDetail, saveTransactionDescription, saveExpenseDetail],
  );

  const weekday = formatMexicoWeekdayLongEn(selectedDate);
  const longDate = formatMexicoLongDateEn(selectedDate);

  return (
    <div className="min-h-screen bg-[#0f0f0c] text-white">
      <div className="relative overflow-hidden border-b border-yellow-500/15 bg-gradient-to-br from-[#1a1810] via-[#14120c] to-[#0c0c0a]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(250,204,21,0.12),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-500/25 bg-yellow-400/10 shadow-[0_0_24px_rgba(250,204,21,0.12)]">
                <Banknote className="h-5 w-5 text-yellow-400" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yellow-500/80">
                  Daily cash
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-yellow-100 sm:text-3xl">
                  Register & movement
                </h1>
                <p className="mt-1 max-w-xl text-sm text-gray-500">
                  Cash sales, drawer movements, and cash-paid expenses for one calendar day. Purchases logged as{" "}
                  <strong className="font-medium text-gray-400">Cash</strong> under Shopping → Register purchase appear here as{" "}
                  <strong className="font-medium text-gray-400">Register purchase</strong> (out). Start balance is saved in this
                  browser only.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:pb-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={goPrev}
                className="h-11 w-11 rounded-xl border-yellow-500/25 bg-black/20 text-yellow-200 hover:bg-yellow-500/10"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 rounded-xl border-yellow-500/25 bg-black/20 text-yellow-300 hover:bg-yellow-500/10"
                    aria-label="Pick date"
                  >
                    <CalendarDays className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto border border-yellow-500/30 bg-[#1a1810] p-2 text-gray-100 shadow-xl"
                  align="end"
                >
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => {
                      if (d) {
                        setSelectedDate(d);
                        setCalendarOpen(false);
                      }
                    }}
                    initialFocus
                    className="rounded-lg [--cell-size:2.25rem]"
                  />
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={goNext}
                className="h-11 w-11 rounded-xl border-yellow-500/25 bg-black/20 text-yellow-200 hover:bg-yellow-500/10"
                aria-label="Next day"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="relative rounded-2xl border border-yellow-500/20 bg-black/25 px-6 py-8 shadow-[inset_0_1px_0_rgba(250,204,21,0.06)] sm:px-10 sm:py-10">
            {isToday && (
              <span className="absolute right-6 top-6 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-yellow-300">
                Today
              </span>
            )}
            <p
              className="text-4xl font-extralight tracking-[-0.04em] text-yellow-50 sm:text-5xl md:text-6xl"
              style={{ fontFeatureSettings: '"ss01", "cv02"' }}
            >
              {weekday}
            </p>
            <p className="mt-2 text-lg font-medium text-yellow-500/90 sm:text-xl">{longDate}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-yellow-500/15 bg-[#161612] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Start cash</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="pb-2 text-sm text-gray-500">MXN</span>
              <Input
                type="text"
                inputMode="decimal"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                onBlur={persistOpening}
                placeholder="Count at open"
                className="h-11 border-yellow-500/20 bg-[#0f0f0c] text-xl font-semibold tabular-nums text-yellow-100 placeholder:text-gray-600"
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-600">Saved locally for this date. Blur field to save.</p>
          </div>
          <div className="rounded-xl border border-yellow-500/15 bg-[#161612] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Net cash (day)</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums",
                totals.net >= 0 ? "text-emerald-400/95" : "text-rose-400/95",
              )}
            >
              {formatMx(totals.net)}
            </p>
            <p className="mt-2 text-[11px] text-gray-600">
              In {formatMx(totals.cashIn)} · Out {formatMx(totals.cashOut)}
            </p>
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-gradient-to-br from-[#1f1c12] to-[#14120c] p-4 shadow-[0_0_40px_rgba(250,204,21,0.06)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-600/90">End cash</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-yellow-200">
              {totals.end !== null ? formatMx(totals.end) : "—"}
            </p>
            <p className="mt-2 text-[11px] text-yellow-700/80">
              {totals.opening !== null ? "Start + net for the day" : "Set start cash to calculate"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/25 bg-[#101820] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-500/90">Labor (employees)</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs text-gray-500">Scheduled shifts not yet paid from cash</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-200">{formatMx(unpaidShiftLaborDay)}</p>
            </div>
            <p className="max-w-xl text-[11px] leading-relaxed text-gray-500 sm:text-right">
              Same amounts as on the Employees calendar for this date. Salary paid from the cash drawer appears in the register
              as an expense row when you complete a shift with &quot;Complete &amp; pay&quot; (company cash). Dashboard labor
              includes both booked salary expenses and unpaid scheduled shifts.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-yellow-500/15 bg-[#161612] p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-yellow-200">Register manual cash</h2>
              <p className="text-[11px] text-gray-500">
                Creates a <strong className="text-gray-400">company cash transaction</strong> for this date (visible under Finance /
                Company account). In local dev, rows are stored in this browser.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !lastRemovedManual ||
                (lastRemovedManual.kind === "legacy" && lastRemovedManual.dayStr !== dayStr) ||
                createCompanyTx.isPending
              }
              onClick={() => void handleUndoManual()}
              className="h-8 gap-1.5 border-yellow-500/30 text-gray-200 hover:bg-yellow-500/10 disabled:opacity-30"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo last removed
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[8rem] flex-1 space-y-1.5">
              <Label className="text-[10px] text-gray-500">Note</Label>
              <Input
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="e.g. Coin bag, rounding"
                className="h-9 border-yellow-500/20 bg-[#0f0f0c] text-sm"
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-28">
              <Label className="text-[10px] text-gray-500">Amount</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 border-yellow-500/20 bg-[#0f0f0c] text-sm tabular-nums"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-yellow-500/15 bg-black/30 p-0.5">
              <button
                type="button"
                onClick={() => setManualDir("in")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  manualDir === "in" ? "bg-yellow-400 text-black" : "text-gray-400 hover:text-white",
                )}
              >
                In
              </button>
              <button
                type="button"
                onClick={() => setManualDir("out")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  manualDir === "out" ? "bg-rose-500/90 text-white" : "text-gray-400 hover:text-white",
                )}
              >
                Out
              </button>
            </div>
            <Button
              type="button"
              disabled={createCompanyTx.isPending}
              onClick={() => void handleRegisterManualCash()}
              className="h-9 gap-1.5 bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {createCompanyTx.isPending ? "Saving…" : "Register cash"}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-yellow-500/20 bg-[#10100c]">
          <div className="border-b border-yellow-500/15 bg-[#1a1810] px-4 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-600/90">Cash ledger</h2>
            <p className="text-[11px] text-gray-600">
              Includes <strong className="font-medium text-gray-500">Loyverse POS</strong> cash receipts, customer cash orders,
              Shopping <strong className="font-medium text-gray-500">Register purchase</strong> lines paid with{" "}
              <strong className="font-medium text-gray-500">Cash</strong>, other cash expenses, and manual rows above. Card-paid
              shopping purchases go to the bank account, not this drawer. Click a detail cell to edit (saved on blur or Enter);
              Loyverse labels are stored in this browser only.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-yellow-500/20 bg-[#14120c] text-left text-[10px] font-semibold uppercase tracking-wider text-yellow-600/90">
                  <th className="whitespace-nowrap px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="min-w-[12rem] px-3 py-2.5">Detail</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right text-emerald-500/90">In</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right text-rose-400/90">Out</th>
                  <th className="w-12 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-16 text-center text-gray-500">
                      No cash movements for this day.
                    </td>
                  </tr>
                ) : (
                  tableRows.map((r, i) => (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-b border-yellow-500/10 transition-colors hover:bg-yellow-500/[0.03]",
                        i % 2 === 1 ? "bg-black/20" : "bg-transparent",
                      )}
                    >
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-500">{r.timeLabel}</td>
                      <td className="px-3 py-2 text-gray-300">{r.source}</td>
                      <td className="px-2 py-1 align-middle text-gray-400">
                        <LedgerDetailCell
                          displayDetail={detailOverrides[r.id] ?? r.detail}
                          onCommit={(value) => handleDetailCommit(r, value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-300/90">
                        {r.inAmount != null ? formatMx(r.inAmount) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums text-rose-300/85">
                        {r.outAmount != null ? formatMx(r.outAmount) : "—"}
                      </td>
                      <td className="px-1 py-1 text-right">
                        {r.isManual || r.isRegisteredManual ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={deleteCompanyTx.isPending}
                            className="h-8 w-8 text-gray-500 hover:bg-rose-950/40 hover:text-rose-400 disabled:opacity-40"
                            onClick={() => handleRemoveRow(r)}
                            aria-label={r.isRegisteredManual ? "Remove registered cash entry" : "Remove manual line"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <span className="inline-block w-8" />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
