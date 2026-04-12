import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Printer,
  FileSpreadsheet,
  ShoppingCart,
  ChefHat,
  Users,
  Info,
} from "lucide-react";
import { format, endOfMonth, eachDayOfInterval, subMonths, startOfMonth, startOfDay, endOfDay, parseISO } from "date-fns";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enUS, es } from "date-fns/locale";
import { listOrders } from "@/lib/local-dev-orders";
import { getClipOverview, hasClipApiConfig } from "@/api/clip";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { cn } from "@/lib/utils";
import {
  buildMergedCanonicalEvents,
  filterCanonicalEventsByDateRange,
  sumEventAmounts,
  aggregateTopReceiptLineItems,
  countByChannel,
  getRecordDate,
} from "@/lib/mergedSales";
import { isLocalFinanceMode, localListExpenses, localListCompanyTransactions } from "@/lib/localDevFinance";
import {
  dateFromMexicoDateKey,
  formatMexicoGeneratedTimestamp,
  formatMexicoLongDateEs,
  getMexicoDateKey,
  getMexicoNowDateKey,
  getMexicoNowYearMonth,
  getMexicoYearMonthKey,
} from "@/lib/mexicoTime";

/** Calendar day for Expense.date (YYYY-MM-DD strings avoid timezone shifts). Falls back to created_* so rows still count. */
function expenseCalendarDayKey(e) {
  const raw = e?.date;
  if (raw != null && raw !== "") {
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    try {
      const d = parseISO(/^\d{4}-\d{2}-\d{2}T/.test(s) ? s : `${s.slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return getMexicoDateKey(d);
    } catch {
      /* ignore */
    }
    try {
      const k = getMexicoDateKey(raw);
      if (k) return k;
    } catch {
      /* ignore */
    }
  }
  const fallback = getRecordDate(e);
  if (!Number.isNaN(fallback.getTime()) && fallback.getTime() !== 0) {
    return getMexicoDateKey(fallback);
  }
  return "";
}

function expenseCalendarMonthKey(e) {
  const d = expenseCalendarDayKey(e);
  return d.length >= 7 ? d.slice(0, 7) : "";
}

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatCurrencyDetailed = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatNumber = (value) => new Intl.NumberFormat("es-MX").format(value || 0);

function escapeCsvField(value) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const RADIAN = Math.PI / 180;

function pieSectorLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, value }) {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fde68a" textAnchor="middle" dominantBaseline="central" fontSize={11}>
      {`${name}: ${value}`}
    </text>
  );
}

function scrollToStatsSection(elementId) {
  document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const statsShortcutLinkClass =
  "rounded px-0.5 text-[11px] text-yellow-300/90 transition-colors hover:text-yellow-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-yellow-400/60";

function StatsDetailShortcuts({ channelId, topItemsId }) {
  return (
    <nav aria-label="Section shortcuts" className="mb-4 flex flex-wrap items-center gap-x-0.5 gap-y-1">
      <span className="mr-2 text-[10px] font-medium uppercase tracking-wider text-yellow-500/55">Jump to</span>
      <button type="button" className={statsShortcutLinkClass} onClick={() => scrollToStatsSection(channelId)}>
        Channel mix
      </button>
      <span className="select-none px-1 text-[10px] text-yellow-600/35" aria-hidden>
        ·
      </span>
      <button type="button" className={statsShortcutLinkClass} onClick={() => scrollToStatsSection(topItemsId)}>
        Top items
      </button>
    </nav>
  );
}

function pctChangeLabel(current, previous) {
  if (previous == null || previous === 0) {
    return null;
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs previous month`;
}

export default function Statistics() {
  const [selectedMonth, setSelectedMonth] = useState(() => getMexicoNowYearMonth());
  const [selectedDay, setSelectedDay] = useState(() => getMexicoNowDateKey());
  const [printMode, setPrintMode] = useState(null);
  const [statsView, setStatsView] = useState("monthly");
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), "-created_date"),
  });

  const useLocalFinance = isLocalFinanceMode();
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListExpenses() : base44.entities.Expense.list("-date")),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });
  const appSettings = useMemo(() => getResolvedIntegrationSettings(settings[0] || {}), [settings]);

  const statisticsMonth = statsView === "daily" ? format(parseISO(`${selectedDay}T12:00:00`), "yyyy-MM") : selectedMonth;

  const { data: transactions = [] } = useQuery({
    queryKey: ["companyTransactions", useLocalFinance ? "local" : "remote"],
    queryFn: () =>
      useLocalFinance ? localListCompanyTransactions() : base44.entities.CompanyTransaction.list("-date"),
  });

  const monthAnchor = useMemo(() => parseISO(`${statisticsMonth}-01`), [statisticsMonth]);
  const fetchStart = useMemo(() => startOfMonth(subMonths(monthAnchor, 1)), [monthAnchor]);
  const rangeStart = useMemo(() => startOfMonth(monthAnchor), [monthAnchor]);
  const rangeEnd = useMemo(() => {
    const end = endOfMonth(monthAnchor);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [monthAnchor]);
  const prevRangeStart = useMemo(() => startOfMonth(subMonths(monthAnchor, 1)), [monthAnchor]);
  const prevRangeEnd = useMemo(() => {
    const end = endOfMonth(subMonths(monthAnchor, 1));
    end.setHours(23, 59, 59, 999);
    return end;
  }, [monthAnchor]);

  const { data: loyverseOverview } = useQuery({
    queryKey: ["statisticsLoyverse", settings[0]?.id || "none", statisticsMonth],
    queryFn: () =>
      getLoyverseOverview(appSettings, {
        start: fetchStart,
        end: rangeEnd,
      }),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });

  const { data: clipOverview } = useQuery({
    queryKey: ["statisticsClip", settings[0]?.id || "none", statisticsMonth],
    queryFn: () =>
      getClipOverview(appSettings, {
        start: fetchStart,
        end: rangeEnd,
      }),
    enabled: hasClipApiConfig(appSettings),
    staleTime: 60_000,
  });

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const anchor = parseISO(`${getMexicoNowYearMonth()}-01`);
    const date = subMonths(anchor, i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: es }),
    };
  });

  const monthOrders = orders.filter((o) => getMexicoYearMonthKey(o.created_date) === statisticsMonth);
  const monthExpenses = expenses.filter((e) => expenseCalendarMonthKey(e) === statisticsMonth);

  const dayOrders = orders.filter((o) => getMexicoDateKey(o.created_date) === selectedDay);
  const dayExpenses = expenses.filter((e) => expenseCalendarDayKey(e) === selectedDay);

  const contributionInWindow = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.type === "contribution" &&
          getRecordDate(t) >= fetchStart &&
          getRecordDate(t) <= rangeEnd,
      ),
    [transactions, fetchStart, rangeEnd],
  );

  const { canonicalEvents: canonicalFull } = useMemo(
    () =>
      buildMergedCanonicalEvents({
        receipts: loyverseOverview?.receipts || [],
        clipPayments: clipOverview?.payments || [],
        contributionTransactions: contributionInWindow,
        stores: loyverseOverview?.stores || [],
        dedupeWindowMs: 10 * 60 * 1000,
        priorityMode: "Prefer Loyverse",
        paymentSource: "All sources",
        branch: "All branches",
        channel: "All channels",
      }),
    [loyverseOverview, clipOverview, contributionInWindow],
  );

  const canonicalCurrent = useMemo(
    () => filterCanonicalEventsByDateRange(canonicalFull, rangeStart, rangeEnd),
    [canonicalFull, rangeStart, rangeEnd],
  );
  const canonicalPrev = useMemo(
    () => filterCanonicalEventsByDateRange(canonicalFull, prevRangeStart, prevRangeEnd),
    [canonicalFull, prevRangeStart, prevRangeEnd],
  );

  const mergedRevenue = sumEventAmounts(canonicalCurrent);
  const mergedTransactionCount = canonicalCurrent.length;
  const mergedAov = mergedTransactionCount ? mergedRevenue / mergedTransactionCount : 0;
  const monthExpensesTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const mergedNet = mergedRevenue - monthExpensesTotal;

  const orderModuleRevenue = monthOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const orderModuleCount = monthOrders.length;

  const sourceTotals = canonicalCurrent.reduce(
    (acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + e.amount;
      return acc;
    },
    { loyverse: 0, clip: 0, manual: 0 },
  );

  const PIZZA_COST_ESTIMATE = 80;
  const ingredientExpenses = monthExpenses.filter((e) => e.category === "ingredients").reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const laborExpenses = monthExpenses.filter((e) => e.category === "salaries").reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const estimatedIngredientCost = ingredientExpenses || orderModuleCount * PIZZA_COST_ESTIMATE;
  const grossProfit = mergedRevenue - estimatedIngredientCost;
  const foodCostPct = mergedRevenue > 0 ? (estimatedIngredientCost / mergedRevenue) * 100 : 0;
  const laborCostPct = mergedRevenue > 0 ? (laborExpenses / mergedRevenue) * 100 : 0;

  const prevMonthStr = format(subMonths(monthAnchor, 1), "yyyy-MM");
  const prevMonthExpenses = expenses.filter((e) => expenseCalendarMonthKey(e) === prevMonthStr);
  const prevMonthExpenseTotal = prevMonthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const prevMergedRevenue = sumEventAmounts(canonicalPrev);
  const prevMergedNet = prevMergedRevenue - prevMonthExpenseTotal;

  const revenueChangeLabel = pctChangeLabel(mergedRevenue, prevMergedRevenue);
  const ordersChangeLabel = pctChangeLabel(mergedTransactionCount, canonicalPrev.length);
  const expensesChangeLabel = pctChangeLabel(monthExpensesTotal, prevMonthExpenseTotal);
  const profitChangeLabel = pctChangeLabel(mergedNet, prevMergedNet);

  const PIE_COLORS = ["#facc15", "#a16207", "#fef08a", "#84cc16", "#22d3ee", "#a78bfa", "#fb7185"];

  const selectedDayDate = useMemo(() => parseISO(`${selectedDay}T12:00:00`), [selectedDay]);
  const dayStart = startOfDay(selectedDayDate);
  const dayEnd = endOfDay(selectedDayDate);
  const dayCanonical = filterCanonicalEventsByDateRange(canonicalFull, dayStart, dayEnd);
  const dayMergedRevenue = sumEventAmounts(dayCanonical);
  const dayMergedCount = dayCanonical.length;
  const dayExpensesTotal = dayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const dayNet = dayMergedRevenue - dayExpensesTotal;
  const dayStats = {
    totalRevenue: dayMergedRevenue,
    totalExpenses: dayExpensesTotal,
    totalProfit: dayNet,
    totalOrders: dayMergedCount,
    avgOrderValue: dayMergedCount ? dayMergedRevenue / dayMergedCount : 0,
    profitMargin: dayMergedRevenue > 0 ? (dayNet / dayMergedRevenue) * 100 : 0,
  };

  const dayExpenseByCategory = useMemo(() => {
    const map = new Map();
    dayExpenses.forEach((e) => {
      const c = e.category || "other";
      map.set(c, (map.get(c) || 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [dayExpenses]);

  const daySourceTotals = dayCanonical.reduce(
    (acc, e) => {
      acc[e.source] = (acc[e.source] || 0) + e.amount;
      return acc;
    },
    { loyverse: 0, clip: 0, manual: 0 },
  );

  const dayIngredientExpenses = dayExpenses
    .filter((e) => e.category === "ingredients")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const dayLaborExpenses = dayExpenses
    .filter((e) => e.category === "salaries")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const dayEstimatedIngredient = dayIngredientExpenses || dayOrders.length * PIZZA_COST_ESTIMATE;
  const dayGrossProfit = dayMergedRevenue - dayEstimatedIngredient;
  const dayFoodCostPct = dayMergedRevenue > 0 ? (dayEstimatedIngredient / dayMergedRevenue) * 100 : 0;
  const dayLaborCostPct = dayMergedRevenue > 0 ? (dayLaborExpenses / dayMergedRevenue) * 100 : 0;

  const dayChannelPieData = countByChannel(dayCanonical).map((row, index) => ({
    ...row,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }));

  const dayItemCounts = {};
  const dayItemRevenue = {};
  dayOrders.forEach((order) => {
    order.items?.forEach((item) => {
      dayItemCounts[item.item_name] = (dayItemCounts[item.item_name] || 0) + item.quantity;
      dayItemRevenue[item.item_name] = (dayItemRevenue[item.item_name] || 0) + item.price * item.quantity;
    });
  });
  const dayTopFromReceipts = aggregateTopReceiptLineItems(dayCanonical, 10);
  const dayTopItems =
    dayTopFromReceipts.length > 0
      ? dayTopFromReceipts
      : Object.entries(dayItemCounts)
          .map(([name, count]) => ({ name, count, revenue: dayItemRevenue[name] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

  const daySnapshotBars = [
    { name: "Merged POS", value: dayMergedRevenue },
    { name: "Expenses", value: dayExpensesTotal },
    { name: "Net", value: dayNet },
  ];

  const dailyLedgerRows = useMemo(() => {
    const days = eachDayOfInterval({ start: rangeStart, end: endOfMonth(monthAnchor) });
    return days.map((day) => {
      const ds = startOfDay(day);
      const de = endOfDay(day);
      const ev = filterCanonicalEventsByDateRange(canonicalFull, ds, de);
      const mergedPosNet = sumEventAmounts(ev);
      const dayStr = format(day, "yyyy-MM-dd");
      const dExp = expenses.filter((e) => expenseCalendarDayKey(e) === dayStr);
      const expensesSpent = dExp.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const sourceTotals = ev.reduce(
        (acc, e) => {
          acc[e.source] = (acc[e.source] || 0) + e.amount;
          return acc;
        },
        { loyverse: 0, clip: 0, manual: 0 },
      );
      const dOrders = orders.filter((o) => getMexicoDateKey(o.created_date) === dayStr);
      const orderModuleRevenue = dOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      return {
        dateIso: dayStr,
        dayEnglish: format(day, "EEEE", { locale: enUS }),
        mergedPosNet,
        expensesSpent,
        net: mergedPosNet - expensesSpent,
        mergedEvents: ev.length,
        loyverse: sourceTotals.loyverse,
        clip: sourceTotals.clip,
        manual: sourceTotals.manual,
        orderModuleRevenue,
      };
    });
  }, [rangeStart, monthAnchor, canonicalFull, expenses, orders]);

  const dailyLedgerTotals = useMemo(
    () =>
      dailyLedgerRows.reduce(
        (acc, r) => ({
          mergedPosNet: acc.mergedPosNet + r.mergedPosNet,
          expensesSpent: acc.expensesSpent + r.expensesSpent,
          net: acc.net + r.net,
          mergedEvents: acc.mergedEvents + r.mergedEvents,
          loyverse: acc.loyverse + r.loyverse,
          clip: acc.clip + r.clip,
          manual: acc.manual + r.manual,
          orderModuleRevenue: acc.orderModuleRevenue + r.orderModuleRevenue,
        }),
        {
          mergedPosNet: 0,
          expensesSpent: 0,
          net: 0,
          mergedEvents: 0,
          loyverse: 0,
          clip: 0,
          manual: 0,
          orderModuleRevenue: 0,
        },
      ),
    [dailyLedgerRows],
  );

  const dailyRevenue = useMemo(
    () =>
      dailyLedgerRows.map((r) => ({
        date: format(parseISO(`${r.dateIso}T12:00:00`), "MMM dd"),
        revenue: r.mergedPosNet,
        expenses: r.expensesSpent,
        profit: r.net,
        orders: r.mergedEvents,
      })),
    [dailyLedgerRows],
  );

  const channelPieData = countByChannel(canonicalCurrent).map((row, index) => ({
    ...row,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }));

  const expenseByCategory = useMemo(() => {
    const map = new Map();
    monthExpenses.forEach((e) => {
      const c = e.category || "other";
      map.set(c, (map.get(c) || 0) + Number(e.amount || 0));
    });
    return Array.from(map.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [monthExpenses]);

  const itemCounts = {};
  const itemRevenue = {};
  monthOrders.forEach((order) => {
    order.items?.forEach((item) => {
      itemCounts[item.item_name] = (itemCounts[item.item_name] || 0) + item.quantity;
      itemRevenue[item.item_name] = (itemRevenue[item.item_name] || 0) + item.price * item.quantity;
    });
  });

  const topFromReceipts = aggregateTopReceiptLineItems(canonicalCurrent, 10);
  const topItems =
    topFromReceipts.length > 0
      ? topFromReceipts
      : Object.entries(itemCounts)
          .map(([name, count]) => ({ name, count, revenue: itemRevenue[name] }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

  const handlePrintDaily = () => {
    setPrintMode("daily");
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  const handlePrintMonthly = () => {
    setPrintMode("monthly");
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  const handleOpenInExcel = () => {
    const headers = [
      "Date (ISO)",
      "Weekday",
      "Daily cash — merged POS net sales (MXN)",
      "Spent — Finance expenses incl. Shopping (MXN)",
      "Net (MXN)",
      "Merged sales events",
      "Loyverse (MXN)",
      "Clip (MXN)",
      "Manual (MXN)",
      "Order module revenue (MXN)",
    ];
    const dataLines = dailyLedgerRows.map((r) =>
      [
        r.dateIso,
        r.dayEnglish,
        r.mergedPosNet.toFixed(2),
        r.expensesSpent.toFixed(2),
        r.net.toFixed(2),
        String(r.mergedEvents),
        r.loyverse.toFixed(2),
        r.clip.toFixed(2),
        r.manual.toFixed(2),
        r.orderModuleRevenue.toFixed(2),
      ]
        .map(escapeCsvField)
        .join(","),
    );
    const totalLine = [
      "",
      "TOTAL",
      dailyLedgerTotals.mergedPosNet.toFixed(2),
      dailyLedgerTotals.expensesSpent.toFixed(2),
      dailyLedgerTotals.net.toFixed(2),
      String(dailyLedgerTotals.mergedEvents),
      dailyLedgerTotals.loyverse.toFixed(2),
      dailyLedgerTotals.clip.toFixed(2),
      dailyLedgerTotals.manual.toFixed(2),
      dailyLedgerTotals.orderModuleRevenue.toFixed(2),
    ]
      .map(escapeCsvField)
      .join(",");
    const csv = `\uFEFF${[headers.map(escapeCsvField).join(","), ...dataLines, totalLine].join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily-ledger-${selectedMonth}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const showDailyOnScreen = !printMode && statsView === "daily";
  const showMonthlyOnScreen = !printMode && statsView === "monthly";
  const showDailyPrint = printMode === "daily";
  const showMonthlyPrint = printMode === "monthly";

  const chartAxisTick = { fill: "#e7e5e4", fontSize: 11 };
  const chartTooltipStyle = {
    background: "#242424",
    border: "1px solid rgba(250,204,21,0.25)",
    borderRadius: "8px",
    color: "#fafaf9",
  };

  const sourceMixSub = `After dedupe: Loyverse ${formatCurrency(sourceTotals.loyverse)} · Clip ${formatCurrency(sourceTotals.clip)} · Manual ${formatCurrency(sourceTotals.manual)}`;

  const summaryKpis = [
    {
      label: "Sales events (merged)",
      value: formatNumber(mergedTransactionCount),
      sub: `${ordersChangeLabel || "No comparison"} — Loyverse + Clip + manual ledger, same rules as Dashboard`,
      subTone: "neutral",
      icon: ShoppingCart,
    },
    {
      label: "Net sales (POS merge)",
      value: formatCurrency(mergedRevenue),
      sub: revenueChangeLabel ? `${revenueChangeLabel} · ${sourceMixSub}` : sourceMixSub,
      subTone: "neutral",
      icon: DollarSign,
    },
    {
      label: "Avg sale (merged)",
      value: formatCurrency(mergedAov),
      sub: mergedTransactionCount ? "Mean transaction amount after deduplication" : "No merged sales in month",
      subTone: "neutral",
      icon: TrendingUp,
    },
    {
      label: "Expenses (Finance ledger)",
      value: formatCurrency(monthExpensesTotal),
      sub: expensesChangeLabel || "No comparison — Expense entity rows in this month",
      subTone: "neutral",
      icon: TrendingDown,
    },
    {
      label: "Net (merged sales − expenses)",
      value: formatCurrency(mergedNet),
      sub: profitChangeLabel || "No comparison",
      subTone: mergedNet >= 0 ? "good" : "bad",
      icon: mergedNet >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Order module (separate)",
      value: formatCurrency(orderModuleRevenue),
      sub:
        orderModuleCount > 0
          ? `${formatNumber(orderModuleCount)} Order module rows — not added to POS merge unless also in Loyverse/Clip/manual`
          : "No orders in Order module this month",
      subTone: "neutral",
      icon: Package,
    },
  ];

  const dayOrderModuleRevenue = dayOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const daySourceMixSub = `After dedupe: Loyverse ${formatCurrency(daySourceTotals.loyverse)} · Clip ${formatCurrency(daySourceTotals.clip)} · Manual ${formatCurrency(daySourceTotals.manual)}`;

  const dailySummaryKpis = [
    {
      label: "Sales events (merged)",
      value: formatNumber(dayMergedCount),
      sub: `${daySourceMixSub} — same rules as Dashboard`,
      subTone: "neutral",
      icon: ShoppingCart,
    },
    {
      label: "Net sales (POS merge)",
      value: formatCurrency(dayMergedRevenue),
      sub: daySourceMixSub,
      subTone: "neutral",
      icon: DollarSign,
    },
    {
      label: "Avg sale (merged)",
      value: formatCurrency(dayStats.avgOrderValue),
      sub: dayMergedCount ? "Mean transaction amount after deduplication" : "No merged sales this day",
      subTone: "neutral",
      icon: TrendingUp,
    },
    {
      label: "Expenses (Finance ledger)",
      value: formatCurrency(dayExpensesTotal),
      sub: "Expense rows dated this calendar day",
      subTone: "neutral",
      icon: TrendingDown,
    },
    {
      label: "Net (merged sales − expenses)",
      value: formatCurrency(dayNet),
      sub: "POS merge revenue minus same-day expenses",
      subTone: dayNet >= 0 ? "good" : "bad",
      icon: dayNet >= 0 ? TrendingUp : TrendingDown,
    },
    {
      label: "Order module (separate)",
      value: formatCurrency(dayOrderModuleRevenue),
      sub:
        dayOrders.length > 0
          ? `${formatNumber(dayOrders.length)} Order module rows — not added to POS merge unless also in Loyverse/Clip/manual`
          : "No orders in Order module this day",
      subTone: "neutral",
      icon: Package,
    },
  ];

  return (
    <div className="statistics-page min-h-screen bg-[#1a1a1a] text-white">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; background: white; padding: 20px; }
          .no-print { display: none !important; }
          .print-break { page-break-after: always; }
          @page { margin: 1cm; }
        }
        .statistics-page .recharts-cartesian-axis-tick text { fill: #e7e5e4; }
        .statistics-page .recharts-cartesian-axis-line { stroke: #737373; }
        .statistics-page .recharts-cartesian-grid line { stroke: #404040; }
        .statistics-page .recharts-default-tooltip { color: #fafaf9 !important; }
      `}</style>

      <div className="border-b border-yellow-500/20 bg-[#1a1a1a] py-5 no-print">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold text-yellow-400">Statistics</h1>
              <p className="text-xs text-gray-400">Same merged POS math as Dashboard (Loyverse + Clip + manual), plus Finance ledger expenses</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:space-y-7 lg:px-8 lg:py-7">
        <div className="no-print flex flex-wrap gap-2 rounded-xl border border-yellow-500/20 bg-[#242424] p-1">
          {[
            { id: "monthly", label: "Monthly overview" },
            { id: "daily", label: "Single day" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatsView(tab.id)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                statsView === tab.id ? "bg-yellow-400/20 text-yellow-200" : "text-gray-400 hover:text-white",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="no-print rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4">
          <div className="flex gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400/90" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-yellow-200">Where each number comes from</p>
              <p className="mt-1 text-xs text-gray-400">
                <strong className="text-gray-300">Net sales &amp; sales events</strong> use the same pipeline as Dashboard: Loyverse receipts + approved Clip payments + manual contribution transactions, then duplicate removal (10 min window, prefer Loyverse).
                <strong className="text-gray-300"> Expenses</strong> are summed from Finance <strong>Expense</strong> rows
                {statsView === "daily" ? " dated the selected calendar day." : " in the calendar month."}
                <strong className="text-gray-300"> Order module</strong> shows in-app <strong>Order</strong> totals separately — those are not double-counted into net sales unless the same sale also appears in Loyverse/Clip/manual.
              </p>
            </div>
          </div>
        </div>

        <div className="no-print rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
          <h3 className="mb-3 text-sm font-bold text-yellow-400">Period</h3>
          {statsView === "monthly" ? (
            <div className="max-w-md space-y-2">
              <label className="text-xs font-medium text-gray-400">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="border-yellow-500/20 bg-[#1a1a1a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="max-w-md space-y-2">
              <label className="text-xs font-medium text-gray-400">Date</label>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full rounded-md border border-yellow-500/20 bg-[#1a1a1a] px-3 py-2 text-white [color-scheme:dark]"
              />
            </div>
          )}
        </div>

        <div className="no-print flex flex-wrap gap-3">
          <Button
            onClick={handlePrintDaily}
            className="h-8 gap-2 bg-yellow-400 text-xs text-black hover:bg-yellow-300"
            variant="default"
          >
            <Printer className="h-4 w-4" />
            Print daily report
          </Button>
          <Button
            onClick={handlePrintMonthly}
            className="h-8 gap-2 border border-yellow-500/20 bg-[#242424] text-xs text-gray-300 hover:text-white"
            variant="outline"
          >
            <Printer className="h-4 w-4" />
            Print monthly report
          </Button>
        </div>

        <div className={printMode ? "print-area" : ""}>
          {printMode && (
            <div className="mb-8 border-b-2 pb-6">
              <div className="text-center">
                <h1 className="mb-2 text-3xl font-bold">Los Tios Pizzeria</h1>
                <h2 className="text-xl text-gray-700">
                  {printMode === "daily"
                    ? `Daily report — ${formatMexicoLongDateEs(dateFromMexicoDateKey(selectedDay))}`
                    : `Monthly report — ${monthOptions.find((m) => m.value === selectedMonth)?.label}`}
                </h2>
                <p className="mt-2 text-sm text-gray-600">Generated {formatMexicoGeneratedTimestamp()}</p>
              </div>
            </div>
          )}

          {(showDailyOnScreen || showDailyPrint) && (
            <div className="mb-8">
              <h2 className="mb-4 text-xl font-bold sm:text-2xl">
                Daily — {formatMexicoLongDateEs(dateFromMexicoDateKey(selectedDay))}
              </h2>

              <div className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {dailySummaryKpis.map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <kpi.icon className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
                      <p className="truncate text-xs uppercase tracking-widest text-yellow-200/70">{kpi.label}</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{kpi.value}</p>
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        kpi.subTone === "good" && "text-emerald-400",
                        kpi.subTone === "bad" && "text-red-400",
                        kpi.subTone === "neutral" && "text-gray-400",
                      )}
                    >
                      {kpi.sub}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-yellow-500/15 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <ChefHat className="h-3.5 w-3.5 text-yellow-400" />
                    Gross profit (rough)
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(dayGrossProfit)}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {dayIngredientExpenses ? "After ingredient expenses" : `Estimate ${PIZZA_COST_ESTIMATE} / order`}
                  </p>
                </div>
                <div className="rounded-xl border border-yellow-500/15 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <ChefHat className="h-3.5 w-3.5 text-yellow-400" />
                    Food cost %
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{dayFoodCostPct.toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-gray-400">vs merged POS net sales</p>
                </div>
                <div className="rounded-xl border border-yellow-500/15 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <Users className="h-3.5 w-3.5 text-yellow-400" />
                    Labor cost %
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{dayLaborExpenses ? `${dayLaborCostPct.toFixed(1)}%` : "—"}</p>
                  <p className="mt-1 text-xs text-gray-400">{dayLaborExpenses ? "Salary expenses" : "No salary expenses"}</p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base text-yellow-100">Costs by category</CardTitle>
                    <p className="text-xs text-gray-400">All expense rows on the selected day</p>
                  </CardHeader>
                  <CardContent>
                    {dayExpenseByCategory.length ? (
                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {dayExpenseByCategory.map(({ category, total }) => (
                          <div key={category} className="flex items-center justify-between rounded-lg bg-[#1a1a1a] px-3 py-2 text-sm">
                            <span className="capitalize text-gray-300">{category}</span>
                            <span className="font-semibold text-yellow-200">{formatCurrency(total)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between border-t border-yellow-500/10 pt-2 text-sm font-bold text-yellow-100">
                          <span>Total</span>
                          <span>{formatCurrency(dayExpensesTotal)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300">No expenses this day.</p>
                    )}
                  </CardContent>
                </Card>

                {!printMode && (
                  <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base text-yellow-100">Day snapshot</CardTitle>
                      <p className="text-xs text-gray-400">Merged POS, expenses, and net for the selected date</p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={daySnapshotBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                          <XAxis dataKey="name" tick={chartAxisTick} tickLine={{ stroke: "#737373" }} axisLine={{ stroke: "#737373" }} />
                          <YAxis tick={chartAxisTick} tickLine={{ stroke: "#737373" }} axisLine={{ stroke: "#737373" }} width={48} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            labelStyle={{ color: "#fafaf9" }}
                            itemStyle={{ color: "#fafaf9" }}
                            formatter={(value) => formatCurrencyDetailed(value)}
                          />
                          <Bar dataKey="value" fill="#facc15" radius={[4, 4, 0, 0]} name="Amount" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>

              {!printMode && (
                <div className="mb-6 rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <h3 className="mb-1 text-sm font-medium text-yellow-200">Breakdown</h3>
                  <p className="mb-3 text-xs text-gray-400">Sales channel mix and top items for the selected day.</p>
                  <StatsDetailShortcuts channelId="stats-daily-channel" topItemsId="stats-daily-top-items" />
                  <div className="space-y-4">
                    <Card id="stats-daily-channel" className="scroll-mt-24 border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base text-yellow-100">Merged sales by channel</CardTitle>
                        <p className="text-xs text-gray-400">From Loyverse receipt routing (same as Dashboard)</p>
                      </CardHeader>
                      <CardContent>
                        {dayChannelPieData.length ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie
                                data={dayChannelPieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={pieSectorLabel}
                                outerRadius={88}
                                dataKey="value"
                              >
                                {dayChannelPieData.map((entry, index) => (
                                  <Cell key={`day-cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={chartTooltipStyle}
                                labelStyle={{ color: "#fafaf9" }}
                                itemStyle={{ color: "#fafaf9" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="py-12 text-center text-sm text-gray-300">No merged sales with channel labels this day.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card id="stats-daily-top-items" className="scroll-mt-24 border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base text-yellow-100">Top items (Loyverse receipts, else Order module)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {dayTopItems.length > 0 ? (
                          <div className="space-y-3">
                            {dayTopItems.map((item, index) => (
                              <div key={item.name} className="flex items-center justify-between rounded-lg bg-[#1a1a1a] p-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400/20 text-sm font-bold text-yellow-400">
                                    {index + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium text-gray-100">{item.name}</p>
                                    <p className="text-xs text-gray-400">{item.count} sold</p>
                                  </div>
                                </div>
                                <p className="font-semibold text-yellow-300">{formatCurrency(item.revenue)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-sm text-gray-300">No line items for this day.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {printMode === "daily" && (
                <div className="mt-6 space-y-6">
                  <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg text-yellow-100">Merged sales by channel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="py-2 text-left">Channel</th>
                            <th className="py-2 text-center">Events</th>
                            <th className="py-2 text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayChannelPieData.map((row) => (
                            <tr key={row.name} className="border-b">
                              <td className="py-2">{row.name}</td>
                              <td className="py-2 text-center">{row.value}</td>
                              <td className="py-2 text-right font-semibold">{formatCurrencyDetailed(row.revenue)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total (merged)</td>
                            <td className="py-2 text-center">{formatNumber(dayMergedCount)}</td>
                            <td className="py-2 text-right">{formatCurrencyDetailed(dayMergedRevenue)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg text-yellow-100">Expenses by category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="py-2 text-left">Category</th>
                            <th className="py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayExpenseByCategory.map(({ category, total }) => (
                            <tr key={category} className="border-b">
                              <td className="py-2 capitalize">{category}</td>
                              <td className="py-2 text-right font-semibold">{formatCurrencyDetailed(total)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total</td>
                            <td className="py-2 text-right">{formatCurrencyDetailed(dayExpensesTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {showDailyPrint && <div className="print-break" />}

          {(showMonthlyOnScreen || showMonthlyPrint) && (
            <div>
              <h2 className="mb-4 text-xl font-bold sm:text-2xl">
                Monthly — {monthOptions.find((m) => m.value === selectedMonth)?.label}
              </h2>

              <div className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {summaryKpis.map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <kpi.icon className="h-3.5 w-3.5 shrink-0 text-yellow-400" />
                      <p className="truncate text-xs uppercase tracking-widest text-yellow-200/70">{kpi.label}</p>
                    </div>
                    <p className="text-2xl font-bold text-white">{kpi.value}</p>
                    <p
                      className={cn(
                        "mt-1 text-xs",
                        kpi.subTone === "good" && "text-emerald-400",
                        kpi.subTone === "bad" && "text-red-400",
                        kpi.subTone === "neutral" && "text-gray-400",
                      )}
                    >
                      {kpi.sub}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-yellow-500/15 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <ChefHat className="h-3.5 w-3.5 text-yellow-400" />
                    Gross profit (rough)
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(grossProfit)}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {ingredientExpenses ? "After ingredient expenses" : `Estimate ${PIZZA_COST_ESTIMATE} / order`}
                  </p>
                </div>
                <div className="rounded-xl border border-yellow-500/15 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <ChefHat className="h-3.5 w-3.5 text-yellow-400" />
                    Food cost %
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{foodCostPct.toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-gray-400">vs merged POS net sales</p>
                </div>
                <div className="rounded-xl border border-yellow-500/15 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <Users className="h-3.5 w-3.5 text-yellow-400" />
                    Labor cost %
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{laborExpenses ? `${laborCostPct.toFixed(1)}%` : "—"}</p>
                  <p className="mt-1 text-xs text-gray-400">{laborExpenses ? "Salary expenses" : "No salary expenses"}</p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base text-yellow-100">Costs by category</CardTitle>
                    <p className="text-xs text-gray-400">All expense rows in selected month</p>
                  </CardHeader>
                  <CardContent>
                    {expenseByCategory.length ? (
                      <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                        {expenseByCategory.map(({ category, total }) => (
                          <div key={category} className="flex items-center justify-between rounded-lg bg-[#1a1a1a] px-3 py-2 text-sm">
                            <span className="capitalize text-gray-300">{category}</span>
                            <span className="font-semibold text-yellow-200">{formatCurrency(total)}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between border-t border-yellow-500/10 pt-2 text-sm font-bold text-yellow-100">
                          <span>Total</span>
                          <span>{formatCurrency(monthExpensesTotal)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300">No expenses this month.</p>
                    )}
                  </CardContent>
                </Card>

                {!printMode && (
                  <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base text-yellow-100">Revenue, expenses &amp; net by day</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={dailyRevenue}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                          <XAxis dataKey="date" tick={chartAxisTick} tickLine={{ stroke: "#737373" }} axisLine={{ stroke: "#737373" }} />
                          <YAxis tick={chartAxisTick} tickLine={{ stroke: "#737373" }} axisLine={{ stroke: "#737373" }} width={48} />
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                            labelStyle={{ color: "#fafaf9" }}
                            itemStyle={{ color: "#fafaf9" }}
                            formatter={(value) => formatCurrencyDetailed(value)}
                          />
                          <Line type="monotone" dataKey="revenue" stroke="#facc15" strokeWidth={2} name="Revenue" dot={false} />
                          <Line type="monotone" dataKey="expenses" stroke="#a16207" strokeWidth={2} name="Expenses" dot={false} />
                          <Line type="monotone" dataKey="profit" stroke="#86efac" strokeWidth={2} name="Net" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>

              <Card className="mb-6 border-2 border-yellow-500/35 bg-[#1c1c14] text-gray-200 shadow-none">
                <CardHeader className="flex flex-col gap-3 border-b border-yellow-500/25 bg-yellow-500/[0.12] pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base text-yellow-100">Daily ledger</CardTitle>
                    <p className="mt-1 text-xs text-yellow-200/70">
                      Spreadsheet-style view (English). Daily cash = merged POS net sales; spent = all Finance expenses for that
                      calendar day (including purchases registered from Shopping).
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleOpenInExcel}
                    className="no-print h-9 shrink-0 gap-2 border border-yellow-400/40 bg-yellow-500/20 text-xs text-yellow-100 hover:bg-yellow-500/30"
                    variant="outline"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Open in Excel
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] border-collapse text-left text-[11px] sm:text-xs">
                      <thead>
                        <tr className="border-b border-yellow-500/40 bg-yellow-500/20 text-[10px] font-semibold uppercase tracking-wide text-yellow-100">
                          <th className="sticky left-0 z-10 border-r border-yellow-500/30 bg-[#2a2610] px-2 py-2.5">Date</th>
                          <th className="border-r border-yellow-500/20 px-2 py-2.5">Weekday</th>
                          <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Daily cash (POS)</th>
                          <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Spent</th>
                          <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Net</th>
                          <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Events</th>
                          <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Loyverse</th>
                          <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Clip</th>
                          <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Manual</th>
                          <th className="px-2 py-2.5 text-right">Order module</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailyLedgerRows.map((r, i) => (
                          <tr
                            key={r.dateIso}
                            className={cn(
                              "border-b border-yellow-500/15 transition-colors hover:bg-yellow-500/[0.06]",
                              i % 2 === 1 && "bg-black/20",
                            )}
                          >
                            <td className="sticky left-0 z-[1] border-r border-yellow-500/25 bg-[#1c1c14] px-2 py-2 font-medium text-yellow-100/95 tabular-nums">
                              {r.dateIso}
                            </td>
                            <td className="border-r border-yellow-500/15 px-2 py-2 text-gray-300">{r.dayEnglish}</td>
                            <td className="border-r border-yellow-500/15 px-2 py-2 text-right font-mono tabular-nums text-yellow-200">
                              {formatCurrencyDetailed(r.mergedPosNet)}
                            </td>
                            <td
                              className={cn(
                                "border-r border-yellow-500/15 px-2 py-2 text-right font-mono tabular-nums",
                                r.expensesSpent < 0 ? "text-red-400" : "text-amber-200/90",
                              )}
                            >
                              {r.expensesSpent < 0
                                ? `-${formatCurrencyDetailed(Math.abs(r.expensesSpent))}`
                                : formatCurrencyDetailed(r.expensesSpent)}
                            </td>
                            <td
                              className={cn(
                                "border-r border-yellow-500/15 px-2 py-2 text-right font-mono tabular-nums",
                                r.net >= 0 ? "text-emerald-300/90" : "text-red-300/90",
                              )}
                            >
                              {formatCurrencyDetailed(r.net)}
                            </td>
                            <td className="border-r border-yellow-500/15 px-2 py-2 text-right font-mono tabular-nums text-gray-200">
                              {formatNumber(r.mergedEvents)}
                            </td>
                            <td className="border-r border-yellow-500/15 px-2 py-2 text-right font-mono tabular-nums text-gray-300">
                              {formatCurrencyDetailed(r.loyverse)}
                            </td>
                            <td className="border-r border-yellow-500/15 px-2 py-2 text-right font-mono tabular-nums text-gray-300">
                              {formatCurrencyDetailed(r.clip)}
                            </td>
                            <td className="border-r border-yellow-500/15 px-2 py-2 text-right font-mono tabular-nums text-gray-300">
                              {formatCurrencyDetailed(r.manual)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums text-gray-300">
                              {formatCurrencyDetailed(r.orderModuleRevenue)}
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-yellow-500/50 bg-yellow-500/15 font-semibold text-yellow-50">
                          <td className="sticky left-0 z-[1] border-r border-yellow-500/30 bg-[#2a2610] px-2 py-2.5" colSpan={2}>
                            Total
                          </td>
                          <td className="border-r border-yellow-500/20 px-2 py-2.5 text-right font-mono tabular-nums">
                            {formatCurrencyDetailed(dailyLedgerTotals.mergedPosNet)}
                          </td>
                          <td
                            className={cn(
                              "border-r border-yellow-500/20 px-2 py-2.5 text-right font-mono tabular-nums",
                              dailyLedgerTotals.expensesSpent < 0 ? "text-red-400" : "",
                            )}
                          >
                            {dailyLedgerTotals.expensesSpent < 0
                              ? `-${formatCurrencyDetailed(Math.abs(dailyLedgerTotals.expensesSpent))}`
                              : formatCurrencyDetailed(dailyLedgerTotals.expensesSpent)}
                          </td>
                          <td
                            className={cn(
                              "border-r border-yellow-500/20 px-2 py-2.5 text-right font-mono tabular-nums",
                              dailyLedgerTotals.net >= 0 ? "text-emerald-200" : "text-red-200",
                            )}
                          >
                            {formatCurrencyDetailed(dailyLedgerTotals.net)}
                          </td>
                          <td className="border-r border-yellow-500/20 px-2 py-2.5 text-right font-mono tabular-nums">
                            {formatNumber(dailyLedgerTotals.mergedEvents)}
                          </td>
                          <td className="border-r border-yellow-500/20 px-2 py-2.5 text-right font-mono tabular-nums">
                            {formatCurrencyDetailed(dailyLedgerTotals.loyverse)}
                          </td>
                          <td className="border-r border-yellow-500/20 px-2 py-2.5 text-right font-mono tabular-nums">
                            {formatCurrencyDetailed(dailyLedgerTotals.clip)}
                          </td>
                          <td className="border-r border-yellow-500/20 px-2 py-2.5 text-right font-mono tabular-nums">
                            {formatCurrencyDetailed(dailyLedgerTotals.manual)}
                          </td>
                          <td className="px-2 py-2.5 text-right font-mono tabular-nums">
                            {formatCurrencyDetailed(dailyLedgerTotals.orderModuleRevenue)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {!printMode && (
                <div className="mb-6 rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <h3 className="mb-1 text-sm font-medium text-yellow-200">Breakdown</h3>
                  <p className="mb-3 text-xs text-gray-400">Sales channel mix and top items for the selected month.</p>
                  <StatsDetailShortcuts channelId="stats-month-channel" topItemsId="stats-month-top-items" />
                  <div className="space-y-4">
                    <Card id="stats-month-channel" className="scroll-mt-24 border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base text-yellow-100">Merged sales by channel</CardTitle>
                        <p className="text-xs text-gray-400">From Loyverse receipt routing (same as Dashboard)</p>
                      </CardHeader>
                      <CardContent>
                        {channelPieData.length ? (
                          <ResponsiveContainer width="100%" height={260}>
                            <PieChart>
                              <Pie
                                data={channelPieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={pieSectorLabel}
                                outerRadius={88}
                                dataKey="value"
                              >
                                {channelPieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={chartTooltipStyle}
                                labelStyle={{ color: "#fafaf9" }}
                                itemStyle={{ color: "#fafaf9" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="py-12 text-center text-sm text-gray-300">No merged sales with channel labels this month.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card id="stats-month-top-items" className="scroll-mt-24 border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base text-yellow-100">Top items (Loyverse receipts, else Order module)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {topItems.length > 0 ? (
                          <div className="space-y-3">
                            {topItems.map((item, index) => (
                              <div key={item.name} className="flex items-center justify-between rounded-lg bg-[#1a1a1a] p-3">
                                <div className="flex items-center gap-3">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400/20 text-sm font-bold text-yellow-400">
                                    {index + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium text-gray-100">{item.name}</p>
                                    <p className="text-xs text-gray-400">{item.count} sold</p>
                                  </div>
                                </div>
                                <p className="font-semibold text-yellow-300">{formatCurrency(item.revenue)}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-sm text-gray-300">No line items for this month.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {printMode === "monthly" && (
                <div className="mt-6 space-y-6">
                  <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg text-yellow-100">Merged sales by channel</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="py-2 text-left">Channel</th>
                            <th className="py-2 text-center">Events</th>
                            <th className="py-2 text-right">Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {channelPieData.map((row) => (
                            <tr key={row.name} className="border-b">
                              <td className="py-2">{row.name}</td>
                              <td className="py-2 text-center">{row.value}</td>
                              <td className="py-2 text-right font-semibold">{formatCurrencyDetailed(row.revenue)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total (merged)</td>
                            <td className="py-2 text-center">{formatNumber(mergedTransactionCount)}</td>
                            <td className="py-2 text-right">{formatCurrencyDetailed(mergedRevenue)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  <Card className="border border-yellow-500/15 bg-[#242424] text-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-lg text-yellow-100">Expenses by category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="py-2 text-left">Category</th>
                            <th className="py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expenseByCategory.map(({ category, total }) => (
                            <tr key={category} className="border-b">
                              <td className="py-2 capitalize">{category}</td>
                              <td className="py-2 text-right font-semibold">{formatCurrencyDetailed(total)}</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total</td>
                            <td className="py-2 text-right">{formatCurrencyDetailed(monthExpensesTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
