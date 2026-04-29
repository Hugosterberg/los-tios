// @ts-nocheck
import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  ChefHat,
  CreditCard,
  PackageSearch,
  Pizza,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Store,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { subDays, addDays, eachDayOfInterval, format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";
import { getMexicoNowDateKey } from "@/lib/mexicoTime";
import { base44 } from "@/api/base44Client";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { getClipOverview, hasClipApiConfig } from "@/api/clip";
import { appParams } from "@/lib/app-params";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { aggregateTopReceiptLineItems, buildMergedCanonicalEvents, sumEventAmounts } from "@/lib/mergedSales";
import {
  getOpeningBalance,
  getOpeningCountMeta,
  listOpeningCountDiffs,
} from "@/lib/dailyCashLocal";
import { useDailyCashStoreSync } from "@/hooks/useDailyCashStoreSync";
import { useMonthUrlSync, isValidMonthKey, appendMonthParam } from "@/hooks/useMonthUrlSync";
import { formatMxn, formatCount } from "@/lib/format";
import { isLocalDevOrdersMode, listOrders } from "@/lib/local-dev-orders";
import {
  isLocalFinanceMode,
  localListExpenses,
  localListCompanyTransactions,
  localListEmployees,
  localListShifts,
} from "@/lib/localDevFinance";
import { sumTemplateLaborBetween, totalExpectedLaborForDate } from "@/lib/employeeLabor";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import KpiCard from "@/components/dashboard/KpiCard";
import KpiBreakdownDialog from "@/components/dashboard/KpiBreakdownDialog";
import InsightTable from "@/components/dashboard/InsightTable";
import AlertFeed from "@/components/dashboard/AlertFeed";
import { getDashboardSourceMeta } from "@/components/dashboard/sourceMeta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  alerts as mockAlerts,
  costsSummary as mockCostsSummary,
  costTrendVsBudget as mockCostTrendVsBudget,
  filterOptions,
  inventoryInsights as mockInventoryInsights,
  laborEfficiencyTrend as mockLaborEfficiencyTrend,
} from "@/features/dashboard/mockData";
import {
  buildAovTrendFromEvents,
  buildCatalogProductCards,
  buildCostTrendVsBudget,
  buildDashboardFilterWindow,
  buildHighestMarginProductsFromReceipts,
  buildInventoryForecast,
  buildInventoryRows,
  buildLaborEfficiencyTrend,
  buildOrdersByHourFromEvents,
  buildReceiptProductPerformance,
  buildRecentPurchases,
  buildSevenDayRevenueFromEvents,
  buildThirtyDayRevenueFromEvents,
  calculateDifference,
  DEDUPE_PRIORITY_OPTIONS,
  DEDUPE_WINDOW_OPTIONS,
  filterByDashboardWindow,
  formatDateSafe,
  formatDifference,
  formatExpensePaymentSource,
  formatSourceName,
  getClipPaymentAmount,
  getClipPaymentRefundAmount,
  getClipSettlementFeeAmount,
  getClipSettlementNetAmount,
  getClipSettlementStatus,
  getDashboardQueryStart,
  getDashboardQueryEnd,
  getEndOfToday,
  getExpenseAmount,
  getExpenseCategory,
  getReceiptGrossBeforeDiscount,
  getReceiptTotal,
  getRecordDate,
  getStartOfToday,
  getTrendFromDifference,
  matchesBranchFilter,
  matchesPaymentSourceFilter,
  matchesSalesChannelFilter,
  normalizePaymentMethod,
  parseDedupeWindowMinutes,
  sumOrderRevenue,
} from "@/lib/dashboardUtils";
import { createPageUrl } from "@/utils";

const dashboardFocusHref = (view) =>
  `${createPageUrl("Dashboard")}?focus=${view}`;

const formatCurrency = formatMxn;
const formatNumber = formatCount;

function SourceBadge({ source = "mock" }) {
  const resolved = getDashboardSourceMeta(source);

  return (
    <Badge className={`border ${resolved.tone}`}>{resolved.label}</Badge>
  );
}

function SelectField({ label, options, value, onChange }) {
  return (
    <label className="flex w-full min-w-0 flex-col gap-2 sm:min-w-[170px]">
      <span className="text-[11px] uppercase tracking-[0.2em] text-gray-500">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-14 w-full rounded-[28px] border-yellow-500/20 bg-[#202020] px-5 text-[15px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_30px_rgba(0,0,0,0.18)] transition-all duration-200 hover:border-yellow-400/30 hover:bg-[#242424] focus:ring-0 focus:ring-offset-0 data-[state=open]:border-yellow-400/40 data-[state=open]:bg-[#262626] data-[state=open]:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_0_4px_rgba(250,204,21,0.08)] [&>span]:text-left">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent
          className="rounded-[24px] border border-yellow-500/20 bg-[#202020] p-2 text-white shadow-[0_20px_50px_rgba(0,0,0,0.38)]"
          position="popper"
        >
          {options.map((option) => (
            <SelectItem
              key={option}
              value={option}
              className="min-h-[46px] rounded-2xl px-4 text-[15px] font-medium text-white focus:bg-yellow-400/15 focus:text-yellow-100"
            >
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function StatusBadge({ value }) {
  const normalized = String(value).toLowerCase();
  const styles =
    normalized === "matched" || normalized === "low"
      ? "border-yellow-400/25 bg-yellow-400/10 text-yellow-200"
      : normalized === "mismatch" || normalized === "critical"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : normalized === "pending" || normalized === "review"
          ? "border-yellow-400/20 bg-yellow-400/10 text-yellow-200"
          : "border-yellow-500/20 bg-yellow-500/8 text-yellow-200";

  return <Badge className={`border ${styles}`}>{value}</Badge>;
}

function ProductList({ title, items = [], source = "mock" }) {
  return (
    <DashboardPanel
      title={title}
      sourceBadge={<SourceBadge source={source} />}
      className="h-full"
    >
      <div className="space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <div
              key={item.id || `${title}-${index}`}
              className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"
            >
              <p className="text-sm font-semibold text-white">{item.product || "Unknown product"}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                <span>{formatNumber(item.units || 0)} units</span>
                <span className="text-yellow-500/50">-</span>
                <span>{item.revenue || formatCurrency(0)}</span>
              </div>
              <p className="mt-1 text-xs text-yellow-200/80">{item.margin || "No margin data"}</p>
              {item.href ? (
                <Link
                  to={item.href}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-yellow-300 hover:text-yellow-200"
                >
                  View details <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 text-sm text-gray-400">
            No product data available for the selected filters.
          </p>
        )}
      </div>
    </DashboardPanel>
  );
}


/** @typedef {{ mode: "calendar", start: Date, end: Date, label: string } | { mode: "rolling", start: Date | null, end: Date, label: string }} DashboardFilterWindow */

/**
 * @param {null | { y: number, m: number }} calendarMonth — `m` is 0–11
 * @param {string} selectedDateRange
 */
const CALENDAR_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const QUICK_RANGE_OPTIONS = ["Today", "Last week", "This year", "Last year"];

function getDefaultDashboardCalendarMonth() {
  const key = getMexicoNowDateKey();
  const y = Number(key.slice(0, 4));
  const m0 = Number(key.slice(5, 7)) - 1;
  if (Number.isFinite(y) && m0 >= 0 && m0 <= 11) {
    return { y, m: m0 };
  }
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const [selectedDateRange, setSelectedDateRange] = React.useState(QUICK_RANGE_OPTIONS[0]);
  const [calendarMonth, setCalendarMonth] = React.useState(null);
  const [calendarBrowseYear, setCalendarBrowseYear] = React.useState(() => getDefaultDashboardCalendarMonth().y);
  const [selectedDedupeWindow, setSelectedDedupeWindow] = React.useState(DEDUPE_WINDOW_OPTIONS[2]);
  const [selectedDedupePriority, setSelectedDedupePriority] = React.useState(DEDUPE_PRIORITY_OPTIONS[0]);
  const [kpiDetailItem, setKpiDetailItem] = React.useState(null);
  /* Bumped by useDailyCashStoreSync onStoreChange so the "Money at a glance" KPIs re-read
     opening balances / diff events after the DailyCash store migrates from AppSettings. */
  const [cashStoreTick, setCashStoreTick] = React.useState(0);
  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" || !appParams.appId || !appParams.serverUrl);
  const dashboardFilterWindow = React.useMemo(
    () => buildDashboardFilterWindow(calendarMonth, selectedDateRange),
    [calendarMonth, selectedDateRange],
  );

  /* Bidirectional sync of Dashboard's calendar-month picker with ?month=YYYY-MM.
     Active only when a calendar month is actually selected, so the rolling ranges
     ("Today", "Last week", etc.) never broadcast a misleading month to other tabs. */
  const calendarMonthKey = calendarMonth
    ? `${calendarMonth.y}-${String(calendarMonth.m + 1).padStart(2, "0")}`
    : "";
  const setCalendarMonthFromKey = React.useCallback((key) => {
    if (!isValidMonthKey(key)) return;
    const [y, m] = key.split("-").map(Number);
    setCalendarMonth({ y, m: m - 1 });
    setCalendarBrowseYear(y);
  }, []);
  useMonthUrlSync(calendarMonthKey, setCalendarMonthFromKey, { active: !!calendarMonth });
  const queryWindowStart = React.useMemo(() => {
    if (calendarMonth) {
      return new Date(calendarMonth.y, calendarMonth.m, 1);
    }
    return getDashboardQueryStart(selectedDateRange);
  }, [calendarMonth, selectedDateRange]);
  const queryWindowEnd = React.useMemo(() => {
    if (calendarMonth) {
      return new Date(calendarMonth.y, calendarMonth.m + 1, 0, 23, 59, 59, 999);
    }
    return getDashboardQueryEnd(selectedDateRange);
  }, [calendarMonth, selectedDateRange]);
  const dedupeWindowMs = React.useMemo(
    () => parseDedupeWindowMinutes(selectedDedupeWindow) * 60 * 1000,
    [selectedDedupeWindow],
  );

  const useLocalFinance = isLocalFinanceMode() || isLocalOnlyMode;
  const useLocalOrders = isLocalDevOrdersMode || isLocalOnlyMode;

  /* Bootstraps the Daily Cash store so opening counts + diff events are readable on this page.
     Dashboard is read-only against the store, but the same persistence is shared with DailyCash/
     Shopping — keeping it in sync lets "Cash in drawer" and the variance chart render correctly. */
  useDailyCashStoreSync({
    onStoreChange: () => setCashStoreTick((t) => t + 1),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });
  const appSettings = React.useMemo(() => getResolvedIntegrationSettings(settings[0] || {}), [settings]);

  const ordersQuery = useQuery({
    queryKey: ["orders", useLocalOrders ? "local" : "remote"],
    queryFn: () =>
      listOrders((orderBy) => base44.entities.Order.list(orderBy), "-created_date", { forceLocal: useLocalOrders }),
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListExpenses() : base44.entities.Expense.list("-date")),
  });

  const transactionsQuery = useQuery({
    queryKey: ["companyTransactions", useLocalFinance ? "local" : "remote"],
    queryFn: () =>
      useLocalFinance ? localListCompanyTransactions() : base44.entities.CompanyTransaction.list("-date"),
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListEmployees() : base44.entities.Employee.list("name")),
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListShifts() : base44.entities.Shift.list("-date")),
  });

  const loyverseQuery = useQuery({
    queryKey: ["loyverseOverview", settings[0]?.id || "none", queryWindowStart?.toISOString() || "all", queryWindowEnd.toISOString()],
    queryFn: () => getLoyverseOverview(appSettings, {
      start: queryWindowStart,
      end: queryWindowEnd,
    }),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });

  const clipQuery = useQuery({
    queryKey: ["clipOverview", settings[0]?.id || "none", queryWindowStart?.toISOString() || "all", queryWindowEnd.toISOString()],
    queryFn: () => getClipOverview(appSettings, {
      start: queryWindowStart,
      end: queryWindowEnd,
    }),
    enabled: hasClipApiConfig(appSettings),
    staleTime: 60_000,
  });

  const focusTarget = searchParams.get("focus");

  React.useEffect(() => {
    if (!focusTarget) {
      return;
    }
    const element = document.getElementById(focusTarget);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [focusTarget]);

  const orders = ordersQuery.data || [];
  const expenses = expensesQuery.data || [];
  const transactions = transactionsQuery.data || [];
  const employees = employeesQuery.data || [];
  const shifts = shiftsQuery.data || [];
  const loyverseOverview = loyverseQuery.data;
  const clipOverview = clipQuery.data;
  const receipts = loyverseOverview?.receipts || [];
  const clipPayments = clipOverview?.payments || [];
  const clipSettlements = clipOverview?.settlements || [];

  /* ---------------- Money at a glance (same window as calendar / quick range above) ---------------- */
  const glanceRangeStart = dashboardFilterWindow.start;
  const glanceRangeEnd = dashboardFilterWindow.end;
  const glanceRangeStartKey =
    glanceRangeStart && glanceRangeEnd ? formatDateSafe(glanceRangeStart, "yyyy-MM-dd") : "";
  const glanceRangeEndKey =
    glanceRangeStart && glanceRangeEnd ? formatDateSafe(glanceRangeEnd, "yyyy-MM-dd") : "";

  const dashboardAllSourcesSalesFilter = React.useMemo(
    () => ({
      paymentSource: filterOptions.paymentSources[0],
      branch: filterOptions.branches[0],
      channel: filterOptions.salesChannels[0],
    }),
    [],
  );

  const kpiCanonicalEvents = React.useMemo(() => {
    if (!glanceRangeStart || !glanceRangeEnd) {
      return [];
    }
    const inWindow = (record) => {
      const d = getRecordDate(record);
      return d >= glanceRangeStart && d <= glanceRangeEnd;
    };
    const { canonicalEvents } = buildMergedCanonicalEvents({
      receipts: receipts.filter(inWindow),
      clipPayments: clipPayments.filter(inWindow),
      contributionTransactions: transactions
        .filter((t) => t?.type === "contribution")
        .filter(inWindow),
      stores: loyverseOverview?.stores || [],
      dedupeWindowMs,
      priorityMode: selectedDedupePriority,
      paymentSource: dashboardAllSourcesSalesFilter.paymentSource,
      branch: dashboardAllSourcesSalesFilter.branch,
      channel: dashboardAllSourcesSalesFilter.channel,
    });
    return canonicalEvents;
  }, [
    receipts,
    clipPayments,
    transactions,
    loyverseOverview,
    dedupeWindowMs,
    selectedDedupePriority,
    glanceRangeStart,
    glanceRangeEnd,
    dashboardAllSourcesSalesFilter,
  ]);

  const kpiSalesTotal = React.useMemo(() => sumEventAmounts(kpiCanonicalEvents), [kpiCanonicalEvents]);

  const kpiExpensesTotal = React.useMemo(() => {
    if (!glanceRangeStartKey || !glanceRangeEndKey) return 0;
    return expenses
      .filter((e) => {
        const dk = String(e?.date || "").slice(0, 10);
        return dk >= glanceRangeStartKey && dk <= glanceRangeEndKey;
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses, glanceRangeStartKey, glanceRangeEndKey]);

  const kpiWithdrawalsTotal = React.useMemo(() => {
    if (!glanceRangeStartKey || !glanceRangeEndKey) return 0;
    return transactions
      .filter((t) => t?.type === "withdrawal")
      .filter((t) => {
        const dk = String(t?.date || "").slice(0, 10);
        return dk >= glanceRangeStartKey && dk <= glanceRangeEndKey;
      })
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }, [transactions, glanceRangeStartKey, glanceRangeEndKey]);

  const kpiNet = kpiSalesTotal - kpiExpensesTotal - kpiWithdrawalsTotal;

  const glanceCashSnapshot = React.useMemo(() => {
    if (!glanceRangeStartKey || !glanceRangeEndKey) {
      return { amount: null, dateKey: null, countedAtIso: null, diff: null };
    }
    const diffs = listOpeningCountDiffs().filter(
      (ev) => ev?.dateKey && ev.dateKey >= glanceRangeStartKey && ev.dateKey <= glanceRangeEndKey,
    );
    const latest = diffs.length > 0 ? diffs[0] : null;
    if (latest) {
      const n = Number(latest.enteredOpening);
      return {
        amount: Number.isFinite(n) ? n : null,
        dateKey: latest.dateKey,
        countedAtIso: latest.ts || null,
        diff: latest.diff ?? null,
      };
    }
    const endOpening = Number(getOpeningBalance(glanceRangeEndKey));
    if (Number.isFinite(endOpening)) {
      const meta = getOpeningCountMeta(glanceRangeEndKey);
      return {
        amount: endOpening,
        dateKey: glanceRangeEndKey,
        countedAtIso: meta?.updatedAt ?? null,
        diff: null,
      };
    }
    return { amount: null, dateKey: glanceRangeEndKey, countedAtIso: null, diff: null };
  }, [cashStoreTick, glanceRangeStartKey, glanceRangeEndKey]);

  const glanceCashAgeLabel = React.useMemo(() => {
    const iso = glanceCashSnapshot.countedAtIso;
    if (!iso) return "No count logged in this period";
    try {
      return `Counted ${formatDistanceToNowStrict(new Date(iso), { addSuffix: true, locale: enUS })}`;
    } catch {
      return "Counted in period";
    }
  }, [glanceCashSnapshot.countedAtIso]);

  /* Cash variance over the last 30 Mexico-calendar days. One bar per day; only days where a
     manual count was actually performed produce a bar (zero-days are omitted — otherwise the chart
     would be mostly empty when the shop is not counting daily). */
  const cashVariance30d = React.useMemo(() => {
    const diffs = listOpeningCountDiffs();
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const byDay = new Map();
    for (const ev of diffs) {
      if (!ev?.dateKey) continue;
      if (typeof ev.diff !== "number" || !Number.isFinite(ev.diff)) continue;
      const ts = ev.ts ? new Date(ev.ts) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;
      if (ts < start || ts > now) continue;
      const prev = byDay.get(ev.dateKey);
      /* Keep the latest count per day (list is newest-first so "first seen" wins). */
      if (!prev) byDay.set(ev.dateKey, { dateKey: ev.dateKey, diff: ev.diff, ts });
    }
    return Array.from(byDay.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [cashStoreTick]);

  const cashVarianceTotal = cashVariance30d.reduce((sum, d) => sum + d.diff, 0);
  const cashVarianceBiggest = cashVariance30d.reduce(
    (worst, d) => (Math.abs(d.diff) > Math.abs(worst?.diff ?? 0) ? d : worst),
    null,
  );

  const clipPaymentsPayload = clipOverview?.raw?.paymentsPayload || null;
  const clipSettlementsPayload = clipOverview?.raw?.settlementsPayload || null;
  const filteredOrders = filterByDashboardWindow(orders, dashboardFilterWindow);
  const filteredExpenses = filterByDashboardWindow(expenses, dashboardFilterWindow);
  const expenseLedgerRows = React.useMemo(
    () =>
      [...filteredExpenses]
        .sort((a, b) => getRecordDate(b).getTime() - getRecordDate(a).getTime())
        .map((expense) => ({
          id: expense.id,
          date: formatDateSafe(expense.date, "yyyy-MM-dd", "—"),
          name: expense.name || "—",
          category: getExpenseCategory(expense) || "other",
          amount: getExpenseAmount(expense),
          payment: formatExpensePaymentSource(expense.payment_source),
          origin: expense.from_shopping_list ? "Shopping" : "Finance",
        })),
    [filteredExpenses],
  );
  const filteredTransactions = filterByDashboardWindow(transactions, dashboardFilterWindow);
  const filteredShifts = filterByDashboardWindow(shifts, dashboardFilterWindow).filter(
    (shift) => shift.status !== "removed" && !String(shift.notes || "").includes("[lt_removed_shift]"),
  );
  const filteredReceipts = filterByDashboardWindow(receipts, dashboardFilterWindow);
  const filteredClipPayments = filterByDashboardWindow(clipPayments, dashboardFilterWindow);
  const filteredClipSettlements = filterByDashboardWindow(clipSettlements, dashboardFilterWindow);
  const displayPeriodLabel = dashboardFilterWindow.mode === "calendar" ? dashboardFilterWindow.label : selectedDateRange;
  const selectedRangeLabelLower = displayPeriodLabel.toLowerCase();
  /** Rolling "Today" only — week/year/month contexts hide pure today-only sections. */
  const isDayOnlyDashboardContext = !calendarMonth && selectedDateRange === "Today";

  const deliveredOrders = filteredOrders.filter((order) => order.status === "delivered");
  const activeOrders = filteredOrders.filter((order) => ["pending", "preparing", "ready", "out_for_delivery"].includes(order.status)).length;
  const todayStart = getStartOfToday();
  const weekStart = subDays(todayStart, 6);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const todayCancelledOrders = filteredOrders.filter((order) => order.status === "cancelled").length;
  const todayDelayedOrders = filteredOrders.filter((order) => Number(order.estimated_delivery_minutes || 0) > 35).length;
  const todayRefundCount = filteredClipPayments.filter((payment) => getClipPaymentRefundAmount(payment) > 0).length;
  const prepTimeOrders = filteredOrders.filter((order) => Number(order.preparation_minutes || order.estimated_delivery_minutes || 0) > 0);
  const avgPrepTime = prepTimeOrders.length
    ? Math.round(prepTimeOrders.reduce((sum, order) => sum + Number(order.preparation_minutes || order.estimated_delivery_minutes || 0), 0) / prepTimeOrders.length)
    : 0;
  const ordersInKitchen = filteredOrders.filter((order) => order.status === "preparing").length;
  const ordersOutForDelivery = filteredOrders.filter((order) => order.status === "out_for_delivery").length;

  const totalRevenue = sumOrderRevenue(deliveredOrders);
  const shiftExpenseIds = new Set(filteredShifts.map((shift) => shift.expense_id).filter(Boolean));
  const ingredientExpenseRows = filteredExpenses.filter((expense) => getExpenseCategory(expense) === "ingredients");
  const shoppingIngredientExpenseRows = ingredientExpenseRows.filter((expense) => expense.from_shopping_list);
  const manualIngredientExpenseRows = ingredientExpenseRows.filter((expense) => !expense.from_shopping_list);
  const salaryExpenseRows = filteredExpenses.filter((expense) => getExpenseCategory(expense) === "salaries");
  const shiftLaborExpenseRows = salaryExpenseRows.filter((expense) => shiftExpenseIds.has(expense.id));
  const recurringExpenseRows = filteredExpenses.filter((expense) => expense.is_recurring);
  const otherOperatingExpenseRows = filteredExpenses.filter((expense) => {
    const category = getExpenseCategory(expense);
    return category !== "ingredients" && category !== "salaries" && !expense.is_recurring;
  });
  const totalExpenseLedger = filteredExpenses.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const shoppingIngredientExpenses = shoppingIngredientExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const manualIngredientExpenses = manualIngredientExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const rawIngredientExpenses = shoppingIngredientExpenses || manualIngredientExpenses;
  // Fallback: estimate ingredient cost at MXN 80 per order when no expense data exists
  const PIZZA_COST_ESTIMATE = 80;
  const estimatedIngredientCost = filteredOrders.length * PIZZA_COST_ESTIMATE;
  const ingredientExpenses = rawIngredientExpenses || estimatedIngredientCost;
  const isIngredientCostEstimated = !rawIngredientExpenses && estimatedIngredientCost > 0;
  const shiftLaborExpenseTotal = shiftLaborExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  /** Salary expenses booked in Finance (includes shift-linked payouts when marked paid). */
  const salaryLedgerInRange = salaryExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  /** Scheduled / completed shifts not yet paid — economic labor cost from the calendar. */
  const unpaidShiftLaborAccrued = filteredShifts
    .filter((s) => s.status !== "cancelled" && s.status !== "paid")
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const templateLaborAccrued = React.useMemo(() => {
    if (!dashboardFilterWindow.start) {
      return 0;
    }
    const laborEnd = dashboardFilterWindow.mode === "calendar" ? dashboardFilterWindow.end : getEndOfToday();
    return sumTemplateLaborBetween(dashboardFilterWindow.start, laborEnd, employees, shifts);
  }, [dashboardFilterWindow, employees, shifts]);
  const laborExpenses = salaryLedgerInRange + unpaidShiftLaborAccrued + templateLaborAccrued;
  const recurringExpenses = recurringExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const otherOperatingExpenses = otherOperatingExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const ingredientExpensesInRange = ingredientExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const laborExpensesInRange = laborExpenses;
  const filteredRefundVolume = filteredClipPayments.reduce((sum, payment) => sum + getClipPaymentRefundAmount(payment), 0);
  const paymentFees = filteredClipSettlements.reduce((sum, settlement) => sum + getClipSettlementFeeAmount(settlement), 0);
  const grossSales = filteredReceipts.length ? filteredReceipts.reduce((sum, receipt) => sum + getReceiptGrossBeforeDiscount(receipt), 0) : totalRevenue;

  const totalExpenses = totalExpenseLedger + paymentFees;
  const grossProfit = grossSales - ingredientExpenses;
  const netProfit = grossSales - ingredientExpenses - laborExpenses - recurringExpenses - otherOperatingExpenses - paymentFees;
  const foodCostPct = grossSales ? (ingredientExpenses / grossSales) * 100 : 0;
  const laborCostPct = grossSales ? (laborExpenses / grossSales) * 100 : 0;
  const failedSettlementsCount = filteredClipSettlements.filter((settlement) => {
    const status = getClipSettlementStatus(settlement);
    return status.includes("fail") || status.includes("declin") || status.includes("error");
  }).length;
  const completedReceiptsCount = filteredReceipts.filter((receipt) => {
    const status = String(receipt?.status || receipt?.receipt_status || (receipt?.canceled_at ? "cancelled" : "completed")).toLowerCase();
    return !status.includes("cancel");
  }).length;
  const cancelledReceiptsCount = filteredReceipts.filter((receipt) => {
    const status = String(receipt?.status || receipt?.receipt_status || (receipt?.canceled_at ? "cancelled" : "completed")).toLowerCase();
    return status.includes("cancel");
  }).length;
  const cancellationRate = completedReceiptsCount + cancelledReceiptsCount
    ? (cancelledReceiptsCount / (completedReceiptsCount + cancelledReceiptsCount)) * 100
    : 0;

  const approvedClipPayments = filteredClipPayments.filter((payment) => {
    const status = String(payment.status || "").toLowerCase();
    return status.includes("approved") || status.includes("paid");
  });
  const firstApprovedClipPayment = approvedClipPayments[0] || clipPayments[0] || null;
  const firstFilteredReceipt = filteredReceipts[0] || receipts[0] || null;
  const clipApprovedTotal = approvedClipPayments.reduce((sum, payment) => sum + getClipPaymentAmount(payment), 0);
  const loyverseSalesTotal = filteredReceipts.reduce((sum, receipt) => sum + getReceiptTotal(receipt), 0);
  const manualContributionTransactions = filteredTransactions.filter((transaction) => transaction.type === "contribution");
  const hasManualContributionRecords = transactions.some((transaction) => transaction.type === "contribution");
  /** Badge for unified sales KPIs: use configured integrations, not "empty range" (zero sales still means live sources). */
  const salesPipelineDataSource =
    hasClipApiConfig(appSettings) && hasLoyverseApiConfig(appSettings)
      ? "both"
      : hasClipApiConfig(appSettings)
        ? "clip"
        : hasLoyverseApiConfig(appSettings)
          ? "loyverse"
          : hasManualContributionRecords
            ? "manual"
            : "mock";
  const { canonicalEvents: filteredCanonicalSalesEvents, duplicates: mergedSaleDuplicates } = buildMergedCanonicalEvents({
    receipts: filteredReceipts,
    clipPayments: filteredClipPayments,
    contributionTransactions: manualContributionTransactions,
    stores: loyverseOverview?.stores || [],
    dedupeWindowMs,
    priorityMode: selectedDedupePriority,
    paymentSource: dashboardAllSourcesSalesFilter.paymentSource,
    branch: dashboardAllSourcesSalesFilter.branch,
    channel: dashboardAllSourcesSalesFilter.channel,
  });
  /* Top 10 best-selling dishes in the selected filter window. Uses Loyverse receipt line items
     only because line-level data isn't available for Clip/manual yet. */
  const topDishesInPeriod = React.useMemo(
    () => aggregateTopReceiptLineItems(filteredCanonicalSalesEvents, 10),
    [filteredCanonicalSalesEvents],
  );
  const topDishesRevenue = topDishesInPeriod.reduce((sum, r) => sum + (r.revenue || 0), 0);

  /* Top 10 cost centers in the same window — groups expenses by name (case-insensitive, trimmed)
     across all categories so "Harina" and "Water" show up alongside "Rent" / "Electricity". */
  const topExpensesByName = React.useMemo(() => {
    const byKey = new Map();
    for (const e of filteredExpenses) {
      const raw = (e?.name || "").trim();
      const key = raw.toLowerCase();
      if (!key) continue;
      const prev = byKey.get(key);
      const amount = Number(e?.amount || 0);
      if (prev) {
        prev.total += amount;
        prev.count += 1;
        prev.names.set(raw, (prev.names.get(raw) || 0) + 1);
        if (!prev.category) prev.category = getExpenseCategory(e) || "";
      } else {
        byKey.set(key, {
          key,
          total: amount,
          count: 1,
          category: getExpenseCategory(e) || "",
          names: new Map([[raw, 1]]),
        });
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
        return { key: g.key, name: bestName, total: g.total, count: g.count, category: g.category };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredExpenses]);
  const topExpensesTotal = topExpensesByName.reduce((sum, r) => sum + r.total, 0);

  const currentDaySalesEvents = filteredCanonicalSalesEvents.filter((event) => event.timestamp >= todayStart);
  const currentWeekSalesEvents = filteredCanonicalSalesEvents.filter((event) => event.timestamp >= weekStart);
  const currentMonthSalesEvents = filteredCanonicalSalesEvents.filter((event) => event.timestamp >= monthStart);
  const previousDaySalesEvents = filteredCanonicalSalesEvents.filter((event) => {
    return event.timestamp >= subDays(todayStart, 7) && event.timestamp < subDays(todayStart, 6);
  });
  const previousWeekSalesEvents = filteredCanonicalSalesEvents.filter((event) => {
    return event.timestamp >= subDays(todayStart, 13) && event.timestamp < subDays(todayStart, 6);
  });
  const previousMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1);
  const previousMonthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const previousMonthSalesEvents = filteredCanonicalSalesEvents.filter((event) => {
    return event.timestamp >= previousMonthStart && event.timestamp < previousMonthEnd;
  });
  const previousSelectedSalesEvents = (() => {
    if (!dashboardFilterWindow.start) {
      return [];
    }
    if (dashboardFilterWindow.mode === "calendar") {
      const ms = dashboardFilterWindow.start.getMonth();
      const ys = dashboardFilterWindow.start.getFullYear();
      const prevStart = new Date(ys, ms - 1, 1);
      const prevEnd = new Date(ys, ms, 0, 23, 59, 59, 999);
      return filteredCanonicalSalesEvents.filter((event) => event.timestamp >= prevStart && event.timestamp <= prevEnd);
    }
    const selectedRangeStart = dashboardFilterWindow.start;
    const diff = todayStart.getTime() - selectedRangeStart.getTime();
    const previousStart = new Date(selectedRangeStart.getTime() - diff - 86400000);
    const previousEnd = new Date(todayStart.getTime() - diff - 86400000);
    return filteredCanonicalSalesEvents.filter((event) => event.timestamp >= previousStart && event.timestamp < previousEnd);
  })();
  const filteredDuplicateRowsRaw = mergedSaleDuplicates.filter(({ duplicate, canonical }) =>
    (
      matchesPaymentSourceFilter(duplicate, dashboardAllSourcesSalesFilter.paymentSource)
      && matchesBranchFilter(duplicate, dashboardAllSourcesSalesFilter.branch)
      && matchesSalesChannelFilter(duplicate, dashboardAllSourcesSalesFilter.channel)
    ) || (
      matchesPaymentSourceFilter(canonical, dashboardAllSourcesSalesFilter.paymentSource)
      && matchesBranchFilter(canonical, dashboardAllSourcesSalesFilter.branch)
      && matchesSalesChannelFilter(canonical, dashboardAllSourcesSalesFilter.channel)
    ),
  );
  const filteredDeduplicationRows = filteredDuplicateRowsRaw.slice(0, 20).map(({ duplicate, canonical, matchedWithinMinutes }, index) => ({
    id: `dedupe-filtered-${index}`,
    removed_source: formatSourceName(duplicate.source),
    kept_source: formatSourceName(canonical.source),
    amount: formatCurrency(duplicate.amount),
    removed_time: formatDateSafe(duplicate.timestamp, "yyyy-MM-dd HH:mm"),
    kept_time: formatDateSafe(canonical.timestamp, "yyyy-MM-dd HH:mm"),
    payment_method: duplicate.paymentMethod || "unknown",
    branch: canonical.branch || duplicate.branch || "Unknown",
    channel: canonical.channel || duplicate.channel || "Unknown",
    matched_window: `${matchedWithinMinutes} min`,
  }));
  const deduplicatedSalesCount = mergedSaleDuplicates.length;
  const filteredClipSalesTotal = filteredCanonicalSalesEvents
    .filter((event) => event.source === "clip")
    .reduce((sum, event) => sum + event.amount, 0);
  const filteredManualContributionTotal = filteredCanonicalSalesEvents
    .filter((event) => event.source === "manual")
    .reduce((sum, event) => sum + event.amount, 0);
  const filteredLoyverseSalesTotal = filteredCanonicalSalesEvents
    .filter((event) => event.source === "loyverse")
    .reduce((sum, event) => sum + event.amount, 0);
  const filteredLoyverseReceipts = filteredCanonicalSalesEvents
    .filter((event) => event.source === "loyverse")
    .map((event) => event.payload)
    .filter(Boolean);
  const filteredDeduplicatedSalesCount = filteredDuplicateRowsRaw.length;
  const filteredSalesTotal = filteredCanonicalSalesEvents.reduce((sum, event) => sum + event.amount, 0);
  const salesTransactionCount = filteredCanonicalSalesEvents.length;
  const averageTransactionValue = salesTransactionCount
    ? filteredCanonicalSalesEvents.reduce((sum, event) => sum + event.amount, 0) / salesTransactionCount
    : 0;
  const appCardTotal = filteredOrders
    .filter((order) => order.payment_method === "card")
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const todayCardOrdersCount = filteredOrders.filter((order) => order.payment_method === "card").length;
  const depositTotal = filteredClipSettlements.reduce((sum, settlement) => sum + getClipSettlementNetAmount(settlement), 0);
  const netSales = filteredLoyverseSalesTotal + filteredClipSalesTotal + filteredManualContributionTotal;
  const aov = averageTransactionValue;
  const unsettledClipPayments = approvedClipPayments.filter((payment) => {
    const paidAt = getRecordDate(payment);
    const ageMs = Date.now() - paidAt.getTime();
    return ageMs > 24 * 60 * 60 * 1000;
  });
  const eligibleSettlementsTotal = unsettledClipPayments.reduce((sum, payment) => sum + getClipPaymentAmount(payment), 0);
  const pendingSettlements = Math.max(eligibleSettlementsTotal - depositTotal, 0);
  const mismatch = clipApprovedTotal - appCardTotal;
  const bankTransferTotal = filteredTransactions
    .filter((transaction) => normalizePaymentMethod(transaction.payment_method) === "transfer")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

  const ordersCount = salesTransactionCount;
  const clipFilterActive =
    dashboardAllSourcesSalesFilter.paymentSource === "All sources" ||
    dashboardAllSourcesSalesFilter.paymentSource === "Clip";
  const costPerOrder = ordersCount ? totalExpenses / ordersCount : 0;
  const comparisonCards = [
    {
      id: "day-compare",
      label: "This day vs same day last week",
      current: currentDaySalesEvents.reduce((sum, event) => sum + event.amount, 0),
      previous: previousDaySalesEvents.reduce((sum, event) => sum + event.amount, 0),
    },
    {
      id: "week-compare",
      label: "This week vs last week",
      current: currentWeekSalesEvents.reduce((sum, event) => sum + event.amount, 0),
      previous: previousWeekSalesEvents.reduce((sum, event) => sum + event.amount, 0),
    },
    {
      id: "month-compare",
      label: "This month vs last month",
      current: currentMonthSalesEvents.reduce((sum, event) => sum + event.amount, 0),
      previous: previousMonthSalesEvents.reduce((sum, event) => sum + event.amount, 0),
    },
    {
      id: "selected-compare",
      label: "Selected period vs previous period",
      current: filteredSalesTotal,
      previous: previousSelectedSalesEvents.reduce((sum, event) => sum + event.amount, 0),
    },
  ]
    .filter((item) => isDayOnlyDashboardContext || item.id !== "day-compare")
    .map((item) => {
    const difference = calculateDifference(item.current, item.previous);
    return {
      ...item,
      currentLabel: formatCurrency(item.current),
      previousLabel: item.previous ? formatCurrency(item.previous) : "No prior period",
      deltaLabel: formatDifference(difference),
      trend: getTrendFromDifference(difference),
    };
  });
  const primaryComparisonCard = comparisonCards.find((item) => item.id === "selected-compare") || comparisonCards[0];

  const revenue7Days = buildSevenDayRevenueFromEvents(filteredCanonicalSalesEvents);
  const revenue30Days = buildThirtyDayRevenueFromEvents(filteredCanonicalSalesEvents);
  const ordersByHourToday = buildOrdersByHourFromEvents(filteredCanonicalSalesEvents);
  const salesByChannel = filteredCanonicalSalesEvents.reduce((channels, event) => {
    const fillByChannel = {
      "Direct web": "#fbbf24",
      "Dine-in": "#fb7185",
      "Pickup": "#38bdf8",
      "Delivery app": "#4ade80",
      Unknown: "#737373",
    };
    const existing = channels.find((channel) => channel.name === event.channel);
    if (existing) {
      existing.value += event.amount;
      return channels;
    }

    channels.push({
      name: event.channel,
      value: event.amount,
      fill: fillByChannel[event.channel] || "#737373",
    });
    return channels;
  }, []);
  const aovTrend = buildAovTrendFromEvents(filteredCanonicalSalesEvents);
  const productDetailsHref = dashboardFocusHref("products");
  const bestSellingProducts = filteredLoyverseReceipts.length
    ? buildReceiptProductPerformance(filteredLoyverseReceipts, "top", formatCurrency, productDetailsHref)
    : buildCatalogProductCards(loyverseOverview?.items || [], "top", filteredClipPayments, formatCurrency, productDetailsHref);
  const highestMarginProducts = filteredLoyverseReceipts.length
    ? buildHighestMarginProductsFromReceipts(filteredLoyverseReceipts, formatCurrency, productDetailsHref)
    : buildCatalogProductCards(loyverseOverview?.items || [], "top", filteredClipPayments, formatCurrency, productDetailsHref);
  const worstPerformingProducts = filteredLoyverseReceipts.length
    ? buildReceiptProductPerformance(filteredLoyverseReceipts, "bottom", formatCurrency, productDetailsHref)
    : buildCatalogProductCards(loyverseOverview?.items || [], "bottom", filteredClipPayments, formatCurrency, productDetailsHref);
  const inventoryRows = buildInventoryRows(loyverseOverview);
  const recentPurchases = buildRecentPurchases(filteredExpenses, formatCurrency);
  const inventoryForecast = buildInventoryForecast(inventoryRows);
  const laborCostForecastItems = React.useMemo(() => {
    const items = [];
    const today = getStartOfToday();
    const horizonStart = addDays(today, 1);
    const horizonEnd = addDays(today, 14);
    for (const day of eachDayOfInterval({ start: horizonStart, end: horizonEnd })) {
      const ds = format(day, "yyyy-MM-dd");
      const t = totalExpectedLaborForDate(ds, employees, shifts);
      if (t <= 0) continue;
      items.push({
        id: `labor-forecast-${ds}`,
        ingredient: `Labor · ${format(day, "EEE, MMM d")}`,
        risk: `Expected cost about ${formatCurrency(t)} (unpaid shifts + workday template)`,
        action: "Confirm shifts in Employee Calendar; payouts appear as salary expenses when marked paid.",
      });
    }
    return items.slice(0, 7);
  }, [employees, shifts]);
  const laborEfficiencyTrend = buildLaborEfficiencyTrend(filteredShifts, filteredOrders);
  const costTrendData = buildCostTrendVsBudget(filteredOrders, filteredExpenses);
  const totalWorkedHours = filteredShifts.reduce((sum, shift) => sum + Number(shift.hours_worked || 0), 0);
  const totalShiftCost = filteredShifts.reduce((sum, shift) => sum + Number(shift.amount || 0), 0);
  const salesPerLaborHour = totalWorkedHours ? filteredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) / totalWorkedHours : 0;
  const laborCostPerShift = filteredShifts.length ? totalShiftCost / filteredShifts.length : 0;
  const overtimeAlertsCount = filteredShifts.filter((shift) => Number(shift.hours_worked || 0) > 8).length;
  const currentShiftStaffing = filteredShifts.length;
  const activeEmployeesCount = employees.filter((employee) => employee.is_active).length;
  const leanOpsMode = activeEmployeesCount <= 1 && ordersCount <= 20;

  const liveAlerts = [];
  if (!hasLoyverseApiConfig(appSettings)) {
    liveAlerts.push({
      id: "missing-loyverse",
      severity: "high",
      summary: "Loyverse is not configured for this dashboard.",
      suggestedAction: "Add the Loyverse token in Settings so sales, products, receipts, and inventory can populate live.",
      timestamp: "Now",
      status: "new",
      owner: "Admin",
      href: createPageUrl("IntegrationsHub"),
      dataSource: "loyverse",
    });
  }
  if (!hasClipApiConfig(appSettings)) {
    liveAlerts.push({
      id: "missing-clip",
      severity: "high",
      summary: "Clip is not configured for reconciliation and payment monitoring.",
      suggestedAction: "Add Clip credentials in Settings to replace payment placeholders and settlement assumptions.",
      timestamp: "Now",
      status: "new",
      owner: "Admin",
      href: createPageUrl("IntegrationsHub"),
      dataSource: "clip",
    });
  }
  if (
    hasClipApiConfig(appSettings) &&
    !clipQuery.isLoading &&
    !clipQuery.isError &&
    todayCardOrdersCount > 0 &&
    filteredClipPayments.length === 0
  ) {
    liveAlerts.push({
      id: "clip-sync-warning",
      severity: "high",
      summary: `Clip is connected but no payments were mapped into the selected ${selectedRangeLabelLower} window.`,
      suggestedAction: "Check Clip credentials, payment status mapping, and timezone/date-field alignment between Clip and the dashboard.",
      timestamp: "Live",
      status: "new",
      owner: "Finance manager",
      href: "/Clip",
      dataSource: "clip",
    });
  }
  if (
    hasClipApiConfig(appSettings) &&
    !clipQuery.isLoading &&
    !clipQuery.isError &&
    filteredClipPayments.length === 0
  ) {
    liveAlerts.push({
      id: "clip-empty-feed",
      severity: "medium",
      summary: "Clip is configured but the payments feed returned zero records.",
      suggestedAction: "Verify the API credentials and date range returned by Clip, then refresh the connection in Integrations.",
      timestamp: "Live",
      status: "new",
      owner: "Admin",
      href: "/Clip",
      dataSource: "clip",
    });
  }
  if (Math.abs(mismatch) > 1) {
    liveAlerts.push({
      id: "payment-mismatch",
      severity: "critical",
      summary: "Card totals differ between Order module (card orders) and Clip payments.",
      suggestedAction: "Review unlinked card orders and match them against Clip transactions before close.",
      timestamp: "Live",
      status: "new",
      owner: "Finance manager",
      href: dashboardFocusHref("payments-reconciliation"),
      dataSource: hasClipApiConfig(appSettings) && hasLoyverseApiConfig(appSettings) ? "both" : hasClipApiConfig(appSettings) ? "clip" : "order_records",
    });
  }
  if (todayRefundCount > 0) {
    liveAlerts.push({
      id: "refunds-live",
      severity: "medium",
      summary: `${todayRefundCount} Clip refunds detected in the selected ${selectedRangeLabelLower} window.`,
      suggestedAction: "Check refund reasons and confirm they match cancellations or duplicate charges.",
      timestamp: "Live",
      status: "acknowledged",
      owner: "Operations",
      href: dashboardFocusHref("alerts-exceptions"),
      dataSource: "clip",
    });
  }
  if (foodCostPct > 30) {
    liveAlerts.push({
      id: "food-cost-live",
      severity: "high",
      summary: `Food cost is ${foodCostPct.toFixed(1)}% based on tracked ingredient purchases.`,
      suggestedAction: "Review Shopping List conversions, supplier prices, waste, and menu mix before close.",
      timestamp: "Live",
      status: "new",
      owner: "Operations",
      href: dashboardFocusHref("costs"),
      dataSource: "finance_ledger",
    });
  }
  if (laborCostPct > 20) {
    liveAlerts.push({
      id: "labor-cost-live",
      severity: "high",
      summary: `Labor cost is ${laborCostPct.toFixed(1)}% based on tracked salary and shift-linked expenses.`,
      suggestedAction: "Check paid shifts, overtime, and any salary expenses not linked back to the employee calendar.",
      timestamp: "Live",
      status: "acknowledged",
      owner: "Management",
      href: dashboardFocusHref("staff"),
      dataSource: "finance_ledger",
    });
  }
  if (inventoryRows.some((row) => row.status === "Critical")) {
    liveAlerts.push({
      id: "inventory-critical-live",
      severity: "critical",
      summary: `${inventoryRows.filter((row) => row.status === "Critical").length} inventory items are at critical stock level in Loyverse.`,
      suggestedAction: "Review branch transfers or place an emergency supplier order now.",
      timestamp: "Live",
      status: "new",
      owner: "Supply chain",
      href: dashboardFocusHref("inventory"),
      dataSource: "loyverse",
    });
  }
  if (failedSettlementsCount > 0) {
    liveAlerts.push({
      id: "failed-settlements-live",
      severity: "critical",
      summary: `${failedSettlementsCount} Clip settlements show a failed or declined status.`,
      suggestedAction: "Inspect the failed settlement reports and verify deposit status with the processor.",
      timestamp: "Live",
      status: "new",
      owner: "Finance manager",
      href: dashboardFocusHref("payments-reconciliation"),
      dataSource: "clip",
    });
  }
  if (cancellationRate > 10 || todayCancelledOrders >= 3) {
    liveAlerts.push({
      id: "cancellations-live",
      severity: "medium",
      summary: `Cancellation rate is ${cancellationRate.toFixed(1)}% with ${todayCancelledOrders} app cancellations in the selected ${selectedRangeLabelLower}.`,
      suggestedAction: "Review refund reasons, service delays, and channel-specific cancellation patterns.",
      timestamp: "Live",
      status: "new",
      owner: "Operations",
      href: dashboardFocusHref("alerts-exceptions"),
      dataSource: "order_records",
    });
  }

  const alerts = liveAlerts.length
    ? liveAlerts
    : mockAlerts.map((alert) => ({ ...alert, dataSource: "mock" }));
  const alertHasClip = alerts.some((alert) => alert.dataSource === "clip" || alert.dataSource === "both");
  const alertHasLoyverse = alerts.some((alert) => alert.dataSource === "loyverse" || alert.dataSource === "both");
  const alertHasOrderModule = alerts.some((alert) => alert.dataSource === "order_records");
  const alertsSource = alertHasClip && alertHasLoyverse
    ? "both"
    : alertHasClip
      ? "clip"
      : alertHasLoyverse
        ? "loyverse"
        : alertHasOrderModule
          ? "order_records"
          : "mock";

  const kpiFilterSummary = `${displayPeriodLabel} · all branches & channels · Dedupe ${selectedDedupeWindow} / ${selectedDedupePriority}`;

  const canonicalSourceStats = React.useMemo(() => {
    const count = { loyverse: 0, clip: 0, manual: 0 };
    const sum = { loyverse: 0, clip: 0, manual: 0 };
    for (const e of filteredCanonicalSalesEvents) {
      if (e.source === "loyverse") {
        count.loyverse += 1;
        sum.loyverse += e.amount;
      } else if (e.source === "clip") {
        count.clip += 1;
        sum.clip += e.amount;
      } else if (e.source === "manual") {
        count.manual += 1;
        sum.manual += e.amount;
      }
    }
    return {
      count,
      avg: {
        loyverse: count.loyverse ? sum.loyverse / count.loyverse : null,
        clip: count.clip ? sum.clip / count.clip : null,
        manual: count.manual ? sum.manual / count.manual : null,
      },
    };
  }, [filteredCanonicalSalesEvents]);

  const kpiEventDebugRows = React.useMemo(
    () =>
      [...filteredCanonicalSalesEvents]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 250)
        .map((e) => ({
          id: String(e.id),
          time: formatDateSafe(e.timestamp, "yyyy-MM-dd HH:mm"),
          source: e.source,
          amount: formatCurrency(e.amount),
          payment: String(e.paymentMethod || "—"),
        })),
    [filteredCanonicalSalesEvents],
  );

  const grossProfitIngredientLines = React.useMemo(() => {
    const lines = [];
    if (shoppingIngredientExpenses > 0) {
      lines.push({
        label: "Shopping list → ingredient expenses",
        value: formatCurrency(shoppingIngredientExpenses),
      });
    }
    if (manualIngredientExpenses > 0) {
      lines.push({
        label: "Manual ingredient expenses (Finance)",
        value: formatCurrency(manualIngredientExpenses),
      });
    }
    if (isIngredientCostEstimated) {
      lines.push({
        label: `Estimate MXN ${PIZZA_COST_ESTIMATE} × ${filteredOrders.length} orders (window)`,
        value: formatCurrency(estimatedIngredientCost),
      });
    } else if (rawIngredientExpenses && lines.length > 1) {
      lines.push({
        label: "Ingredient cost total",
        value: formatCurrency(rawIngredientExpenses),
        emphasize: true,
      });
    }
    return lines;
  }, [
    shoppingIngredientExpenses,
    manualIngredientExpenses,
    isIngredientCostEstimated,
    filteredOrders.length,
    estimatedIngredientCost,
    rawIngredientExpenses,
  ]);

  const executiveKpis = [
    {
      id: "net-sales",
      label: "Net Sales",
      value: formatCurrency(netSales),
      delta: primaryComparisonCard.deltaLabel,
      trend: primaryComparisonCard.trend,
      comparisonLabel: `Combined for ${selectedRangeLabelLower} (all payment sources): Loyverse receipts + unmatched Clip payments + unmatched manual entries.${filteredDeduplicatedSalesCount ? ` ${filteredDeduplicatedSalesCount} duplicate matches removed.` : ""}`,
      sparkTone: "positive",
      sparkline: revenue7Days.map((item) => Math.max(item.revenue, 0)),
      href: dashboardFocusHref("net-sales"),
      dataSource: salesPipelineDataSource,
      breakdown: {
        type: "net-sales",
        loyverse: filteredLoyverseSalesTotal,
        clip: filteredClipSalesTotal,
        manual: filteredManualContributionTotal,
        total: netSales,
        dedupeFilteredCount: filteredDeduplicatedSalesCount,
        dedupeTotalCount: deduplicatedSalesCount,
        dedupeRows: filteredDeduplicationRows,
      },
    },
    {
      id: "orders-count",
      label: "Orders Count",
      value: formatNumber(ordersCount),
      delta: primaryComparisonCard.deltaLabel,
      trend: primaryComparisonCard.trend,
      comparisonLabel: `Current count for ${selectedRangeLabelLower}.`,
      sparkTone: "positive",
      sparkline: revenue7Days.map((item) => item.orders),
      href: dashboardFocusHref("orders-count"),
      dataSource: salesPipelineDataSource,
      breakdown: {
        type: "orders-count",
        total: salesTransactionCount,
        bySource: {
          loyverse: canonicalSourceStats.count.loyverse,
          clip: canonicalSourceStats.count.clip,
          manual: canonicalSourceStats.count.manual,
        },
        eventRows: kpiEventDebugRows,
      },
    },
    {
      id: "average-order-value",
      label: "Average Order Value",
      value: formatCurrency(aov),
      delta: aov ? primaryComparisonCard.deltaLabel : "Waiting for source data",
      trend: primaryComparisonCard.trend,
      comparisonLabel: `Average transaction amount from deduplicated Loyverse, Clip, and manual sales for ${selectedRangeLabelLower}`,
      sparkTone: "positive",
      sparkline: aovTrend.map((item) => item.aov),
      href: dashboardFocusHref("average-order-value"),
      dataSource: salesPipelineDataSource,
      breakdown: {
        type: "average-order-value",
        sumAmounts: filteredSalesTotal,
        count: salesTransactionCount,
        aov,
        avgLoyverse: canonicalSourceStats.avg.loyverse,
        avgClip: canonicalSourceStats.avg.clip,
        avgManual: canonicalSourceStats.avg.manual,
      },
    },
    {
      id: "gross-profit",
      label: "Gross Profit",
      value: ingredientExpenses ? formatCurrency(grossProfit) : mockCostsSummary[0].value,
      delta: rawIngredientExpenses ? primaryComparisonCard.deltaLabel : isIngredientCostEstimated ? `Estimated at MXN ${PIZZA_COST_ESTIMATE}/order × ${filteredOrders.length} orders` : "Waiting for ingredient purchase mapping",
      trend: primaryComparisonCard.trend,
      comparisonLabel: rawIngredientExpenses
        ? `Calculated for ${selectedRangeLabelLower} using ${shoppingIngredientExpenses ? "Shopping List purchase expenses" : "ingredient expense entries"}.`
        : `Estimated using MXN ${PIZZA_COST_ESTIMATE} average ingredient cost per order. Add real expenses to replace this.`,
      sparkTone: "positive",
      sparkline: revenue7Days.map((item) => Math.max(item.revenue - ingredientExpenses / 7, 0)),
      href: dashboardFocusHref("gross-profit"),
      dataSource: rawIngredientExpenses ? "finance_ledger" : salesPipelineDataSource,
      breakdown: {
        type: "gross-profit",
        grossSales,
        grossProfit,
        revenueLabel: filteredReceipts.length
          ? "Loyverse · gross before discount (Σ receipts)"
          : "Orders · delivered revenue (fallback)",
        revenueNote: filteredReceipts.length
          ? `${filteredReceipts.length} Loyverse receipts in ${displayPeriodLabel} (dashboard window + filters).`
          : `No Loyverse receipts in window — using ${deliveredOrders.length} delivered orders’ total_amount.`,
        lines: grossProfitIngredientLines,
        isEstimated: isIngredientCostEstimated,
        estimateNote: `Ingredient cost is estimated at MXN ${PIZZA_COST_ESTIMATE} per order × ${filteredOrders.length} orders in the filtered window until Finance ingredient purchases are mapped.`,
      },
    },
    {
      id: "net-profit",
      label: "Net Profit",
      value: laborExpenses && rawIngredientExpenses ? formatCurrency(netProfit) : "—",
      delta: laborExpenses && rawIngredientExpenses ? primaryComparisonCard.deltaLabel : "Missing ingredient and labor expenses.",
      trend: primaryComparisonCard.trend,
      comparisonLabel: laborExpenses && rawIngredientExpenses
        ? `Derived from ingredients, labor, recurring costs, other expenses, and Clip fees for ${selectedRangeLabelLower}.`
        : `Needs ingredient expenses — log purchases in Finance with category "ingredients" or convert Shopping List items. Also needs labor — complete shifts in Employee Calendar or add salary expenses in Finance. Optional: recurring fixed costs and Clip fees for full accuracy.`,
      sparkTone: "negative",
      sparkline: revenue7Days.map((item) => Math.max(item.revenue - ingredientExpenses / 7, 0)),
      href: dashboardFocusHref("net-profit"),
      dataSource: laborExpenses && rawIngredientExpenses && paymentFees ? "both" : laborExpenses && rawIngredientExpenses ? "finance_ledger" : salesPipelineDataSource,
      breakdown: {
        type: "generic",
        lines: [
          {
            label: "Net profit",
            value: laborExpenses && rawIngredientExpenses ? formatCurrency(netProfit) : "—",
            emphasize: true,
          },
          { label: "Gross sales (gross profit base)", value: formatCurrency(grossSales) },
          { label: "− Ingredient cost", value: formatCurrency(ingredientExpenses) },
          { label: "− Labor (salary + unpaid shifts + template)", value: formatCurrency(laborExpenses) },
          { label: "− Recurring expenses", value: formatCurrency(recurringExpenses) },
          { label: "− Other operating", value: formatCurrency(otherOperatingExpenses) },
          { label: "− Clip / payment fees", value: formatCurrency(paymentFees || 0) },
        ],
        note:
          laborExpenses && rawIngredientExpenses
            ? `Same period as card: ${displayPeriodLabel}. Uses gross sales from Loyverse receipts (or delivered orders if no receipts), not deduplicated Net Sales.`
            : "Net profit stays empty until both mapped ingredient expenses and labor inputs exist.",
      },
    },
    {
      id: "food-cost",
      label: "Food Cost %",
      value: `${foodCostPct.toFixed(1)}%`,
      delta: rawIngredientExpenses ? (shoppingIngredientExpenses ? "Purchase-based from Shopping List expenses" : "Based on ingredient expenses") : `Estimated at MXN ${PIZZA_COST_ESTIMATE}/order`,
      trend: "down",
      comparisonLabel: rawIngredientExpenses ? "Purchase-based cost until recipe-level COGS is added" : `Using MXN ${PIZZA_COST_ESTIMATE} average cost per order as estimate. Add ingredient expenses to replace.`,
      sparkTone: "negative",
      sparkline: mockCostTrendVsBudget.map((item) => item.actual),
      href: dashboardFocusHref("food-cost"),
      dataSource: rawIngredientExpenses ? "finance_ledger" : salesPipelineDataSource,
      breakdown: {
        type: "generic",
        lines: [
          { label: "Food cost %", value: `${foodCostPct.toFixed(1)}%`, emphasize: true },
          { label: "Ingredient expenses (mapped or estimate)", value: formatCurrency(ingredientExpenses) },
          { label: "÷ Gross sales", value: formatCurrency(grossSales) },
          {
            label: "Formula",
            value: grossSales ? `${((ingredientExpenses / grossSales) * 100).toFixed(2)}%` : "—",
          },
        ],
        note: rawIngredientExpenses
          ? "Numerator uses Shopping List + manual ingredient expenses in the dashboard window."
          : `Numerator uses MXN ${PIZZA_COST_ESTIMATE} × ${filteredOrders.length} orders until real purchases are categorized.`,
      },
    },
    {
      id: "labor-cost",
      label: "Labor Cost %",
      value: laborExpenses ? `${laborCostPct.toFixed(1)}%` : "—",
      delta: laborExpenses
        ? unpaidShiftLaborAccrued > 0
          ? `Includes ${formatCurrency(unpaidShiftLaborAccrued)} from unpaid scheduled shifts`
          : shiftLaborExpenseTotal
            ? "Shift-linked salary expenses"
            : "Based on salary expenses"
        : "No salary expenses logged yet. Add shifts via Employee Calendar or log salary expenses in Finance to populate this.",
      trend: "down",
      comparisonLabel: laborExpenses ? "Uses employee calendar payouts where available" : "Needs salary expenses or completed shifts. Go to Employees → log shifts, or Finance → add a salary expense.",
      sparkTone: "negative",
      sparkline: laborExpenses ? mockLaborEfficiencyTrend.map((item) => item.efficiency / 20) : [16.8, 17.0, 17.3, 17.8, 18.0, 18.4, 18.7],
      href: dashboardFocusHref("labor-cost"),
      dataSource: laborExpenses ? "finance_ledger" : "mock",
      breakdown: {
        type: "generic",
        lines: [
          { label: "Labor cost %", value: laborExpenses ? `${laborCostPct.toFixed(1)}%` : "—", emphasize: true },
          { label: "Salary expenses (Finance)", value: formatCurrency(salaryLedgerInRange) },
          { label: "+ Unpaid shift accrual", value: formatCurrency(unpaidShiftLaborAccrued) },
          { label: "+ Template labor (no shift row)", value: formatCurrency(templateLaborAccrued) },
          { label: "= Labor total (card)", value: formatCurrency(laborExpenses) },
          { label: "÷ Gross sales", value: formatCurrency(grossSales) },
        ],
        note: "Labor numerator mixes paid salary expenses, unpaid scheduled shifts, and template coverage — same idea as Daily Cash labor card.",
      },
    },
    {
      id: "open-anomalies",
      label: "Open Anomalies",
      value: formatNumber(alerts.length),
      delta: liveAlerts.length ? "Generated from live syncs" : "Mock alerts fallback",
      trend: liveAlerts.length ? "up" : "down",
      comparisonLabel: liveAlerts.length ? "Built from current data mismatches and config gaps" : "Replace once more anomaly rules are wired",
      sparkTone: liveAlerts.length ? "positive" : "negative",
      sparkline: liveAlerts.length ? [1, 1, 2, 2, 3, 3, alerts.length] : [4, 5, 6, 7, 8, 9, 12],
      href: dashboardFocusHref("alerts-exceptions"),
      dataSource: liveAlerts.length ? salesPipelineDataSource : "mock",
      breakdown: {
        type: "generic",
        lines: [{ label: "Alerts in feed", value: formatNumber(alerts.length), emphasize: true }],
        note: liveAlerts.length
          ? "Each item below is a live rule hit (config, reconciliation, refunds, etc.)."
          : "Showing curated mock alerts until integrations produce live rule hits.",
      },
    },
  ];

  const liveOperations = [
    { id: "active-orders", label: "Active Orders", value: formatNumber(activeOrders), tone: "text-white", subtext: "Order module: in-app Order rows (status in your ordering flow)", href: dashboardFocusHref("live-operations"), dataSource: "order_records" },
    { id: "delayed-orders", label: "Delayed Orders", value: formatNumber(todayDelayedOrders), tone: "text-yellow-400", subtext: `Order module: SLA estimate for selected ${selectedRangeLabelLower}`, href: dashboardFocusHref("live-operations"), dataSource: orders.length ? "order_records" : "mock" },
    { id: "avg-prep-time", label: "Average Prep Time", value: avgPrepTime ? `${avgPrepTime} min` : "—", tone: "text-white", subtext: avgPrepTime ? `Order module for selected ${selectedRangeLabelLower}` : "Order module: needs preparation_minutes or estimated_delivery_minutes on Order records.", href: dashboardFocusHref("live-operations"), dataSource: orders.length ? "order_records" : "mock" },
    { id: "orders-in-kitchen", label: "Orders In Kitchen", value: formatNumber(ordersInKitchen), tone: "text-white", subtext: "Order module: status = preparing", href: dashboardFocusHref("live-operations"), dataSource: "order_records" },
    { id: "out-for-delivery", label: "Out For Delivery", value: formatNumber(ordersOutForDelivery), tone: "text-yellow-400", subtext: "Order module: status = out for delivery", href: dashboardFocusHref("live-operations"), dataSource: "order_records" },
    { id: "reservations", label: `Reservations (${displayPeriodLabel})`, value: "—", tone: "text-white", subtext: "Needs a Reservation entity with a date field. Once reservations are logged, the selected range count auto-populates.", href: dashboardFocusHref("live-operations"), dataSource: "mock" },
    { id: "refunds", label: `Refund Count (${displayPeriodLabel})`, value: formatNumber(todayRefundCount), tone: "text-red-300", subtext: `Clip API: refund fields in selected ${selectedRangeLabelLower}`, href: dashboardFocusHref("payments-reconciliation"), dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
    { id: "cancelled", label: `Cancelled Orders (${displayPeriodLabel})`, value: formatNumber(todayCancelledOrders), tone: "text-yellow-400", subtext: "Order module: status = cancelled", href: dashboardFocusHref("alerts-exceptions"), dataSource: "order_records" },
  ]
    .filter((item) => {
      if (
        !isDayOnlyDashboardContext
        && ["active-orders", "delayed-orders", "orders-in-kitchen", "out-for-delivery"].includes(item.id)
      ) {
        return false;
      }
      return true;
    })
    .filter((item) => {
      if (!leanOpsMode) {
        return true;
      }

      return ["active-orders", "avg-prep-time", "refunds", "cancelled"].includes(item.id);
    });

  const paymentSummary = [
    { label: `Total Received (${displayPeriodLabel})`, value: formatCurrency(filteredSalesTotal), subtext: `Deduplicated received amount for ${selectedRangeLabelLower} (all payment sources).`, dataSource: salesPipelineDataSource },
    { label: `Net Sales Inflow (${displayPeriodLabel})`, value: formatCurrency(netSales), subtext: filteredDeduplicatedSalesCount ? `Duplicate same-amount same-time sales removed across Loyverse, Clip, and manual entries (${filteredDeduplicatedSalesCount} matches).` : `All payment sources across Loyverse, Clip, and manual contributions for the selected period`, dataSource: salesPipelineDataSource },
    { label: `Pending Settlements (${displayPeriodLabel})`, value: clipFilterActive ? formatCurrency(pendingSettlements) : "—", subtext: clipOverview ? (clipFilterActive ? "Clip payments older than 24h compared against filtered net deposits" : "Only applicable for All sources or Clip view") : "Needs Clip to calculate", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
    { label: `Settled Amounts (${displayPeriodLabel})`, value: formatCurrency(depositTotal), subtext: clipOverview ? "Live from filtered Clip settlements" : "Waiting for Clip", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
    { label: `Refunds (${displayPeriodLabel})`, value: formatCurrency(filteredRefundVolume), subtext: clipOverview ? "Live from filtered Clip refunds" : "Waiting for Clip", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
    { label: "Payment Fees", value: paymentFees ? formatCurrency(paymentFees) : "—", subtext: paymentFees ? "Live from Clip settlement fee fields" : "Clip must return total_fee, fee_amount, fees, or commission_amount in its settlement records for this to auto-fill.", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
  ];

  const cashVsCard = [
    { source: "Cash", amount: filteredCanonicalSalesEvents.filter((event) => event.paymentMethod === "cash").reduce((sum, event) => sum + event.amount, 0) },
    { source: "Card", amount: filteredCanonicalSalesEvents.filter((event) => ["card", "credit_card", "debit_card"].includes(String(event.paymentMethod).toLowerCase())).reduce((sum, event) => sum + event.amount, 0) },
    { source: "Clip", amount: filteredClipSalesTotal },
    { source: "Deposited", amount: depositTotal },
  ];

  const reconciliationRows = [
    {
      id: "recon-app-card-vs-clip",
      source_system: "Order module (card) vs Clip",
      expected_amount: formatCurrency(appCardTotal),
      actual_amount: formatCurrency(clipApprovedTotal),
      difference: formatCurrency(mismatch),
      status: Math.abs(mismatch) <= 1 ? "Matched" : "Mismatch",
      last_sync_time: clipOverview?.metrics?.latestSyncAt ? formatDateSafe(clipOverview.metrics.latestSyncAt, "HH:mm") : "N/A",
    },
    {
      id: "recon-clip-vs-bank",
      source_system: "Unmatched Clip payments vs settlements",
      expected_amount: clipFilterActive ? formatCurrency(filteredClipSalesTotal) : "—",
      actual_amount: formatCurrency(depositTotal),
      difference: clipFilterActive ? formatCurrency(depositTotal - filteredClipSalesTotal) : "—",
      status: clipFilterActive ? (depositTotal >= filteredClipSalesTotal ? "Matched" : "Pending") : "Review",
      last_sync_time: clipOverview?.metrics?.latestSyncAt ? formatDateSafe(clipOverview.metrics.latestSyncAt, "HH:mm") : "N/A",
    },
    {
      id: "recon-loyverse-vs-orders",
      source_system: "Loyverse gross vs app delivered",
      expected_amount: formatCurrency(grossSales),
      actual_amount: formatCurrency(totalRevenue),
      difference: formatCurrency(totalRevenue - grossSales),
      status: loyverseOverview ? "Review" : "Pending",
      last_sync_time: loyverseOverview?.metrics?.latestSyncAt ? formatDateSafe(loyverseOverview.metrics.latestSyncAt, "HH:mm") : "N/A",
    },
    ...(bankTransferTotal
      ? [{
          id: "recon-bank-ledger",
          source_system: "Manual bank ledger",
          expected_amount: formatCurrency(depositTotal),
          actual_amount: formatCurrency(bankTransferTotal),
          difference: formatCurrency(bankTransferTotal - depositTotal),
          status: Math.abs(bankTransferTotal - depositTotal) <= 1 ? "Matched" : "Review",
          last_sync_time: filteredTransactions[0]?.date ? formatDateSafe(filteredTransactions[0].date, "HH:mm") : "N/A",
        }]
      : []),
  ];

  const costsSummary = [
    {
      label: `All expenses (${displayPeriodLabel})`,
      value: totalExpenseLedger ? formatCurrency(totalExpenseLedger) : "—",
      delta: totalExpenseLedger
        ? `Every Finance expense row in the selected ${selectedRangeLabelLower} (all categories and payment sources)`
        : "Log expenses in Finance (Company account) so the full ledger appears here.",
      dataSource: totalExpenseLedger ? "finance_ledger" : "mock",
    },
    { label: `Ingredient Cost (${displayPeriodLabel})`, value: ingredientExpensesInRange ? formatCurrency(ingredientExpensesInRange) : formatCurrency(filteredOrders.length * PIZZA_COST_ESTIMATE), delta: ingredientExpensesInRange ? `Purchase-based from ingredient expenses in selected ${selectedRangeLabelLower}` : `Estimated: ${filteredOrders.length} orders × MXN ${PIZZA_COST_ESTIMATE}`, dataSource: ingredientExpensesInRange ? "finance_ledger" : salesPipelineDataSource },
    { label: "Food Cost %", value: `${foodCostPct.toFixed(1)}%`, delta: rawIngredientExpenses ? "Calculated live from purchase-based ingredient cost" : `Estimated at MXN ${PIZZA_COST_ESTIMATE}/order avg. Add expenses to replace.`, dataSource: rawIngredientExpenses ? "finance_ledger" : salesPipelineDataSource },
    { label: `Labor Cost (${displayPeriodLabel})`, value: laborExpensesInRange ? formatCurrency(laborExpensesInRange) : "—", delta: laborExpensesInRange ? `Salaries, unpaid shifts, and workday template (no double-count with shifts) in selected ${selectedRangeLabelLower}` : "Log shifts in Employee Calendar or add salary expenses in Finance.", dataSource: laborExpensesInRange ? "finance_ledger" : "mock" },
    { label: "Labor Cost %", value: laborExpenses ? `${laborCostPct.toFixed(1)}%` : "—", delta: laborExpenses ? "Calculated live from tracked labor expenses" : "Needs salary expenses. Log shifts with pay in Employee Calendar or add salary expenses in Finance.", dataSource: laborExpenses ? "finance_ledger" : "mock" },
    { label: "Payment Processing Fees", value: paymentFees ? formatCurrency(paymentFees) : "—", delta: paymentFees ? "Live from Clip settlement reports" : "Requires Clip to return fee fields (total_fee / fee_amount / fees / commission_amount) in settlement records.", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
    { label: "Fixed Costs", value: recurringExpenses ? formatCurrency(recurringExpenses) : "—", delta: recurringExpenses ? "Live from recurring expenses" : "Add recurring expenses in Finance (e.g. rent, utilities) and check the 'recurring' checkbox.", dataSource: recurringExpenses ? "finance_ledger" : "mock" },
    { label: "Other Operating Expenses", value: otherOperatingExpenses ? formatCurrency(otherOperatingExpenses) : "—", delta: otherOperatingExpenses ? "Live from non-ingredient, non-salary expenses" : "Add non-ingredient, non-salary expenses in Finance to track operational overhead.", dataSource: otherOperatingExpenses ? "finance_ledger" : "mock" },
    { label: "Cost Per Order", value: costPerOrder ? formatCurrency(costPerOrder) : "—", delta: costPerOrder ? "Ingredient + labor + operating costs + Clip fees divided by orders" : "Needs expenses in Finance. Once any cost is logged, this auto-calculates as total expenses ÷ order count.", dataSource: costPerOrder && paymentFees ? "both" : costPerOrder ? "finance_ledger" : salesPipelineDataSource },
  ];

  const inventoryInsights = {
    lowStock: inventoryRows.length ? inventoryRows : mockInventoryInsights.lowStock,
    purchases: recentPurchases.length ? recentPurchases : mockInventoryInsights.purchases,
    forecast: laborCostForecastItems.length
      ? [...laborCostForecastItems, ...(inventoryForecast.length ? inventoryForecast : mockInventoryInsights.forecast)]
      : inventoryForecast.length
        ? inventoryForecast
        : mockInventoryInsights.forecast,
  };

  const hasLoyverseCatalog = Boolean(loyverseOverview?.items?.length);
  const inventoryDataSource = inventoryRows.length || hasLoyverseApiConfig(appSettings) ? "loyverse" : "mock";
  const inventoryPurchasesSource = recentPurchases.length ? "finance_ledger" : "mock";
  const inventoryForecastSource = laborCostForecastItems.length
    ? "finance_ledger"
    : inventoryForecast.length || hasLoyverseApiConfig(appSettings)
      ? "loyverse"
      : "mock";
  const bestSellingSource = (hasLoyverseApiConfig(appSettings) || filteredLoyverseReceipts.length || hasLoyverseCatalog) ? "loyverse" : "mock";
  const worstPerformingSource = (hasLoyverseApiConfig(appSettings) || filteredLoyverseReceipts.length || hasLoyverseCatalog) ? "loyverse" : "mock";
  const staffMetrics = [
    { label: "Total Worked Hours", value: totalWorkedHours ? `${formatNumber(totalWorkedHours)} h` : "—", detail: totalWorkedHours ? `Finance / HR: Shift records in selected ${selectedRangeLabelLower}` : "Log shifts with hours_worked in Employee Calendar to populate this.", dataSource: totalWorkedHours ? "finance_ledger" : "mock" },
    { label: "Sales Per Labor Hour", value: salesPerLaborHour ? formatCurrency(salesPerLaborHour) : "—", detail: salesPerLaborHour ? `Merged POS sales ÷ shift hours for selected ${selectedRangeLabelLower}` : "Needs completed shifts with hours_worked. Auto-calculates as selected-range revenue ÷ total shift hours.", dataSource: salesPerLaborHour ? "finance_ledger" : "mock" },
    { label: "Labor Cost Per Shift", value: laborCostPerShift ? formatCurrency(laborCostPerShift) : "—", detail: laborCostPerShift ? "Finance: average tracked shift payouts" : "Set an amount (payout) on each shift in Employee Calendar. Average auto-calculates.", dataSource: laborCostPerShift ? "finance_ledger" : "mock" },
    { label: "Shift Staffing", value: currentShiftStaffing ? `${formatNumber(currentShiftStaffing)} staff` : "—", detail: currentShiftStaffing ? `${displayPeriodLabel} shifts. ${formatNumber(activeEmployeesCount)} active employees in roster.` : `Schedule shifts in Employee Calendar to see staffing for selected ${selectedRangeLabelLower}.`, dataSource: currentShiftStaffing ? "finance_ledger" : "mock" },
    { label: "Overtime Alerts", value: overtimeAlertsCount ? formatNumber(overtimeAlertsCount) : "—", detail: overtimeAlertsCount ? "Triggered by shifts above 8 tracked hours" : "Auto-triggers when any shift has more than 8 hours logged. No overtime in current data.", dataSource: overtimeAlertsCount ? "finance_ledger" : "mock" },
  ];
  const staffDataSource = staffMetrics.some((metric) => metric.dataSource === "finance_ledger") ? "finance_ledger" : "mock";
  const laborEfficiencySource = laborEfficiencyTrend.some((item) => item.efficiency > 0) ? "finance_ledger" : "mock";
  const liveSourceStates = [
    { id: "loyverse", label: "Loyverse", connected: hasLoyverseApiConfig(appSettings) },
    { id: "clip", label: "Clip", connected: hasClipApiConfig(appSettings) },
    { id: "order-module", label: "Order module", connected: orders.length > 0 },
  ];
  const connectedLiveSourcesCount = liveSourceStates.filter((source) => source.connected).length;
  const isRefreshing =
    ordersQuery.isFetching ||
    expensesQuery.isFetching ||
    transactionsQuery.isFetching ||
    employeesQuery.isFetching ||
    shiftsQuery.isFetching ||
    loyverseQuery.isFetching ||
    clipQuery.isFetching;
  const lastLiveSyncAt = clipOverview?.metrics?.latestSyncAt || loyverseOverview?.metrics?.latestSyncAt || null;

  const refreshAll = () => {
    ordersQuery.refetch();
    expensesQuery.refetch();
    transactionsQuery.refetch();
    employeesQuery.refetch();
    shiftsQuery.refetch();
    if (hasLoyverseApiConfig(appSettings)) {
      loyverseQuery.refetch();
    }
    if (hasClipApiConfig(appSettings)) {
      clipQuery.refetch();
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <KpiBreakdownDialog
        open={Boolean(kpiDetailItem)}
        onOpenChange={(open) => {
          if (!open) setKpiDetailItem(null);
        }}
        title={kpiDetailItem?.label || ""}
        filterSummary={kpiFilterSummary}
        breakdown={kpiDetailItem?.breakdown}
      />
      <div className="border-b border-yellow-500/20">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300">Los Tios Management Dashboard</Badge>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Los Tios management dashboard
              </h1>
              <p className="mt-3 text-sm leading-6 text-gray-400 sm:text-base">
                Live data is loaded from Loyverse, Clip, the Order module, and the Finance ledger where those sources are already available.
                Cards marked <span className="text-yellow-300">Limited data</span> still rely on partial coverage and should be read as directional rather than final.
              </p>
              <div className="mt-8 rounded-2xl border border-yellow-500/15 bg-[#141414]/90 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-500/70">Calendar month</p>
                    <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                      Select a month to align every KPI with that full calendar window, or use a quick range.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-yellow-500/25 bg-black/30 text-yellow-200 hover:bg-yellow-400/10"
                      onClick={() => setCalendarBrowseYear((y) => y - 1)}
                      aria-label="Previous year"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums text-yellow-200">{calendarBrowseYear}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-yellow-500/25 bg-black/30 text-yellow-200 hover:bg-yellow-400/10"
                      onClick={() => setCalendarBrowseYear((y) => y + 1)}
                      aria-label="Next year"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
                  {CALENDAR_MONTH_SHORT.map((shortLabel, monthIndex) => {
                    const isActive =
                      calendarMonth?.y === calendarBrowseYear && calendarMonth?.m === monthIndex;
                    return (
                      <button
                        key={shortLabel}
                        type="button"
                        onClick={() => setCalendarMonth({ y: calendarBrowseYear, m: monthIndex })}
                        className={`rounded-lg border px-1 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide transition-colors sm:text-xs ${
                          isActive
                            ? "border-yellow-400/80 bg-yellow-400/15 text-yellow-100 shadow-[0_0_0_1px_rgba(250,204,21,0.15)]"
                            : "border-white/10 bg-black/25 text-gray-400 hover:border-yellow-500/35 hover:text-gray-200"
                        }`}
                      >
                        {shortLabel}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Quick range</span>
                  {QUICK_RANGE_OPTIONS.map((option) => {
                    const active = !calendarMonth && selectedDateRange === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setSelectedDateRange(option);
                          setCalendarMonth(null);
                        }}
                        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? "border-yellow-400/80 bg-yellow-400/15 text-yellow-100"
                            : "border-white/10 bg-black/25 text-gray-400 hover:border-yellow-500/35 hover:text-gray-200"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {calendarMonth ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                    <span className="text-xs text-gray-500">
                      Active: <span className="font-medium text-yellow-200/90">{displayPeriodLabel}</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-gray-500 hover:bg-white/5 hover:text-gray-200"
                      onClick={() => setCalendarMonth(null)}
                    >
                      Clear · use quick range
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[460px]">
              <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Live sources connected</p>
                <p className="mt-2 text-2xl font-bold text-yellow-400">
                  {connectedLiveSourcesCount}/3
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {liveSourceStates.map((source) => (
                    <span
                      key={source.id}
                      className={source.connected ? "text-yellow-300" : "text-gray-500"}
                    >
                      {source.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Last synced</p>
                <p className="mt-2 text-lg font-bold text-yellow-400">
                  {lastLiveSyncAt
                    ? formatDateSafe(lastLiveSyncAt, "yyyy-MM-dd HH:mm")
                    : "No live sync yet"}
                </p>
                <p className="text-xs text-gray-400">Based on current dashboard queries</p>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Reporting currency</p>
                <p className="mt-2 text-2xl font-bold text-yellow-400">MXN</p>
                <p className="text-xs text-gray-400">All money values on this page are shown in Mexican pesos.</p>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Quick refresh</p>
                <Button
                  onClick={refreshAll}
                  disabled={isRefreshing}
                  className="mt-2 h-10 w-full justify-start gap-2 bg-yellow-400 text-black hover:bg-yellow-300"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh live data
                </Button>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4 sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadge source="clip" />
                  <span className="text-sm text-gray-300">Clip data</span>
                  <SourceBadge source="loyverse" />
                  <span className="text-sm text-gray-300">Loyverse data</span>
                  <SourceBadge source="both" />
                  <span className="text-sm text-gray-300">Combined Clip + Loyverse</span>
                  <SourceBadge source="order_records" />
                  <span className="text-sm text-gray-300">Order module (in-app orders)</span>
                  <SourceBadge source="finance_ledger" />
                  <span className="text-sm text-gray-300">Finance ledger (Expense, shifts)</span>
                  <SourceBadge source="mock" />
                  <span className="text-sm text-gray-300">Needs replacement / mapping</span>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Combined sales and reconciliation use all payment sources, branches, and channels for the selected period. Revolut is not integrated yet in this repo, so bank views still come from local finance records instead of the Revolut API.
                </p>
                {leanOpsMode ? (
                  <p className="mt-2 text-xs text-yellow-300">
                    Lean mode is active for a low-volume setup: staffing and advanced operations views are reduced so sales, payments, products, and basic costs stay primary.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <section id="money-at-a-glance" className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Selected period</p>
              <h2 className="mt-1 text-2xl font-bold text-yellow-400">Money at a glance</h2>
              <p className="mt-1 text-xs text-gray-500">
                Matches the calendar month or quick range above ({displayPeriodLabel}). Cash uses the latest count in that window, or the saved opening on the last day of the range.
              </p>
            </div>
            <Button asChild variant="outline" className="hidden sm:inline-flex border-yellow-500/25 bg-[#242424] text-gray-200 hover:bg-[#2b2b2b]">
              <Link to={createPageUrl("DailyCash")}>
                Open Daily Cash
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mb-4 flex gap-2 sm:hidden">
            <Button asChild variant="outline" className="flex-1 border-yellow-500/25 bg-[#242424] text-gray-200 hover:bg-[#2b2b2b]">
              <Link to={createPageUrl("DailyCash")}>
                Open Daily Cash
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 border-yellow-500/25 bg-[#242424] text-gray-200 hover:bg-[#2b2b2b]">
              <Link to={appendMonthParam(createPageUrl("ShoppingList"), calendarMonthKey)}>
                Open Shopping
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border-2 border-yellow-400/40 bg-gradient-to-br from-yellow-500/[0.10] via-[#1a1808] to-[#141410] p-5 shadow-[inset_0_1px_0_0_rgba(250,204,21,0.15)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-400/75">
                  Cash in drawer
                </p>
                <SourceBadge source="manual" />
              </div>
              <p className="mt-1 text-[11px] font-medium text-yellow-500/70">{displayPeriodLabel}</p>
              <p className="mt-3 text-3xl font-bold tabular-nums text-yellow-300 sm:text-4xl">
                {glanceCashSnapshot.amount !== null ? formatCurrency(glanceCashSnapshot.amount) : "—"}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                <span>{glanceCashAgeLabel}</span>
                {glanceCashSnapshot.diff !== null && glanceCashSnapshot.diff !== 0 && (
                  <span
                    className={`tabular-nums ${glanceCashSnapshot.diff > 0 ? "text-yellow-200" : "text-red-300"}`}
                  >
                    Last diff {glanceCashSnapshot.diff > 0 ? "+" : ""}
                    {formatCurrency(glanceCashSnapshot.diff)}
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-yellow-400/40 bg-gradient-to-br from-yellow-500/[0.10] via-[#1a1808] to-[#141410] p-5 shadow-[inset_0_1px_0_0_rgba(250,204,21,0.15)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-400/75">
                  Sales
                </p>
                <SourceBadge source={salesPipelineDataSource} />
              </div>
              <p className="mt-1 text-[11px] font-medium text-yellow-500/70">{displayPeriodLabel}</p>
              <p className="mt-3 text-3xl font-bold tabular-nums text-yellow-300 sm:text-4xl">
                {formatCurrency(kpiSalesTotal)}
              </p>
              <p className="mt-3 text-xs text-gray-400">
                {formatNumber(kpiCanonicalEvents.length)}{" "}
                {kpiCanonicalEvents.length === 1 ? "sale" : "sales"} in this period (Clip + Loyverse + manual inflows)
              </p>
            </div>

            <div className="rounded-2xl border-2 border-yellow-400/40 bg-gradient-to-br from-yellow-500/[0.10] via-[#1a1808] to-[#141410] p-5 shadow-[inset_0_1px_0_0_rgba(250,204,21,0.15)]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-400/75">
                  Net
                </p>
                <SourceBadge source="finance_ledger" />
              </div>
              <p className="mt-1 text-[11px] font-medium text-yellow-500/70">{displayPeriodLabel}</p>
              <p
                className={`mt-3 text-3xl font-bold tabular-nums sm:text-4xl ${kpiNet < 0 ? "text-red-300" : "text-yellow-300"}`}
              >
                {formatCurrency(kpiNet)}
              </p>
              <p className="mt-3 text-xs text-gray-400">
                Sales − expenses ({formatCurrency(kpiExpensesTotal)}) − withdrawals ({formatCurrency(kpiWithdrawalsTotal)})
              </p>
            </div>
          </div>
        </section>

        <section id="cash-variance" className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Cash health</p>
              <h2 className="mt-1 text-2xl font-bold text-yellow-400">Cash variance — last 30 days</h2>
              <p className="mt-1 text-xs text-gray-500">
                Difference between expected end-of-day cash and what was actually counted. Green = extra,
                red = missing.
              </p>
            </div>
            <Button asChild variant="outline" className="hidden sm:inline-flex border-yellow-500/25 bg-[#242424] text-gray-200 hover:bg-[#2b2b2b]">
              <Link to={createPageUrl("DailyCash") + "?focus=manual-counting-history"}>
                Open counting history
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mb-4 sm:hidden">
            <Button asChild variant="outline" className="w-full border-yellow-500/25 bg-[#242424] text-gray-200 hover:bg-[#2b2b2b]">
              <Link to={createPageUrl("DailyCash") + "?focus=manual-counting-history"}>
                Open counting history
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-yellow-500/20 bg-[#1e1e1e] p-5">
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Counts logged</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-white">{cashVariance30d.length}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Cumulative diff</p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums ${cashVarianceTotal < 0 ? "text-red-300" : "text-yellow-300"}`}
                >
                  {cashVarianceTotal > 0 ? "+" : ""}
                  {formatCurrency(cashVarianceTotal)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Biggest swing</p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums ${(cashVarianceBiggest?.diff ?? 0) < 0 ? "text-red-300" : "text-yellow-300"}`}
                >
                  {cashVarianceBiggest
                    ? `${cashVarianceBiggest.diff > 0 ? "+" : ""}${formatCurrency(cashVarianceBiggest.diff)}`
                    : "—"}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-500">
                  {cashVarianceBiggest?.dateKey || "No counts yet"}
                </p>
              </div>
            </div>
            {cashVariance30d.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">
                No manual counts logged in the last 30 days. Run a count from{" "}
                <Link to={createPageUrl("DailyCash")} className="text-yellow-300 hover:underline">
                  Daily Cash
                </Link>{" "}
                to populate this chart.
              </p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashVariance30d} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis
                      dataKey="dateKey"
                      stroke="#6b7280"
                      tickFormatter={(k) => (typeof k === "string" ? k.slice(5) : k)}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      stroke="#6b7280"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(250,204,21,0.06)" }}
                      contentStyle={{
                        background: "#1a1a1a",
                        border: "1px solid rgba(250,204,21,0.2)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value) => [formatCurrency(Number(value)), "Diff"]}
                      labelFormatter={(label) => label}
                    />
                    <Bar dataKey="diff" radius={[4, 4, 0, 0]}>
                      {cashVariance30d.map((entry) => (
                        <Cell
                          key={entry.dateKey}
                          fill={entry.diff >= 0 ? "#facc15" : "#f87171"}
                          fillOpacity={entry.diff >= 0 ? 0.85 : 0.9}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        <section id="product-mix-ranking" className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Where money flows</p>
              <h2 className="mt-1 text-2xl font-bold text-yellow-400">Top spend &amp; top sales</h2>
              <p className="mt-1 text-xs text-gray-500">
                Uses the filter window above ({displayPeriodLabel}). Spend groups expense rows by
                name; sales use Loyverse receipt line items.
              </p>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-yellow-500/20 bg-[#1e1e1e]">
              <div className="flex items-center justify-between gap-2 border-b border-yellow-500/15 px-5 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-yellow-200">Top spend by item</h3>
                  <SourceBadge source="finance_ledger" />
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-yellow-200">
                  <Link to={appendMonthParam(createPageUrl("ShoppingList"), calendarMonthKey)}>
                    Open Shopping
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              {topExpensesByName.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-500">
                  No expenses in {displayPeriodLabel.toLowerCase()}.
                </p>
              ) : (
                <>
                <div className="space-y-3 p-4 sm:hidden">
                  {topExpensesByName.map((row, idx) => {
                    const share = topExpensesTotal > 0 ? (row.total / topExpensesTotal) * 100 : 0;
                    return (
                      <div key={row.key} className="rounded-xl border border-yellow-500/10 bg-black/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">#{idx + 1}</p>
                            <p className="mt-1 truncate text-sm font-semibold text-yellow-50">{row.name}</p>
                            <p className="mt-1 text-[11px] text-gray-500">
                              {row.category && row.category !== "other" ? row.category : "Expense"} · {row.count} rows
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-semibold tabular-nums text-amber-200/90">{formatCurrency(row.total)}</p>
                            {share > 0 ? <p className="text-[10px] text-gray-500">{share.toFixed(1)}%</p> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[420px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-yellow-500/15 bg-black/25 text-[10px] font-semibold uppercase tracking-wide text-yellow-200/80">
                        <th className="px-4 py-2">#</th>
                        <th className="px-4 py-2">Item</th>
                        <th className="px-4 py-2 text-right">Total</th>
                        <th className="px-4 py-2 text-right">Rows</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topExpensesByName.map((row, idx) => {
                        const share = topExpensesTotal > 0 ? (row.total / topExpensesTotal) * 100 : 0;
                        return (
                          <tr
                            key={row.key}
                            className={`border-b border-yellow-500/10 ${idx % 2 === 1 ? "bg-black/20" : ""}`}
                          >
                            <td className="px-4 py-2 tabular-nums text-gray-500">{idx + 1}</td>
                            <td className="px-4 py-2 font-medium text-yellow-50">
                              {row.name}
                              {row.category && row.category !== "other" && (
                                <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-gray-500">
                                  {row.category}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-mono tabular-nums text-amber-200/90">
                              {formatCurrency(row.total)}
                              {share > 0 && (
                                <span className="ml-2 text-[10px] font-normal text-gray-500">
                                  {share.toFixed(1)}%
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-400">{row.count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-yellow-500/20 bg-[#1e1e1e]">
              <div className="flex items-center justify-between gap-2 border-b border-yellow-500/15 px-5 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-yellow-200">Top sales by dish</h3>
                  <SourceBadge source="loyverse" />
                </div>
                <Button asChild variant="ghost" size="sm" className="text-xs text-gray-400 hover:text-yellow-200">
                  <Link to={appendMonthParam(createPageUrl("Statistics"), calendarMonthKey)}>
                    Open Stats
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              {topDishesInPeriod.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-500">
                  {hasLoyverseApiConfig(appSettings)
                    ? `No Loyverse receipts in ${displayPeriodLabel.toLowerCase()}.`
                    : "Connect Loyverse in Integrations to populate this list."}
                </p>
              ) : (
                <>
                <div className="space-y-3 p-4 sm:hidden">
                  {topDishesInPeriod.map((row, idx) => {
                    const share = topDishesRevenue > 0 ? (row.revenue / topDishesRevenue) * 100 : 0;
                    return (
                      <div key={row.name} className="rounded-xl border border-yellow-500/10 bg-black/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">#{idx + 1}</p>
                            <p className="mt-1 truncate text-sm font-semibold text-yellow-50">{row.name}</p>
                            <p className="mt-1 text-[11px] text-gray-500">{formatNumber(row.count)} units</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-semibold tabular-nums text-amber-200/90">{formatCurrency(row.revenue)}</p>
                            {share > 0 ? <p className="text-[10px] text-gray-500">{share.toFixed(1)}%</p> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full min-w-[420px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-yellow-500/15 bg-black/25 text-[10px] font-semibold uppercase tracking-wide text-yellow-200/80">
                        <th className="px-4 py-2">#</th>
                        <th className="px-4 py-2">Dish</th>
                        <th className="px-4 py-2 text-right">Revenue</th>
                        <th className="px-4 py-2 text-right">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topDishesInPeriod.map((row, idx) => {
                        const share = topDishesRevenue > 0 ? (row.revenue / topDishesRevenue) * 100 : 0;
                        return (
                          <tr
                            key={row.name}
                            className={`border-b border-yellow-500/10 ${idx % 2 === 1 ? "bg-black/20" : ""}`}
                          >
                            <td className="px-4 py-2 tabular-nums text-gray-500">{idx + 1}</td>
                            <td className="px-4 py-2 font-medium text-yellow-50">{row.name}</td>
                            <td className="px-4 py-2 text-right font-mono tabular-nums text-amber-200/90">
                              {formatCurrency(row.revenue)}
                              {share > 0 && (
                                <span className="ml-2 text-[10px] font-normal text-gray-500">
                                  {share.toFixed(1)}%
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-gray-400">
                              {formatNumber(row.count)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section id="executive-summary">

          <details className="mb-4 group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-xl border border-yellow-500/10 bg-[#1e1e1e] px-4 py-2.5 text-xs uppercase tracking-[0.2em] text-gray-500 hover:bg-[#242424] select-none list-none">
              <span className="mr-1 text-yellow-500/60 group-open:rotate-90 transition-transform inline-block">▶</span>
              Period Comparisons
            </summary>
            <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {comparisonCards.map((item) => (
                <div key={item.id} className="rounded-xl border border-yellow-500/10 bg-[#1e1e1e] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-gray-600">{item.label}</p>
                  <p className="mt-1.5 text-lg font-bold text-white">{item.currentLabel}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className={`text-xs font-medium ${item.trend === "up" ? "text-yellow-400" : "text-red-400"}`}>{item.deltaLabel}</p>
                    <p className="text-[10px] text-gray-600">Prev: {item.previousLabel}</p>
                  </div>
                </div>
              ))}
            </div>
          </details>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {executiveKpis.map((item) => (
              <KpiCard key={item.id} item={item} onOpenBreakdown={item.breakdown ? setKpiDetailItem : undefined} />
            ))}
          </div>
        </section>

        <section id="live-operations" className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Live Operations</p>
              <h2 className="mt-1 text-2xl font-bold text-yellow-400">
                {leanOpsMode
                  ? `${displayPeriodLabel} at a glance`
                  : isDayOnlyDashboardContext
                    ? `Current service flow (${displayPeriodLabel})`
                    : `Operations in period (${displayPeriodLabel})`}
              </h2>
            </div>
            <Button asChild variant="outline" className="border-yellow-500/20 bg-[#242424] text-gray-200 hover:bg-[#2b2b2b]">
              <Link to={dashboardFocusHref("live-operations")}>
                View operations detail
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {liveOperations.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4 transition-all hover:border-yellow-400/30 hover:bg-[#2b2b2b]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{item.label}</p>
                  <SourceBadge source={item.dataSource} />
                </div>
                <p className={`mt-3 text-3xl font-bold ${item.tone}`}>{item.value}</p>
                <p className="mt-2 text-sm text-gray-400">{item.subtext}</p>
              </Link>
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          <DashboardPanel
            title="Sales & Trends"
            description="Revenue cadence, order timing, and sales mix."
            sourceBadge={<SourceBadge source={salesPipelineDataSource} />}
            action={<Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300"><BarChart3 className="mr-1 h-3 w-3" />Source-tagged sales events</Badge>}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <p className="text-sm font-semibold text-yellow-400">Revenue trend (latest 7 days within selection)</p>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenue7Days}>
                      <defs>
                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#facc15" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#facc15" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(250,204,21,0.08)" vertical={false} />
                      <XAxis dataKey="day" stroke="#737373" />
                      <YAxis stroke="#737373" />
                      <Tooltip contentStyle={{ background: "#242424", border: "1px solid rgba(250,204,21,0.18)", borderRadius: "12px" }} />
                      <Area type="monotone" dataKey="revenue" stroke="#facc15" fill="url(#revenueFill)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <p className="text-sm font-semibold text-yellow-400">Revenue last 30 days</p>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenue30Days}>
                      <CartesianGrid stroke="rgba(250,204,21,0.08)" vertical={false} />
                      <XAxis dataKey="window" stroke="#737373" />
                      <YAxis stroke="#737373" />
                      <Tooltip contentStyle={{ background: "#242424", border: "1px solid rgba(250,204,21,0.18)", borderRadius: "12px" }} />
                      <Bar dataKey="revenue" fill="#facc15" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="target" fill="#5a4c12" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {isDayOnlyDashboardContext ? (
                <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                  <p className="text-sm font-semibold text-yellow-400">Sales events by hour ({displayPeriodLabel})</p>
                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ordersByHourToday}>
                        <CartesianGrid stroke="rgba(250,204,21,0.08)" vertical={false} />
                        <XAxis dataKey="hour" stroke="#737373" />
                        <YAxis stroke="#737373" />
                        <Tooltip contentStyle={{ background: "#242424", border: "1px solid rgba(250,204,21,0.18)", borderRadius: "12px" }} />
                        <Bar dataKey="orders" fill="#eab308" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <p className="text-sm font-semibold text-yellow-400">Sales by channel</p>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={salesByChannel} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={4}>
                        {salesByChannel.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#242424", border: "1px solid rgba(250,204,21,0.18)", borderRadius: "12px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 xl:col-span-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-yellow-400">Average order value trend</p>
                  <SourceBadge source={salesPipelineDataSource} />
                </div>
                <div className="mt-4 h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aovTrend}>
                      <CartesianGrid stroke="rgba(250,204,21,0.08)" vertical={false} />
                      <XAxis dataKey="period" stroke="#737373" />
                      <YAxis stroke="#737373" />
                      <Tooltip contentStyle={{ background: "#242424", border: "1px solid rgba(250,204,21,0.18)", borderRadius: "12px" }} />
                      <Line type="monotone" dataKey="aov" stroke="#fde047" strokeWidth={3} dot={{ r: 4, fill: "#fde047" }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Alerts & Exceptions"
            description="Current action queue for management."
            sourceBadge={<SourceBadge source={alertsSource} />}
            action={<Badge className="border border-red-500/20 bg-red-500/10 text-red-300"><AlertTriangle className="mr-1 h-3 w-3" />{alerts.length} active</Badge>}
          >
            <AlertFeed alerts={alerts} />
          </DashboardPanel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <ProductList title="Best selling products" items={bestSellingProducts} source={bestSellingSource} />
          {leanOpsMode ? (
            <ProductList title="Focus products" items={bestSellingProducts} source={bestSellingSource} />
          ) : (
            <ProductList title="Highest margin products" items={highestMarginProducts} source="loyverse" />
          )}
          <ProductList title="Worst performing products" items={worstPerformingProducts} source={worstPerformingSource} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <DashboardPanel
            id="payments-reconciliation"
            title="Payments & Reconciliation"
            description="Cross-check between Order module card totals, Clip transactions, and deposits."
            sourceBadge={<SourceBadge source={salesPipelineDataSource} />}
            action={<Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300"><CreditCard className="mr-1 h-3 w-3" />Clip + app</Badge>}
          >
            <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Duplicate matches removed</p>
                <p className="mt-2 text-2xl font-bold text-white">{formatNumber(deduplicatedSalesCount)}</p>
                <p className="mt-2 text-xs text-gray-400">Current reconciliation uses {selectedDedupeWindow.toLowerCase()} and {selectedDedupePriority.toLowerCase()}.</p>
              </div>
              <SelectField
                label="Dedupe window"
                options={DEDUPE_WINDOW_OPTIONS}
                value={selectedDedupeWindow}
                onChange={setSelectedDedupeWindow}
              />
              <SelectField
                label="Dedupe priority"
                options={DEDUPE_PRIORITY_OPTIONS}
                value={selectedDedupePriority}
                onChange={setSelectedDedupePriority}
              />
              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Match rule</p>
                <p className="mt-2 text-sm font-medium text-white">Same amount + near timestamp</p>
                <p className="mt-2 text-xs text-gray-400">If two sources report the same amount within the chosen time window, the preferred source wins and the other is removed from combined sales.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              {paymentSummary.map((item) => (
                <div key={item.label} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{item.label}</p>
                    <SourceBadge source={item.dataSource} />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-white">{item.value}</p>
                  <p className="mt-2 text-xs text-gray-400">{item.subtext}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-yellow-400">Cash vs card vs Clip</p>
                  <SourceBadge source={salesPipelineDataSource} />
                </div>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashVsCard} layout="vertical">
                      <CartesianGrid stroke="rgba(250,204,21,0.08)" horizontal={false} />
                      <XAxis type="number" stroke="#737373" />
                      <YAxis dataKey="source" type="category" stroke="#737373" width={84} />
                      <Tooltip contentStyle={{ background: "#242424", border: "1px solid rgba(250,204,21,0.18)", borderRadius: "12px" }} />
                      <Bar dataKey="amount" fill="#facc15" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <InsightTable
                title="Reconciliation table"
                subtitle="Expected vs actual amounts from current connected sources."
                sourceBadge={<SourceBadge source={salesPipelineDataSource} />}
                columns={[
                  { key: "source_system", label: "Source system" },
                  { key: "expected_amount", label: "Expected amount" },
                  { key: "actual_amount", label: "Actual amount" },
                  { key: "difference", label: "Difference" },
                  { key: "status", label: "Status", render: (value) => <StatusBadge value={value} /> },
                  { key: "last_sync_time", label: "Last sync time" },
                ]}
                rows={reconciliationRows}
                defaultSortKey="last_sync_time"
              />
            </div>

            <div className="mt-6">
              <InsightTable
                title="Deduplicated sales matches"
                subtitle={filteredDeduplicatedSalesCount
                  ? `Recent matches removed from combined sales for the current payment-source filter. Showing ${Math.min(filteredDeduplicationRows.length, filteredDeduplicatedSalesCount)} of ${filteredDeduplicatedSalesCount}.`
                  : "No same-amount same-time duplicate sales were detected for the current payment-source filter."}
                sourceBadge={<SourceBadge source={salesPipelineDataSource} />}
                columns={[
                  { key: "removed_source", label: "Removed source" },
                  { key: "kept_source", label: "Kept source" },
                  { key: "amount", label: "Amount" },
                  { key: "branch", label: "Branch" },
                  { key: "channel", label: "Channel" },
                  { key: "removed_time", label: "Removed time" },
                  { key: "kept_time", label: "Kept time" },
                  { key: "matched_window", label: "Matched within" },
                  { key: "payment_method", label: "Method" },
                ]}
                rows={filteredDeduplicationRows}
                defaultSortKey="removed_time"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-yellow-400">Clip API response</p>
                  <SourceBadge source={hasClipApiConfig(appSettings) ? "clip" : "mock"} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-yellow-500/10 bg-black/20 p-3">
                    <p className="text-xs text-gray-500">Payments returned</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatNumber(clipPayments.length)}</p>
                  </div>
                  <div className="rounded-lg border border-yellow-500/10 bg-black/20 p-3">
                    <p className="text-xs text-gray-500">Unmatched Clip volume</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatCurrency(filteredClipSalesTotal)}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-400">
                  If Clip returns payments with `amount`, `total_amount`, or `approved_amount` and status `approved`/`paid`, funds should appear here.
                </p>
                <details className="mt-4 rounded-xl border border-yellow-500/10 bg-black/10 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    First Clip payment payload
                  </summary>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-gray-300">
                    {JSON.stringify(firstApprovedClipPayment || clipPaymentsPayload || { message: "No Clip payment payload returned." }, null, 2)}
                  </pre>
                </details>
              </div>

              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-yellow-400">Loyverse API response</p>
                  <SourceBadge source={hasLoyverseApiConfig(appSettings) ? "loyverse" : "mock"} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-yellow-500/10 bg-black/20 p-3">
                    <p className="text-xs text-gray-500">Receipts returned</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatNumber(filteredReceipts.length || receipts.length)}</p>
                  </div>
                  <div className="rounded-lg border border-yellow-500/10 bg-black/20 p-3">
                    <p className="text-xs text-gray-500">Receipt total</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatCurrency(loyverseSalesTotal)}</p>
                  </div>
                </div>
                <details className="mt-4 rounded-xl border border-yellow-500/10 bg-black/10 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    First Loyverse receipt payload
                  </summary>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-gray-300">
                    {JSON.stringify(firstFilteredReceipt || { message: "No Loyverse receipt payload returned." }, null, 2)}
                  </pre>
                </details>
                <details className="mt-3 rounded-xl border border-yellow-500/10 bg-black/10 p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                    Raw Clip settlements payload
                  </summary>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-gray-300">
                    {JSON.stringify(clipSettlementsPayload || { message: "No Clip settlements payload returned." }, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel
            id="costs"
            title="Costs"
            description="Uses live Expense and Clip settlement rows where available, otherwise stays marked as placeholder."
            sourceBadge={<SourceBadge source={totalExpenseLedger > 0 && paymentFees > 0 ? "both" : paymentFees > 0 ? "clip" : totalExpenseLedger > 0 ? "finance_ledger" : salesPipelineDataSource} />}
            action={<Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300"><BriefcaseBusiness className="mr-1 h-3 w-3" />Expenses</Badge>}
          >
            <div className="mb-4 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 text-sm text-gray-300">
              <p className="font-medium text-white">Current calculation basis</p>
              <p className="mt-2">
                The <strong className="text-gray-100">expense ledger</strong> below lists every Finance row in the selected range
                (shopping-registered purchases, manual entries, salaries, bank/card payments, etc.). Summary cards still split
                ingredient, labor, recurring, and other costs for margin math. Net profit also includes Clip settlement fees.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Food cost remains purchase-based until recipe-level COGS exists; labor includes booked salaries plus unpaid shifts and
                workday template where configured.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {costsSummary.map((cost) => (
                <div key={cost.label} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{cost.label}</p>
                    <SourceBadge source={cost.dataSource} />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-white">{cost.value}</p>
                  <p className="mt-2 text-xs text-gray-400">{cost.delta}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 max-h-[min(520px,60vh)] overflow-y-auto">
              <InsightTable
                title="Full expense ledger"
                subtitle={`All expenses in the selected ${selectedRangeLabelLower}, newest first. Filter or export CSV below.`}
                sourceBadge={<SourceBadge source={expenseLedgerRows.length ? "finance_ledger" : "mock"} />}
                columns={[
                  { key: "date", label: "Date" },
                  { key: "name", label: "Name" },
                  { key: "category", label: "Category" },
                  { key: "amount", label: "Amount", render: (v) => formatCurrency(v) },
                  { key: "payment", label: "Paid from" },
                  { key: "origin", label: "Source" },
                ]}
                rows={expenseLedgerRows}
                defaultSortKey="date"
                emptyMessage="No expenses in this date range. Add them under Finance / Company account."
                className="border-yellow-500/15"
              />
            </div>

            <div className="mt-6 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-yellow-400">Cost trend vs budget</p>
                <SourceBadge source={costTrendData.some((item) => item.actual > 0) || filteredExpenses.length ? "finance_ledger" : salesPipelineDataSource} />
              </div>
              <div className="mt-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={costTrendData.some((item) => item.actual > 0) ? costTrendData : mockCostTrendVsBudget}>
                    <CartesianGrid stroke="rgba(250,204,21,0.08)" vertical={false} />
                    <XAxis dataKey="month" stroke="#737373" />
                    <YAxis stroke="#737373" />
                    <Tooltip contentStyle={{ background: "#242424", border: "1px solid rgba(250,204,21,0.18)", borderRadius: "12px" }} />
                    <Line dataKey="actual" stroke="#facc15" strokeWidth={3} dot={{ fill: "#facc15" }} />
                    <Line dataKey="budget" stroke="#a16207" strokeWidth={3} dot={{ fill: "#a16207" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </DashboardPanel>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr_0.85fr]">
          <DashboardPanel
            id="inventory"
            title="Inventory"
            description="Low stock is pulled from Loyverse inventory. Purchase cards reuse the expense ledger where supplier spending is already tracked."
            sourceBadge={<SourceBadge source={inventoryDataSource} />}
            action={<Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300"><PackageSearch className="mr-1 h-3 w-3" />Inventory</Badge>}
          >
            <InsightTable
              title="Low stock items"
              subtitle="Days remaining stays placeholder until depletion logic is added."
              sourceBadge={<SourceBadge source={inventoryDataSource} />}
              columns={[
                { key: "ingredient", label: "Ingredient" },
                { key: "branch", label: "Branch" },
                { key: "level", label: "Level" },
                { key: "days_remaining", label: "Days remaining" },
                { key: "status", label: "Status", render: (value) => <StatusBadge value={value} /> },
              ]}
              rows={inventoryInsights.lowStock}
              defaultSortKey="ingredient"
            />
          </DashboardPanel>

          <DashboardPanel title="Recent purchases" description="Uses tracked ingredient expenses when available, otherwise remains marked as placeholder." sourceBadge={<SourceBadge source={inventoryPurchasesSource} />}>
            <div className="space-y-3">
              {inventoryInsights.purchases.map((purchase) => (
                <div key={purchase.id} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                  <p className="text-sm font-semibold text-white">{purchase.item}</p>
                  <p className="mt-1 text-sm text-gray-400">{purchase.supplier}</p>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-yellow-400">{purchase.cost}</span>
                    <span className="text-gray-500">{purchase.received}</span>
                  </div>
                </div>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel title="Forecasted shortages" description="Includes upcoming labor from the employee roster (workdays + shifts) and inventory risk when Loyverse data is available." sourceBadge={<SourceBadge source={inventoryForecastSource} />}>
            <div className="space-y-3">
              {inventoryInsights.forecast.map((item) => (
                <div key={item.id} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                  <p className="text-sm font-semibold text-white">{item.ingredient}</p>
                  <p className="mt-2 text-sm text-yellow-400">{item.risk}</p>
                  <p className="mt-2 text-sm text-gray-400">{item.action}</p>
                </div>
              ))}
            </div>
          </DashboardPanel>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <DashboardPanel
            id="staff"
            title="Staff"
            description="Uses shift records, employee roster data, and salary expenses where available."
            sourceBadge={<SourceBadge source={staffDataSource} />}
            action={<Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300"><Users className="mr-1 h-3 w-3" />Staff</Badge>}
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {staffMetrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{metric.label}</p>
                    <SourceBadge source={metric.dataSource} />
                  </div>
                  <p className="mt-3 text-2xl font-bold text-white">{metric.value}</p>
                  <p className="mt-2 text-xs text-gray-400">{metric.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-yellow-400">Labor efficiency trend</p>
                <SourceBadge source={laborEfficiencySource} />
              </div>
              <div className="mt-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={laborEfficiencySource === "live" ? laborEfficiencyTrend : mockLaborEfficiencyTrend}>
                    <CartesianGrid stroke="rgba(250,204,21,0.08)" vertical={false} />
                    <XAxis dataKey="period" stroke="#737373" />
                    <YAxis stroke="#737373" />
                    <Tooltip contentStyle={{ background: "#242424", border: "1px solid rgba(250,204,21,0.18)", borderRadius: "12px" }} />
                    <Bar dataKey="efficiency" fill="#facc15" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </DashboardPanel>

          <DashboardPanel title="Recommended next checks" description="Shortcuts to the dashboard sections that usually need follow-up.">
            <div className="space-y-3">
              {[
                { icon: CreditCard, title: "Payments & reconciliation", subtitle: "Card totals, Clip sync, and settlement gaps", href: dashboardFocusHref("payments-reconciliation") },
                { icon: Pizza, title: "Product mix", subtitle: "Best sellers are partially live, margins still need cost mapping", href: dashboardFocusHref("products") },
                { icon: ChefHat, title: "Food cost investigation", subtitle: "Expense-based today, needs real COGS and supplier costing", href: dashboardFocusHref("costs") },
                { icon: Activity, title: "Alert queue", subtitle: "Generated from current sync and reconciliation conditions", href: dashboardFocusHref("alerts-exceptions") },
                { icon: Store, title: "Integration status", subtitle: "Review provider health, missing credentials, and sync setup in Integrations.", href: createPageUrl("IntegrationsHub") },
              ].map((item) => (
                <Link
                  key={item.title}
                  to={item.href}
                  className="flex items-center justify-between rounded-xl border border-yellow-500/20 bg-[#1a1a1a] p-4 transition-all hover:border-yellow-400/30 hover:bg-[#202020]"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl border border-yellow-500/10 bg-black/20 p-3">
                      <item.icon className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-sm text-gray-400">{item.subtitle}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-500" />
                </Link>
              ))}
            </div>
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}
