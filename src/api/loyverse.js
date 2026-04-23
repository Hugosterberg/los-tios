import { buildLoyverseResolvedConfig } from "@/lib/integrationSettings";
import { base44 } from "@/api/base44Client";
const DEFAULT_LOYVERSE_API_BASE_URL = "https://api.loyverse.com/v1.0";
const DEFAULT_LOYVERSE_PROXY_PATH = "/api/loyverse";

export const LOYVERSE_API_BASE_URL =
  import.meta.env.VITE_LOYVERSE_API_BASE_URL || DEFAULT_LOYVERSE_API_BASE_URL;
const LOYVERSE_ITEM_MODIFIER_STORAGE_KEY = "los_tios_loyverse_item_modifier_assignments_v1";
const isBrowser = typeof window !== "undefined";

export function getLoyverseResolvedConfig(settings = {}) {
  const config = buildLoyverseResolvedConfig(settings);

  return {
    ...config,
    baseUrl: config.baseUrl || DEFAULT_LOYVERSE_API_BASE_URL,
  };
}

function getLoyverseRequestBaseUrl(config) {
  return import.meta.env.DEV
    ? (import.meta.env.VITE_LOYVERSE_PROXY_PATH || DEFAULT_LOYVERSE_PROXY_PATH)
    : config.baseUrl;
}

export function hasLoyverseApiConfig(settings = {}) {
  return Boolean(getLoyverseResolvedConfig(settings).apiToken);
}

class LoyverseApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "LoyverseApiError";
    this.status = status;
  }
}

function readItemModifierAssignments() {
  if (!isBrowser) {
    return {};
  }

  const stored = window.localStorage.getItem(LOYVERSE_ITEM_MODIFIER_STORAGE_KEY);
  if (!stored) {
    return {};
  }

  try {
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeItemModifierAssignments(assignments) {
  if (!isBrowser) {
    return;
  }

  window.localStorage.setItem(
    LOYVERSE_ITEM_MODIFIER_STORAGE_KEY,
    JSON.stringify(assignments),
  );
}

export async function saveLoyverseItemModifierAssignments(itemId, modifierIds) {
  const assignments = readItemModifierAssignments();
  assignments[itemId] = Array.isArray(modifierIds) ? [...new Set(modifierIds)] : [];
  writeItemModifierAssignments(assignments);

  return {
    itemId,
    modifierIds: assignments[itemId],
  };
}

function buildLoyverseUrl(baseUrl, path, searchParams = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const resolvedBaseUrl = /^https?:/i.test(normalizedBaseUrl)
    ? `${normalizedBaseUrl}/`
    : `${window.location.origin}${normalizedBaseUrl}/`;
  const url = new URL(path, resolvedBaseUrl);

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

/**
 * Low-level Loyverse HTTP call. GET is used throughout this module; POST is used to create receipts from the web app.
 * In production, POST must be supported by the `loyverseProxy` Edge Function (method + JSON body) or calls will fail.
 */
export async function loyverseApiRequest(method, path, { searchParams = {}, body = undefined, settings = {} } = {}) {
  const config = getLoyverseResolvedConfig(settings);
  if (!config.apiToken) {
    throw new LoyverseApiError("Missing Loyverse API token");
  }

  const headers = {
    Authorization: `Bearer ${config.apiToken}`,
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
  };

  if (import.meta.env.DEV) {
    const url = buildLoyverseUrl(getLoyverseRequestBaseUrl(config), path, searchParams);
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new LoyverseApiError(`Loyverse API error ${response.status}: ${text || response.statusText}`, response.status);
    }

    return text ? JSON.parse(text) : null;
  }

  const response = await base44.functions.invoke("loyverseProxy", {
    method,
    path,
    searchParams,
    body,
    apiToken: config.apiToken,
  });

  if (response.data?.error) {
    throw new LoyverseApiError(response.data.error);
  }

  return response.data;
}

async function loyverseFetch(path, searchParams = {}, settings = {}) {
  return loyverseApiRequest("GET", path, { searchParams, settings });
}

/**
 * Create a sales receipt in Loyverse (shows in Back Office / POS history). Body shape follows Loyverse Open API (receipt_lines + payments).
 */
export async function createLoyverseReceipt(settings, body) {
  try {
    return await loyverseApiRequest("POST", "receipts", { body, settings });
  } catch (err) {
    const status = err?.status;
    if (status === 400 || status === 422) {
      return loyverseApiRequest("POST", "receipts", { body: { receipt: body }, settings });
    }
    throw err;
  }
}

export async function fetchLoyversePaymentTypes(settings) {
  return fetchOptionalCollection("payment_types", "payment_types", { maxPages: 5, settings });
}

export async function fetchLoyverseStoresList(settings) {
  return fetchOptionalCollection("stores", "stores", { maxPages: 5, settings });
}

function extractCollection(payload, collectionKey) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload[collectionKey])) {
    return payload[collectionKey];
  }

  if (payload.data && Array.isArray(payload.data[collectionKey])) {
    return payload.data[collectionKey];
  }

  const firstArray = Object.values(payload).find(Array.isArray);
  return firstArray || [];
}

function extractCursor(payload) {
  return (
    payload?.cursor ||
    payload?.next_cursor ||
    payload?.pagination?.cursor ||
    payload?.pagination?.next_cursor ||
    null
  );
}

/**
 * @param {string} path
 * @param {string} collectionKey
 * @param {{
 *  maxPages?: number,
 *  searchParams?: Record<string, string | number | null | undefined>,
 *  settings?: Record<string, any>
 * }} [options]
 */
async function fetchCollection(path, collectionKey, { maxPages = 10, searchParams, settings } = {}) {
  const allRecords = [];
  let cursor = null;
  let page = 0;

  do {
    const payload = await loyverseFetch(path, {
      ...searchParams,
      ...(cursor ? { cursor } : {}),
    }, settings);

    allRecords.push(...extractCollection(payload, collectionKey));
    cursor = extractCursor(payload);
    page += 1;
  } while (cursor && page < maxPages);

  return allRecords;
}

async function fetchOptionalCollection(path, collectionKey, options = {}) {
  try {
    return await fetchCollection(path, collectionKey, options);
  } catch {
    return [];
  }
}

export async function fetchLoyverseCategoriesList(settings) {
  return fetchOptionalCollection("categories", "categories", { maxPages: 5, settings });
}

function getMoneyAmount(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    return getMoneyAmount(value.amount ?? value.value);
  }

  return 0;
}

function getReceiptStatus(receipt) {
  return (
    receipt.status ||
    receipt.receipt_status ||
    (receipt.canceled_at ? "cancelled" : "completed")
  );
}

function getReceiptLineItems(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return [];
  }

  return (
    receipt.line_items ||
    receipt.receipt_items ||
    receipt.items ||
    receipt.positions ||
    []
  );
}

function getReceiptPayments(receipt) {
  if (!receipt || typeof receipt !== "object") {
    return [];
  }

  return Array.isArray(receipt.payments) ? receipt.payments : [];
}

function normalizeDay(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/**
 * Receipts: include if any of the common timestamps fall in [start, end].
 * Open tickets are often saved with an older receipt_date but updated_at when edited today; a single-field rule hid them from “Day”.
 */
function filterRecordsByDateRange(records, options = {}) {
  if (!options.start && !options.end) {
    return records;
  }

  const start = options.start ? new Date(options.start) : null;
  const end = options.end ? new Date(options.end) : null;

  return records.filter((record) => {
    const candidates = [
      record?.receipt_date,
      record?.created_at,
      record?.updated_at,
      record?.date,
    ].filter(Boolean);

    if (candidates.length === 0) {
      return false;
    }

    return candidates.some((raw) => {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        return false;
      }
      if (start && date < start) {
        return false;
      }
      if (end && date > end) {
        return false;
      }
      return true;
    });
  });
}

function getLineItemTotalMoney(lineItem, preferredKeys = []) {
  for (const key of preferredKeys) {
    const value = getMoneyAmount(lineItem?.[key]);
    if (value > 0) {
      return value;
    }
  }

  const quantity = Number(lineItem?.quantity ?? lineItem?.qty ?? 1) || 1;
  const unitPrice = getMoneyAmount(
    lineItem?.price_money ??
    lineItem?.price ??
    lineItem?.base_price_money ??
    lineItem?.amount_money,
  );

  return unitPrice * quantity;
}

export async function getLoyverseOverview(settings = {}, options = {}) {
  const [
    stores,
    items,
    customers,
    receipts,
    categories,
    modifiers,
    discounts,
    taxes,
    employees,
    posDevices,
    shifts,
    inventoryLevels,
  ] = await Promise.all([
    fetchOptionalCollection("stores", "stores", { maxPages: 5, settings }),
    fetchOptionalCollection("items", "items", { maxPages: 50, settings }),
    fetchOptionalCollection("customers", "customers", { maxPages: 50, settings }),
    fetchCollection("receipts", "receipts", { maxPages: 100, settings }),
    fetchOptionalCollection("categories", "categories", { maxPages: 10, settings }),
    fetchOptionalCollection("modifiers", "modifiers", { maxPages: 50, settings }),
    fetchOptionalCollection("discounts", "discounts", { maxPages: 10, settings }),
    fetchOptionalCollection("taxes", "taxes", { maxPages: 10, settings }),
    fetchOptionalCollection("employees", "employees", { maxPages: 10, settings }),
    fetchOptionalCollection("pos_devices", "pos_devices", { maxPages: 10, settings }),
    fetchOptionalCollection("shifts", "shifts", { maxPages: 50, settings }),
    fetchOptionalCollection("inventory", "inventory_levels", { maxPages: 50, settings }),
  ]);

  const receiptsInRange = filterRecordsByDateRange(receipts, options);
  const receiptsSorted = [...receiptsInRange].sort((a, b) => {
    const left = new Date(a.created_at || a.updated_at || 0).getTime();
    const right = new Date(b.created_at || b.updated_at || 0).getTime();
    return right - left;
  });

  const completedReceipts = receiptsSorted.filter((receipt) => {
    const status = getReceiptStatus(receipt).toLowerCase();
    return !status.includes("cancel");
  });

  const cancelledReceipts = receiptsSorted.filter((receipt) => {
    const status = getReceiptStatus(receipt).toLowerCase();
    return status.includes("cancel");
  });

  const grossSales = completedReceipts.reduce((sum, receipt) => {
    return (
      sum +
      getMoneyAmount(
        receipt.total_money ??
          receipt.total ??
          receipt.total_payment_money,
      )
    );
  }, 0);
  const totalDiscountAmount = completedReceipts.reduce(
    (sum, receipt) => sum + getMoneyAmount(receipt.total_discount),
    0,
  );
  const totalTaxAmount = completedReceipts.reduce(
    (sum, receipt) => sum + getMoneyAmount(receipt.total_tax),
    0,
  );
  const totalTipsAmount = completedReceipts.reduce(
    (sum, receipt) => sum + getMoneyAmount(receipt.tip),
    0,
  );
  const averageReceiptValue = completedReceipts.length ? grossSales / completedReceipts.length : 0;

  const itemsSorted = [...items].sort((a, b) => {
    const left = new Date(a.updated_at || a.created_at || 0).getTime();
    const right = new Date(b.updated_at || b.created_at || 0).getTime();
    return right - left;
  });

  const customersSorted = [...customers].sort((a, b) => {
    const left = new Date(a.updated_at || a.created_at || 0).getTime();
    const right = new Date(b.updated_at || b.created_at || 0).getTime();
    return right - left;
  });

  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const storeMap = new Map(stores.map((store) => [store.id, store]));
  const modifierMap = new Map(modifiers.map((modifier) => [modifier.id, modifier]));
  const modifierAssignments = readItemModifierAssignments();

  const variantsCount = items.reduce(
    (sum, item) => sum + (Array.isArray(item.variants) ? item.variants.length : 0),
    0,
  );
  const itemsWithVariantsCount = items.filter(
    (item) => Array.isArray(item.variants) && item.variants.length > 0,
  ).length;
  const trackedStockItemsCount = items.filter((item) => item.track_stock).length;
  const soldByWeightItemsCount = items.filter((item) => item.sold_by_weight).length;
  const compositeItemsCount = items.filter((item) => item.is_composite).length;
  const productionItemsCount = items.filter((item) => item.use_production).length;
  const itemsWithoutCategoryCount = items.filter((item) => !item.category_id).length;

  const modifierOptionsCount = modifiers.reduce(
    (sum, modifier) =>
      sum + (Array.isArray(modifier.modifier_options) ? modifier.modifier_options.length : 0),
    0,
  );

  const activePosDevicesCount = posDevices.filter((device) => device.activated).length;
  const ownerEmployeesCount = employees.filter((employee) => employee.is_owner).length;
  const customerLifetimeValue = customers.reduce(
    (sum, customer) => sum + getMoneyAmount(customer.total_spent),
    0,
  );
  const activeCustomersCount = customers.filter((customer) => {
    return getMoneyAmount(customer.total_spent) > 0 || (customer.total_visits ?? 0) > 0;
  }).length;

  const categoryBreakdown = categories
    .map((category) => {
      const categoryItems = items.filter((item) => item.category_id === category.id);
      const variants = categoryItems.reduce(
        (sum, item) => sum + (Array.isArray(item.variants) ? item.variants.length : 0),
        0,
      );

      return {
        ...category,
        itemsCount: categoryItems.length,
        trackedStockItemsCount: categoryItems.filter((item) => item.track_stock).length,
        variantsCount: variants,
      };
    })
    .sort((a, b) => b.itemsCount - a.itemsCount || a.name.localeCompare(b.name));

  const modifierBreakdown = modifiers
    .map((modifier) => ({
      ...modifier,
      storesCount: Array.isArray(modifier.stores) ? modifier.stores.length : 0,
      optionsCount: Array.isArray(modifier.modifier_options) ? modifier.modifier_options.length : 0,
    }))
    .sort((a, b) => b.optionsCount - a.optionsCount || a.name.localeCompare(b.name));

  const discountBreakdown = discounts
    .map((discount) => ({
      ...discount,
      storesCount: Array.isArray(discount.stores) ? discount.stores.length : 0,
    }))
    .sort((a, b) => {
      const left = getMoneyAmount(a.discount_percent ?? a.amount);
      const right = getMoneyAmount(b.discount_percent ?? b.amount);
      return right - left;
    });

  const enrichedItems = itemsSorted.map((item) => {
    const localModifierIds = Array.isArray(modifierAssignments[item.id])
      ? modifierAssignments[item.id]
      : null;
    const effectiveModifierIds = localModifierIds ?? item.modifier_ids ?? [];

    return {
      ...item,
      category: item.category_id ? categoryMap.get(item.category_id) || null : null,
      variantsCount: Array.isArray(item.variants) ? item.variants.length : 0,
      modifier_ids: effectiveModifierIds,
      modifierLinksCount: Array.isArray(effectiveModifierIds) ? effectiveModifierIds.length : 0,
      modifierDetails: Array.isArray(effectiveModifierIds)
        ? effectiveModifierIds.map((modifierId) => modifierMap.get(modifierId)).filter(Boolean)
        : [],
      hasLocalModifierOverride: Boolean(localModifierIds),
    };
  });

  const enrichedCustomers = customersSorted.map((customer) => ({
    ...customer,
    totalSpentAmount: getMoneyAmount(customer.total_spent),
  }));

  const enrichedPosDevices = posDevices.map((device) => ({
    ...device,
    store: device.store_id ? storeMap.get(device.store_id) || null : null,
  }));

  const enrichedEmployees = employees.map((employee) => ({
    ...employee,
    storeDetails: Array.isArray(employee.stores)
      ? employee.stores.map((storeId) => storeMap.get(storeId)).filter(Boolean)
      : [],
  }));

  const productSales = [...completedReceipts.reduce((map, receipt) => {
    getReceiptLineItems(receipt).forEach((lineItem) => {
      const key = lineItem.item_id || lineItem.variant_id || lineItem.item_name || "unknown";
      const current = map.get(key) || {
        id: key,
        itemId: lineItem.item_id || null,
        variantId: lineItem.variant_id || null,
        itemName: lineItem.item_name || lineItem.name || "Unknown item",
        sku: lineItem.sku || null,
        quantity: 0,
        grossRevenue: 0,
        netRevenue: 0,
        discounts: 0,
        costTotal: 0,
      };

      current.quantity += Number(lineItem.quantity || 0);
      current.grossRevenue += getLineItemTotalMoney(lineItem, ["gross_total_money", "subtotal_money"]);
      current.netRevenue += getLineItemTotalMoney(lineItem, ["total_money", "gross_total_money", "subtotal_money"]);
      current.discounts += getMoneyAmount(lineItem.total_discount);
      current.costTotal += getMoneyAmount(lineItem.cost_total ?? lineItem.cost);
      map.set(key, current);
    });

    return map;
  }, new Map()).values()]
    .sort((a, b) => b.quantity - a.quantity || b.netRevenue - a.netRevenue);

  const paymentMethodSummary = [...completedReceipts.reduce((map, receipt) => {
    getReceiptPayments(receipt).forEach((payment) => {
      const key = payment.type || payment.name || payment.payment_type_id || "unknown";
      const current = map.get(key) || {
        id: key,
        type: payment.type || "unknown",
        name: payment.name || payment.type || "Unknown",
        count: 0,
        amount: 0,
      };

      current.count += 1;
      current.amount += getMoneyAmount(payment.money_amount);
      map.set(key, current);
    });

    return map;
  }, new Map()).values()]
    .sort((a, b) => b.amount - a.amount || b.count - a.count);

  const salesByStore = [...completedReceipts.reduce((map, receipt) => {
    const key = receipt.store_id || "unknown";
    const current = map.get(key) || {
      id: key,
      storeId: key,
      storeName: storeMap.get(key)?.name || key || "Unknown store",
      receiptsCount: 0,
      salesAmount: 0,
      discountsAmount: 0,
    };

    current.receiptsCount += 1;
    current.salesAmount += getMoneyAmount(receipt.total_money ?? receipt.total_payment_money ?? receipt.total);
    current.discountsAmount += getMoneyAmount(receipt.total_discount);
    map.set(key, current);
    return map;
  }, new Map()).values()]
    .sort((a, b) => b.salesAmount - a.salesAmount);

  const employeeMap = new Map(enrichedEmployees.map((employee) => [employee.id, employee]));
  const salesByEmployee = [...completedReceipts.reduce((map, receipt) => {
    const key = receipt.employee_id || "unknown";
    const current = map.get(key) || {
      id: key,
      employeeId: key,
      employeeName: employeeMap.get(key)?.name || key || "Unknown employee",
      receiptsCount: 0,
      salesAmount: 0,
    };

    current.receiptsCount += 1;
    current.salesAmount += getMoneyAmount(receipt.total_money ?? receipt.total_payment_money ?? receipt.total);
    map.set(key, current);
    return map;
  }, new Map()).values()]
    .sort((a, b) => b.salesAmount - a.salesAmount);

  const dailySales = [...completedReceipts.reduce((map, receipt) => {
    const day = normalizeDay(receipt.receipt_date || receipt.created_at || receipt.updated_at);
    if (!day) {
      return map;
    }

    const current = map.get(day) || {
      day,
      receiptsCount: 0,
      salesAmount: 0,
      discountsAmount: 0,
    };

    current.receiptsCount += 1;
    current.salesAmount += getMoneyAmount(receipt.total_money ?? receipt.total_payment_money ?? receipt.total);
    current.discountsAmount += getMoneyAmount(receipt.total_discount);
    map.set(day, current);
    return map;
  }, new Map()).values()]
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    stores,
    items: enrichedItems,
    customers: enrichedCustomers,
    receipts: receiptsSorted,
    categories: categoryBreakdown,
    modifiers: modifierBreakdown,
    discounts: discountBreakdown,
    taxes,
    employees: enrichedEmployees,
    posDevices: enrichedPosDevices,
    shifts,
    inventoryLevels,
    analytics: {
      productSales,
      paymentMethodSummary,
      salesByStore,
      salesByEmployee,
      dailySales,
      averageReceiptValue,
      totalDiscountAmount,
      totalTaxAmount,
      totalTipsAmount,
    },
    config: {
      baseUrl: getLoyverseResolvedConfig(settings).baseUrl,
    },
    metrics: {
      storesCount: stores.length,
      itemsCount: items.length,
      customersCount: customers.length,
      receiptsCount: receiptsSorted.length,
      categoriesCount: categories.length,
      modifiersCount: modifiers.length,
      modifierOptionsCount,
      discountsCount: discounts.length,
      taxesCount: taxes.length,
      employeesCount: employees.length,
      ownerEmployeesCount,
      posDevicesCount: posDevices.length,
      activePosDevicesCount,
      shiftsCount: shifts.length,
      inventoryLevelsCount: inventoryLevels.length,
      completedReceiptsCount: completedReceipts.length,
      cancelledReceiptsCount: cancelledReceipts.length,
      grossSales,
      averageReceiptValue,
      totalDiscountAmount,
      totalTaxAmount,
      totalTipsAmount,
      variantsCount,
      itemsWithVariantsCount,
      trackedStockItemsCount,
      soldByWeightItemsCount,
      compositeItemsCount,
      productionItemsCount,
      itemsWithoutCategoryCount,
      activeCustomersCount,
      customerLifetimeValue,
      latestSyncAt: new Date().toISOString(),
    },
  };
}
