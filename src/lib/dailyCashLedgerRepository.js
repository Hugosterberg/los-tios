// @ts-nocheck
/**
 * Daily Cash persistence on its own Base44 entity (no longer mixed into AppSettings writes).
 *
 * ## Base44 — create entity `DailyCashLedger`
 *
 * Add a collection/entity named exactly **`DailyCashLedger`** with at least:
 *
 * | Field | Type | Required | Notes |
 * |-------|------|----------|--------|
 * | `ledger_payload_json` | Long text / string | yes | Full JSON: same object shape as legacy `AppSettings.daily_cash_store_json` (`openings`, `openingCountMeta`, `manualLines`, `detailOverrides`, `ledgerTimeOverrides`, `openingDiffEvents`). |
 *
 * The app uses **`list('-created_date')` and takes the first row** as the active ledger document.
 * For a single-tenant app, keep **one row** (create empty `{...}` payload or migrate legacy JSON here).
 *
 * ## Migrating from AppSettings
 *
 * 1. Copy the string from `AppSettings.daily_cash_store_json` into `ledger_payload_json` on a new `DailyCashLedger` row (or use Base44 import).
 * 2. Deploy this frontend; it reads **ledger first**, then legacy AppSettings if the ledger is empty.
 * 3. After the app has saved at least once, you may clear `daily_cash_store_json` on App Settings in Base44 (optional).
 */

import { base44 } from "@/api/base44Client";
import { dailyCashStoreJsonStringHasMeaningfulData } from "@/lib/dailyCashLocal";

export const DAILY_CASH_LEDGER_QUERY_KEY = ["dailyCashLedger"];

export const DAILY_CASH_LEDGER_PAYLOAD_FIELD = "ledger_payload_json";

/**
 * Prefer dedicated ledger row; fall back to legacy AppSettings blob.
 * @param {Record<string, unknown> | null | undefined} ledgerRow
 * @param {Record<string, unknown> | null | undefined} appSettingsRow
 * @returns {string}
 */
export function pickDailyCashHydrationJsonString(ledgerRow, appSettingsRow) {
  const lj = ledgerRow?.[DAILY_CASH_LEDGER_PAYLOAD_FIELD];
  if (typeof lj === "string" && dailyCashStoreJsonStringHasMeaningfulData(lj)) {
    return lj;
  }
  const legacy = appSettingsRow?.daily_cash_store_json;
  return typeof legacy === "string" ? legacy : "";
}

/**
 * @returns {Promise<any[]>}
 */
export async function listDailyCashLedgerRows() {
  try {
    const rows = await base44.entities.DailyCashLedger.list("-created_date");
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn(
      "[dailyCashLedger] DailyCashLedger.list failed — create the entity in Base44 or check permissions:",
      err,
    );
    return [];
  }
}

/**
 * @param {{
 *   json: string;
 *   ledgerRowId: string | null;
 *   settingsRowId: string | null;
 *   queryClient: import("@tanstack/react-query").QueryClient;
 * }} args
 */
export async function persistDailyCashLedgerPayload({ json, ledgerRowId, settingsRowId, queryClient }) {
  const ledger = base44.entities.DailyCashLedger;
  try {
    if (ledgerRowId) {
      await ledger.update(ledgerRowId, { [DAILY_CASH_LEDGER_PAYLOAD_FIELD]: json });
      queryClient.setQueryData(DAILY_CASH_LEDGER_QUERY_KEY, (prev) => {
        if (!Array.isArray(prev) || !prev.length) {
          return [{ id: ledgerRowId, [DAILY_CASH_LEDGER_PAYLOAD_FIELD]: json }];
        }
        return prev.map((r) =>
          r?.id === ledgerRowId ? { ...r, [DAILY_CASH_LEDGER_PAYLOAD_FIELD]: json } : r,
        );
      });
      return;
    }
    const created = await ledger.create({ [DAILY_CASH_LEDGER_PAYLOAD_FIELD]: json });
    queryClient.setQueryData(DAILY_CASH_LEDGER_QUERY_KEY, [created]);
  } catch (err) {
    if (!settingsRowId) {
      console.error("[dailyCashLedger] persist failed and no AppSettings row for fallback", err);
      throw err;
    }
    console.warn("[dailyCashLedger] persist to DailyCashLedger failed — falling back to AppSettings", err);
    await base44.entities.AppSettings.update(settingsRowId, {
      daily_cash_store_json: json,
    });
    queryClient.setQueryData(["appSettings"], (prev) => {
      if (!prev?.length) return prev;
      const first = prev[0];
      if (first?.id !== settingsRowId) return prev;
      return [{ ...first, daily_cash_store_json: json }, ...prev.slice(1)];
    });
  }
}
