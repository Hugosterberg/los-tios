/**
 * Loyverse receipts + Clip (approved) + manual contributions → deduped canonical sale events.
 * Same rules as Dashboard; used by Statistics for aligned monthly/daily figures.
 */

export function getRecordDate(record) {
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

export function getClipPaymentAmount(payment) {
  return getMoneyValue(
    payment?.amount ?? payment?.total_amount ?? payment?.total ?? payment?.approved_amount,
  );
}

export function getReceiptTotal(receipt) {
  return getMoneyValue(
    receipt?.total_money ?? receipt?.total ?? receipt?.total_payment_money,
  );
}

function normalizePaymentMethod(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeBranchName(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSalesChannel(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function deriveReceiptSalesChannel(receipt) {
  const value = normalizeSalesChannel(
    receipt?.source || receipt?.dining_option || receipt?.order_type || receipt?.receipt_type,
  );
  if (value.includes("dine")) {
    return "Dine-in";
  }
  if (value.includes("pickup") || value.includes("takeout") || value.includes("carryout")) {
    return "Pickup";
  }
  if (value.includes("delivery") || value.includes("marketplace")) {
    return "Delivery app";
  }
  if (value.includes("web") || value.includes("online")) {
    return "Direct web";
  }
  return "Unknown";
}

function deriveManualSalesChannel(transaction) {
  const value = normalizeSalesChannel(transaction?.payment_method || transaction?.category || "manual");
  if (value.includes("transfer") || value.includes("bank")) {
    return "Direct web";
  }
  if (value.includes("cash")) {
    return "Dine-in";
  }
  return "Unknown";
}

export function getReceiptPaymentMethod(receipt) {
  const payment = (receipt?.payments || [])[0];
  return (
    payment?.type ||
    payment?.name ||
    payment?.payment_type_id ||
    receipt?.payment_type ||
    receipt?.payment_method ||
    "unknown"
  );
}

export function getReceiptItems(receipt) {
  return receipt?.line_items || receipt?.receipt_items || receipt?.items || receipt?.positions || [];
}

export function getReceiptItemGross(item) {
  const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1;
  const unitPrice = getMoneyValue(
    item?.price_money ?? item?.price ?? item?.base_price_money ?? item?.gross_money ?? item?.amount_money,
  );
  if (unitPrice > 0) {
    return unitPrice * quantity;
  }
  return getMoneyValue(
    item?.total_money ?? item?.gross_total_money ?? item?.subtotal_money ?? item?.amount,
  );
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
    if (method === "cash" || method === "efectivo") return true;
    if (method.includes("efectivo")) return true;
    if (method.includes("cash") && !method.includes("cashback")) return true;
    return false;
  }
  if (selectedPaymentSource === "Bank transfer") {
    return method.includes("transfer") || method.includes("bank");
  }
  if (selectedPaymentSource === "Online") {
    return (
      method.includes("online") ||
      method.includes("web") ||
      method.includes("delivery") ||
      method.includes("marketplace")
    );
  }
  if (selectedPaymentSource === "Card") {
    return (
      event.source !== "clip" &&
      (method.includes("card") || method.includes("credit") || method.includes("debit"))
    );
  }
  return true;
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

function createSaleEvent({ id, source, amount, timestamp, paymentMethod, branch, channel, payload }) {
  return {
    id,
    source,
    amount: Number(amount || 0),
    timestamp: timestamp ? new Date(timestamp) : new Date(0),
    paymentMethod: paymentMethod || "unknown",
    branch: branch || null,
    channel: channel || "Unknown",
    payload,
  };
}

function findDuplicateEventIndex(canonicalEvents, candidate, toleranceMs = 10 * 60 * 1000) {
  return canonicalEvents.findIndex((event) => {
    if (Math.abs(event.amount - candidate.amount) > 0.009) {
      return false;
    }
    const timeDifference = Math.abs(event.timestamp.getTime() - candidate.timestamp.getTime());
    return timeDifference <= toleranceMs;
  });
}

function getEventPriority(event, priorityMode) {
  const sourcePriorityByMode = {
    "Prefer Loyverse": { loyverse: 0, clip: 1, manual: 2 },
    "Prefer Clip": { clip: 0, loyverse: 1, manual: 2 },
    "Prefer Manual": { manual: 0, loyverse: 1, clip: 2 },
    "Prefer earliest": { loyverse: 0, clip: 1, manual: 2 },
  };
  const sourcePriority = sourcePriorityByMode[priorityMode] || sourcePriorityByMode["Prefer Loyverse"];
  return sourcePriority[event.source] ?? 99;
}

export function dedupeSaleEvents(receiptEvents, clipEvents, manualEvents, options = {}) {
  const toleranceMs = options.toleranceMs ?? 10 * 60 * 1000;
  const priorityMode = options.priorityMode || "Prefer Loyverse";
  const allEvents = [...receiptEvents, ...clipEvents, ...manualEvents].sort((left, right) => {
    if (priorityMode === "Prefer earliest") {
      const timeDiff = left.timestamp.getTime() - right.timestamp.getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
    }
    const priorityDiff = getEventPriority(left, priorityMode) - getEventPriority(right, priorityMode);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return left.timestamp.getTime() - right.timestamp.getTime();
  });
  const canonicalEvents = [];
  const duplicates = [];
  allEvents.forEach((event) => {
    const duplicateIndex = findDuplicateEventIndex(canonicalEvents, event, toleranceMs);
    if (duplicateIndex >= 0) {
      duplicates.push({
        duplicate: event,
        canonical: canonicalEvents[duplicateIndex],
        matchedWithinMinutes: Math.round(
          Math.abs(canonicalEvents[duplicateIndex].timestamp.getTime() - event.timestamp.getTime()) / 60000,
        ),
      });
      return;
    }
    canonicalEvents.push(event);
  });
  return { canonicalEvents, duplicates };
}

const DEFAULT_PRIORITY = "Prefer Loyverse";

/**
 * @param {object} params
 * @param {Array} params.receipts - Loyverse receipts (any window; caller filters dates)
 * @param {Array} params.clipPayments - raw Clip payments
 * @param {Array} params.contributionTransactions - CompanyTransaction rows with type contribution
 * @param {Array} [params.stores] - Loyverse stores for branch names
 * @param {number} [params.dedupeWindowMs] - sliding window for cross-source dedupe
 * @param {string} [params.priorityMode] - one of the priority strings used by resolveDedupePriority
 * @param {string} [params.paymentSource] - "All sources" or a specific payment source filter
 * @param {string} [params.branch] - "All branches" or a specific branch name
 * @param {string} [params.channel] - "All channels" or a specific channel name
 */
export function buildMergedCanonicalEvents({
  receipts = [],
  clipPayments = [],
  contributionTransactions = [],
  stores = [],
  dedupeWindowMs = 10 * 60 * 1000,
  priorityMode = DEFAULT_PRIORITY,
  paymentSource = "All sources",
  branch = "All branches",
  channel = "All channels",
}) {
  const loyverseStoreMap = new Map(stores.map((store) => [store.id, store.name || store.id]));
  const receiptSaleEvents = receipts.map((receipt, index) =>
    createSaleEvent({
      id: receipt.id || receipt.receipt_number || `receipt-${index}`,
      source: "loyverse",
      amount: getReceiptTotal(receipt),
      timestamp: getRecordDate(receipt),
      paymentMethod: getReceiptPaymentMethod(receipt),
      branch: loyverseStoreMap.get(receipt.store_id) || receipt.store_id || "Centro",
      channel: deriveReceiptSalesChannel(receipt),
      payload: receipt,
    }),
  );
  const approvedClipPayments = clipPayments.filter((payment) => {
    const status = String(payment.status || "").toLowerCase();
    return status.includes("approved") || status.includes("paid");
  });
  const clipSaleEvents = approvedClipPayments.map((payment, index) =>
    createSaleEvent({
      id: payment.id || payment.receipt_no || `clip-${index}`,
      source: "clip",
      amount: getClipPaymentAmount(payment),
      timestamp: getRecordDate(payment),
      paymentMethod: payment?.payment_method?.id || payment?.payment_method?.type || "card",
      branch: "Centro",
      channel: "Unknown",
      payload: payment,
    }),
  );
  const manualSaleEvents = contributionTransactions.map((transaction, index) =>
    createSaleEvent({
      id: transaction.id || `manual-${index}`,
      source: "manual",
      amount: Number(transaction.amount || 0),
      timestamp: getRecordDate(transaction),
      paymentMethod: transaction.payment_method || "manual",
      branch: "Centro",
      channel: deriveManualSalesChannel(transaction),
      payload: transaction,
    }),
  );
  const dedupedSales = dedupeSaleEvents(receiptSaleEvents, clipSaleEvents, manualSaleEvents, {
    toleranceMs: dedupeWindowMs,
    priorityMode,
  });
  const canonicalEvents = dedupedSales.canonicalEvents.filter(
    (event) =>
      matchesPaymentSourceFilter(event, paymentSource) &&
      matchesBranchFilter(event, branch) &&
      matchesSalesChannelFilter(event, channel),
  );
  return {
    canonicalEvents,
    duplicates: dedupedSales.duplicates,
  };
}

export function filterCanonicalEventsByDateRange(events, rangeStart, rangeEndInclusive) {
  return events.filter((e) => e.timestamp >= rangeStart && e.timestamp <= rangeEndInclusive);
}

export function sumEventAmounts(events) {
  return events.reduce((sum, e) => sum + e.amount, 0);
}

export function aggregateTopReceiptLineItems(canonicalEvents, limit = 10) {
  const map = new Map();
  canonicalEvents
    .filter((e) => e.source === "loyverse" && e.payload)
    .forEach((event) => {
      getReceiptItems(event.payload).forEach((item) => {
        const name = item.item_name || item.name || item.variant_name || "Item";
        const qty = Number(item.quantity || item.qty || 1) || 1;
        const rev = getReceiptItemGross(item);
        const cur = map.get(name) || { count: 0, revenue: 0 };
        cur.count += qty;
        cur.revenue += rev;
        map.set(name, cur);
      });
    });
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function countByChannel(canonicalEvents) {
  const map = new Map();
  canonicalEvents.forEach((e) => {
    const key = e.channel || "Unknown";
    const cur = map.get(key) || { name: key, value: 0, revenue: 0 };
    cur.value += 1;
    cur.revenue += e.amount;
    map.set(key, cur);
  });
  return Array.from(map.values());
}
