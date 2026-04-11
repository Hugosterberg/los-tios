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
import { subDays, format, isValid } from "date-fns";
import { base44 } from "@/api/base44Client";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { getClipOverview, hasClipApiConfig } from "@/api/clip";
import { appParams } from "@/lib/app-params";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { buildMergedCanonicalEvents } from "@/lib/mergedSales";
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
} from "@/features/dashboard/mockData";

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatNumber = (value) => new Intl.NumberFormat("es-MX").format(value || 0);

function formatDateSafe(value, pattern, fallback = "N/A") {
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) {
    return fallback;
  }

  return format(date, pattern);
}

function SourceBadge({ source = "mock" }) {
  const sourceMeta = {
    clip: {
      label: "Clip",
      tone: "border border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    },
    loyverse: {
      label: "Loyverse",
      tone: "border border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
    },
    both: {
      label: "Clip + Loyverse",
      tone: "border border-amber-400/30 bg-amber-400/10 text-amber-100",
    },
    order_records: {
      label: "Order module",
      tone: "border border-yellow-300/25 bg-yellow-300/8 text-yellow-300",
    },
    finance_ledger: {
      label: "Finance ledger",
      tone: "border border-yellow-600/30 bg-yellow-600/10 text-yellow-100",
    },
    manual: {
      label: "Manual",
      tone: "border border-yellow-500/20 bg-yellow-500/8 text-yellow-200",
    },
    mock: {
      label: "Hardcoded",
      tone: "border border-yellow-400/20 bg-yellow-400/10 text-yellow-200",
    },
    live: {
      label: "Live data",
      tone: "border border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
    },
  };
  const resolved = sourceMeta[source] || sourceMeta.mock;

  return (
    <Badge className={resolved.tone}>{resolved.label}</Badge>
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
      ? "border-yellow-400/25 bg-yellow-400/10 text-yellow-200"
      : normalized === "mismatch" || normalized === "critical"
        ? "border-red-400/20 bg-red-400/10 text-red-300"
        : normalized === "pending" || normalized === "review"
          ? "border-yellow-400/20 bg-yellow-400/10 text-yellow-200"
          : "border-yellow-500/20 bg-yellow-500/8 text-yellow-200";

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

function getEndOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

const DEDUPE_WINDOW_OPTIONS = ["2 min", "5 min", "10 min", "15 min"];
const DEDUPE_PRIORITY_OPTIONS = ["Prefer Loyverse", "Prefer Clip", "Prefer Manual", "Prefer earliest"];

function parseDedupeWindowMinutes(option) {
  const parsed = Number.parseInt(String(option || "").replace(/\D/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
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

function getDateRangeWindow(range) {
  const start = getDateRangeStart(range);
  return {
    start,
    end: getEndOfToday(),
  };
}

function getDashboardQueryStart(range) {
  const today = getStartOfToday();

  switch (range) {
    case "1 day":
    case "7 days":
      return subDays(today, 34);
    case "1 month":
      return new Date(today.getFullYear(), today.getMonth() - 1, 1);
    case "All history":
    default:
      return subDays(today, 89);
  }
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

function formatSourceName(source) {
  if (source === "loyverse") {
    return "Loyverse";
  }
  if (source === "clip") {
    return "Clip";
  }
  if (source === "manual") {
    return "Manual";
  }
  return source;
}

function normalizePaymentMethod(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function matchesPaymentSourceFilter(event, selectedPaymentSource) {
  if (selectedPaymentSource === "All sources") {
    return true;
  }

  const method = normalizePaymentMethod(event.paymentMethod);

  if (selectedPaymentSource === "Clip") {
    return event.source === "clip";
  }

  if (selectedPaymentSource === "Cash") {
    return method === "cash";
  }

  if (selectedPaymentSource === "Bank transfer") {
    return method.includes("transfer") || method.includes("bank");
  }

  if (selectedPaymentSource === "Online") {
    return method.includes("online") || method.includes("web") || method.includes("delivery") || method.includes("marketplace");
  }

  if (selectedPaymentSource === "Card") {
    return event.source !== "clip" && (method.includes("card") || method.includes("credit") || method.includes("debit"));
  }

  return true;
}

function normalizeBranchName(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesBranchFilter(event, selectedBranch) {
  if (selectedBranch === "All branches") {
    return true;
  }

  if (!event.branch) {
    return selectedBranch === "Centro";
  }

  return normalizeBranchName(event.branch) === normalizeBranchName(selectedBranch);
}

function matchesSalesChannelFilter(event, selectedChannel) {
  if (selectedChannel === "All channels") {
    return true;
  }

  return event.channel === selectedChannel;
}

function getClipSettlementFeeAmount(settlement) {
  return getMoneyValue(
    settlement?.total_fee ??
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
    settlement?.disbursed_net_amount ??
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

function buildOrdersByHourFromEvents(events) {
  return Array.from({ length: 12 }, (_, index) => {
    const hour = index + 10;
    const count = events.filter((event) => event.timestamp.getHours() === hour).length;
    return { hour: String(hour), orders: count };
  });
}

function buildSevenDayRevenueFromEvents(events) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(new Date(), 6 - index);
    const dayEvents = events.filter((event) => isSameDay(event.timestamp, date));
    return {
      day: format(date, "EEE"),
      revenue: dayEvents.reduce((sum, event) => sum + event.amount, 0),
      orders: dayEvents.length,
    };
  });
}

function buildThirtyDayRevenueFromEvents(events) {
  return Array.from({ length: 4 }, (_, index) => {
    const end = subDays(new Date(), (3 - index) * 7);
    const start = subDays(end, 6);
    const weekEvents = events.filter((event) => {
      return event.timestamp >= start && event.timestamp <= end;
    });
    const revenue = weekEvents.reduce((sum, event) => sum + event.amount, 0);
    return {
      window: `Week ${index + 1}`,
      revenue,
      target: Math.round(revenue * 0.94),
    };
  });
}

function buildAovTrendFromEvents(events) {
  return Array.from({ length: 4 }, (_, index) => {
    const end = subDays(new Date(), (3 - index) * 7);
    const start = subDays(end, 6);
    const weekEvents = events.filter((event) => {
      return event.timestamp >= start && event.timestamp <= end;
    });
    const totalRevenue = weekEvents.reduce((sum, event) => sum + event.amount, 0);
    return {
      period: `Week ${index + 1}`,
      aov: weekEvents.length ? Number((totalRevenue / weekEvents.length).toFixed(2)) : 0,
    };
  });
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
      received: expense.date ? formatDateSafe(expense.date, "yyyy-MM-dd", "No date") : "No date",
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

function buildReceiptProductPerformance(receipts, direction = "top") {
  const itemsMap = new Map();

  receipts.forEach((receipt) => {
    getReceiptItems(receipt).forEach((item) => {
      const product = item.item_name || item.name || item.variant_name || "Unknown item";
      const current = itemsMap.get(product) || { units: 0, revenue: 0 };
      const quantity = Number(item.quantity || item.qty || 0);
      current.units += quantity;
      current.revenue += getReceiptItemGross(item);
      itemsMap.set(product, current);
    });
  });

  const sorted = [...itemsMap.entries()]
    .filter(([, values]) => values.units > 0)
    .sort((a, b) => {
      if (direction === "bottom") {
        return a[1].units - b[1].units || a[1].revenue - b[1].revenue;
      }

      return b[1].units - a[1].units || b[1].revenue - a[1].revenue;
    })
    .slice(0, 3);

  return sorted.map(([product, values], index) => ({
    id: `loyverse-product-${direction}-${index}`,
    product,
    units: values.units,
    revenue: formatCurrency(values.revenue),
    margin: direction === "bottom" ? "Live low-volume proxy" : "Live from Loyverse receipts",
    href: "/managementinsight?view=products",
  }));
}

function getLoyverseItemPrice(item) {
  const directPrice = getMoneyValue(item?.price ?? item?.default_price ?? item?.price_money);
  if (directPrice > 0) {
    return directPrice;
  }

  if (Array.isArray(item?.variants) && item.variants.length > 0) {
    const variantPrice = item.variants.reduce((max, variant) => {
      const value = getMoneyValue(
        variant?.default_price ??
        variant?.price ??
        variant?.price_money,
      );
      return Math.max(max, value);
    }, 0);
    if (variantPrice > 0) {
      return variantPrice;
    }
  }

  return 0;
}

function isLikelyRealName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  if (/^unknown/i.test(normalized)) {
    return false;
  }
  return /[a-zA-Z\u00C0-\u017F]/.test(normalized);
}

function resolveLoyverseItemName(item, clipNameFallbacks = []) {
  const variantName = Array.isArray(item?.variants)
    ? item.variants.map((variant) => variant?.name).find(Boolean)
    : "";
  const fallbackFromFields = [
    item?.name,
    item?.item_name,
    item?.display_name,
    item?.title,
    variantName,
    item?.sku,
    item?.id ? `Item ${item.id}` : "",
  ].find((candidate) => isLikelyRealName(candidate));

  if (fallbackFromFields) {
    return String(fallbackFromFields).trim();
  }

  const clipName = clipNameFallbacks.find((candidate) => isLikelyRealName(candidate));
  if (clipName) {
    return String(clipName).trim();
  }

  if (item?.sku) {
    return `SKU ${item.sku}`;
  }
  if (item?.id) {
    return `Item ${item.id}`;
  }

  return "Menu item";
}

function buildCatalogProductCards(items, direction = "top", clipPayments = []) {
  const clipNameFallbacks = (clipPayments || [])
    .map((payment) =>
      payment?.description ||
      payment?.concept ||
      payment?.reference ||
      payment?.receipt_no ||
      "",
    )
    .filter(Boolean);

  const normalized = (items || [])
    .map((item, index) => ({
      id: item.id || `loyverse-catalog-${index}`,
      product: resolveLoyverseItemName(item, clipNameFallbacks),
      units: Number(item.variantsCount || item.variants?.length || 0),
      revenue: formatCurrency(getLoyverseItemPrice(item)),
      margin: "Catalog item",
      href: "/managementinsight?view=products",
      _sortPrice: getLoyverseItemPrice(item),
    }))
    .sort((left, right) => {
      if (direction === "bottom") {
        return left._sortPrice - right._sortPrice;
      }
      return right._sortPrice - left._sortPrice;
    })
    .slice(0, 3);

  return normalized.map(({ _sortPrice, ...item }) => item);
}

function buildHighestMarginProductsFromReceipts(receipts) {
  const byProduct = new Map();

  receipts.forEach((receipt) => {
    getReceiptItems(receipt).forEach((item) => {
      const product = item.item_name || item.name || item.variant_name || "Unknown item";
      const current = byProduct.get(product) || { units: 0, revenue: 0, cost: 0 };
      const quantity = Number(item.quantity || item.qty || 0);
      const lineRevenue = getReceiptItemGross(item);
      const lineCost = getMoneyValue(item.cost_total ?? item.cost) || 0;
      current.units += quantity;
      current.revenue += lineRevenue;
      current.cost += lineCost;
      byProduct.set(product, current);
    });
  });

  return [...byProduct.entries()]
    .map(([product, values], index) => {
      const marginAmount = values.revenue - values.cost;
      const marginPct = values.revenue > 0 ? (marginAmount / values.revenue) * 100 : null;
      return {
        id: `loyverse-margin-${index}`,
        product,
        units: values.units,
        revenue: formatCurrency(values.revenue),
        margin: marginPct === null ? "No cost data" : `${marginPct.toFixed(1)}% margin`,
        href: "/managementinsight?view=products",
        _sortMargin: marginAmount,
      };
    })
    .sort((left, right) => right._sortMargin - left._sortMargin)
    .slice(0, 3)
    .map(({ _sortMargin, ...row }) => row);
}

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const [selectedDateRange, setSelectedDateRange] = React.useState(filterOptions.dateRanges[0]);
  const [selectedBranch, setSelectedBranch] = React.useState(filterOptions.branches[0]);
  const [selectedChannel, setSelectedChannel] = React.useState(filterOptions.salesChannels[0]);
  const [selectedPaymentSource, setSelectedPaymentSource] = React.useState(filterOptions.paymentSources[0]);
  const [selectedShift, setSelectedShift] = React.useState(filterOptions.shifts[0]);
  const [selectedDedupeWindow, setSelectedDedupeWindow] = React.useState(DEDUPE_WINDOW_OPTIONS[2]);
  const [selectedDedupePriority, setSelectedDedupePriority] = React.useState(DEDUPE_PRIORITY_OPTIONS[0]);
  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" || !appParams.appId || !appParams.serverUrl);
  const queryWindowStart = React.useMemo(
    () => getDashboardQueryStart(selectedDateRange),
    [selectedDateRange],
  );
  const selectedRangeWindow = React.useMemo(
    () => getDateRangeWindow(selectedDateRange),
    [selectedDateRange],
  );
  const dedupeWindowMs = React.useMemo(
    () => parseDedupeWindowMinutes(selectedDedupeWindow) * 60 * 1000,
    [selectedDedupeWindow],
  );

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
    queryKey: ["loyverseOverview", settings[0]?.id || "none", queryWindowStart?.toISOString() || "all", selectedRangeWindow.end.toISOString()],
    queryFn: () => getLoyverseOverview(appSettings, {
      start: queryWindowStart,
      end: selectedRangeWindow.end,
    }),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });

  const clipQuery = useQuery({
    queryKey: ["clipOverview", settings[0]?.id || "none", queryWindowStart?.toISOString() || "all", selectedRangeWindow.end.toISOString()],
    queryFn: () => getClipOverview(appSettings, {
      start: queryWindowStart,
      end: selectedRangeWindow.end,
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
  const clipPaymentsPayload = clipOverview?.raw?.paymentsPayload || null;
  const clipSettlementsPayload = clipOverview?.raw?.settlementsPayload || null;
  const filteredOrders = filterByRange(orders, selectedDateRange);
  const filteredExpenses = filterByRange(expenses, selectedDateRange);
  const filteredTransactions = filterByRange(transactions, selectedDateRange);
  const filteredShifts = filterByRange(shifts, selectedDateRange);
  const filteredReceipts = filterByRange(receipts, selectedDateRange);
  const filteredClipPayments = filterByRange(clipPayments, selectedDateRange);
  const filteredClipSettlements = filterByRange(clipSettlements, selectedDateRange);
  const selectedRangeLabelLower = selectedDateRange.toLowerCase();

  const deliveredOrders = filteredOrders.filter((order) => order.status === "delivered");
  const activeOrders = filteredOrders.filter((order) => ["pending", "preparing", "ready", "out_for_delivery"].includes(order.status)).length;
  const todayStart = getStartOfToday();
  const weekStart = subDays(todayStart, 6);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const todayOrders = filteredOrders;
  const weekOrders = filteredOrders;
  const todayCancelledOrders = todayOrders.filter((order) => order.status === "cancelled").length;
  const todayDelayedOrders = filteredOrders.filter((order) => Number(order.estimated_delivery_minutes || 0) > 35).length;
  const todayRefundCount = filteredClipPayments.filter((payment) => getClipPaymentRefundAmount(payment) > 0).length;
  const prepTimeOrders = todayOrders.filter((order) => Number(order.preparation_minutes || order.estimated_delivery_minutes || 0) > 0);
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
  const ingredientExpensesInRange = ingredientExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
  const laborExpensesInRange = salaryExpenseRows.reduce((sum, expense) => sum + getExpenseAmount(expense), 0);
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
    paymentSource: selectedPaymentSource,
    branch: selectedBranch,
    channel: selectedChannel,
  });
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
  const selectedRangeStart = getDateRangeStart(selectedDateRange);
  const previousSelectedSalesEvents = selectedRangeStart
    ? filteredCanonicalSalesEvents.filter((event) => {
        const diff = todayStart.getTime() - selectedRangeStart.getTime();
        const previousStart = new Date(selectedRangeStart.getTime() - diff - 86400000);
        const previousEnd = new Date(todayStart.getTime() - diff - 86400000);
        return event.timestamp >= previousStart && event.timestamp < previousEnd;
      })
    : [];
  const filteredDuplicateRowsRaw = mergedSaleDuplicates.filter(({ duplicate, canonical }) =>
    (
      matchesPaymentSourceFilter(duplicate, selectedPaymentSource)
      && matchesBranchFilter(duplicate, selectedBranch)
      && matchesSalesChannelFilter(duplicate, selectedChannel)
    ) || (
      matchesPaymentSourceFilter(canonical, selectedPaymentSource)
      && matchesBranchFilter(canonical, selectedBranch)
      && matchesSalesChannelFilter(canonical, selectedChannel)
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
  const clipFilterActive = selectedPaymentSource === "All sources" || selectedPaymentSource === "Clip";
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
  const bestSellingProducts = filteredLoyverseReceipts.length
    ? buildReceiptProductPerformance(filteredLoyverseReceipts, "top")
    : buildCatalogProductCards(loyverseOverview?.items || [], "top", filteredClipPayments);
  const highestMarginProducts = filteredLoyverseReceipts.length
    ? buildHighestMarginProductsFromReceipts(filteredLoyverseReceipts)
    : buildCatalogProductCards(loyverseOverview?.items || [], "top", filteredClipPayments);
  const worstPerformingProducts = filteredLoyverseReceipts.length
    ? buildReceiptProductPerformance(filteredLoyverseReceipts, "bottom")
    : buildCatalogProductCards(loyverseOverview?.items || [], "bottom", filteredClipPayments);
  const inventoryRows = buildInventoryRows(loyverseOverview);
  const recentPurchases = buildRecentPurchases(filteredExpenses);
  const inventoryForecast = buildInventoryForecast(inventoryRows);
  const laborEfficiencyTrend = buildLaborEfficiencyTrend(filteredShifts, filteredOrders);
  const costTrendData = buildCostTrendVsBudget(filteredOrders, filteredExpenses);
  const todayShifts = filteredShifts;
  const weekShifts = filteredShifts;
  const totalWorkedHours = weekShifts.reduce((sum, shift) => sum + Number(shift.hours_worked || 0), 0);
  const totalShiftCost = weekShifts.reduce((sum, shift) => sum + Number(shift.amount || 0), 0);
  const salesPerLaborHour = totalWorkedHours ? weekOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0) / totalWorkedHours : 0;
  const laborCostPerShift = weekShifts.length ? totalShiftCost / weekShifts.length : 0;
  const overtimeAlertsCount = filteredShifts.filter((shift) => Number(shift.hours_worked || 0) > 8).length;
  const currentShiftStaffing = todayShifts.length;
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
      href: "/integrations",
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
      href: "/integrations",
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
      href: "/managementinsight?view=payments-reconciliation",
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
      href: "/managementinsight?view=alerts-exceptions",
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
      href: "/managementinsight?view=costs",
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
      href: "/managementinsight?view=staff",
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
      href: "/managementinsight?view=inventory",
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
      href: "/managementinsight?view=payments-reconciliation",
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
      href: "/managementinsight?view=alerts-exceptions",
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

  const executiveKpis = [
    {
      id: "net-sales",
      label: "Net Sales",
      value: formatCurrency(netSales),
      delta: primaryComparisonCard.deltaLabel,
      trend: primaryComparisonCard.trend,
      comparisonLabel: `Combined for ${selectedDateRange.toLowerCase()} and ${selectedPaymentSource.toLowerCase()}: Loyverse receipts + unmatched Clip payments + unmatched manual entries.${filteredDeduplicatedSalesCount ? ` ${filteredDeduplicatedSalesCount} duplicate matches removed.` : ""}`,
      sparkTone: "positive",
      sparkline: revenue7Days.map((item) => Math.max(item.revenue, 0)),
      href: "/managementinsight?view=net-sales",
      dataSource: salesPipelineDataSource,
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
      dataSource: salesPipelineDataSource,
    },
    {
      id: "average-order-value",
      label: "Average Order Value",
      value: formatCurrency(aov),
      delta: aov ? primaryComparisonCard.deltaLabel : "Waiting for source data",
      trend: primaryComparisonCard.trend,
      comparisonLabel: `Average transaction amount from deduplicated Loyverse, Clip, and manual sales for ${selectedDateRange.toLowerCase()}`,
      sparkTone: "positive",
      sparkline: aovTrend.map((item) => item.aov),
      href: "/managementinsight?view=average-order-value",
      dataSource: salesPipelineDataSource,
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
      dataSource: rawIngredientExpenses ? "finance_ledger" : salesPipelineDataSource,
    },
    {
      id: "net-profit",
      label: "Net Profit",
      value: laborExpenses && rawIngredientExpenses ? formatCurrency(netProfit) : "—",
      delta: laborExpenses && rawIngredientExpenses ? primaryComparisonCard.deltaLabel : "Missing ingredient and labor expenses.",
      trend: primaryComparisonCard.trend,
      comparisonLabel: laborExpenses && rawIngredientExpenses
        ? `Derived from ingredients, labor, recurring costs, other expenses, and Clip fees for ${selectedDateRange.toLowerCase()}.`
        : `Needs ingredient expenses — log purchases in Finance with category "ingredients" or convert Shopping List items. Also needs labor — complete shifts in Employee Calendar or add salary expenses in Finance. Optional: recurring fixed costs and Clip fees for full accuracy.`,
      sparkTone: "negative",
      sparkline: revenue7Days.map((item) => Math.max(item.revenue - ingredientExpenses / 7, 0)),
      href: "/managementinsight?view=net-profit",
      dataSource: laborExpenses && rawIngredientExpenses && paymentFees ? "both" : laborExpenses && rawIngredientExpenses ? "finance_ledger" : salesPipelineDataSource,
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
      dataSource: rawIngredientExpenses ? "finance_ledger" : salesPipelineDataSource,
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
      dataSource: laborExpenses ? "finance_ledger" : "mock",
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
      dataSource: liveAlerts.length ? salesPipelineDataSource : "mock",
    },
  ];

  const liveOperations = [
    { id: "active-orders", label: "Active Orders", value: formatNumber(activeOrders), tone: "text-white", subtext: "Order module: Base44 Order rows (status in your ordering flow)", href: "/managementinsight?view=live-operations", dataSource: "order_records" },
    { id: "delayed-orders", label: "Delayed Orders", value: formatNumber(todayDelayedOrders), tone: "text-yellow-400", subtext: `Order module: SLA estimate for selected ${selectedRangeLabelLower}`, href: "/managementinsight?view=live-operations", dataSource: orders.length ? "order_records" : "mock" },
    { id: "avg-prep-time", label: "Average Prep Time", value: avgPrepTime ? `${avgPrepTime} min` : "—", tone: "text-white", subtext: avgPrepTime ? `Order module for selected ${selectedRangeLabelLower}` : "Order module: needs preparation_minutes or estimated_delivery_minutes on Order records.", href: "/managementinsight?view=live-operations", dataSource: orders.length ? "order_records" : "mock" },
    { id: "orders-in-kitchen", label: "Orders In Kitchen", value: formatNumber(ordersInKitchen), tone: "text-white", subtext: "Order module: status = preparing", href: "/managementinsight?view=live-operations", dataSource: "order_records" },
    { id: "out-for-delivery", label: "Out For Delivery", value: formatNumber(ordersOutForDelivery), tone: "text-yellow-400", subtext: "Order module: status = out for delivery", href: "/managementinsight?view=live-operations", dataSource: "order_records" },
    { id: "reservations", label: `Reservations (${selectedDateRange})`, value: "—", tone: "text-white", subtext: "Needs a Reservation entity with a date field. Once reservations are logged, the selected range count auto-populates.", href: "/managementinsight?view=live-operations", dataSource: "mock" },
    { id: "refunds", label: `Refund Count (${selectedDateRange})`, value: formatNumber(todayRefundCount), tone: "text-red-300", subtext: `Clip API: refund fields in selected ${selectedRangeLabelLower}`, href: "/managementinsight?view=payments-reconciliation", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
    { id: "cancelled", label: `Cancelled Orders (${selectedDateRange})`, value: formatNumber(todayCancelledOrders), tone: "text-yellow-400", subtext: "Order module: status = cancelled", href: "/managementinsight?view=alerts-exceptions", dataSource: "order_records" },
  ].filter((item) => {
    if (!leanOpsMode) {
      return true;
    }

    return ["active-orders", "avg-prep-time", "refunds", "cancelled"].includes(item.id);
  });

  const paymentSummary = [
    { label: `Total Received (${selectedDateRange})`, value: formatCurrency(filteredSalesTotal), subtext: `Deduplicated received amount filtered to ${selectedPaymentSource.toLowerCase()} for ${selectedDateRange.toLowerCase()}`, dataSource: salesPipelineDataSource },
    { label: `Net Sales Inflow (${selectedDateRange})`, value: formatCurrency(netSales), subtext: filteredDeduplicatedSalesCount ? `Duplicate same-amount same-time sales removed across Loyverse, Clip, and manual entries (${filteredDeduplicatedSalesCount} matches for current payment-source filter).` : `Filtered to ${selectedPaymentSource.toLowerCase()} across Loyverse, Clip, and manual contributions for the selected period`, dataSource: salesPipelineDataSource },
    { label: `Pending Settlements (${selectedDateRange})`, value: clipFilterActive ? formatCurrency(pendingSettlements) : "—", subtext: clipOverview ? (clipFilterActive ? "Clip payments older than 24h compared against filtered net deposits" : "Only applicable for All sources or Clip view") : "Needs Clip to calculate", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
    { label: `Settled Amounts (${selectedDateRange})`, value: formatCurrency(depositTotal), subtext: clipOverview ? "Live from filtered Clip settlements" : "Waiting for Clip", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
    { label: `Refunds (${selectedDateRange})`, value: formatCurrency(filteredRefundVolume), subtext: clipOverview ? "Live from filtered Clip refunds" : "Waiting for Clip", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
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
    { label: `Ingredient Cost (${selectedDateRange})`, value: ingredientExpensesInRange ? formatCurrency(ingredientExpensesInRange) : formatCurrency(filteredOrders.length * PIZZA_COST_ESTIMATE), delta: ingredientExpensesInRange ? `Purchase-based from ingredient expenses in selected ${selectedRangeLabelLower}` : `Estimated: ${filteredOrders.length} orders × MXN ${PIZZA_COST_ESTIMATE}`, dataSource: ingredientExpensesInRange ? "finance_ledger" : salesPipelineDataSource },
    { label: "Food Cost %", value: `${foodCostPct.toFixed(1)}%`, delta: rawIngredientExpenses ? "Calculated live from purchase-based ingredient cost" : `Estimated at MXN ${PIZZA_COST_ESTIMATE}/order avg. Add expenses to replace.`, dataSource: rawIngredientExpenses ? "finance_ledger" : salesPipelineDataSource },
    { label: `Labor Cost (${selectedDateRange})`, value: laborExpensesInRange ? formatCurrency(laborExpensesInRange) : "—", delta: laborExpensesInRange ? `Shift-linked and salary expenses in selected ${selectedRangeLabelLower}` : "Log shifts in Employee Calendar or add salary expenses in Finance.", dataSource: laborExpensesInRange ? "finance_ledger" : "mock" },
    { label: "Labor Cost %", value: laborExpenses ? `${laborCostPct.toFixed(1)}%` : "—", delta: laborExpenses ? "Calculated live from tracked labor expenses" : "Needs salary expenses. Log shifts with pay in Employee Calendar or add salary expenses in Finance.", dataSource: laborExpenses ? "finance_ledger" : "mock" },
    { label: "Payment Processing Fees", value: paymentFees ? formatCurrency(paymentFees) : "—", delta: paymentFees ? "Live from Clip settlement reports" : "Requires Clip to return fee fields (total_fee / fee_amount / fees / commission_amount) in settlement records.", dataSource: hasClipApiConfig(appSettings) ? "clip" : "mock" },
    { label: "Fixed Costs", value: recurringExpenses ? formatCurrency(recurringExpenses) : "—", delta: recurringExpenses ? "Live from recurring expenses" : "Add recurring expenses in Finance (e.g. rent, utilities) and check the 'recurring' checkbox.", dataSource: recurringExpenses ? "finance_ledger" : "mock" },
    { label: "Other Operating Expenses", value: otherOperatingExpenses ? formatCurrency(otherOperatingExpenses) : "—", delta: otherOperatingExpenses ? "Live from non-ingredient, non-salary expenses" : "Add non-ingredient, non-salary expenses in Finance to track operational overhead.", dataSource: otherOperatingExpenses ? "finance_ledger" : "mock" },
    { label: "Cost Per Order", value: costPerOrder ? formatCurrency(costPerOrder) : "—", delta: costPerOrder ? "Ingredient + labor + operating costs + Clip fees divided by orders" : "Needs expenses in Finance. Once any cost is logged, this auto-calculates as total expenses ÷ order count.", dataSource: costPerOrder && paymentFees ? "both" : costPerOrder ? "finance_ledger" : salesPipelineDataSource },
  ];

  const inventoryInsights = {
    lowStock: inventoryRows.length ? inventoryRows : mockInventoryInsights.lowStock,
    purchases: recentPurchases.length ? recentPurchases : mockInventoryInsights.purchases,
    forecast: inventoryForecast.length ? inventoryForecast : mockInventoryInsights.forecast,
  };

  const hasLoyverseCatalog = Boolean(loyverseOverview?.items?.length);
  const inventoryDataSource = inventoryRows.length || hasLoyverseApiConfig(appSettings) ? "loyverse" : "mock";
  const inventoryPurchasesSource = recentPurchases.length ? "finance_ledger" : "mock";
  const inventoryForecastSource = inventoryForecast.length || hasLoyverseApiConfig(appSettings) ? "loyverse" : "mock";
  const bestSellingSource = (hasLoyverseApiConfig(appSettings) || filteredLoyverseReceipts.length || hasLoyverseCatalog) ? "loyverse" : "mock";
  const worstPerformingSource = (hasLoyverseApiConfig(appSettings) || filteredLoyverseReceipts.length || hasLoyverseCatalog) ? "loyverse" : "mock";
  const staffMetrics = [
    { label: "Total Worked Hours", value: totalWorkedHours ? `${formatNumber(totalWorkedHours)} h` : "—", detail: totalWorkedHours ? `Finance / HR: Shift records in selected ${selectedRangeLabelLower}` : "Log shifts with hours_worked in Employee Calendar to populate this.", dataSource: totalWorkedHours ? "finance_ledger" : "mock" },
    { label: "Sales Per Labor Hour", value: salesPerLaborHour ? formatCurrency(salesPerLaborHour) : "—", detail: salesPerLaborHour ? `Merged POS sales ÷ shift hours for selected ${selectedRangeLabelLower}` : "Needs completed shifts with hours_worked. Auto-calculates as selected-range revenue ÷ total shift hours.", dataSource: salesPerLaborHour ? "finance_ledger" : "mock" },
    { label: "Labor Cost Per Shift", value: laborCostPerShift ? formatCurrency(laborCostPerShift) : "—", detail: laborCostPerShift ? "Finance: average tracked shift payouts" : "Set an amount (payout) on each shift in Employee Calendar. Average auto-calculates.", dataSource: laborCostPerShift ? "finance_ledger" : "mock" },
    { label: "Shift Staffing", value: currentShiftStaffing ? `${formatNumber(currentShiftStaffing)} staff` : "—", detail: currentShiftStaffing ? `${selectedDateRange} shifts. ${formatNumber(activeEmployeesCount)} active employees in roster.` : `Schedule shifts in Employee Calendar to see staffing for selected ${selectedRangeLabelLower}.`, dataSource: currentShiftStaffing ? "finance_ledger" : "mock" },
    { label: "Overtime Alerts", value: overtimeAlertsCount ? formatNumber(overtimeAlertsCount) : "—", detail: overtimeAlertsCount ? "Triggered by shifts above 8 tracked hours" : "Auto-triggers when any shift has more than 8 hours logged. No overtime in current data.", dataSource: overtimeAlertsCount ? "finance_ledger" : "mock" },
  ];
  const staffDataSource = staffMetrics.some((metric) => metric.dataSource === "finance_ledger") ? "finance_ledger" : "mock";
  const laborEfficiencySource = laborEfficiencyTrend.some((item) => item.efficiency > 0) ? "finance_ledger" : "mock";
  const liveSourceStates = [
    { id: "loyverse", label: "Loyverse", connected: hasLoyverseApiConfig(appSettings) },
    { id: "clip", label: "Clip", connected: hasClipApiConfig(appSettings) },
    { id: "order-module", label: "Order module (Base44)", connected: orders.length > 0 },
  ];
  const connectedLiveSourcesCount = liveSourceStates.filter((source) => source.connected).length;

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
                Live data is loaded from Loyverse, Clip, the Order module (Base44 orders), and the Finance ledger (expenses, shifts) wherever integrations are already available.
                Anything that still needs replacement is clearly marked as <span className="text-yellow-300">Hardcoded</span>.
              </p>
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
                  {clipOverview?.metrics?.latestSyncAt || loyverseOverview?.metrics?.latestSyncAt
                    ? formatDateSafe(clipOverview?.metrics?.latestSyncAt || loyverseOverview?.metrics?.latestSyncAt, "yyyy-MM-dd HH:mm")
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
                  <SourceBadge source="clip" />
                  <span className="text-sm text-gray-300">Clip data</span>
                  <SourceBadge source="loyverse" />
                  <span className="text-sm text-gray-300">Loyverse data</span>
                  <SourceBadge source="both" />
                  <span className="text-sm text-gray-300">Combined Clip + Loyverse</span>
                  <SourceBadge source="order_records" />
                  <span className="text-sm text-gray-300">Order module (Base44 Order)</span>
                  <SourceBadge source="finance_ledger" />
                  <span className="text-sm text-gray-300">Finance ledger (Expense, shifts)</span>
                  <SourceBadge source="mock" />
                  <span className="text-sm text-gray-300">Needs replacement / mapping</span>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  Date, payment source, branch, and sales channel now affect the combined sales and reconciliation views on this page. Revolut is not integrated yet in this repo, so bank views still come from local finance records instead of the Revolut API.
                </p>
                {leanOpsMode ? (
                  <p className="mt-2 text-xs text-yellow-300">
                    Lean mode is active for a low-volume setup: staffing and advanced operations views are reduced so sales, payments, products, and basic costs stay primary.
                  </p>
                ) : null}
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
                    <p className={`text-xs font-medium ${item.trend === "up" ? "text-yellow-400" : "text-red-400"}`}>{item.deltaLabel}</p>
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
              <h2 className="mt-1 text-2xl font-bold text-yellow-400">{leanOpsMode ? `${selectedDateRange} at a glance` : `Current service flow (${selectedDateRange})`}</h2>
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

              <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <p className="text-sm font-semibold text-yellow-400">Sales events by hour ({selectedDateRange})</p>
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
