import { buildClipResolvedConfig } from "@/lib/integrationSettings";
import { base44 } from "@/api/base44Client";
export const CLIP_PAYMENTS_API_BASE_URL = "https://api.payclip.com";
export const CLIP_SETTLEMENTS_API_BASE_URL = "https://api-gw.payclip.com";
const DEFAULT_CLIP_PAYMENTS_PROXY_PATH = "/api/clip/payments";
const DEFAULT_CLIP_SETTLEMENTS_PROXY_PATH = "/api/clip/settlements";

function buildClipAuthToken(config = {}) {
  if (config.authToken) {
    return config.authToken.startsWith("Basic ")
      ? config.authToken
      : `Basic ${config.authToken}`;
  }

  if (!config.apiKey || !config.apiSecret) {
    return "";
  }

  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return `Basic ${window.btoa(`${config.apiKey}:${config.apiSecret}`)}`;
  }

  return "";
}

export function getClipResolvedConfig(settings = {}) {
  const config = buildClipResolvedConfig(settings);
  return {
    ...config,
    paymentsBaseUrl: config.paymentsBaseUrl || CLIP_PAYMENTS_API_BASE_URL,
    settlementsBaseUrl: config.settlementsBaseUrl || CLIP_SETTLEMENTS_API_BASE_URL,
    authToken: buildClipAuthToken(config),
  };
}

export function hasClipApiConfig(settings = {}) {
  return Boolean(getClipResolvedConfig(settings).authToken);
}



export const CLIP_API_CATALOG = [
  {
    key: "transactions",
    name: "Transactions API",
    status: "live",
    authHeader: "Authorization",
    docsUrl: "https://developer.clip.mx/reference/introduccion-api-de-transacciones",
    summary: "Query transactions by date range and fetch individual transaction details.",
    capabilities: [
      "GET /payments by date range",
      "GET /payments/{payment_id} individual detail",
      "GET /payments/receipt-no/{receipt_no} receipt reconciliation",
    ],
    limits: "Clip documents period filters and reconciliation by receipt_no.",
  },
  {
    key: "settlements",
    name: "Deposits API",
    status: "live",
    authHeader: "x-api-key",
    docsUrl: "https://developer.clip.mx/reference/api-de-dep%C3%B3sitos",
    summary: "Summarizes deposits and lets you inspect each settlement report in detail.",
    capabilities: [
      "GET /settlements period summary",
      "GET /settlements/{settlement_report_id} report detail",
    ],
    limits: "Clip documenta consultas de hasta 90 dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as por periodo.",
  },
  {
    key: "checkout",
    name: "Hosted Checkout",
    status: "documented",
    authHeader: "Token Clip",
    docsUrl: "https://developer.clip.mx/reference/createnewpaymentlink",
    summary: "Creates Clip-hosted payment links and lets you check their status.",
    capabilities: [
      "POST create new payment link",
      "GET payment link status",
      "RedirecciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n al checkout hospedado",
    ],
    limits: "No se ejecuta automÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ticamente aquÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­ porque crea recursos reales.",
  },
  {
    key: "refunds",
    name: "Refunds API",
    status: "documented",
    authHeader: "Token Clip",
    docsUrl: "https://developer.clip.mx/reference/introduccion-api-de-reembolsos",
    summary: "Manages refunds for existing charges through the Clip API.",
    capabilities: [
      "Request refund",
      "Conciliar contra la transacciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n original",
    ],
    limits: "Es una operaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n mutante y queda fuera del dashboard de solo lectura.",
  },
  {
    key: "webhooks",
    name: "Webhooks and Postback",
    status: "documented",
    authHeader: "ConfiguraciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n backend",
    docsUrl: "https://developer.clip.mx/docs/conciliacion-de-transacciones-apis-1",
    summary: "Notifies payment states and transaction results in real time.",
    capabilities: [
      "Checkout webhook",
      "Postback for in-person charges",
      "ConciliaciÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³n por payment_request_id y receipt_no",
    ],
    limits: "Requiere endpoint backend pÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âºblico para recibir eventos.",
  },
  {
    key: "pinpad",
    name: "PinPad API",
    status: "documented",
    authHeader: "Token Clip",
    docsUrl: "https://developer.clip.mx/docs/api-de-pinpad",
    summary: "Permite iniciar y administrar cobros en terminales fÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­sicas desde backend.",
    capabilities: [
      "Create payment attempt",
      "Check payment detail",
      "Cancel a started payment",
    ],
    limits: "DiseÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±ada para backend + terminal + webhook, no solo frontend.",
  },
];

class ClipApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ClipApiError";
    this.status = status;
  }
}

function getClipRequestBaseUrl(apiType, config) {
  if (import.meta.env.DEV) {
    return apiType === "settlements"
      ? (import.meta.env.VITE_CLIP_SETTLEMENTS_PROXY_PATH || DEFAULT_CLIP_SETTLEMENTS_PROXY_PATH)
      : (import.meta.env.VITE_CLIP_PAYMENTS_PROXY_PATH || DEFAULT_CLIP_PAYMENTS_PROXY_PATH);
  }

  return apiType === "settlements" ? config.settlementsBaseUrl : config.paymentsBaseUrl;
}

function buildClipUrl(baseUrl, path, searchParams = {}) {
  const normalizedBaseUrl = String(baseUrl || "").replace(/\/$/, "");
  const resolvedBaseUrl = /^https?:/i.test(normalizedBaseUrl)
    ? `${normalizedBaseUrl}/`
    : `${window.location.origin}${normalizedBaseUrl}/`;
  const url = new URL(path, resolvedBaseUrl);

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

async function clipFetch(path, { searchParams, apiType = "payments", authToken } = {}) {
  if (!authToken) {
    throw new ClipApiError("Missing Clip auth token");
  }

  if (import.meta.env.DEV) {
    const config = getClipResolvedConfig();
    const url = buildClipUrl(getClipRequestBaseUrl(apiType, config), path, searchParams);
    const response = await fetch(url, {
      headers: apiType === "settlements"
        ? { Accept: "application/json", "x-api-key": authToken }
        : { Accept: "application/json", Authorization: authToken },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ClipApiError(`Clip API error ${response.status}: ${text || response.statusText}`, response.status);
    }

    return text ? JSON.parse(text) : null;
  }

  const response = await base44.functions.invoke("clipProxy", {
    path,
    searchParams,
    apiType,
    authToken,
  });

  return response.data;
}

async function clipFetchOptional(path, options = {}) {
  try {
    return await clipFetch(path, options);
  } catch {
    return null;
  }
}

function normalizeClipItem(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (payload.item && typeof payload.item === "object") {
    return payload.item;
  }

  if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
    return payload.data;
  }

  return payload;
}

function extractArray(payload) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  const firstArray = Object.values(payload).find(Array.isArray);
  return firstArray || [];
}

function getAmount(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    return getAmount(value.amount ?? value.value ?? value.total);
  }

  return 0;
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

function normalizeClipDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function normalizeClipDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function getSettlementDetailId(settlement) {
  const href = settlement?.links?.self?.href;
  if (typeof href === "string") {
    const parts = href.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  }

  return settlement?.settlement_report_id || null;
}

function extractSettlementPaymentRows(detailPayload) {
  const settlement = detailPayload?.settlement;
  if (!settlement || !Array.isArray(settlement.details)) {
    return [];
  }

  return settlement.details.flatMap((detail) =>
    (detail.payments || []).map((payment) => ({
      ...payment,
      settlementDate: detail.date,
      settlementReportId: settlement.settlement_report_id,
      merchantName: settlement.merchant_name,
      disbursementDate: settlement.disbursement_date,
    })),
  );
}

function getDefaultPaymentsRange() {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);

  return {
    from: from.toISOString().replace(/\.\d{3}Z$/, "Z"),
    to: to.toISOString().replace(/\.\d{3}Z$/, "Z"),
  };
}

function getPaymentsRange(options = {}) {
  if (options.start || options.end) {
    return {
      from: normalizeClipDateTime(options.start || new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
      to: normalizeClipDateTime(options.end || new Date()),
    };
  }

  return getDefaultPaymentsRange();
}

function getDefaultSettlementsRange() {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 89);
  from.setUTCHours(0, 0, 0, 0);
  // Use yesterday as "to" to avoid timezone edge cases with Clip API
  to.setUTCDate(to.getUTCDate() - 1);
  to.setUTCHours(23, 59, 59, 999);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function getSettlementsRange(options = {}) {
  if (options.start || options.end) {
    const end = options.end ? new Date(options.end) : new Date();
    const start = options.start ? new Date(options.start) : new Date(end.getTime() - 89 * 24 * 60 * 60 * 1000);
    const boundedStart = new Date(Math.max(start.getTime(), end.getTime() - 89 * 24 * 60 * 60 * 1000));

    return {
      from: normalizeClipDate(boundedStart),
      to: normalizeClipDate(end),
    };
  }

  return getDefaultSettlementsRange();
}

function getClipPageCursor(payload) {
  return (
    payload?.cursor ||
    payload?.next_cursor ||
    payload?.pagination?.cursor ||
    payload?.pagination?.next_cursor ||
    null
  );
}

function getClipNextPage(payload, currentPage, pageSize, itemCount) {
  const explicitNextPage =
    payload?.next_page ??
    payload?.pagination?.next_page ??
    payload?.paging?.next_page ??
    null;

  if (explicitNextPage) {
    return explicitNextPage;
  }

  if (itemCount === pageSize) {
    return currentPage + 1;
  }

  return null;
}

async function fetchClipCollection(path, { searchParams, apiType, authToken, pageSize = 100, maxPages = 20 } = {}) {
  const allItems = [];
  let cursor = null;
  let page = 1;
  let pagesFetched = 0;
  let previousSignature = null;

  while (pagesFetched < maxPages) {
    const payload = await clipFetch(path, {
      searchParams: {
        ...searchParams,
        size: pageSize,
        ...(cursor ? { cursor } : { page }),
      },
      apiType,
      authToken,
    });

    const items = extractArray(payload);
    const signature = JSON.stringify(items.slice(0, 5).map((item) => item?.id || item?.receipt_no || item?.settlement_report_id || item));

    if (signature && signature === previousSignature) {
      break;
    }

    previousSignature = signature;
    allItems.push(...items);
    pagesFetched += 1;

    const nextCursor = getClipPageCursor(payload);
    if (nextCursor) {
      cursor = nextCursor;
      continue;
    }

    const nextPage = getClipNextPage(payload, page, pageSize, items.length);
    if (!nextPage) {
      break;
    }

    page = nextPage;
  }

  return allItems;
}

export async function getClipOverview(settings = {}, options = {}) {
  const config = getClipResolvedConfig(settings);
  const paymentsRange = getPaymentsRange(options);
  const settlementsRange = getSettlementsRange(options);

  const [paymentMethodsPayload, paymentsPayload, settlementsPayload] = await Promise.all([
    clipFetchOptional("payment_methods", {
      apiType: "payments",
      authToken: config.authToken,
    }),
    fetchClipCollection("payments", {
      searchParams: {
        from: paymentsRange.from,
        to: paymentsRange.to,
      },
      apiType: "payments",
      authToken: config.authToken,
    }),
    fetchClipCollection("settlements", {
      searchParams: {
        from: settlementsRange.from,
        to: settlementsRange.to,
      },
      apiType: "settlements",
      authToken: config.authToken,
    }).catch(() => null),
  ]);

  const payments = extractArray(paymentsPayload).sort((a, b) => {
    const left = new Date(a.created_at || a.approved_at || 0).getTime();
    const right = new Date(b.created_at || b.approved_at || 0).getTime();
    return right - left;
  });

  const settlements = extractArray(settlementsPayload).sort((a, b) => {
    const left = new Date(a.created_at || a.deposit_date || a.date || 0).getTime();
    const right = new Date(b.created_at || b.deposit_date || b.date || 0).getTime();
    return right - left;
  });
  const paymentMethods = extractArray(paymentMethodsPayload);
  const settlementDetailPayloads = await Promise.all(
    settlements.map((settlement) => {
      const settlementId = getSettlementDetailId(settlement);
      if (!settlementId) {
        return Promise.resolve(null);
      }

      return clipFetchOptional(`settlements/${settlementId}`, {
        apiType: "settlements",
        authToken: config.authToken,
      });
    }),
  );
  const settlementPayments = settlementDetailPayloads.flatMap(extractSettlementPaymentRows);

  const approvedPayments = payments.filter((payment) => {
    const status = String(payment.status || "").toLowerCase();
    return status.includes("approved") || status.includes("paid");
  });
  const refundedPayments = payments.filter((payment) => getAmount(payment.amount_refunded) > 0);
  const grossVolume = approvedPayments.reduce((sum, payment) => sum + getAmount(payment.amount), 0);
  const refundedVolume = payments.reduce((sum, payment) => sum + getAmount(payment.amount_refunded), 0);
  const tipsVolume = payments.reduce((sum, payment) => sum + getAmount(payment.tip_amount ?? payment.tip), 0);
  const netDeposits = settlements.reduce(
    (sum, settlement) =>
      sum + getAmount(settlement.disbursed_net_amount ?? settlement.net_amount ?? settlement.net_total ?? settlement.amount_net),
    0,
  );
  const grossDeposits = settlements.reduce(
    (sum, settlement) => sum + getAmount(settlement.gross_amount ?? settlement.gross_total ?? settlement.amount_gross),
    0,
  );
  const totalSettlementFees = settlements.reduce(
    (sum, settlement) => sum + getAmount(settlement.total_fee ?? settlement.fee_amount ?? settlement.total_fees),
    0,
  );
  const totalSettlementTax = settlements.reduce(
    (sum, settlement) => sum + getAmount(settlement.total_tax),
    0,
  );
  const totalSettlementRetention = settlements.reduce(
    (sum, settlement) => sum + getAmount(settlement.total_retention),
    0,
  );
  const averageTicket = approvedPayments.length ? grossVolume / approvedPayments.length : 0;
  const installmentPaymentsCount = approvedPayments.filter((payment) => Number(payment.installments || 0) > 1).length;
  const paymentStatusSummary = [...payments.reduce((map, payment) => {
    const key = String(payment.status || "unknown").toLowerCase();
    const current = map.get(key) || { status: key, count: 0, amount: 0 };
    current.count += 1;
    current.amount += getAmount(payment.amount);
    map.set(key, current);
    return map;
  }, new Map()).values()].sort((a, b) => b.count - a.count || b.amount - a.amount);
  const paymentTypeSummary = [...approvedPayments.reduce((map, payment) => {
    const method = payment.payment_method || {};
    const key = method.id || method.type || "unknown";
    const current = map.get(key) || {
      id: key,
      type: method.type || "unknown",
      name: method.id || method.type || "Unknown",
      count: 0,
      amount: 0,
    };
    current.count += 1;
    current.amount += getAmount(payment.amount);
    map.set(key, current);
    return map;
  }, new Map()).values()].sort((a, b) => b.amount - a.amount || b.count - a.count);
  const issuerSummary = [...approvedPayments.reduce((map, payment) => {
    const issuer = payment?.payment_method?.card?.issuer || "Unknown issuer";
    const current = map.get(issuer) || { issuer, count: 0, amount: 0 };
    current.count += 1;
    current.amount += getAmount(payment.amount);
    map.set(issuer, current);
    return map;
  }, new Map()).values()].sort((a, b) => b.amount - a.amount || b.count - a.count);
  const dailyPayments = [...approvedPayments.reduce((map, payment) => {
    const day = normalizeDay(payment.approved_at || payment.created_at);
    if (!day) {
      return map;
    }

    const current = map.get(day) || { day, count: 0, grossAmount: 0, refundedAmount: 0, tipsAmount: 0 };
    current.count += 1;
    current.grossAmount += getAmount(payment.amount);
    current.refundedAmount += getAmount(payment.amount_refunded);
    current.tipsAmount += getAmount(payment.tip_amount ?? payment.tip);
    map.set(day, current);
    return map;
  }, new Map()).values()].sort((a, b) => a.day.localeCompare(b.day));
  const settlementDaily = [...settlements.reduce((map, settlement) => {
    const day = settlement.disbursement_date || normalizeDay(settlement.created_at || settlement.date);
    if (!day) {
      return map;
    }

    const current = map.get(day) || { day, settlementsCount: 0, grossAmount: 0, netAmount: 0, feeAmount: 0 };
    current.settlementsCount += 1;
    current.grossAmount += getAmount(settlement.gross_amount ?? settlement.gross_total ?? settlement.amount_gross);
    current.netAmount += getAmount(settlement.disbursed_net_amount ?? settlement.net_amount ?? settlement.net_total ?? settlement.amount_net);
    current.feeAmount += getAmount(settlement.total_fee ?? settlement.fee_amount ?? settlement.total_fees);
    map.set(day, current);
    return map;
  }, new Map()).values()].sort((a, b) => a.day.localeCompare(b.day));
  const settlementCardBrands = [...settlementPayments.reduce((map, payment) => {
    const brand = payment?.card?.brand || payment.payment_method || "UNKNOWN";
    const current = map.get(brand) || { brand, count: 0, amount: 0, feeAmount: 0 };
    current.count += 1;
    current.amount += getAmount(payment.amount);
    current.feeAmount += getAmount(payment?.charges?.charge?.fee);
    map.set(brand, current);
    return map;
  }, new Map()).values()].sort((a, b) => b.amount - a.amount || b.count - a.count);

  return {
    paymentMethods,
    payments,
    settlements,
    settlementDetails: settlementDetailPayloads.filter(Boolean),
    settlementPayments,
    raw: {
      paymentMethodsPayload,
      paymentsPayload,
      settlementsPayload,
    },
    ranges: {
      payments: paymentsRange,
      settlements: settlementsRange,
    },
    config: {
      paymentsBaseUrl: config.paymentsBaseUrl,
      settlementsBaseUrl: config.settlementsBaseUrl,
    },
    analytics: {
      paymentStatusSummary,
      paymentTypeSummary,
      issuerSummary,
      dailyPayments,
      settlementDaily,
      settlementCardBrands,
      averageTicket,
      installmentPaymentsCount,
      totalSettlementFees,
      totalSettlementTax,
      totalSettlementRetention,
    },
    metrics: {
      paymentMethodsCount: paymentMethods.length,
      paymentsCount: payments.length,
      approvedPaymentsCount: approvedPayments.length,
      refundedPaymentsCount: refundedPayments.length,
      settlementsCount: settlements.length,
      grossVolume,
      refundedVolume,
      tipsVolume,
      grossDeposits,
      netDeposits,
      totalSettlementFees,
      totalSettlementTax,
      totalSettlementRetention,
      averageTicket,
      installmentPaymentsCount,
      settlementPaymentsCount: settlementPayments.length,
      latestSyncAt: new Date().toISOString(),
    },
  };
}

export async function getClipPaymentDetails(paymentId, settings = {}) {
  if (!paymentId) {
    throw new ClipApiError("Missing Clip payment ID");
  }

  const config = getClipResolvedConfig(settings);
  const payload = await clipFetch(`payments/${paymentId}`, {
    apiType: "payments",
    authToken: config.authToken,
  });

  return normalizeClipItem(payload);
}

export async function getClipPaymentByReceipt(receiptNo, settings = {}) {
  if (!receiptNo) {
    throw new ClipApiError("Missing Clip receipt number");
  }

  const config = getClipResolvedConfig(settings);
  const payload = await clipFetch(`payments/receipt-no/${receiptNo}`, {
    apiType: "payments",
    authToken: config.authToken,
  });

  return normalizeClipItem(payload);
}

export async function getClipSettlementDetails(settlementReportId, settings = {}) {
  if (!settlementReportId) {
    throw new ClipApiError("Missing Clip settlement report ID");
  }

  const config = getClipResolvedConfig(settings);
  const payload = await clipFetch(`settlements/${settlementReportId}`, {
    apiType: "settlements",
    authToken: config.authToken,
  });

  return normalizeClipItem(payload);
}
