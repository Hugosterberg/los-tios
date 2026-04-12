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

/**
 * Calls notionProxy with optional internal integration token from saved app settings / env.
 * Token priority on the server: OAuth (Base44) → notionInternalToken from this call → NOTION_INTEGRATION_TOKEN env.
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

  const raw = await base44.functions.invoke("notionProxy", body);
  const data = unwrapInvokeResponse(raw);

  if (data && typeof data === "object" && data.error) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : data.error?.message || JSON.stringify(data.error);
    const err = new Error(msg);
    err.response = { data };
    throw err;
  }

  return data;
}
