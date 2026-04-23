import { format, isValid, subDays } from "date-fns";
import { formatMxn } from "@/lib/format";
import {
  formatMexicoDateTimeNumeric,
  formatMexicoTime,
  getMexicoDateKey,
  getMexicoHourFromInstant,
  getMexicoNowDateKey,
  getMexicoYearMonthKey,
  isPlainDateKey,
  MEXICO_DISPLAY_TIMEZONE,
  mexicoWallDateTimeToUtcIso,
} from "@/lib/mexicoTime";

const formatCurrency = formatMxn;

export const DEDUPE_WINDOW_OPTIONS = ["2 min", "5 min", "10 min", "15 min"];
export const DEDUPE_PRIORITY_OPTIONS = ["Prefer Loyverse", "Prefer Clip", "Prefer Manual", "Prefer earliest"];

export function formatDateSafe(value, pattern, fallback = "N/A") {
  const date = value instanceof Date ? value : new Date(value);
  if (!isValid(date)) {
    return fallback;
  }

  if (pattern === "HH:mm") {
    return formatMexicoTime(date, fallback);
  }
  if (pattern === "yyyy-MM-dd HH:mm") {
    return formatMexicoDateTimeNumeric(date, fallback);
  }
  if (pattern === "yyyy-MM-dd") {
    if (typeof value === "string" && isPlainDateKey(value.trim())) {
      return value.trim().slice(0, 10);
    }
    return getMexicoDateKey(date) || fallback;
  }

  return format(date, pattern);
}

export function getStartOfToday() {
  const todayKey = getMexicoNowDateKey();
  return new Date(mexicoWallDateTimeToUtcIso(todayKey, "00:00") || `${todayKey}T00:00:00.000Z`);
}

function getStartOfMonth(date = new Date()) {
  const yearMonthKey = getMexicoYearMonthKey(date);
  const startKey = /^\d{4}-\d{2}$/.test(yearMonthKey) ? `${yearMonthKey}-01` : `${getMexicoNowDateKey().slice(0, 8)}01`;
  return new Date(mexicoWallDateTimeToUtcIso(startKey, "00:00") || `${startKey}T00:00:00.000Z`);
}

export function getEndOfToday() {
  const todayKey = getMexicoNowDateKey();
  return new Date(mexicoWallDateTimeToUtcIso(todayKey, "23:59") || `${todayKey}T23:59:59.999Z`);
}

export function parseDedupeWindowMinutes(option) {
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

export function buildDashboardFilterWindow(calendarMonth, selectedDateRange) {
  if (calendarMonth) {
    const pad = (n) => String(n).padStart(2, "0");
    const startKey = `${String(calendarMonth.y).padStart(4, "0")}-${pad(calendarMonth.m + 1)}-01`;
    const nextMonthDate = new Date(Date.UTC(calendarMonth.y, calendarMonth.m + 1, 1));
    const endKey = `${nextMonthDate.getUTCFullYear()}-${pad(nextMonthDate.getUTCMonth() + 1)}-01`;
    const endDate = new Date(mexicoWallDateTimeToUtcIso(endKey, "00:00") || `${endKey}T00:00:00.000Z`);
    endDate.setUTCDate(endDate.getUTCDate() - 1);
    const finalEndKey = getMexicoDateKey(endDate);
    const start = new Date(mexicoWallDateTimeToUtcIso(startKey, "00:00") || `${startKey}T00:00:00.000Z`);
    const end = new Date(mexicoWallDateTimeToUtcIso(finalEndKey, "23:59") || `${finalEndKey}T23:59:59.999Z`);
    return { mode: "calendar", start, end, label: format(start, "MMMM yyyy") };
  }

  return {
    mode: "rolling",
    start: getDateRangeStart(selectedDateRange),
    end: getEndOfToday(),
    label: selectedDateRange,
  };
}

export function filterByDashboardWindow(records, window) {
  if (!window.start) {
    return records;
  }
  return records.filter((record) => {
    const recordDate = getRecordDate(record);
    return recordDate >= window.start && recordDate <= window.end;
  });
}

export function getDashboardQueryStart(range) {
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

export function sumOrderRevenue(orders) {
  return orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
}

export function calculateDifference(current, previous) {
  if (!previous) {
    return null;
  }

  return current - previous;
}

export function formatDifference(difference) {
  if (difference === null || Number.isNaN(difference)) {
    return "No prior period";
  }
  if (difference === 0) {
    return "MXN 0";
  }

  const sign = difference > 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(difference))}`;
}

export function getTrendFromDifference(difference) {
  if (difference === null || difference === 0) {
    return "up";
  }

  return difference > 0 ? "up" : "down";
}

export function isSameDay(left, right) {
  return getMexicoDateKey(left) === getMexicoDateKey(right);
}

export function getExpenseAmount(expense) {
  return Number(expense?.amount || 0);
}

export function getRecordDate(record) {
  const preferredTimestamp =
    record?.recorded_at ||
    record?.purchased_at ||
    record?.created_date ||
    record?.created_at ||
    record?.approved_at ||
    record?.paid_at ||
    record?.deposit_date ||
    record?.updated_date ||
    record?.updated_at;
  if (preferredTimestamp) {
    return new Date(preferredTimestamp);
  }
  const rawDate = record?.date;
  if (isPlainDateKey(rawDate)) {
    return new Date(mexicoWallDateTimeToUtcIso(String(rawDate).trim().slice(0, 10), "12:00") || rawDate);
  }
  return new Date(rawDate || 0);
}

export function getMoneyValue(value) {
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

export function getClipPaymentAmount(payment) {
  return getMoneyValue(payment?.amount ?? payment?.total_amount ?? payment?.total ?? payment?.approved_amount);
}

export function getClipPaymentRefundAmount(payment) {
  return getMoneyValue(payment?.amount_refunded ?? payment?.refunded_amount ?? payment?.refund_amount);
}

export function formatSourceName(source) {
  if (source === "loyverse") return "Loyverse";
  if (source === "clip") return "Clip";
  if (source === "manual") return "Manual";
  return source;
}

export function normalizePaymentMethod(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function matchesPaymentSourceFilter(event, selectedPaymentSource) {
  if (selectedPaymentSource === "All sources") return true;

  const method = normalizePaymentMethod(event.paymentMethod);
  if (selectedPaymentSource === "Clip") return event.source === "clip";
  if (selectedPaymentSource === "Cash") return method === "cash";
  if (selectedPaymentSource === "Bank transfer") return method.includes("transfer") || method.includes("bank");
  if (selectedPaymentSource === "Online") {
    return method.includes("online") || method.includes("web") || method.includes("delivery") || method.includes("marketplace");
  }
  if (selectedPaymentSource === "Card") {
    return event.source !== "clip" && (method.includes("card") || method.includes("credit") || method.includes("debit"));
  }

  return true;
}

export function matchesBranchFilter(event, selectedBranch) {
  if (selectedBranch === "All branches") return true;
  if (!event.branch) return selectedBranch === "Centro";
  return String(event.branch || "").trim().toLowerCase() === String(selectedBranch || "").trim().toLowerCase();
}

export function matchesSalesChannelFilter(event, selectedChannel) {
  if (selectedChannel === "All channels") return true;
  return event.channel === selectedChannel;
}

export function getClipSettlementFeeAmount(settlement) {
  return getMoneyValue(
    settlement?.total_fee ??
      settlement?.fee_amount ??
      settlement?.fees ??
      settlement?.commission_amount ??
      settlement?.total_fees,
  );
}

export function getClipSettlementStatus(settlement) {
  return String(settlement?.status || settlement?.state || "processed").toLowerCase();
}

export function getClipSettlementNetAmount(settlement) {
  return getMoneyValue(
    settlement?.disbursed_net_amount ??
      settlement?.net_amount ??
      settlement?.net_total ??
      settlement?.amount_net ??
      settlement?.net,
  );
}

export function getReceiptTotal(receipt) {
  return getMoneyValue(receipt?.total_money ?? receipt?.total ?? receipt?.total_payment_money);
}

export function getReceiptItems(receipt) {
  return receipt?.line_items || receipt?.receipt_items || receipt?.items || receipt?.positions || [];
}

export function getReceiptItemGross(item) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1;
  const unitPrice = getMoneyValue(item?.price_money ?? item?.price ?? item?.base_price_money ?? item?.gross_money ?? item?.amount_money);

  if (unitPrice > 0) {
    return unitPrice * quantity;
  }

  return getMoneyValue(item?.total_money ?? item?.gross_total_money ?? item?.subtotal_money ?? item?.amount);
}

export function getReceiptGrossBeforeDiscount(receipt) {
  const subtotal = getMoneyValue(receipt?.subtotal_money ?? receipt?.subtotal ?? receipt?.gross_money ?? receipt?.amount_money);
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

export function byCategory(expenses, category) {
  return expenses.filter((expense) => String(expense.category || "").toLowerCase() === category);
}

export function getExpenseCategory(expense) {
  return String(expense?.category || "").toLowerCase();
}

export function formatExpensePaymentSource(paymentSource) {
  const value = String(paymentSource || "company_cash");
  if (value === "company_cash") return "Cash drawer";
  if (value === "company_account") return "Company account / card";
  if (value === "individual") return "Individual";
  return value;
}

export function buildOrdersByHourFromEvents(events) {
  return Array.from({ length: 12 }, (_, index) => {
    const hour = index + 10;
    const count = events.filter((event) => getMexicoHourFromInstant(event.timestamp) === hour).length;
    return { hour: String(hour), orders: count };
  });
}

const mexicoWeekdayShort = new Intl.DateTimeFormat("en-US", {
  timeZone: MEXICO_DISPLAY_TIMEZONE,
  weekday: "short",
});

export function buildSevenDayRevenueFromEvents(events) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = subDays(getEndOfToday(), 6 - index);
    const dayKey = getMexicoDateKey(date);
    const dayEvents = events.filter((event) => getMexicoDateKey(event.timestamp) === dayKey);
    return {
      day: mexicoWeekdayShort.format(date),
      revenue: dayEvents.reduce((sum, event) => sum + event.amount, 0),
      orders: dayEvents.length,
    };
  });
}

export function buildThirtyDayRevenueFromEvents(events) {
  return Array.from({ length: 4 }, (_, index) => {
    const endKey = getMexicoDateKey(subDays(getEndOfToday(), (3 - index) * 7));
    const startKey = getMexicoDateKey(subDays(new Date(mexicoWallDateTimeToUtcIso(endKey, "00:00") || `${endKey}T00:00:00.000Z`), 6));
    const start = new Date(mexicoWallDateTimeToUtcIso(startKey, "00:00") || `${startKey}T00:00:00.000Z`);
    const end = new Date(mexicoWallDateTimeToUtcIso(endKey, "23:59") || `${endKey}T23:59:59.999Z`);
    const weekEvents = events.filter((event) => event.timestamp >= start && event.timestamp <= end);
    const revenue = weekEvents.reduce((sum, event) => sum + event.amount, 0);
    return { window: `Week ${index + 1}`, revenue, target: Math.round(revenue * 0.94) };
  });
}

export function buildAovTrendFromEvents(events) {
  return Array.from({ length: 4 }, (_, index) => {
    const end = subDays(new Date(), (3 - index) * 7);
    const start = subDays(end, 6);
    const weekEvents = events.filter((event) => event.timestamp >= start && event.timestamp <= end);
    const totalRevenue = weekEvents.reduce((sum, event) => sum + event.amount, 0);
    return {
      period: `Week ${index + 1}`,
      aov: weekEvents.length ? Number((totalRevenue / weekEvents.length).toFixed(2)) : 0,
    };
  });
}

export function buildInventoryRows(loyverseOverview) {
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
        days_remaining: "Threshold alert",
        status: quantity <= 5 ? "Critical" : "Low",
      };
    })
    .filter((row) => row.status === "Critical" || row.status === "Low")
    .slice(0, 8);
}

export function buildInventoryForecast(rows) {
  return rows.slice(0, 3).map((row) => ({
    id: `forecast-${row.id}`,
    ingredient: row.ingredient,
    risk: row.status === "Critical" ? "Critical stock threshold reached" : "Low stock threshold reached",
    action: row.status === "Critical" ? "Reorder or transfer stock immediately." : "Review next purchase window and branch transfers.",
  }));
}

export function buildLaborEfficiencyTrend(shifts, orders) {
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
    return { period: `Week ${index + 1}`, efficiency: hours ? Number((revenue / hours).toFixed(1)) : 0 };
  });
}

export function buildCostTrendVsBudget(orders, expenses) {
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

export function buildRecentPurchases(expenses, formatCurrency) {
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

export function buildReceiptProductPerformance(receipts, direction = "top", formatCurrency, href) {
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
    href,
  }));
}

export function buildCatalogProductCards(items, direction = "top", clipPayments = [], formatCurrency, href) {
  const clipNameFallbacks = (clipPayments || [])
    .map((payment) => payment?.description || payment?.concept || payment?.reference || payment?.receipt_no || "")
    .filter(Boolean);

  const normalized = (items || [])
    .map((item, index) => ({
      id: item.id || `loyverse-catalog-${index}`,
      product: resolveLoyverseItemName(item, clipNameFallbacks),
      units: Number(item.variantsCount || item.variants?.length || 0),
      revenue: formatCurrency(getLoyverseItemPrice(item)),
      margin: "Catalog item",
      href,
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

export function buildHighestMarginProductsFromReceipts(receipts, formatCurrency, href) {
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
        href,
        _sortMargin: marginAmount,
      };
    })
    .sort((left, right) => right._sortMargin - left._sortMargin)
    .slice(0, 3)
    .map(({ _sortMargin, ...row }) => row);
}

export function getLoyverseItemPrice(item) {
  const directPrice = getMoneyValue(item?.price ?? item?.default_price ?? item?.price_money);
  if (directPrice > 0) return directPrice;

  if (Array.isArray(item?.variants) && item.variants.length > 0) {
    const variantPrice = item.variants.reduce((max, variant) => {
      const value = getMoneyValue(variant?.default_price ?? variant?.price ?? variant?.price_money);
      return Math.max(max, value);
    }, 0);
    if (variantPrice > 0) return variantPrice;
  }

  return 0;
}

export function isLikelyRealName(value) {
  const normalized = String(value || "").trim();
  if (!normalized || /^unknown/i.test(normalized)) {
    return false;
  }
  return /[a-zA-Z\u00C0-\u017F]/.test(normalized);
}

export function resolveLoyverseItemName(item, clipNameFallbacks = []) {
  const variantName = Array.isArray(item?.variants)
    ? item.variants.map((variant) => variant?.name).find(isLikelyRealName)
    : "";
  const fallbackFromFields = [
    item?.item_name,
    item?.name,
    item?.variant_name,
    variantName,
    ...clipNameFallbacks,
  ].find(isLikelyRealName);

  return fallbackFromFields || item?.id || "Unnamed item";
}
