import { buildRevolutResolvedConfig } from "@/lib/integrationSettings";
import { base44 } from "@/api/base44Client";

export const REVOLUT_PRODUCTION_API_BASE_URL = "https://b2b.revolut.com/api/1.0";
export const REVOLUT_SANDBOX_API_BASE_URL = "https://sandbox-b2b.revolut.com/api/1.0";

const DEFAULT_REVOLUT_BASE_URL = REVOLUT_PRODUCTION_API_BASE_URL;

export function getRevolutResolvedConfig(settings = {}) {
  const c = buildRevolutResolvedConfig(settings);
  return {
    ...c,
    baseUrl: c.baseUrl || DEFAULT_REVOLUT_BASE_URL,
  };
}

/** True when settings target Revolut Business API sync (not a personal-only acknowledgement). */
export function isRevolutPersonalMode(settings = {}) {
  return getRevolutResolvedConfig(settings).connectionType === "personal";
}

/**
 * True when we should call the Business API: Business account type and a non-empty access token.
 * Personal Revolut is not supported by b2b.revolut.com — returns false.
 */
export function hasRevolutApiConfig(settings = {}) {
  const c = getRevolutResolvedConfig(settings);
  if (c.connectionType === "personal") return false;
  return Boolean(c.accessToken);
}

class RevolutApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "RevolutApiError";
    this.status = status;
  }
}

function isSandboxBaseUrl(baseUrl) {
  return String(baseUrl || "").toLowerCase().includes("sandbox-b2b");
}

/**
 * Build fetch URL. In dev, Vite proxies /api/revolut and /api/revolut-sandbox (see vite.config.js).
 */
function buildBrowserUrl(config, path, searchParams = {}) {
  const root = config.baseUrl.replace(/\/$/, "");
  const rel = path.startsWith("/") ? path : `/${path}`;
  const full = `${root}${rel}`;
  const u = new URL(full);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      u.searchParams.set(key, String(value));
    }
  });
  if (!import.meta.env.DEV) {
    return u.toString();
  }
  const prefix = isSandboxBaseUrl(config.baseUrl) ? "/api/revolut-sandbox" : "/api/revolut";
  const strippedPath = u.pathname.replace(/^\/api/, "");
  return `${prefix}${strippedPath}${u.search}`;
}

/**
 * Path is relative to API root (e.g. `accounts`, `transactions`).
 */
export async function revolutApiRequest(method, path, { searchParams = {}, settings = {} } = {}) {
  const config = getRevolutResolvedConfig(settings);
  if (config.connectionType === "personal") {
    throw new RevolutApiError(
      "Personal Revolut is selected: this app only calls Revolut’s Business API (b2b.revolut.com). Change account type to Business after migration, or keep Personal for manual tracking.",
      400,
    );
  }
  if (!config.accessToken) {
    throw new RevolutApiError("Missing Revolut access token (READ scope). Obtain one via Revolut Business → APIs → Business API.", 400);
  }

  const normalizedPath = String(path || "").replace(/^\//, "");

  if (import.meta.env.DEV) {
    const url = buildBrowserUrl(config, `/${normalizedPath}`, searchParams);
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        Accept: "application/json",
      },
    });
    const text = await response.text();
    if (!response.ok) {
      throw new RevolutApiError(`Revolut API error ${response.status}: ${text || response.statusText}`, response.status);
    }
    return text ? JSON.parse(text) : null;
  }

  const response = await base44.functions.invoke("revolutProxy", {
    method,
    path: normalizedPath,
    searchParams,
    accessToken: config.accessToken,
    baseUrl: config.baseUrl,
  });

  if (response.data?.error) {
    throw new RevolutApiError(response.data.error);
  }

  return response.data;
}

/** @returns {Promise<Array>} */
export async function fetchRevolutAccounts(settings) {
  const data = await revolutApiRequest("GET", "accounts", { settings });
  return Array.isArray(data) ? data : [];
}

/**
 * @param {object} options
 * @param {string} [options.from] ISO date or datetime
 * @param {string} [options.to] ISO date or datetime
 * @param {string} [options.account] Account UUID
 * @param {number} [options.count] Max 1000
 */
export async function fetchRevolutTransactions(settings, options = {}) {
  const { from, to, account, count = 100 } = options;
  const searchParams = {};
  if (from) searchParams.from = from;
  if (to) searchParams.to = to;
  if (account) searchParams.account = account;
  if (count) searchParams.count = String(Math.min(1000, Math.max(1, count)));

  const data = await revolutApiRequest("GET", "transactions", { settings, searchParams });
  return Array.isArray(data) ? data : [];
}

/**
 * Accounts + recent transactions for Integrations preview.
 */
export async function getRevolutIntegrationPreview(settings) {
  const accounts = await fetchRevolutAccounts(settings);
  const accountId = getRevolutResolvedConfig(settings).accountId;
  const to = new Date().toISOString();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const from = fromDate.toISOString().slice(0, 10);

  const transactions = await fetchRevolutTransactions(settings, {
    from,
    to,
    account: accountId || undefined,
    count: 100,
  });

  return {
    accounts,
    transactions,
    meta: {
      accountFilter: accountId || null,
      from,
      to,
    },
  };
}

/** Summarise transaction legs (amount per currency) for display lists. */
export function formatRevolutLegsSummary(tx) {
  const legs = Array.isArray(tx?.legs) ? tx.legs : [];
  if (!legs.length) return "—";
  return legs
    .map((leg) => {
      const amt = Number(leg.amount ?? 0);
      const cur = leg.currency || "";
      return `${amt.toFixed(2)} ${cur}`.trim();
    })
    .join(" · ");
}
