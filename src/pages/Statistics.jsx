// @ts-nocheck
import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useMonthUrlSync } from "@/hooks/useMonthUrlSync";
import { formatMxn, formatCount } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  FileSpreadsheet,
  ShoppingCart,
  ChefHat,
  Users,
  Info,
} from "lucide-react";
import {
  format,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  subYears,
  startOfMonth,
  startOfDay,
  endOfDay,
  parseISO,
  startOfYear,
  endOfYear,
} from "date-fns";
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
import { es } from "date-fns/locale";
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
import {
  isLocalFinanceMode,
  localListExpenses,
  localListCompanyTransactions,
  localListEmployees,
  localListShifts,
} from "@/lib/localDevFinance";
import { sumTemplateLaborBetween, totalExpectedLaborForDate } from "@/lib/employeeLabor";
import {
  dateFromMexicoDateKey,
  formatMexicoLongDateEs,
  formatMexicoWeekdayShortFromDateKey,
  getMexicoDateKey,
  getMexicoHourFromInstant,
  getMexicoNowDateKey,
  getMexicoNowYearMonth,
  getMexicoYearMonthKey,
  MEXICO_DISPLAY_TIMEZONE,
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

const formatCurrency = formatMxn;
const formatNumber = formatCount;

/* Keeps 2 decimals even for round numbers (used in CSV exports + payroll where trailing
   .00 matters). The shared formatMxnDetailed rounds trailing zeros, so we can't reuse it. */
const formatCurrencyDetailed = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

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

/** Summary strips (top sold, best days, rhythm) — same shell as Period card. */
const STATS_STRIP_CLASS =
  "no-print rounded-xl border border-yellow-500/20 bg-[#242424] px-4 py-3 shadow-none";

/** Ledger is the primary data table; slightly stronger frame, same radius family. */
const STATS_LEDGER_CARD_CLASS =
  "no-print rounded-xl border-2 border-yellow-500/30 bg-[#242424] text-gray-200 shadow-none";

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

function pctChangeLabel(current, previous, vsLabel = "previous month") {
  if (previous == null || previous === 0) {
    return null;
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs ${vsLabel}`;
}

export default function Statistics() {
  const [selectedMonth, setSelectedMonth] = useState(() => getMexicoNowYearMonth());
  const [selectedYear, setSelectedYear] = useState(() => getMexicoNowYearMonth().slice(0, 4));
  const [selectedDay, setSelectedDay] = useState(() => getMexicoNowDateKey());
  const [statsView, setStatsView] = useState("monthly");
  /* Keep ?month=YYYY-MM in the URL while on the Monthly view so other admin tabs
     (Dashboard, Shopping) can land on the same period when the user follows a link. */
  useMonthUrlSync(selectedMonth, setSelectedMonth, { active: statsView === "monthly" });
  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), "-created_date"),
  });

  const useLocalFinance = isLocalFinanceMode();
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListExpenses() : base44.entities.Expense.list("-date")),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListEmployees() : base44.entities.Employee.list("name")),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListShifts() : base44.entities.Shift.list("-date")),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });
  const appSettings = useMemo(() => getResolvedIntegrationSettings(settings[0] || {}), [settings]);

  const statisticsMonth =
    statsView === "daily"
      ? format(parseISO(`${selectedDay}T12:00:00`), "yyyy-MM")
      : statsView === "yearly"
        ? `${selectedYear}-01`
        : selectedMonth;

  const { data: transactions = [] } = useQuery({
    queryKey: ["companyTransactions", useLocalFinance ? "local" : "remote"],
    queryFn: () =>
      useLocalFinance ? localListCompanyTransactions() : base44.entities.CompanyTransaction.list("-date"),
  });

  const monthAnchor = useMemo(() => parseISO(`${statisticsMonth}-01`), [statisticsMonth]);
  const rangeStart = useMemo(() => {
    if (statsView === "yearly") {
      return startOfYear(parseISO(`${selectedYear}-01-01`));
    }
    return startOfMonth(monthAnchor);
  }, [statsView, selectedYear, monthAnchor]);
  const rangeEnd = useMemo(() => {
    if (statsView === "yearly") {
      const end = endOfYear(parseISO(`${selectedYear}-01-01`));
      end.setHours(23, 59, 59, 999);
      return end;
    }
    const end = endOfMonth(monthAnchor);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [statsView, selectedYear, monthAnchor]);
  const fetchStart = useMemo(() => startOfMonth(subMonths(rangeStart, 1)), [rangeStart]);
  const prevRangeStart = useMemo(() => {
    if (statsView === "yearly") {
      return startOfYear(subYears(parseISO(`${selectedYear}-01-01`), 1));
    }
    return startOfMonth(subMonths(monthAnchor, 1));
  }, [statsView, selectedYear, monthAnchor]);
  const prevRangeEnd = useMemo(() => {
    if (statsView === "yearly") {
      const end = endOfYear(subYears(parseISO(`${selectedYear}-01-01`), 1));
      end.setHours(23, 59, 59, 999);
      return end;
    }
    const end = endOfMonth(subMonths(monthAnchor, 1));
    end.setHours(23, 59, 59, 999);
    return end;
  }, [statsView, selectedYear, monthAnchor]);

  const statsDataKey = statsView === "yearly" ? `year:${selectedYear}` : statisticsMonth;

  const { data: loyverseOverview } = useQuery({
    queryKey: ["statisticsLoyverse", settings[0]?.id || "none", statsDataKey],
    queryFn: () =>
      getLoyverseOverview(appSettings, {
        start: fetchStart,
        end: rangeEnd,
      }),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });

  const { data: clipOverview } = useQuery({
    queryKey: ["statisticsClip", settings[0]?.id || "none", statsDataKey],
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

  const currentCalendarYear = Number(getMexicoNowYearMonth().slice(0, 4));
  const yearOptions = Array.from({ length: 8 }, (_, i) => {
    const y = String(currentCalendarYear - i);
    return { value: y, label: y };
  });

  const monthOrders = orders.filter((o) =>
    statsView === "yearly"
      ? getMexicoDateKey(o.created_date).startsWith(selectedYear)
      : getMexicoYearMonthKey(o.created_date) === statisticsMonth,
  );
  const monthExpenses = expenses.filter((e) =>
    statsView === "yearly"
      ? expenseCalendarDayKey(e).startsWith(selectedYear)
      : expenseCalendarMonthKey(e) === statisticsMonth,
  );

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

  const prevMonthStr = format(subMonths(monthAnchor, 1), "yyyy-MM");
  const prevYearStr = String(Number(selectedYear) - 1);

  const monthShiftLaborAccrued = useMemo(
    () =>
      shifts
        .filter((s) => {
          if (typeof s.date !== "string") return false;
          const inPeriod =
            statsView === "yearly" ? s.date.startsWith(selectedYear) : s.date.slice(0, 7) === statisticsMonth;
          return inPeriod && s.status !== "cancelled" && s.status !== "paid";
        })
        .reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [shifts, statsView, selectedYear, statisticsMonth],
  );

  const monthTemplateLabor = useMemo(
    () => sumTemplateLaborBetween(rangeStart, rangeEnd, employees, shifts),
    [rangeStart, rangeEnd, employees, shifts],
  );

  const monthLaborAccrual = monthShiftLaborAccrued + monthTemplateLabor;

  const prevMonthShiftLaborAccrued = useMemo(
    () =>
      shifts
        .filter((s) => {
          if (typeof s.date !== "string") return false;
          const inPrev =
            statsView === "yearly" ? s.date.startsWith(prevYearStr) : s.date.slice(0, 7) === prevMonthStr;
          return inPrev && s.status !== "cancelled" && s.status !== "paid";
        })
        .reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [shifts, statsView, prevMonthStr, prevYearStr],
  );

  const prevMonthTemplateLabor = useMemo(
    () => sumTemplateLaborBetween(prevRangeStart, prevRangeEnd, employees, shifts),
    [prevRangeStart, prevRangeEnd, employees, shifts],
  );

  const prevMonthLaborAccrual = prevMonthShiftLaborAccrued + prevMonthTemplateLabor;

  const mergedRevenue = sumEventAmounts(canonicalCurrent);
  const mergedTransactionCount = canonicalCurrent.length;
  const mergedAov = mergedTransactionCount ? mergedRevenue / mergedTransactionCount : 0;
  const monthExpensesTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const mergedNet = mergedRevenue - monthExpensesTotal - monthLaborAccrual;

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
  const monthSalaryLedger = monthExpenses.filter((e) => e.category === "salaries").reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const laborExpenses = monthSalaryLedger + monthLaborAccrual;
  const estimatedIngredientCost = ingredientExpenses || orderModuleCount * PIZZA_COST_ESTIMATE;
  const grossProfit = mergedRevenue - estimatedIngredientCost;
  const foodCostPct = mergedRevenue > 0 ? (estimatedIngredientCost / mergedRevenue) * 100 : 0;
  const laborCostPct = mergedRevenue > 0 ? (laborExpenses / mergedRevenue) * 100 : 0;

  const prevMonthExpenses = expenses.filter((e) =>
    statsView === "yearly"
      ? expenseCalendarDayKey(e).startsWith(prevYearStr)
      : expenseCalendarMonthKey(e) === prevMonthStr,
  );
  const prevMonthExpenseTotal = prevMonthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const prevMergedRevenue = sumEventAmounts(canonicalPrev);
  const prevMergedNet = prevMergedRevenue - prevMonthExpenseTotal - prevMonthLaborAccrual;

  const vsPriorLabel = statsView === "yearly" ? "previous year" : "previous month";
  const revenueChangeLabel = pctChangeLabel(mergedRevenue, prevMergedRevenue, vsPriorLabel);
  const ordersChangeLabel = pctChangeLabel(mergedTransactionCount, canonicalPrev.length, vsPriorLabel);
  const expensesChangeLabel = pctChangeLabel(monthExpensesTotal, prevMonthExpenseTotal, vsPriorLabel);
  const profitChangeLabel = pctChangeLabel(mergedNet, prevMergedNet, vsPriorLabel);

  const PIE_COLORS = ["#facc15", "#a16207", "#fef08a", "#84cc16", "#22d3ee", "#a78bfa", "#fb7185"];

  const selectedDayDate = useMemo(() => parseISO(`${selectedDay}T12:00:00`), [selectedDay]);
  const dayStart = startOfDay(selectedDayDate);
  const dayEnd = endOfDay(selectedDayDate);
  const dayCanonical = filterCanonicalEventsByDateRange(canonicalFull, dayStart, dayEnd);
  const dayMergedRevenue = sumEventAmounts(dayCanonical);
  const dayMergedCount = dayCanonical.length;
  const dayExpensesTotal = dayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const dayLaborAccrued = totalExpectedLaborForDate(selectedDay, employees, shifts);
  const dayNet = dayMergedRevenue - dayExpensesTotal - dayLaborAccrued;
  const dayStats = {
    totalRevenue: dayMergedRevenue,
    totalExpenses: dayExpensesTotal + dayLaborAccrued,
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
  const daySalaryLedger = dayExpenses
    .filter((e) => e.category === "salaries")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const dayLaborExpenses = daySalaryLedger + dayLaborAccrued;
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
    { name: "Expenses + labor", value: dayExpensesTotal + dayLaborAccrued },
    { name: "Net", value: dayNet },
  ];

  const statisticsTodayStr = getMexicoNowDateKey();

  const dailyLedgerRows = useMemo(() => {
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    return days
      .map((day) => {
        const ds = startOfDay(day);
        const de = endOfDay(day);
        const ev = filterCanonicalEventsByDateRange(canonicalFull, ds, de);
        const mergedPosNet = sumEventAmounts(ev);
        const dayStr = format(day, "yyyy-MM-dd");
        const dExp = expenses.filter((e) => expenseCalendarDayKey(e) === dayStr);
        const expensesSpent = dExp.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const laborAccrued = totalExpectedLaborForDate(dayStr, employees, shifts);
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
          weekdayLabel: format(day, "EEEE", { locale: es }),
          mergedPosNet,
          expensesSpent,
          laborAccrued,
          net: mergedPosNet - expensesSpent - laborAccrued,
          mergedEvents: ev.length,
          loyverse: sourceTotals.loyverse,
          clip: sourceTotals.clip,
          manual: sourceTotals.manual,
          orderModuleRevenue,
        };
      })
      .filter((r) => r.dateIso <= statisticsTodayStr);
  }, [rangeStart, rangeEnd, canonicalFull, expenses, orders, employees, shifts, statisticsTodayStr]);

  /** Table + Excel: newest calendar day first (chronological order kept in `dailyLedgerRows` for chart + totals). */
  const dailyLedgerRowsNewestFirst = useMemo(
    () => [...dailyLedgerRows].sort((a, b) => b.dateIso.localeCompare(a.dateIso)),
    [dailyLedgerRows],
  );

  const dailyLedgerTotals = useMemo(
    () =>
      dailyLedgerRows.reduce(
        (acc, r) => ({
          mergedPosNet: acc.mergedPosNet + r.mergedPosNet,
          expensesSpent: acc.expensesSpent + r.expensesSpent,
          laborAccrued: acc.laborAccrued + r.laborAccrued,
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
          laborAccrued: 0,
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
        date: format(parseISO(`${r.dateIso}T12:00:00`), "d MMM", { locale: es }),
        revenue: r.mergedPosNet,
        expenses: r.expensesSpent + r.laborAccrued,
        profit: r.net,
        orders: r.mergedEvents,
      })),
    [dailyLedgerRows],
  );

  const revenueChartData = useMemo(() => {
    if (statsView !== "yearly") return dailyRevenue;
    const map = new Map();
    dailyLedgerRows.forEach((r) => {
      const ym = r.dateIso.slice(0, 7);
      const cur = map.get(ym) || { revenue: 0, expenses: 0, profit: 0, orders: 0 };
      cur.revenue += r.mergedPosNet;
      cur.expenses += r.expensesSpent + r.laborAccrued;
      cur.profit += r.net;
      cur.orders += r.mergedEvents;
      map.set(ym, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => ({
        date: format(parseISO(`${ym}-01T12:00:00`), "MMM", { locale: es }),
        revenue: v.revenue,
        expenses: v.expenses,
        profit: v.profit,
        orders: v.orders,
      }));
  }, [statsView, dailyLedgerRows, dailyRevenue]);

  const topSellingDays = useMemo(() => {
    const rows = dailyLedgerRows.filter((r) => r.mergedPosNet > 0);
    return [...rows].sort((a, b) => b.mergedPosNet - a.mergedPosNet).slice(0, 10);
  }, [dailyLedgerRows]);

  const topSellingDaySlots = useMemo(
    () => Array.from({ length: 10 }, (_, i) => topSellingDays[i] || null),
    [topSellingDays],
  );

  const mergedSalesRhythm = useMemo(() => {
    const events = statsView === "daily" ? dayCanonical : canonicalCurrent;
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, revenue: 0, count: 0 }));
    const byWeekday = new Map();
    events.forEach((e) => {
      const h = getMexicoHourFromInstant(e.timestamp);
      if (h >= 0 && h <= 23) {
        byHour[h].revenue += e.amount;
        byHour[h].count += 1;
      }
      const wk = new Intl.DateTimeFormat("es-MX", {
        timeZone: MEXICO_DISPLAY_TIMEZONE,
        weekday: "long",
      }).format(e.timestamp);
      byWeekday.set(wk, (byWeekday.get(wk) || 0) + e.amount);
    });
    const topHours = [...byHour].filter((x) => x.revenue > 0).sort((a, b) => b.revenue - a.revenue);
    const weekdayRows = Array.from(byWeekday.entries())
      .map(([label, revenue]) => ({ label, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
    const maxHourRev = topHours[0]?.revenue ?? 0;
    return { topHours, weekdayRows, maxHourRev, eventCount: events.length };
  }, [statsView, dayCanonical, canonicalCurrent]);

  const showSalesRhythmCard =
    mergedSalesRhythm.eventCount > 0 &&
    (mergedSalesRhythm.topHours.length > 0 ||
      (statsView !== "daily" && mergedSalesRhythm.weekdayRows.length > 0));

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

  const minimalistTopSold = useMemo(() => {
    if (statsView === "daily") return dayTopItems.slice(0, 5);
    if (statsView === "monthly" || statsView === "yearly") return topItems.slice(0, 5);
    return [];
  }, [statsView, dayTopItems, topItems]);

  const handleOpenInExcel = () => {
    const headers = [
      "Date (ISO)",
      "Día (es-MX)",
      "Daily cash — merged POS net sales (MXN)",
      "Spent — Finance expenses incl. Shopping (MXN)",
      "Labor accrual — unpaid shifts + workday template (MXN)",
      "Net (MXN)",
      "Merged sales events",
      "Loyverse (MXN)",
      "Clip (MXN)",
      "Manual (MXN)",
      "Order module revenue (MXN)",
    ];
    const dataLines = dailyLedgerRowsNewestFirst.map((r) =>
      [
        r.dateIso,
        r.weekdayLabel,
        r.mergedPosNet.toFixed(2),
        r.expensesSpent.toFixed(2),
        r.laborAccrued.toFixed(2),
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
      dailyLedgerTotals.laborAccrued.toFixed(2),
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
    a.download = `daily-ledger-${statsView === "yearly" ? selectedYear : selectedMonth}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const expenseLedgerPeriodPhrase =
    statsView === "yearly" ? "calendar year" : statsView === "daily" ? "calendar day" : "calendar month";
  const orderModulePeriodPhrase =
    statsView === "yearly" ? "this year" : statsView === "daily" ? "this day" : "this month";

  /** Wording inside the combined monthly + yearly stats block (not used on daily view). */
  const periodStatsNoun = statsView === "yearly" ? "year" : "month";

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
      sub: mergedTransactionCount
        ? "Mean transaction amount after deduplication"
        : `No merged sales in selected ${statsView === "yearly" ? "year" : "month"}`,
      subTone: "neutral",
      icon: TrendingUp,
    },
    {
      label: "Expenses (Finance ledger)",
      value: formatCurrency(monthExpensesTotal),
      sub: expensesChangeLabel || `No comparison — Expense entity rows in this ${expenseLedgerPeriodPhrase}`,
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
          : `No orders in Order module ${orderModulePeriodPhrase}`,
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
        <div className="no-print grid grid-cols-3 gap-1 rounded-xl border border-yellow-500/20 bg-[#242424] p-1">
          {[
            { id: "daily", label: "Single day", mobileLabel: "Day" },
            { id: "monthly", label: "Monthly", mobileLabel: "Month" },
            { id: "yearly", label: "Yearly", mobileLabel: "Year" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatsView(tab.id);
                if (tab.id === "yearly") {
                  setSelectedYear(
                    statsView === "daily"
                      ? format(parseISO(`${selectedDay}T12:00:00`), "yyyy")
                      : selectedMonth.slice(0, 4),
                  );
                }
                if (tab.id === "monthly") {
                  if (statsView === "daily") {
                    setSelectedMonth(format(parseISO(`${selectedDay}T12:00:00`), "yyyy-MM"));
                  } else if (statsView === "yearly") {
                    setSelectedMonth((m) => `${selectedYear}-${m.slice(5, 7)}`);
                  }
                }
              }}
              className={cn(
                "rounded-lg px-2 py-2.5 text-center text-sm font-medium transition-colors sm:px-4",
                statsView === tab.id ? "bg-yellow-400/20 text-yellow-200" : "text-gray-400 hover:text-white",
              )}
            >
              <span className="sm:hidden">{tab.mobileLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="no-print rounded-xl border border-yellow-500/20 bg-[#242424] p-4 shadow-none">
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
          ) : statsView === "yearly" ? (
            <div className="max-w-md space-y-2">
              <label className="text-xs font-medium text-gray-400">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="border-yellow-500/20 bg-[#1a1a1a] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((option) => (
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

        {minimalistTopSold.length > 0 && (
          <div className={STATS_STRIP_CLASS}>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-yellow-500/55">Top sold</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {minimalistTopSold.map((item, i) => (
                <li key={item.name} className="flex min-w-0 items-baseline gap-1.5 text-gray-300">
                  <span className="shrink-0 text-yellow-500/45">{i + 1}.</span>
                  <span className="min-w-0 truncate text-gray-200">{item.name}</span>
                  <span className="shrink-0 text-gray-600">·</span>
                  <span className="shrink-0 tabular-nums text-yellow-200/85">{formatCurrency(item.revenue)}</span>
                  <span className="shrink-0 text-xs text-gray-500">({formatNumber(item.count)})</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(statsView === "monthly" || statsView === "yearly") && (
          <div className={STATS_STRIP_CLASS}>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-yellow-500/55">
              Best calendar days (merged POS - 1-10)
            </p>
            <div className="grid gap-x-4 sm:grid-cols-2">
              {[topSellingDaySlots.slice(0, 5), topSellingDaySlots.slice(5, 10)].map((column, columnIndex) => (
                <ol key={columnIndex} className="space-y-2">
                  {column.map((row, slotIndex) => {
                    const rank = columnIndex * 5 + slotIndex + 1;
                    const wdShort = row ? formatMexicoWeekdayShortFromDateKey(row.dateIso) : "";
                    return (
                      <li
                        key={row?.dateIso || `empty-day-rank-${rank}`}
                        className="flex min-h-9 items-center justify-between gap-3 border-b border-yellow-500/10 pb-2 text-sm"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="shrink-0 text-yellow-500/50">{rank}.</span>
                          {row ? (
                            <>
                              <time
                                dateTime={row.dateIso}
                                className="shrink-0 font-mono text-xs tabular-nums tracking-tight text-gray-400"
                              >
                                {row.dateIso}
                              </time>
                              {wdShort ? (
                                <span className="rounded-md border border-yellow-400/35 bg-yellow-400/[0.09] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-yellow-200/95">
                                  {wdShort}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                        {row ? (
                          <span className="shrink-0 tabular-nums font-medium text-yellow-200/90">
                            {formatCurrency(row.mergedPosNet)}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ))}
            </div>
          </div>
        )}

        {(statsView === "monthly" || statsView === "yearly") && (
          <Card className={STATS_LEDGER_CARD_CLASS}>
            <CardHeader className="flex flex-col gap-3 border-b border-yellow-500/25 bg-yellow-500/[0.12] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base text-yellow-100">Daily ledger</CardTitle>
                <p className="mt-1 text-xs text-yellow-200/70">
                  Daily cash = merged POS net sales; spent = Finance ledger for that day; labor accrual = unpaid shift payouts
                  plus roster workdays without a shift (same logic as Dashboard). Net subtracts both spent and labor accrual (paid
                  salaries stay inside spent). Rows are <strong className="font-medium text-yellow-100/90">newest day first</strong>
                  ; future calendar days in the selected {periodStatsNoun} are omitted (Mexico date).
                </p>
              </div>
              <Button
                type="button"
                onClick={handleOpenInExcel}
                disabled={dailyLedgerRowsNewestFirst.length === 0}
                className="no-print h-9 shrink-0 gap-2 border border-yellow-400/40 bg-yellow-500/20 text-xs text-yellow-100 hover:bg-yellow-500/30 disabled:pointer-events-none disabled:opacity-40"
                variant="outline"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Open in Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                {dailyLedgerRowsNewestFirst.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-gray-500">
                    No ledger rows yet for this period (all days may be in the future in Mexico time, or the range is empty).
                  </p>
                ) : (
                <table className="w-full min-w-[1000px] border-collapse text-left text-[11px] sm:text-xs">
                  <thead>
                    <tr className="border-b border-yellow-500/40 bg-yellow-500/20 text-[10px] font-semibold uppercase tracking-wide text-yellow-100">
                      <th className="sticky left-0 z-10 border-r border-yellow-500/30 bg-[#2a2610] px-2 py-2.5">Date</th>
                      <th className="border-r border-yellow-500/20 px-2 py-2.5">Día</th>
                      <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Daily cash (POS)</th>
                      <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Spent</th>
                      <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Labor accr.</th>
                      <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Net</th>
                      <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Events</th>
                      <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Loyverse</th>
                      <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Clip</th>
                      <th className="border-r border-yellow-500/20 px-2 py-2.5 text-right">Manual</th>
                      <th className="px-2 py-2.5 text-right">Order module</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyLedgerRowsNewestFirst.map((r, i) => (
                      <tr
                        key={r.dateIso}
                        className={cn(
                          "border-b border-yellow-500/20 transition-colors hover:bg-yellow-500/[0.06]",
                          i % 2 === 1 && "bg-black/20",
                        )}
                      >
                        <td
                          className={cn(
                            "sticky left-0 z-[1] border-r border-yellow-500/25 px-2 py-2 font-medium text-yellow-100/95 tabular-nums",
                            i % 2 === 1 ? "bg-[#1a1a1a]" : "bg-[#242424]",
                          )}
                        >
                          {r.dateIso}
                        </td>
                        <td className="border-r border-yellow-500/20 px-2 py-2 capitalize text-gray-300">{r.weekdayLabel}</td>
                        <td className="border-r border-yellow-500/20 px-2 py-2 text-right font-mono tabular-nums text-yellow-200">
                          {formatCurrencyDetailed(r.mergedPosNet)}
                        </td>
                        <td
                          className={cn(
                            "border-r border-yellow-500/20 px-2 py-2 text-right font-mono tabular-nums",
                            r.expensesSpent < 0 ? "text-red-400" : "text-amber-200/90",
                          )}
                        >
                          {r.expensesSpent < 0
                            ? `-${formatCurrencyDetailed(Math.abs(r.expensesSpent))}`
                            : formatCurrencyDetailed(r.expensesSpent)}
                        </td>
                        <td className="border-r border-yellow-500/20 px-2 py-2 text-right font-mono tabular-nums text-sky-200/90">
                          {formatCurrencyDetailed(r.laborAccrued)}
                        </td>
                        <td
                          className={cn(
                            "border-r border-yellow-500/20 px-2 py-2 text-right font-mono tabular-nums",
                            r.net >= 0 ? "text-emerald-300/90" : "text-red-300/90",
                          )}
                        >
                          {formatCurrencyDetailed(r.net)}
                        </td>
                        <td className="border-r border-yellow-500/20 px-2 py-2 text-right font-mono tabular-nums text-gray-200">
                          {formatNumber(r.mergedEvents)}
                        </td>
                        <td className="border-r border-yellow-500/20 px-2 py-2 text-right font-mono tabular-nums text-gray-300">
                          {formatCurrencyDetailed(r.loyverse)}
                        </td>
                        <td className="border-r border-yellow-500/20 px-2 py-2 text-right font-mono tabular-nums text-gray-300">
                          {formatCurrencyDetailed(r.clip)}
                        </td>
                        <td className="border-r border-yellow-500/20 px-2 py-2 text-right font-mono tabular-nums text-gray-300">
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
                      <td className="border-r border-yellow-500/20 px-2 py-2.5 text-right font-mono tabular-nums text-sky-200/90">
                        {formatCurrencyDetailed(dailyLedgerTotals.laborAccrued)}
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
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {showSalesRhythmCard && (
          <div className={STATS_STRIP_CLASS}>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-yellow-500/55">
              {statsView === "daily" ? "Hours today" : "When sales happen"} (merged POS · {MEXICO_DISPLAY_TIMEZONE})
            </p>
            {statsView !== "daily" && mergedSalesRhythm.weekdayRows.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-xs text-gray-500">By weekday in this period</p>
                <ul className="flex flex-wrap gap-2">
                  {mergedSalesRhythm.weekdayRows.map(({ label, revenue }) => (
                    <li
                      key={label}
                      className="rounded-md border border-yellow-500/25 bg-yellow-400/[0.06] px-2.5 py-1 text-xs"
                    >
                      <span className="font-medium capitalize text-yellow-200/95">{label}</span>
                      <span className="ml-1.5 tabular-nums text-gray-300">{formatCurrency(revenue)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {mergedSalesRhythm.topHours.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-gray-500">By hour (receipt / payment time)</p>
                <ul className="space-y-2">
                  {mergedSalesRhythm.topHours.slice(0, 10).map(({ hour, revenue, count }) => {
                    const endHourLabel = hour === 23 ? "24" : String(hour + 1).padStart(2, "0");
                    return (
                      <li key={hour} className="flex items-center gap-2 text-xs">
                        <span className="w-[108px] shrink-0 tabular-nums text-gray-400">
                          {String(hour).padStart(2, "0")}:00–{endHourLabel}:00
                        </span>
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full min-w-[6px] rounded-full bg-yellow-400/45"
                            style={{
                              width: mergedSalesRhythm.maxHourRev
                                ? `${Math.max(6, (revenue / mergedSalesRhythm.maxHourRev) * 100)}%`
                                : "6%",
                            }}
                          />
                        </div>
                        <span className="w-[4.5rem] shrink-0 text-right tabular-nums text-yellow-200/90">
                          {formatCurrency(revenue)}
                        </span>
                        <span className="w-8 shrink-0 text-right text-[10px] text-gray-500">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="no-print rounded-xl border border-yellow-500/20 bg-yellow-500/[0.06] p-4">
          <div className="flex gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400/90" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-yellow-200">Where each number comes from</p>
              <p className="mt-1 text-xs text-gray-400">
                <strong className="text-gray-300">Net sales &amp; sales events</strong> use the same pipeline as Dashboard: Loyverse receipts + approved Clip payments + manual contribution transactions, then duplicate removal (10 min window, prefer Loyverse).
                <strong className="text-gray-300"> Expenses</strong> are summed from Finance <strong>Expense</strong> rows
                {statsView === "daily"
                  ? " dated the selected calendar day."
                  : statsView === "yearly"
                    ? " in the selected calendar year."
                    : " in the calendar month."}
                <strong className="text-gray-300"> Order module</strong> shows in-app <strong>Order</strong> totals separately — those are not double-counted into net sales unless the same sale also appears in Loyverse/Clip/manual.
              </p>
            </div>
          </div>
        </div>

        <div>
          {statsView === "daily" && (
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
                <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <ChefHat className="h-3.5 w-3.5 text-yellow-400" />
                    Gross profit (rough)
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(dayGrossProfit)}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {dayIngredientExpenses ? "After ingredient expenses" : `Estimate ${PIZZA_COST_ESTIMATE} / order`}
                  </p>
                </div>
                <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <ChefHat className="h-3.5 w-3.5 text-yellow-400" />
                    Food cost %
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{dayFoodCostPct.toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-gray-400">vs merged POS net sales</p>
                </div>
                <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <Users className="h-3.5 w-3.5 text-yellow-400" />
                    Labor cost %
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{dayLaborExpenses ? `${dayLaborCostPct.toFixed(1)}%` : "—"}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {dayLaborExpenses ? "Paid salaries + unpaid shifts / workday template" : "No labor cost signal for this day"}
                  </p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border border-yellow-500/20 bg-[#242424] text-gray-200 shadow-none">
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

                <Card className="border border-yellow-500/20 bg-[#242424] text-gray-200 shadow-none">
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
              </div>

                <div className="mb-6 rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <h3 className="mb-1 text-sm font-medium text-yellow-200">Breakdown</h3>
                  <p className="mb-3 text-xs text-gray-400">Sales channel mix and top items for the selected day.</p>
                  <StatsDetailShortcuts channelId="stats-daily-channel" topItemsId="stats-daily-top-items" />
                  <div className="space-y-4">
                    <Card id="stats-daily-channel" className="scroll-mt-24 border border-yellow-500/20 bg-[#242424] text-gray-200 shadow-none">
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

                    <Card id="stats-daily-top-items" className="scroll-mt-24 border border-yellow-500/20 bg-[#242424] text-gray-200 shadow-none">
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
            </div>
          )}

          {(statsView === "monthly" || statsView === "yearly") && (
            <div>
              <h2 className="mb-4 text-xl font-bold sm:text-2xl">
                {statsView === "yearly"
                  ? `Yearly — ${selectedYear}`
                  : `Monthly — ${monthOptions.find((m) => m.value === selectedMonth)?.label}`}
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
                <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <ChefHat className="h-3.5 w-3.5 text-yellow-400" />
                    Gross profit (rough)
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(grossProfit)}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {ingredientExpenses ? "After ingredient expenses" : `Estimate ${PIZZA_COST_ESTIMATE} / order`}
                  </p>
                </div>
                <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <ChefHat className="h-3.5 w-3.5 text-yellow-400" />
                    Food cost %
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{foodCostPct.toFixed(1)}%</p>
                  <p className="mt-1 text-xs text-gray-400">vs merged POS net sales</p>
                </div>
                <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-yellow-200/70">
                    <Users className="h-3.5 w-3.5 text-yellow-400" />
                    Labor cost %
                  </div>
                  <p className="mt-2 text-2xl font-bold text-white">{laborExpenses ? `${laborCostPct.toFixed(1)}%` : "—"}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {laborExpenses
                      ? "Ledger salaries + unpaid shifts + workday template"
                      : `No labor cost signal this ${periodStatsNoun}`}
                  </p>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="border border-yellow-500/20 bg-[#242424] text-gray-200 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base text-yellow-100">Costs by category</CardTitle>
                    <p className="text-xs text-gray-400">All expense rows in selected {periodStatsNoun}</p>
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
                      <p className="text-sm text-gray-300">No expenses this {periodStatsNoun}.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-yellow-500/20 bg-[#242424] text-gray-200 shadow-none">
                    <CardHeader>
                      <CardTitle className="text-base text-yellow-100">
                        {statsView === "yearly"
                          ? "Revenue, expenses & net by month"
                          : "Revenue, expenses & net by day"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={statsView === "yearly" ? revenueChartData : dailyRevenue}>
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
              </div>

                <div className="mb-6 rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                  <h3 className="mb-1 text-sm font-medium text-yellow-200">Breakdown</h3>
                  <p className="mb-3 text-xs text-gray-400">
                    Sales channel mix and top items for the selected {periodStatsNoun}.
                  </p>
                  <StatsDetailShortcuts channelId="stats-month-channel" topItemsId="stats-month-top-items" />
                  <div className="space-y-4">
                    <Card id="stats-month-channel" className="scroll-mt-24 border border-yellow-500/20 bg-[#242424] text-gray-200 shadow-none">
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
                          <p className="py-12 text-center text-sm text-gray-300">
                            No merged sales with channel labels this {periodStatsNoun}.
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card id="stats-month-top-items" className="scroll-mt-24 border border-yellow-500/20 bg-[#242424] text-gray-200 shadow-none">
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
                          <p className="text-center text-sm text-gray-300">No line items for this {periodStatsNoun}.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
