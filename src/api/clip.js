import { buildClipResolvedConfig } from "@/lib/integrationSettings";
const DEFAULT_CLIP_PAYMENTS_API_BASE_URL = "https://api.payclip.com";
const DEFAULT_CLIP_SETTLEMENTS_API_BASE_URL = "https://api-gw.payclip.com";
const DEFAULT_CLIP_PAYMENTS_PROXY_PATH = "/api/clip/payments";
const DEFAULT_CLIP_SETTLEMENTS_PROXY_PATH = "/api/clip/settlements";

export const CLIP_PAYMENTS_API_BASE_URL =
  import.meta.env.VITE_CLIP_PAYMENTS_API_BASE_URL || DEFAULT_CLIP_PAYMENTS_API_BASE_URL;
export const CLIP_SETTLEMENTS_API_BASE_URL =
  import.meta.env.VITE_CLIP_SETTLEMENTS_API_BASE_URL || DEFAULT_CLIP_SETTLEMENTS_API_BASE_URL;

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
    paymentsBaseUrl: config.paymentsBaseUrl || DEFAULT_CLIP_PAYMENTS_API_BASE_URL,
    settlementsBaseUrl: config.settlementsBaseUrl || DEFAULT_CLIP_SETTLEMENTS_API_BASE_URL,
    authToken: buildClipAuthToken(config),
  };
}

export function hasClipApiConfig(settings = {}) {
  return Boolean(getClipResolvedConfig(settings).authToken);
}

function getClipPaymentsRequestBaseUrl(config) {
  return import.meta.env.DEV
    ? (import.meta.env.VITE_CLIP_PAYMENTS_PROXY_PATH || DEFAULT_CLIP_PAYMENTS_PROXY_PATH)
    : config.paymentsBaseUrl;
}

function getClipSettlementsRequestBaseUrl(config) {
  return import.meta.env.DEV
    ? (import.meta.env.VITE_CLIP_SETTLEMENTS_PROXY_PATH || DEFAULT_CLIP_SETTLEMENTS_PROXY_PATH)
    : config.settlementsBaseUrl;
}

export const CLIP_API_CATALOG = [
  {
    key: "transactions",
    name: "API de Transacciones",
    status: "live",
    authHeader: "Authorization",
    docsUrl: "https://developer.clip.mx/reference/introduccion-api-de-transacciones",
    summary: "Consulta transacciones por rango de fechas y detalle individual.",
    capabilities: [
      "GET /payments por rango de fechas",
      "GET /payments/{payment_id} detalle individual",
      "GET /payments/receipt-no/{receipt_no} conciliación por recibo",
    ],
    limits: "Clip documenta filtros por periodo y conciliación por receipt_no.",
  },
  {
    key: "settlements",
    name: "API de Depósitos",
    status: "live",
    authHeader: "x-api-key",
    docsUrl: "https://developer.clip.mx/reference/api-de-dep%C3%B3sitos",
    summary: "Resume depósitos y permite revisar el detalle de cada settlement report.",
    capabilities: [
      "GET /settlements resumen por periodo",
      "GET /settlements/{settlement_report_id} detalle del reporte",
    ],
    limits: "Clip documenta consultas de hasta 90 días por periodo.",
  },
  {
    key: "checkout",
    name: "Checkout Redireccionado",
    status: "documented",
    authHeader: "Token Clip",
    docsUrl: "https://developer.clip.mx/reference/createnewpaymentlink",
    summary: "Crea links de pago hospedados por Clip y permite revisar su estado.",
    capabilities: [
      "POST crear nuevo payment link",
      "GET revisar estado del payment link",
      "Redirección al checkout hospedado",
    ],
    limits: "No se ejecuta automáticamente aquí porque crea recursos reales.",
  },
  {
    key: "refunds",
    name: "API de Reembolsos",
    status: "documented",
    authHeader: "Token Clip",
    docsUrl: "https://developer.clip.mx/reference/introduccion-api-de-reembolsos",
    summary: "Gestiona reembolsos de cobros existentes desde la API de Clip.",
    capabilities: [
      "Solicitar reembolso",
      "Conciliar contra la transacción original",
    ],
    limits: "Es una operación mutante y queda fuera del dashboard de solo lectura.",
  },
  {
    key: "webhooks",
    name: "Webhooks y Postback",
    status: "documented",
    authHeader: "Configuración backend",
    docsUrl: "https://developer.clip.mx/docs/conciliacion-de-transacciones-apis-1",
    summary: "Notifica estados de cobro y resultados de transacciones en tiempo real.",
    capabilities: [
      "Webhook de checkout",
      "Postback para cobros presenciales",
      "Conciliación por payment_request_id y receipt_no",
    ],
    limits: "Requiere endpoint backend público para recibir eventos.",
  },
  {
    key: "pinpad",
    name: "API de PinPad",
    status: "documented",
    authHeader: "Token Clip",
    docsUrl: "https://developer.clip.mx/docs/api-de-pinpad",
    summary: "Permite iniciar y administrar cobros en terminales físicas desde backend.",
    capabilities: [
      "Crear intento de pago",
      "Consultar detalle del pago",
      "Cancelar un pago iniciado",
    ],
    limits: "Diseñada para backend + terminal + webhook, no solo frontend.",
  },
];

class ClipApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ClipApiError";
    this.status = status;
  }
}

function buildClipUrl(baseUrl, path, searchParams = {}) {
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

async function clipFetch(baseUrl, path, { searchParams, authHeader = "Authorization", authToken } = {}) {
  if (!authToken) {
    throw new ClipApiError("Missing Clip auth token");
  }

  const url = buildClipUrl(baseUrl, path, searchParams);
  const headerCandidates = authHeader === "x-api-key"
    ? [
        { "x-api-key": authToken },
        { Authorization: authToken },
      ]
    : [
        { Authorization: authToken },
        { "x-api-key": authToken },
      ];

  let lastResponse = null;
  let lastErrorText = "";

  for (const authHeaders of headerCandidates) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        ...authHeaders,
      },
    });

    if (response.ok) {
      return response.json();
    }

    lastResponse = response;
    lastErrorText = await response.text();

    if (response.status !== 401 && response.status !== 403) {
      break;
    }
  }

  if (!lastResponse?.ok) {
    throw new ClipApiError(
      `Clip API error on ${path} ${lastResponse?.status || ""}: ${lastErrorText || lastResponse?.statusText || "Unknown error"}`.trim(),
      lastResponse?.status,
    );
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

function getDefaultSettlementsRange() {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 89);
  from.setUTCHours(0, 0, 0, 0);
  to.setUTCHours(23, 59, 59, 999);

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export async function getClipOverview(settings = {}) {
  const config = getClipResolvedConfig(settings);
  const paymentsRequestBaseUrl = getClipPaymentsRequestBaseUrl(config);
  const settlementsRequestBaseUrl = getClipSettlementsRequestBaseUrl(config);
  const paymentsRange = getDefaultPaymentsRange();
  const settlementsRange = getDefaultSettlementsRange();

  const [paymentsPayload, settlementsPayload] = await Promise.all([
    clipFetch(paymentsRequestBaseUrl, "payments", {
      searchParams: {
        from: paymentsRange.from,
        to: paymentsRange.to,
        size: 100,
      },
      authHeader: "Authorization",
      authToken: config.authToken,
    }),
    clipFetch(settlementsRequestBaseUrl, "settlements", {
      searchParams: {
        from: settlementsRange.from,
        to: settlementsRange.to,
      },
      authHeader: "x-api-key",
      authToken: config.authToken,
    }),
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

  const approvedPayments = payments.filter((payment) => {
    const status = String(payment.status || "").toLowerCase();
    return status.includes("approved") || status.includes("paid");
  });
  const refundedPayments = payments.filter((payment) => getAmount(payment.amount_refunded) > 0);
  const grossVolume = approvedPayments.reduce((sum, payment) => sum + getAmount(payment.amount), 0);
  const refundedVolume = payments.reduce((sum, payment) => sum + getAmount(payment.amount_refunded), 0);
  const tipsVolume = payments.reduce((sum, payment) => sum + getAmount(payment.tip_amount ?? payment.tip), 0);
  const netDeposits = settlements.reduce(
    (sum, settlement) => sum + getAmount(settlement.net_amount ?? settlement.net_total ?? settlement.amount_net),
    0,
  );
  const grossDeposits = settlements.reduce(
    (sum, settlement) => sum + getAmount(settlement.gross_amount ?? settlement.gross_total ?? settlement.amount_gross),
    0,
  );

  return {
    payments,
    settlements,
    raw: {
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
    metrics: {
      paymentsCount: payments.length,
      approvedPaymentsCount: approvedPayments.length,
      refundedPaymentsCount: refundedPayments.length,
      settlementsCount: settlements.length,
      grossVolume,
      refundedVolume,
      tipsVolume,
      grossDeposits,
      netDeposits,
      latestSyncAt: new Date().toISOString(),
    },
  };
}

export async function getClipPaymentDetails(paymentId, settings = {}) {
  if (!paymentId) {
    throw new ClipApiError("Missing Clip payment ID");
  }

  const config = getClipResolvedConfig(settings);
  const payload = await clipFetch(getClipPaymentsRequestBaseUrl(config), `payments/${paymentId}`, {
    authHeader: "Authorization",
    authToken: config.authToken,
  });

  return normalizeClipItem(payload);
}

export async function getClipPaymentByReceipt(receiptNo, settings = {}) {
  if (!receiptNo) {
    throw new ClipApiError("Missing Clip receipt number");
  }

  const config = getClipResolvedConfig(settings);
  const payload = await clipFetch(getClipPaymentsRequestBaseUrl(config), `payments/receipt-no/${receiptNo}`, {
    authHeader: "Authorization",
    authToken: config.authToken,
  });

  return normalizeClipItem(payload);
}

export async function getClipSettlementDetails(settlementReportId, settings = {}) {
  if (!settlementReportId) {
    throw new ClipApiError("Missing Clip settlement report ID");
  }

  const config = getClipResolvedConfig(settings);
  const payload = await clipFetch(getClipSettlementsRequestBaseUrl(config), `settlements/${settlementReportId}`, {
    authHeader: "x-api-key",
    authToken: config.authToken,
  });

  return normalizeClipItem(payload);
}