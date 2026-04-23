import { base44 } from "@/api/base44Client";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";

/**
 * Base44 `functions.invoke` usually returns `{ data: ... }` where `data` is the Edge Function JSON body.
 * Some call sites incorrectly used `res.data.results` (Notion puts `results` on the root of that body).
 */
function unwrapInvokeResponse(raw) {
  if (raw != null && typeof raw === "object" && "data" in raw && raw.data !== undefined) {
    return raw.data;
  }
  return raw;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHttpStatus(error) {
  return (
    error?.response?.status ??
    error?.status ??
    (typeof error?.response?.data?.status === "number" ? error.response.data.status : undefined)
  );
}

function isNotionRateLimited(error) {
  const status = getHttpStatus(error);
  if (status === 429) return true;
  /** Only match explicit 429 in message — avoid retrying unrelated errors that mention "rate". */
  return /\b429\b|status code 429/i.test(String(error?.message || ""));
}

function retryAfterMsFromError(error) {
  const h = error?.response?.headers?.["retry-after"] ?? error?.response?.headers?.["Retry-After"];
  if (h == null || h === "") return null;
  const sec = Number(h);
  if (Number.isFinite(sec) && sec >= 0) {
    return Math.min(sec * 1000, 120_000);
  }
  return null;
}

/**
 * Calls notionProxy with optional internal integration token from saved app settings / env.
 * Token priority on the server: OAuth (Base44) → notionInternalToken from this call → NOTION_INTEGRATION_TOKEN env.
 *
 * Retries on HTTP 429 (Notion rate limits) with Retry-After or exponential backoff.
 *
 * @returns {Promise<object>} Parsed Notion API response body (e.g. `{ results, has_more, next_cursor }` for search).
 */
export async function invokeNotionProxy(payload, integrationSettings = {}) {
  const merged = getResolvedIntegrationSettings(integrationSettings);
  const token =
    typeof merged.notion_internal_token === "string" ? merged.notion_internal_token.trim() : "";
  const body = {
    ...payload,
    ...(token ? { notionInternalToken: token } : {}),
  };

  const maxAttempts = 6;
  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const raw = await base44.functions.invoke("notionProxy", body);
      const data = unwrapInvokeResponse(raw);

      if (data && typeof data === "object" && data.error) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || JSON.stringify(data.error);
        const err = /** @type {any} */ (new Error(msg));
        err.response = { data, status: raw?.status };
        throw err;
      }

      return data;
    } catch (e) {
      lastError = e;
      if (!isNotionRateLimited(e) || attempt === maxAttempts - 1) {
        throw e;
      }
      const fromHeader = retryAfterMsFromError(e);
      const backoff = fromHeader ?? Math.min(45_000, 1500 * 2 ** attempt + Math.random() * 400);
      await sleep(backoff);
    }
  }

  throw lastError;
}
