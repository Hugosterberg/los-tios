import { base44 } from "@/api/base44Client";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";

/**
 * Calls notionProxy with optional internal integration token from saved app settings / env.
 * Token priority on the server: OAuth (Base44) → notionInternalToken from this call → NOTION_INTEGRATION_TOKEN env.
 */
export async function invokeNotionProxy(payload, integrationSettings = {}) {
  const merged = getResolvedIntegrationSettings(integrationSettings);
  const token =
    typeof merged.notion_internal_token === "string" ? merged.notion_internal_token.trim() : "";
  if (token) {
    return base44.functions.invoke("notionProxy", { ...payload, notionInternalToken: token });
  }
  return base44.functions.invoke("notionProxy", payload);
}
