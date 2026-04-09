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
import { subDays, format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { getClipOverview, hasClipApiConfig } from "@/api/clip";
import { appParams } from "@/lib/app-params";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { listOrders } from "@/lib/local-dev-orders";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import KpiCard from "@/components/dashboard/KpiCard";
import InsightTable from "@/components/dashboard/InsightTable";
import AlertFeed from "@/components/dashboard/AlertFeed";
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
  detailViews,
  filterOptions,
  inventoryInsights as mockInventoryInsights,
  laborEfficiencyTrend as mockLaborEfficiencyTrend,
  productPerformance as mockProductPerformance,
} from "@/features/dashboard/mockData";

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatNumber = (value) => new Intl.NumberFormat("es-MX").format(value || 0);

function SourceBadge({ source = "mock" }) {
  const isLive = source === "live";
  return (
    <Badge
      className={
        isLive
          ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border border-amber-400/20 bg-amber-400/10 text-amber-200"
      }
    >
      {isLive ? "Live data" : "Hardcoded"}
    </Badge>
  );
}

function SelectField({ label, options, value, onChange }) {
  return (
    <label className="flex w-full min-w-[170px] flex-col gap-2">
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
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : normalized === "mismatch" || normalized === "critical"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : normalized === "pending" || normalized === "review"
          ? "border-yellow-400/20 bg-yellow-400/10 text-yellow-200"
          : "border-sky-400/20 bg-sky-400/10 text-sky-200";

  return <Badge className={`border ${styles}`}>{value}</Badge>;
}

function ProductList({ title, items, source = "mock" }) {
  return (
    <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-yellow-400">{title}</h3>
          <SourceBadge source={source} />
        </div>
        <Badge className="border border-yellow-500/10 bg-[#1a1a1a] text-gray-300">{items.length} items</Badge>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <Link
            key={item.id}
            to={item.href}
            className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] px-3 py-3 transition-colors hover:bg-[#202020]"
          >
            <div>
              <p className="text-sm font-medium text-white">
                {index + 1}. {item.product}
              </p>
              <p className="text-xs text-gray-500">{item.units} units</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-200">{item.revenue}</p>
              <p className="text-xs text-yellow-400">{item.margin} margin</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function getStartOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getStartOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDateRangeStart(range) {
  const today = getStartOfToday();

  switch (range) {
    case "1 day":
      return today;
    case "7 days":
      return subDays(today, 6);
    case "1 month":
      return getStartOfMonth(today);
    case "All history":
    default:
      return null;
  }
}

function filterByRange(records, range) {
  const start = getDateRangeStart(range);
  if (!start) {
    return records;
  }

  return records.filter((record) => getRecordDate(record) >= start);
}

function sumOrderRevenue(orders) {
  return orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
}

function calculateDifference(current, previous) {
  if (!previous) {
    return null;
  }

  return current - previous;
}

function formatDifference(difference) {
  if (difference === null || Number.isNaN(difference)) {
    return "No prior period";
  }

  if (difference === 0) {
    return "MXN 0";
  }

  const sign = difference > 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(difference))}`;
}

function getTrendFromDifference(difference) {
  if (difference === null || difference === 0) {
    return "up";
  }

  return difference > 0 ? "up" : "down";
}

function isSameDay(left, right) {
  return left.toDateString() === right.toDateString();
}

function getExpenseAmount(expense) {
  return Number(expense?.amount || 0);
}

function getRecordDate(record) {
  return new Date(
    record?.date ||
      record?.created_date ||
      record?.created_at ||
      record?.approved_at ||
      record?.paid_at ||
      record?.deposit_date ||
      record?.updated_at ||
      0,
  );
}

function getMoneyValue(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    return getMoneyValue(value.amount ?? value.value ?? value.total ?? value.net ?? value.gross);
  }

  return 0;
}

function getClipPaymentAmount(payment) {
  return getMoneyValue(
    payment?.amount ??
      payment?.total_amount ??
      payment?.total ??
      payment?.approved_amount,
  );
}

function getClipPaymentRefundAmount(payment) {
  return getMoneyValue(
    payment?.amount_refunded ??
      payment?.refunded_amount ??
      payment?.refund_amount,
  );
}

function getClipSettlementFeeAmount(settlement) {
  return getMoneyValue(
    settlement?.fee_amount ??
      settlement?.fees ??
      settlement?.commission_amount ??
      settlement?.total_fees,
  );
}

function getClipSettlementStatus(settlement) {
  return String(settlement?.status || settlement?.state || "processed").toLowerCase();
}

function getClipSettlementNetAmount(settlement) {
  return getMoneyValue(
    settlement?.net_amount ??
      settlement?.net_total ??
      settlement?.amount_net ??
      settlement?.net,
  );
}

function getReceiptTotal(receipt) {
  return getMoneyValue(
    receipt?.total_money ??
      receipt?.total ??
      receipt?.total_payment_money,
  );
}

function getReceiptItems(receipt) {
  return (
    receipt?.line_items ||
    receipt?.receipt_items ||
    receipt?.items ||
    receipt?.positions ||
    []
  );
}

function getReceiptItemGross(item) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1;
  const unitPrice = getMoneyValue(
    item?.price_money ??
      item?.price ??
      item?.base_price_money ??
      item?.gross_money ??
      item?.amount_money,
  );

  if (unitPrice > 0) {
    return unitPrice * quantity;
  }

  return getMoneyValue(
    item?.total_money ??
      item?.gross_total_money ??
      item?.subtotal_money ??
      item?.amount,
  );
}

function getReceiptGrossBeforeDiscount(receipt) {
  const subtotal = getMoneyValue(
    receipt?.subtotal_money ??
      receipt?.subtotal ??
      receipt?.gross_money ??
      receipt?.amount_money,
  );

  if (subtotal > 0) {
    return subtotal;
  }

  const discountTotal = getMoneyValue(
    receipt?.total_discount_money ??
      receipt?.discount_total_money ??
      receipt?.discount_money ??
      receipt?.discount ??
      receipt?.discount_amount_money,
  );

  if (discountTotal > 0) {
    return getReceiptTotal(receipt) + discountTotal;
  }

  const itemGrossTotal = getReceiptItems(receipt).reduce((sum, item) => sum + getReceiptItemGross(item), 0);
  return itemGrossTotal || getReceiptTotal(receipt);
}

function byCategory(expenses, category) {
  return expenses.filter((expense) => String(expense.category || "").toLowerCase() === category);
}

function getExpenseCategory(expense) {
  return String(expense?.category || "").toLowerCase();
}

function buildOrdersByHour(orders) {
  return Array.from({ length: 12 }, (_, index) => {
    const hour = index + 10;
    const count = orders.filter((order) => new Date(order.created_date).getHours() === hour).length;
    return { hour: String(hour), orders: count };
  });
}

function buildSevenDayRevenue(orders) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(new Date(), 6 - index);
    const dayOrders = orders.filter((order) => isSameDay(new Date(order.created_date), date));
    return {
      day: format(date, "EEE"),
      revenue: dayOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      orders: dayOrders.length,
    };
  });
}

function buildThirtyDayRevenue(orders) {
  return Array.from({ length: 4 }, (_, index) => {
    const end = subDays(new Date(), (3 - index) * 7);
    const start = subDays(end, 6);
    const weekOrders = orders.filter((order) => {
      const created = new Date(order.created_date);
      return created >= start && created <= end;
    });
    const revenue = weekOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    return {
      window: `Week ${index + 1}`,
      revenue,
      target: Math.round(revenue * 0.94),
    };
  });
}

function buildAovTrend(orders) {
  return Array.from({ length: 4 }, (_, index) => {
    const end = subDays(new Date(), (3 - index) * 7);
    const start = subDays(end, 6);
    const weekOrders = orders.filter((order) => {
      const created = new Date(order.created_date);
      return created >= start && created <= end;
    });
    const totalRevenue = weekOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    return {
      period: `Week ${index + 1}`,
      aov: weekOrders.length ? Number((totalRevenue / weekOrders.length).toFixed(2)) : 0,
    };
  });
}

function buildBestSellingProducts(orders) {
  const itemsMap = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = item.item_name || item.name || "Unknown item";
      const current = itemsMap.get(key) || { units: 0, revenue: 0 };
      current.units += Number(item.quantity || 0);
      current.revenue += Number(item.price || 0) * Number(item.quantity || 0);
      itemsMap.set(key, current);
    });
  });

  return [...itemsMap.entries()]
    .sort((a, b) => b[1].units - a[1].units)
    .slice(0, 3)
    .map(([product, values], index) => ({
      id: `live-product-${index}`,
      product,
      units: values.units,
      revenue: formatCurrency(values.revenue),
      margin: "Live qty/revenue",
      href: "/managementinsight?view=products",
    }));
}

function buildSalesByChannel(orders) {
  const channels = [
    { key: "dine-in", name: "Dine-in", fill: "#facc15" },
    { key: "takeout", name: "Takeout", fill: "#a16207" },
    { key: "delivery", name: "Delivery", fill: "#fef08a" },
  ];

  return channels.map((channel) => ({
    name: channel.name,
    value: orders
      .filter((order) => order.order_type === channel.key)
      .reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    fill: channel.fill,
  }));
}

function buildInventoryRows(loyverseOverview) {
  const levels = loyverseOverview?.inventoryLevels || [];
  const items = loyverseOverview?.items || [];
  const itemMap = new Map(items.map((item) => [item.id, item]));

  return levels
    .map((level, index) => {
      const item = itemMap.get(level.item_id);
      const quantity = Number(level.in_stock || level.stock || 0);
      return {
        id: level.id || `inventory-${index}`,
        ingredient: item?.name || level.item_id || "Unknown item",
        branch: level.store_id || "Store",
        level: `${quantity}`,
        days_remaining: "TODO from sales velocity",
        status: quantity <= 5 ? "Critical" : "Low",
      };
    })
    .filter((row) => row.status === "Critical" || row.status === "Low")
    .slice(0, 8);
}

function buildRecentPurchases(expenses) {
  return byCategory(expenses, "ingredients")
    .slice(0, 3)
    .map((expense, index) => ({
      id: expense.id || `purchase-${index}`,
      supplier: expense.supplier || "Expense ledger",
      item: expense.name || "Ingredient purchase",
      cost: formatCurrency(getExpenseAmount(expense)),
      received: expense.date ? format(new Date(expense.date), "yyyy-MM-dd") : "No date",
    }));
}

function buildInventoryForecast(rows) {
  return rows.slice(0, 3).map((row) => ({
    id: `forecast-${row.id}`,
    ingredient: row.ingredient,
    risk: row.status === "Critical" ? "Critical stock threshold reached" : "Low stock threshold reached",
    action: row.status === "Critical" ? "Reorder or transfer stock immediately." : "Review next purchase window and branch transfers.",
  }));
}

function buildLaborEfficiencyTrend(shifts, orders) {
  return Array.from({ length: 4 }, (_, index) => {
    const end = subDays(new Date(), (3 - index) * 7);
    const start = subDays(end, 6);

    const periodShifts = shifts.filter((shift) => {
      const shiftDate = getRecordDate(shift);
      return shiftDate >= start && shiftDate <= end;
    });

    const periodOrders = orders.filter((order) => {
      const orderDate = getRecordDate(order);
      return orderDate >= start && orderDate <= end;
    });

    const hours = periodShifts.reduce((sum, shift) => sum + Number(shift.hours_worked || 0), 0);
    const revenue = periodOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

    return {
      period: `Week ${index + 1}`,
      efficiency: hours ? Number((revenue / hours).toFixed(1)) : 0,
    };
  });
}

function buildCostTrendVsBudget(orders, expenses) {
  const budget = [58, 59, 60, 61];

  return Array.from({ length: 4 }, (_, index) => {
    const end = subDays(new Date(), (3 - index) * 7);
    const start = subDays(end, 6);
    const periodOrders = orders.filter((order) => {
      const orderDate = getRecordDate(order);
      return orderDate >= start && orderDate <= end;
    });
    const periodExpenses = expenses.filter((expense) => {
      const expenseDate = getRecordDate(expense);
      return expenseDate >= start && expenseDate <= end;
    });

    const revenue = periodOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const cost = periodExpenses.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);

    return {
      month: `Week ${index + 1}`,
      actual: revenue ? Number(((cost / revenue) * 100).toFixed(1)) : 0,
      budget: budget[index],
    };
  });
}

function buildWorstPerformingProducts(orders) {
  const itemsMap = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = item.item_name || item.name || "Unknown item";
      const current = itemsMap.get(key) || { units: 0, revenue: 0 };
      current.units += Number(item.quantity || 0);
      current.revenue += Number(item.price || 0) * Number(item.quantity || 0);
      itemsMap.set(key, current);
    });
  });

  return [...itemsMap.entries()]
    .filter(([, values]) => values.units > 0)
    .sort((a, b) => a[1].units - b[1].units || a[1].revenue - b[1].revenue)
    .slice(0, 3)
    .map(([product, values], index) => ({
      id: `low-product-${index}`,
      product,
      units: values.units,
      revenue: formatCurrency(values.revenue),
      margin: "Live low-volume proxy",
      href: "/managementinsight?view=products",
    }));
}

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const [selectedDateRange, setSelectedDateRange] = React.useState(filterOptions.dateRanges[0]);
  const [selectedBranch, setSelectedBranch] = React.useState(filterOptions.branches[0]);
  const [selectedChannel, setSelectedChannel] = React.useState(filterOptions.salesChannels[0]);
  const [selectedPaymentSource, setSelectedPaymentSource] = React.useState(filterOptions.paymentSources[0]);
  const [selectedShift, setSelectedShift] = React.useState(filterOptions.shifts[0]);
  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" || !appParams.appId || !appParams.serverUrl);

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });
  const appSettings = React.useMemo(() => getResolvedIntegrationSettings(settings[0] || {}), [settings]);

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), "-created_date"),
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses"],
    queryFn: () => base44.entities.Expense.list("-date"),
  });

  const transactionsQuery = useQuery({
    queryKey: ["companyTransactions"],
    queryFn: () => base44.entities.CompanyTransaction.list("-date"),
  });

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: () => base44.entities.Employee.list("name"),
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: () => base44.entities.Shift.list("-date"),
  });

  const loyverseQuery = useQuery({
    queryKey: ["loyverseOverview", settings[0]?.id || "none"],
    queryFn: () => getLoyverseOverview(appSettings),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });

  const clipQuery = useQuery({
    queryKey: ["clipOverview", settings[0]?.id || "none"],
    queryFn: () => getClipOverview(appSettings),
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
  const clipPaymentsPayload = clipOverview?.raw?.paymentsPayload || null;
  const clipSettlementsPayload = clipOverview?.raw?.settlementsPayload || null;
  const filteredOrders = filterByRange(orders, selectedDateRange);
  const filteredExpenses = filterByRange(expenses, selectedDateRange);
  const filteredTransactions = filterByRange(transactions, selectedDateRange);
  const filteredShifts = filterByRange(shifts, selectedDateRange);
  const filteredReceipts = filterByRange(receipts, selectedDateRange);
  const filteredClipPayments = filterByRange(clipPayments, selectedDateRange);
  const filteredClipSettlements = filterByRange(clipSettlements, selectedDateRange);

  const deliveredOrders = filteredOrders.filter((order) => order.status === "delivered");
  const activeOrders = orders.filter((order) => ["pending", "preparing", "ready", "out_for_delivery"].includes(order.status)).length;
  const todayStart = getStartOfToday();
  const weekStart = subDays(todayStart, 6);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const todayOrders = orders.filter((order) => new Date(order.created_date) >= todayStart);
  const weekOrders = filteredOrders.filter((order) => getRecordDate(order) >= weekStart);
  const todayReceipts = receipts.filter((receipt) => getRecordDate(receipt) >= todayStart);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const todayCancelledOrders = todayOrders.filter((order) => order.status === "cancelled").length;
  const todayDelayedOrders = orders.filter((order) => Number(order.estimated_delivery_minutes || 0) > 35).length;
  const todayRefundCount = filteredClipPayments.filter((payment) => getClipPaymentRefundAmount(payment) > 0).length;
  const prepTimeOrders = todayOrders.filter((order) => Number(order.preparation_minutes || order.estimated_delivery_minutes || 0) > 0);
  const avgPrepTime = prepTimeOrders.length
    ? Math.round(prepTimeOrders.reduce((sum, order) => sum + Number(order.preparation_minutes || order.estimated_delivery_minutes || 0), 0) / prepTimeOrders.length)
    : 0;
  const ordersInKitchen = orders.filter((order) => order.status === "preparing").length;
  const ordersOutForDelivery = orders.filter((order) => order.status === "out_for_delivery").length;

  const totalRevenue = sumOrderRevenue(deliveredOrders);
  const shiftExpenseIds = new Set(filteredShifts.map((shift) => shift.expense_id).filter(Boolean));
  const ingredientExpenseRows = filteredExpenses.filter((expense) => getExpenseCategory(expense) === "ingredients");
  const shoppingIngredientExpenseRows = ingredientExpenseRows.filter((expense) => expense.from_shopping_list);
  const manualIngredientExpenseRows = ingredientExpenseRows.filter((expense) => !expense.from_shopping_list);
  const salaryExpenseRows = filteredExpenses.filter((expense) => getExpenseCategory(expense) === "salaries");
  const shiftLaborExpenseRows = salaryExpenseRows.filter((expense) => shiftExpenseIds.has(expense.id));
  const manualLaborExpenseRows = salaryExpenseRows.filter((expense) => !shiftExpenseIds.has(expense.id));
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
  const shiftLaborExpenses = shiftLaborExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const manualLaborExpenses = manualLaborExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const laborExpenses = shiftLaborExpenses || manualLaborExpenses;
  const recurringExpenses = recurringExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const otherOperatingExpenses = otherOperatingExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const ingredientExpensesToday = ingredientExpenseRows.filter((expense) => getRecordDate(expense) >= todayStart).reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const ingredientExpensesWeek = ingredientExpenseRows.filter((expense) => getRecordDate(expense) >= weekStart).reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const ingredientExpensesMonth = ingredientExpenseRows.filter((expense) => getRecordDate(expense) >= monthStart).reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const laborExpensesToday = salaryExpenseRows.filter((expense) => getRecordDate(expense) >= todayStart).reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const laborExpensesWeek = salaryExpenseRows.filter((expense) => getRecordDate(expense) >= weekStart).reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const laborExpensesMonth = salaryExpenseRows.filter((expense) => getRecordDate(expense) >= monthStart).reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const filteredRefundVolume = filteredClipPayments.reduce((sum, payment) => sum + getClipPaymentRefundAmount(payment), 0);
  const paymentFees = filteredClipSettlements.reduce((sum, settlement) => sum + getClipSettlementFeeAmount(settlement), 0);
  const grossSales = filteredReceipts.length ? filteredReceipts.reduce((sum, receipt) => sum + getReceiptGrossBeforeDiscount(receipt), 0) : totalRevenue;
  const ordersCount = filteredReceipts.length || filteredOrders.length;
  const totalExpenses = totalExpenseLedger + paymentFees;
  const grossProfit = grossSales - ingredientExpenses;
  const netProfit = grossSales - ingredientExpenses - laborExpenses - recurringExpenses - otherOperatingExpenses - paymentFees;
  const foodCostPct = grossSales ? (ingredientExpenses / grossSales) * 100 : 0;
  const laborCostPct = grossSales ? (laborExpenses / grossSales) * 100 : 0;
  const costPerOrder = ordersCount ? totalExpenses / ordersCount : 0;
  const failedSettlementsCount = filteredClipSettlements.filter((settlement) => {
    const status = getClipSettlementStatus(settlement);
    return status.includes("fail") || status.includes("declin") || status.includes("error");
  }).length;
  const completedReceiptsCount = loyverseOverview?.metrics?.completedReceiptsCount || 0;
  const cancelledReceiptsCount = loyverseOverview?.metrics?.cancelledReceiptsCount || 0;
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
  const manualCashTotal = filteredTransactions
    .filter((transaction) => transaction.type === "contribution" && transaction.payment_method === "cash")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const salesTransactionCount = filteredReceipts.length + approvedClipPayments.length;
  const averageTransactionValue = salesTransactionCount
    ? (loyverseSalesTotal + clipApprovedTotal) / salesTransactionCount
    : 0;
  const appCardTotal = filteredOrders
    .filter((order) => order.payment_method === "card")
    .reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const todayCardOrdersCount = todayOrders.filter((order) => order.payment_method === "card").length;
  const depositTotal = filteredClipSettlements.reduce((sum, settlement) => sum + getClipSettlementNetAmount(settlement), 0);
  const netSales = loyverseSalesTotal + clipApprovedTotal + manualCashTotal;
  const aov = averageTransactionValue;
  const pendingSettlements = Math.max(clipApprovedTotal - depositTotal, 0);
  const mismatch = clipApprovedTotal - appCardTotal;
  const todayGrossReceived = todayReceipts.length
    ? todayReceipts.reduce((sum, receipt) => sum + getReceiptGrossBeforeDiscount(receipt), 0)
    : todayRevenue;
  const bankTransferTotal = filteredTransactions
    .filter((transaction) => transaction.payment_method === "transfer")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const previousDayOrders = orders.filter((order) => {
    const date = getRecordDate(order);
    return date >= subDays(todayStart, 7) && date < subDays(todayStart, 6);
  });
  const previousWeekOrders = orders.filter((order) => {
    const date = getRecordDate(order);
    return date >= subDays(todayStart, 13) && date < subDays(todayStart, 6);
  });
  const previousMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth() - 1, 1);
  const previousMonthEnd = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const previousMonthOrders = orders.filter((order) => {
    const date = getRecordDate(order);
    return date >= previousMonthStart && date < previousMonthEnd;
  });
  const selectedRangeStart = getDateRangeStart(selectedDateRange);
  const previousSelectedOrders = selectedRangeStart
    ? orders.filter((order) => {
        const date = getRecordDate(order);
        const diff = todayStart.getTime() - selectedRangeStart.getTime();
        const previousStart = new Date(selectedRangeStart.getTime() - diff - 86400000);
        const previousEnd = new Date(todayStart.getTime() - diff - 86400000);
        return date >= previousStart && date < previousEnd;
      })
    : [];
  const comparisonCards = [
    {
      id: "day-compare",
      label: "This day vs same day last week",
      current: sumOrderRevenue(todayOrders),
      previous: sumOrderRevenue(previousDayOrders),
    },
    {
      id: "week-compare",
      label: "This week vs last week",
      current: sumOrderRevenue(orders.filter((order) => getRecordDate(order) >= weekStart)),
      previous: sumOrderRevenue(previousWeekOrders),
    },
    {
      id: "month-compare",
      label: "This month vs last month",
      current: sumOrderRevenue(orders.filter((order) => getRecordDate(order) >= monthStart)),
      previous: sumOrderRevenue(previousMonthOrders),
    },
    {
      id: "selected-compare",
      label: "Selected period vs previous period",
      current: totalRevenue,
      previous: sumOrderRevenue(previousSelectedOrders),
    },
  ].map((item) => {
    const difference = calculateDifference(item.current, item.previous);
    return {
      ...item,
      currentLabel: formatCurrency(item.current),
      previousLabel: item.previous ? formatCurrency(item.previous) : "No prior period",
      deltaLabel: formatDifference(difference),
      trend: getTrendFromDifference(difference),
    };
  });
  const primaryComparisonCard = comparisonCards[0];

  const revenue7Days = buildSevenDayRevenue(filteredOrders);
  const revenue30Days = buildThirtyDayRevenue(filteredOrders);
  const ordersByHourToday = buildOrdersByHour(todayOrders);
  const salesByChannel = buildSalesByChannel(deliveredOrders);
  const aovTrend = buildAovTrend(deliveredOrders);
  const bestSellingProducts = buildBestSellingProducts(filteredOrders);
  const worstPerformingProducts = buildWorstPerformingProducts(filteredOrders);
  const inventoryRows = buildInventoryRows(loyverseOverview);
  const recentPurchases = buildRecentPurchases(filteredExpenses);
  const inventoryForecast = buildInventoryForecast(inventoryRows);
  const laborEfficiencyTrend = buildLaborEfficiencyTrend(filteredShifts, filteredOrders);
  const costTrendData = buildCostTrendVsBudget(filteredOrders, filteredExpenses);
  const todayShifts = filteredShifts.filter((shift) => getRecordDate(shift) >= todayStart);
  const weekShifts = filteredShifts.filter((shift) => getRecordDate(shift) >= weekStart);
  const totalWorkedHours = weekShifts.reduce((sum, shift) => sum + Number(shift.hours_worked || 0), 0);
  const totalShiftCost = weekShifts.reduce((sum, shift) => sum + Number(shift.amount || 0), 0);
  const salesPerLaborHour = totalWorkedHours ? weekOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) / totalWorkedHours : 0;
  const laborCostPerShift = weekShifts.length ? totalShiftCost / weekShifts.length : 0;
  const overtimeAlertsCount = shifts.filter((shift) => Number(shift.hours_worked || 0) > 8).length;
  const currentShiftStaffing = todayShifts.length;
  const activeEmployeesCount = employees.filter((employee) => employee.is_active).length;

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
      href: "/integrations",
      dataSource: "live",
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
      href: "/integrations",
      dataSource: "live",
    });
  }
  if (
    hasClipApiConfig(appSettings) &&
    !clipQuery.isLoading &&
    !clipQuery.isError &&
    selectedDateRange === "1 day" &&
    todayCardOrdersCount > 0 &&
    filteredClipPayments.length === 0
  ) {
    liveAlerts.push({
      id: "clip-sync-warning",
      severity: "high",
      summary: "Clip is connected but no payments were mapped into today's dashboard window.",
      suggestedAction: "Check Clip credentials, payment status mapping, and timezone/date-field alignment between Clip and the dashboard.",
      timestamp: "Live",
      status: "new",
      owner: "Finance manager",
      href: "/Clip",
      dataSource: "live",
    });
  }
  if (
    hasClipApiConfig(appSettings) &&
    !clipQuery.isLoading &&
    !clipQuery.isError &&
    clipPayments.length === 0
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
      dataSource: "live",
    });
  }
  if (Math.abs(mismatch) > 1) {
    liveAlerts.push({
      id: "payment-mismatch",
      severity: "critical",
      summary: "Card totals differ between app orders and Clip payments.",
      suggestedAction: "Review unlinked card orders and match them against Clip transactions before close.",
      timestamp: "Live",
      status: "new",
      owner: "Finance manager",
      href: "/managementinsight?view=payments-reconciliation",
      dataSource: "live",
    });
  }
  if (todayRefundCount > 0) {
    liveAlerts.push({
      id: "refunds-live",
      severity: "medium",
      summary: `${todayRefundCount} Clip refunds detected in the current sync window.`,
      suggestedAction: "Check refund reasons and confirm they match cancellations or duplicate charges.",
      timestamp: "Live",
      status: "acknowledged",
      owner: "Operations",
      href: "/managementinsight?view=alerts-exceptions",
      dataSource: "live",
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
      href: "/managementinsight?view=costs",
      dataSource: "live",
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
      href: "/managementinsight?view=staff",
      dataSource: "live",
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
      href: "/managementinsight?view=inventory",
      dataSource: "live",
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
      href: "/managementinsight?view=payments-reconciliation",
      dataSource: "live",
    });
  }
  if (cancellationRate > 10 || todayCancelledOrders >= 3) {
    liveAlerts.push({
      id: "cancellations-live",
      severity: "medium",
      summary: `Cancellation rate is ${cancellationRate.toFixed(1)}% with ${todayCancelledOrders} app cancellations today.`,
      suggestedAction: "Review refund reasons, service delays, and channel-specific cancellation patterns.",
      timestamp: "Live",
      status: "new",
      owner: "Operations",
      href: "/managementinsight?view=alerts-exceptions",
      dataSource: "live",
    });
  }

  const alerts = liveAlerts.length
    ? liveAlerts
    : mockAlerts.map((alert) => ({ ...alert, dataSource: "mock" }));

  const executiveKpis = [
    {
      id: "net-sales",
      label: "Net Sales",
      value: formatCurrency(netSales),
      delta: primaryComparisonCard.deltaLabel,
      trend: primaryComparisonCard.trend,
      comparisonLabel: `Combined for ${selectedDateRange.toLowerCase()}: Loyverse receipts + Clip approved payments + manual cash entries.`,
      sparkTone: "positive",
      sparkline: revenue7Days.map((item) => Math.max(item.revenue, 0)),
      href: "/managementinsight?view=net-sales",
      dataSource: "live",
    },
    {
      id: "orders-count",
      label: "Orders Count",
      value: formatNumber(ordersCount),
      delta: primaryComparisonCard.deltaLabel,
      trend: primaryComparisonCard.trend,
      comparisonLabel: `Current count for ${selectedDateRange.toLowerCase()}.`,
      sparkTone: "positive",
      sparkline: revenue7Days.map((item) => item.orders),
      href: "/managementinsight?view=orders-count",
      dataSource: receipts.length || orders.length ? "live" : "mock",
    },
    {
      id: "average-order-value",
      label: "Average Order Value",
      value: formatCurrency(aov),
      delta: aov ? primaryComparisonCard.deltaLabel : "Waiting for source data",
      trend: primaryComparisonCard.trend,
      comparisonLabel: `Average transaction amount from Loyverse receipts and Clip approved payments for ${selectedDateRange.toLowerCase()}`,
      sparkTone: "positive",
      sparkline: aovTrend.map((item) => item.aov),
      href: "/managementinsight?view=average-order-value",
      dataSource: salesTransactionCount ? "live" : "mock",
    },
    {
      id: "gross-profit",
      label: "Gross Profit",
      value: ingredientExpenses ? formatCurrency(grossProfit) : mockCostsSummary[0].value,
      delta: rawIngredientExpenses ? primaryComparisonCard.deltaLabel : isIngredientCostEstimated ? `Estimated at MXN ${PIZZA_COST_ESTIMATE}/order × ${filteredOrders.length} orders` : "Waiting for ingredient purchase mapping",
      trend: primaryComparisonCard.trend,
      comparisonLabel: rawIngredientExpenses
        ? `Calculated for ${selectedDateRange.toLowerCase()} using ${shoppingIngredientExpenses ? "Shopping List purchase expenses" : "ingredient expense entries"}.`
        : `Estimated using MXN ${PIZZA_COST_ESTIMATE} average ingredient cost per order. Add real expenses to replace this.`,
      sparkTone: "positive",
      sparkline: revenue7Days.map((item) => Math.max(item.revenue - ingredientExpenses / 7, 0)),
      href: "/managementinsight?view=gross-profit",
      dataSource: rawIngredientExpenses ? "live" : "mock",
    },
    {
      id: "net-profit",
      label: "Net Profit",
      value: formatCurrency(netProfit),
      delta: rawIngredientExpenses ? primaryComparisonCard.deltaLabel : `Estimated: ingredients MXN ${PIZZA_COST_ESTIMATE}/order`,
      trend: primaryComparisonCard.trend,
      comparisonLabel: rawIngredientExpenses
        ? `Derived from ingredients, labor, recurring costs, other expenses, and Clip fees for ${selectedDateRange.toLowerCase()}.`
        : `Using MXN ${PIZZA_COST_ESTIMATE} estimated ingredient cost per order. Add real expenses to improve accuracy.`,
      sparkTone: "positive",
      sparkline: revenue7Days.map((item) => Math.max(item.revenue - ingredientExpenses / 7, 0)),
      href: "/managementinsight?view=net-profit",
      dataSource: rawIngredientExpenses ? "live" : "mock",
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
      href: "/managementinsight?view=food-cost",
      dataSource: rawIngredientExpenses ? "live" : "mock",
    },
    {
      id: "labor-cost",
      label: "Labor Cost %",
      value: laborExpenses ? `${laborCostPct.toFixed(1)}%` : "—",
      delta: laborExpenses ? (shiftLaborExpenses ? "Shift-linked salary expenses" : "Based on salary expenses") : "No salary expenses logged yet. Add shifts via Employee Calendar or log salary expenses in Finance to populate this.",
      trend: "down",
      comparisonLabel: laborExpenses ? "Uses employee calendar payouts where available" : "Needs salary expenses or completed shifts. Go to Employees → log shifts, or Finance → add a salary expense.",
      sparkTone: "negative",
      sparkline: laborExpenses ? mockLaborEfficiencyTrend.map((item) => item.efficiency / 20) : [16.8, 17.0, 17.3, 17.8, 18.0, 18.4, 18.7],
      href: "/managementinsight?view=labor-cost",
      dataSource: laborExpenses ? "live" : "mock",
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
      href: "/managementinsight?view=alerts-exceptions",
      dataSource: liveAlerts.length ? "live" : "mock",
    },
  ];

  const liveOperations = [
    { id: "active-orders", label: "Active Orders", value: formatNumber(activeOrders), tone: "text-white", subtext: "Live from app order statuses", href: "/managementinsight?view=live-operations", dataSource: "live" },
    { id: "delayed-orders", label: "Delayed Orders", value: formatNumber(todayDelayedOrders), tone: "text-yellow-400", subtext: "Approximation until SLA timestamps are wired", href: "/managementinsight?view=live-operations", dataSource: orders.length ? "live" : "mock" },
    { id: "avg-prep-time", label: "Average Prep Time", value: avgPrepTime ? `${avgPrepTime} min` : "—", tone: "text-white", subtext: avgPrepTime ? "Current estimate based on open order flow" : "Needs preparation_minutes or estimated_delivery_minutes set on order records.", href: "/managementinsight?view=live-operations", dataSource: todayOrders.length ? "live" : "mock" },
    { id: "orders-in-kitchen", label: "Orders In Kitchen", value: formatNumber(ordersInKitchen), tone: "text-white", subtext: "Orders with status preparing", href: "/managementinsight?view=live-operations", dataSource: "live" },
    { id: "out-for-delivery", label: "Out For Delivery", value: formatNumber(ordersOutForDelivery), tone: "text-yellow-400", subtext: "Orders with delivery handoff status", href: "/managementinsight?view=live-operations", dataSource: "live" },
    { id: "reservations", label: "Reservations Today", value: "—", tone: "text-white", subtext: "Needs a Reservation entity with a date field. Once reservations are logged, today's count auto-populates.", href: "/managementinsight?view=live-operations", dataSource: "mock" },
    { id: "refunds", label: "Refund Count Today", value: formatNumber(todayRefundCount), tone: "text-red-300", subtext: "Live from Clip refund fields", href: "/managementinsight?view=payments-reconciliation", dataSource: clipOverview ? "live" : "mock" },
    { id: "cancelled", label: "Cancelled Orders Today", value: formatNumber(todayCancelledOrders), tone: "text-yellow-400", subtext: "Live from app order statuses", href: "/managementinsight?view=alerts-exceptions", dataSource: "live" },
  ];

  const paymentSummary = [
    { label: `Total Received (${selectedDateRange})`, value: formatCurrency(selectedDateRange === "1 day" ? todayGrossReceived : grossSales), subtext: filteredReceipts.length ? `Live from Loyverse receipts before discounts for ${selectedDateRange.toLowerCase()}` : `Fallback from app orders for ${selectedDateRange.toLowerCase()}`, dataSource: filteredReceipts.length || filteredOrders.length ? "live" : "mock" },
    { label: `Net Sales Inflow (${selectedDateRange})`, value: formatCurrency(netSales), subtext: "Loyverse receipts + Clip approved payments + manual cash contributions for the selected period", dataSource: clipOverview || loyverseOverview || filteredTransactions.length ? "live" : "mock" },
    { label: `Pending Settlements (${selectedDateRange})`, value: formatCurrency(pendingSettlements), subtext: clipOverview ? "Filtered Clip approved payments vs filtered net deposits" : "Needs Clip to calculate", dataSource: clipOverview ? "live" : "mock" },
    { label: `Settled Amounts (${selectedDateRange})`, value: formatCurrency(depositTotal), subtext: clipOverview ? "Live from filtered Clip settlements" : "Waiting for Clip", dataSource: clipOverview ? "live" : "mock" },
    { label: `Refunds (${selectedDateRange})`, value: formatCurrency(filteredRefundVolume), subtext: clipOverview ? "Live from filtered Clip refunds" : "Waiting for Clip", dataSource: clipOverview ? "live" : "mock" },
    { label: "Payment Fees", value: paymentFees ? formatCurrency(paymentFees) : "—", subtext: paymentFees ? "Live from Clip settlement fee fields" : "Clip must return fee_amount, fees, or commission_amount in its settlement records for this to auto-fill.", dataSource: paymentFees ? "live" : "mock" },
  ];

  const cashVsCard = [
    { source: "Cash", amount: orders.filter((order) => order.payment_method === "cash").reduce((sum, order) => sum + Number(order.total_amount || 0), 0) },
    { source: "Card", amount: appCardTotal },
    { source: "Clip", amount: clipApprovedTotal },
    { source: "Deposited", amount: depositTotal },
  ];

  const reconciliationRows = [
    {
      id: "recon-app-card-vs-clip",
      source_system: "App card orders vs Clip",
      expected_amount: formatCurrency(appCardTotal),
      actual_amount: formatCurrency(clipApprovedTotal),
      difference: formatCurrency(mismatch),
      status: Math.abs(mismatch) <= 1 ? "Matched" : "Mismatch",
      last_sync_time: clipOverview?.metrics?.latestSyncAt ? format(new Date(clipOverview.metrics.latestSyncAt), "HH:mm") : "N/A",
    },
    {
      id: "recon-clip-vs-bank",
      source_system: "Clip payments vs settlements",
      expected_amount: formatCurrency(clipApprovedTotal),
      actual_amount: formatCurrency(depositTotal),
      difference: formatCurrency(depositTotal - clipApprovedTotal),
      status: depositTotal >= clipApprovedTotal ? "Matched" : "Pending",
      last_sync_time: clipOverview?.metrics?.latestSyncAt ? format(new Date(clipOverview.metrics.latestSyncAt), "HH:mm") : "N/A",
    },
    {
      id: "recon-loyverse-vs-orders",
      source_system: "Loyverse gross vs app delivered",
      expected_amount: formatCurrency(grossSales),
      actual_amount: formatCurrency(totalRevenue),
      difference: formatCurrency(totalRevenue - grossSales),
      status: loyverseOverview ? "Review" : "Pending",
      last_sync_time: loyverseOverview?.metrics?.latestSyncAt ? format(new Date(loyverseOverview.metrics.latestSyncAt), "HH:mm") : "N/A",
    },
    ...(bankTransferTotal
      ? [{
          id: "recon-bank-ledger",
          source_system: "Manual bank ledger",
          expected_amount: formatCurrency(depositTotal),
          actual_amount: formatCurrency(bankTransferTotal),
          difference: formatCurrency(bankTransferTotal - depositTotal),
          status: Math.abs(bankTransferTotal - depositTotal) <= 1 ? "Matched" : "Review",
          last_sync_time: transactions[0]?.date ? format(new Date(transactions[0].date), "HH:mm") : "N/A",
        }]
      : []),
  ];

  const costsSummary = [
    { label: "Ingredient Cost Today", value: ingredientExpensesToday ? formatCurrency(ingredientExpensesToday) : formatCurrency(todayOrders.length * PIZZA_COST_ESTIMATE), delta: ingredientExpensesToday ? "Purchase-based from ingredient expenses logged today" : `Estimated: ${todayOrders.length} orders × MXN ${PIZZA_COST_ESTIMATE}`, dataSource: ingredientExpensesToday ? "live" : "mock" },
    { label: "Ingredient Cost This Week", value: ingredientExpensesWeek ? formatCurrency(ingredientExpensesWeek) : formatCurrency(weekOrders.length * PIZZA_COST_ESTIMATE), delta: ingredientExpensesWeek ? "Purchase-based from ingredient expenses this week" : `Estimated: ${weekOrders.length} orders × MXN ${PIZZA_COST_ESTIMATE}`, dataSource: ingredientExpensesWeek ? "live" : "mock" },
    { label: "Ingredient Cost This Month", value: ingredientExpensesMonth ? formatCurrency(ingredientExpensesMonth) : formatCurrency(filteredOrders.filter(o => getRecordDate(o) >= monthStart).length * PIZZA_COST_ESTIMATE), delta: ingredientExpensesMonth ? "Purchase-based from ingredient expenses this month" : `Estimated at MXN ${PIZZA_COST_ESTIMATE}/order`, dataSource: ingredientExpensesMonth ? "live" : "mock" },
    { label: "Food Cost %", value: `${foodCostPct.toFixed(1)}%`, delta: rawIngredientExpenses ? "Calculated live from purchase-based ingredient cost" : `Estimated at MXN ${PIZZA_COST_ESTIMATE}/order avg. Add expenses to replace.`, dataSource: rawIngredientExpenses ? "live" : "mock" },
    { label: "Labor Cost Today", value: laborExpensesToday ? formatCurrency(laborExpensesToday) : "—", delta: laborExpensesToday ? "Shift-linked and salary expenses posted today" : "Log today's shifts in Employee Calendar or add a salary expense in Finance.", dataSource: laborExpensesToday ? "live" : "mock" },
    { label: "Labor Cost This Week", value: laborExpensesWeek ? formatCurrency(laborExpensesWeek) : "—", delta: laborExpensesWeek ? "Shift-linked and salary expenses this week" : "No salary expenses this week. Mark shifts as paid in Employee Calendar to populate this.", dataSource: laborExpensesWeek ? "live" : "mock" },
    { label: "Labor Cost This Month", value: laborExpensesMonth ? formatCurrency(laborExpensesMonth) : "—", delta: laborExpensesMonth ? "Shift-linked and salary expenses this month" : "No salary expenses this month. Add salary expenses in Finance or complete shifts in Employee Calendar.", dataSource: laborExpensesMonth ? "live" : "mock" },
    { label: "Labor Cost %", value: laborExpenses ? `${laborCostPct.toFixed(1)}%` : "—", delta: laborExpenses ? "Calculated live from tracked labor expenses" : "Needs salary expenses. Log shifts with pay in Employee Calendar or add salary expenses in Finance.", dataSource: laborExpenses ? "live" : "mock" },
    { label: "Payment Processing Fees", value: paymentFees ? formatCurrency(paymentFees) : "—", delta: paymentFees ? "Live from Clip settlement reports" : "Requires Clip to return fee fields (fee_amount / fees / commission_amount) in settlement records.", dataSource: paymentFees ? "live" : "mock" },
    { label: "Fixed Costs", value: recurringExpenses ? formatCurrency(recurringExpenses) : "—", delta: recurringExpenses ? "Live from recurring expenses" : "Add recurring expenses in Finance (e.g. rent, utilities) and check the 'recurring' checkbox.", dataSource: recurringExpenses ? "live" : "mock" },
    { label: "Other Operating Expenses", value: otherOperatingExpenses ? formatCurrency(otherOperatingExpenses) : "—", delta: otherOperatingExpenses ? "Live from non-ingredient, non-salary expenses" : "Add non-ingredient, non-salary expenses in Finance to track operational overhead.", dataSource: otherOperatingExpenses ? "live" : "mock" },
    { label: "Cost Per Order", value: costPerOrder ? formatCurrency(costPerOrder) : "—", delta: costPerOrder ? "Ingredient + labor + operating costs + Clip fees divided by orders" : "Needs expenses in Finance. Once any cost is logged, this auto-calculates as total expenses ÷ order count.", dataSource: costPerOrder ? "live" : "mock" },
  ];

  const inventoryInsights = {
    lowStock: inventoryRows.length ? inventoryRows : mockInventoryInsights.lowStock,
    purchases: recentPurchases.length ? recentPurchases : mockInventoryInsights.purchases,
    forecast: inventoryForecast.length ? inventoryForecast : mockInventoryInsights.forecast,
  };

  const inventoryDataSource = inventoryRows.length ? "live" : "mock";
  const inventoryPurchasesSource = recentPurchases.length ? "live" : "mock";
  const inventoryForecastSource = inventoryForecast.length ? "live" : "mock";
  const bestSellingSource = bestSellingProducts.length ? "live" : "mock";
  const worstPerformingSource = worstPerformingProducts.length ? "live" : "mock";
  const staffMetrics = [
    { label: "Total Worked Hours", value: totalWorkedHours ? `${formatNumber(totalWorkedHours)} h` : "—", detail: totalWorkedHours ? "Live from Shift records in the last 7 days" : "Log shifts with hours_worked in Employee Calendar to populate this.", dataSource: totalWorkedHours ? "live" : "mock" },
    { label: "Sales Per Labor Hour", value: salesPerLaborHour ? formatCurrency(salesPerLaborHour) : "—", detail: salesPerLaborHour ? "Weekly sales divided by tracked shift hours" : "Needs completed shifts with hours_worked. Auto-calculates as weekly revenue ÷ total shift hours.", dataSource: salesPerLaborHour ? "live" : "mock" },
    { label: "Labor Cost Per Shift", value: laborCostPerShift ? formatCurrency(laborCostPerShift) : "—", detail: laborCostPerShift ? "Average from tracked shift payouts" : "Set an amount (payout) on each shift in Employee Calendar. Average auto-calculates.", dataSource: laborCostPerShift ? "live" : "mock" },
    { label: "Current Shift Staffing", value: currentShiftStaffing ? `${formatNumber(currentShiftStaffing)} staff` : "—", detail: currentShiftStaffing ? `Today's scheduled shifts. ${formatNumber(activeEmployeesCount)} active employees in roster.` : "Schedule today's shifts in Employee Calendar to see current staffing count.", dataSource: currentShiftStaffing ? "live" : "mock" },
    { label: "Overtime Alerts", value: overtimeAlertsCount ? formatNumber(overtimeAlertsCount) : "—", detail: overtimeAlertsCount ? "Triggered by shifts above 8 tracked hours" : "Auto-triggers when any shift has more than 8 hours logged. No overtime in current data.", dataSource: overtimeAlertsCount ? "live" : "mock" },
  ];
  const staffDataSource = staffMetrics.some((metric) => metric.dataSource === "live") ? "live" : "mock";
  const laborEfficiencySource = laborEfficiencyTrend.some((item) => item.efficiency > 0) ? "live" : "mock";

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
      <div className="border-b border-yellow-500/20">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-4xl">
              <Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300">Los Tios Management Dashboard</Badge>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Los Tios management dashboard
              </h1>
              <p className="mt-3 text-sm leading-6 text-gray-400 sm:text-base">
                Live data is loaded from Loyverse, Clip, app orders, and Expense wherever integrations are already available.
                Anything that still needs replacement is clearly marked as <span className="text-yellow-300">Hardcoded</span>.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[460px]">
              <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Live sources connected</p>
                <p className="mt-2 text-2xl font-bold text-yellow-400">
                  {[hasLoyverseApiConfig(appSettings), hasClipApiConfig(appSettings), orders.length > 0].filter(Boolean).length}/3
                </p>
                <p className="text-xs text-gray-400">Loyverse, Clip, app orders</p>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Last synced</p>
                <p className="mt-2 text-lg font-bold text-yellow-400">
                  {clipOverview?.metrics?.latestSyncAt || loyverseOverview?.metrics?.latestSyncAt
                    ? format(new Date(clipOverview?.metrics?.latestSyncAt || loyverseOverview?.metrics?.latestSyncAt), "yyyy-MM-dd HH:mm")
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
                  disabled={ordersQuery.isFetching || expensesQuery.isFetching || transactionsQuery.isFetching || employeesQuery.isFetching || shiftsQuery.isFetching || loyverseQuery.isFetching || clipQuery.isFetching}
                  className="mt-2 h-10 w-full justify-start gap-2 bg-yellow-400 text-black hover:bg-yellow-300"
                >
                  <RefreshCw className={`h-4 w-4 ${(ordersQuery.isFetching || expensesQuery.isFetching || transactionsQuery.isFetching || employeesQuery.isFetching || shiftsQuery.isFetching || loyverseQuery.isFetching || clipQuery.isFetching) ? "animate-spin" : ""}`} />
                  Refresh live data
                </Button>
              </div>
              <div className="rounded-xl border border-yellow-500/20 bg-[#242424] p-4 sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadge source="live" />
                  <span className="text-sm text-gray-300">Live data already wired</span>
                  <SourceBadge source="mock" />
                  <span className="text-sm text-gray-300">Needs replacement / mapping</span>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Filters below are still mostly UI-only until branch/channel/date filtering is wired directly into the provider queries. Revolut is not integrated yet in this repo, so bank views still come from local finance records instead of the Revolut API.
                </p>
              </div>
            </div>
          </div>

          <div className="mx-auto mt-5 grid max-w-[1500px] gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SelectField label="Date range" options={filterOptions.dateRanges} value={selectedDateRange} onChange={setSelectedDateRange} />
            <SelectField label="Branch" options={filterOptions.branches} value={selectedBranch} onChange={setSelectedBranch} />
            <SelectField label="Sales channel" options={filterOptions.salesChannels} value={selectedChannel} onChange={setSelectedChannel} />
            <SelectField label="Payment source" options={filterOptions.paymentSources} value={selectedPaymentSource} onChange={setSelectedPaymentSource} />
            <SelectField label="Shift" options={filterOptions.shifts} value={selectedShift} onChange={setSelectedShift} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
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
                    <p className={`text-xs font-medium ${item.trend === "up" ? "text-emerald-400" : "text-red-400"}`}>{item.deltaLabel}</p>
                    <p className="text-[10px] text-gray-600">Prev: {item.previousLabel}</p>
                  </div>
                </div>
              ))}
            </div>
          </details>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {executiveKpis.map((item) => (
              <KpiCard key={item.id} item={item} />
            ))}
          </div>
        </section>

        <section id="live-operations" className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gray-500">Live Operations</p>
              <h2 className="mt-1 text-2xl font-bold text-yellow-400">Current service flow</h2>
            </div>
            <Button asChild variant="outline" className="border-yellow-500/20 bg-[#242424] text-gray-200 hover:bg-[#2b2b2b]">
              <Link to="/managementinsight?view=live-operations">
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
            sourceBadge={<SourceBadge source="live" />}
            action={<Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300"><BarChart3 className="mr-1 h-3 w-3" />Live from orders</Badge>}
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <p className="text-sm font-semibold text-yellow-400">Revenue last 7 days</p>
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

              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <p className="text-sm font-semibold text-yellow-400">Orders by hour today</p>
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
                  <SourceBadge source="live" />
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
            sourceBadge={<SourceBadge source={liveAlerts.length ? "live" : "mock"} />}
            action={<Badge className="border border-red-500/20 bg-red-500/10 text-red-300"><AlertTriangle className="mr-1 h-3 w-3" />{alerts.length} active</Badge>}
          >
            <AlertFeed alerts={alerts} />
          </DashboardPanel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <ProductList title="Best selling products" items={bestSellingProducts.length ? bestSellingProducts : mockProductPerformance.bestSelling} source={bestSellingSource} />
          <ProductList title="Highest margin products" items={mockProductPerformance.highestMargin} source="mock" />
          <ProductList title="Worst performing products" items={worstPerformingProducts.length ? worstPerformingProducts : mockProductPerformance.worstPerforming} source={worstPerformingSource} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <DashboardPanel
            id="payments-reconciliation"
            title="Payments & Reconciliation"
            description="Cross-check between app orders, Clip transactions, and deposits."
            sourceBadge={<SourceBadge source={clipOverview ? "live" : "mock"} />}
            action={<Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300"><CreditCard className="mr-1 h-3 w-3" />Clip + app</Badge>}
          >
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
                  <SourceBadge source="live" />
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
                sourceBadge={<SourceBadge source={clipOverview || loyverseOverview ? "live" : "mock"} />}
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

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-yellow-400">Clip API response</p>
                  <SourceBadge source={clipOverview ? "live" : "mock"} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-yellow-500/10 bg-black/20 p-3">
                    <p className="text-xs text-gray-500">Payments returned</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatNumber(clipPayments.length)}</p>
                  </div>
                  <div className="rounded-lg border border-yellow-500/10 bg-black/20 p-3">
                    <p className="text-xs text-gray-500">Approved volume</p>
                    <p className="mt-1 text-xl font-bold text-white">{formatCurrency(clipApprovedTotal)}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-gray-400">
                  Om Clip returnerar betalningar med `amount`, `total_amount` eller `approved_amount` och status `approved`/`paid`, ska pengar synas här.
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
                  <SourceBadge source={loyverseOverview ? "live" : "mock"} />
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
            sourceBadge={<SourceBadge source={totalExpenses ? "live" : "mock"} />}
            action={<Badge className="border border-yellow-500/20 bg-yellow-400/10 text-yellow-300"><BriefcaseBusiness className="mr-1 h-3 w-3" />Expenses</Badge>}
          >
            <div className="mb-4 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 text-sm text-gray-300">
              <p className="font-medium text-white">Current calculation basis</p>
              <p className="mt-2">
                Ingredient cost uses Shopping List purchases converted into expenses when available, with manual ingredient expenses as fallback.
                Labor uses shift-linked salary expenses from the employee calendar when available, with manual salary expenses as fallback.
                Net profit also includes recurring expenses, other operating expenses, and Clip settlement fees.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                This is already much closer to reality, but food cost is still purchase-based until recipe-level COGS and ingredient depletion are added.
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

            <div className="mt-6 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-yellow-400">Cost trend vs budget</p>
                <SourceBadge source={costTrendData.some((item) => item.actual > 0) ? "live" : "mock"} />
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

          <DashboardPanel title="Forecasted shortages" description="Derived from current low-stock thresholds when Loyverse inventory is available." sourceBadge={<SourceBadge source={inventoryForecastSource} />}>
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

          <DashboardPanel title="Management detail hub" description="Entry points into drill-downs and the architecture notes page.">
            <div className="space-y-3">
              {[
                { icon: CreditCard, title: "Payments & reconciliation", subtitle: "Card totals, Clip sync, and settlement gaps", href: "/managementinsight?view=payments-reconciliation" },
                { icon: Pizza, title: "Product mix", subtitle: "Best sellers are partially live, margins still need cost mapping", href: "/managementinsight?view=products" },
                { icon: ChefHat, title: "Food cost investigation", subtitle: "Expense-based today, needs real COGS and supplier costing", href: "/managementinsight?view=costs" },
                { icon: Activity, title: "Alert queue", subtitle: "Generated from current sync and reconciliation conditions", href: "/managementinsight?view=alerts-exceptions" },
                { icon: Store, title: "Integration blueprint", subtitle: `Clip and Loyverse are live. Revolut still needs an API client, auth settings, and backend proxy. ${detailViews["payments-reconciliation"].summary}`, href: "/managementinsight?view=payments-reconciliation" },
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