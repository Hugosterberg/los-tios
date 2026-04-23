// @ts-nocheck
/**
 * One-shot migration: legacy `openingDiffEvents` inside Daily Cash JSON → Base44 `ManualCashCount` rows,
 * then strip that array from the in-memory store and persist `DailyCashLedger` without embedded events.
 *
 * Safe to call multiple times: if the table already has rows, only the legacy blob is cleared and flushed.
 */

import {
  clearOpeningDiffEventsFromStore,
  flushDailyCashPersistImmediate,
  getDailyCashPersistenceMode,
  peekOpeningDiffEventsFromStoreBlob,
} from "@/lib/dailyCashLocal";
import {
  MANUAL_CASH_COUNTS_QUERY_KEY,
  createManualCashCountRow,
  listManualCashCountRows,
  manualCountPayloadToCreateBody,
} from "@/lib/manualCashCountRepository";

/** @type {Promise<Record<string, unknown>> | null} */
let inFlightMigration = null;

/** Cool-down so a failing `ManualCashCount.create` (e.g. missing entity) does not hammer Base44 every React render. */
let lastRowCreateFailureAt = 0;
const CREATE_FAILURE_COOLDOWN_MS = 60_000;

/**
 * @param {import("@tanstack/react-query").QueryClient} queryClient
 * @returns {Promise<{ ok: boolean; migratedRows: number; clearedLegacyBlob?: boolean; reason?: string }>}
 */
export async function migrateLegacyManualCountBlobToBase44(queryClient) {
  if (getDailyCashPersistenceMode() !== "remote") {
    return { ok: true, migratedRows: 0, reason: "not_remote" };
  }
  if (inFlightMigration) {
    return inFlightMigration;
  }
  inFlightMigration = runLegacyManualCountMigration(queryClient).finally(() => {
    inFlightMigration = null;
  });
  return inFlightMigration;
}

/**
 * @param {import("@tanstack/react-query").QueryClient} queryClient
 */
async function runLegacyManualCountMigration(queryClient) {
  const legacy = peekOpeningDiffEventsFromStoreBlob();
  if (legacy.length === 0) {
    return { ok: true, migratedRows: 0 };
  }

  const existing = await listManualCashCountRows();
  if (existing === null) {
    return { ok: false, migratedRows: 0, reason: "manual_count_list_failed" };
  }

  /* Table already populated (e.g. another device migrated): drop duplicate-prone blob only and persist. */
  if (existing.length > 0) {
    clearOpeningDiffEventsFromStore();
    try {
      await flushDailyCashPersistImmediate();
    } catch (e) {
      console.error("[manualCashCount] flush after clearing legacy blob failed", e);
      return { ok: false, migratedRows: 0, reason: "flush_failed" };
    }
    await queryClient.invalidateQueries({ queryKey: MANUAL_CASH_COUNTS_QUERY_KEY });
    return { ok: true, migratedRows: 0, clearedLegacyBlob: true };
  }

  if (Date.now() - lastRowCreateFailureAt < CREATE_FAILURE_COOLDOWN_MS && lastRowCreateFailureAt > 0) {
    return { ok: false, migratedRows: 0, reason: "throttled_after_create_failure" };
  }

  const sorted = [...legacy].sort((a, b) => new Date(a?.ts || 0).getTime() - new Date(b?.ts || 0).getTime());
  const idMap = new Map();
  try {
    for (const ev of sorted) {
      const prev = ev.previousManualCountId;
      const body = manualCountPayloadToCreateBody({
        dateKey: ev.dateKey,
        ts: ev.ts,
        priorCloseDayStr: ev.priorCloseDayStr,
        expectedEnd: ev.expectedEnd,
        enteredOpening: Number(ev.enteredOpening),
        diff: ev.diff,
        comment: ev.comment,
        expectedSourceLabel: ev.expectedSourceLabel,
        previousManualCountId: typeof prev === "string" && prev ? idMap.get(prev) || "" : "",
        previousManualCountDateKey: ev.previousManualCountDateKey,
        previousManualCountTs: ev.previousManualCountTs,
      });
      const row = await createManualCashCountRow(body);
      if (ev?.id && row?.id) idMap.set(ev.id, row.id);
    }
  } catch (e) {
    lastRowCreateFailureAt = Date.now();
    console.error("[manualCashCount] legacy → ManualCashCount row create failed", e);
    return { ok: false, migratedRows: 0, reason: "create_failed" };
  }

  lastRowCreateFailureAt = 0;
  clearOpeningDiffEventsFromStore();
  try {
    await flushDailyCashPersistImmediate();
  } catch (e) {
    console.error("[manualCashCount] flush after migrating rows failed", e);
    return { ok: false, migratedRows: 0, reason: "flush_failed" };
  }

  await queryClient.invalidateQueries({ queryKey: MANUAL_CASH_COUNTS_QUERY_KEY });
  return { ok: true, migratedRows: sorted.length };
}
