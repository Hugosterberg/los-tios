// @ts-nocheck
/**
 * One Base44 row per saved manual drawer count — not embedded in DailyCashLedger JSON.
 * Create entity **ManualCashCount** in Base44 (see `base44/entities/ManualCashCount.jsonc`).
 */

import { base44 } from "@/api/base44Client";

export const MANUAL_CASH_COUNTS_QUERY_KEY = ["manualCashCounts"];

/** @param {Record<string, unknown>} row */
export function manualCashCountRowToEvent(row) {
  if (!row || typeof row !== "object") return null;
  const hasExpected =
    row.has_expected_end === false
      ? false
      : typeof row.expected_end === "number" && Number.isFinite(row.expected_end);
  const hasDiff =
    row.has_diff === false ? false : typeof row.diff === "number" && Number.isFinite(row.diff);
  const expectedRaw = row.expected_end;
  const diffRaw = row.diff;
  return {
    id: row.id,
    ts: typeof row.logged_at_utc === "string" ? row.logged_at_utc : "",
    dateKey: typeof row.count_day === "string" ? row.count_day : "",
    priorCloseDayStr: row.prior_close_day_str || null,
    expectedEnd: hasExpected && typeof expectedRaw === "number" && Number.isFinite(expectedRaw) ? expectedRaw : null,
    enteredOpening: Number(row.entered_opening),
    diff: hasDiff && typeof diffRaw === "number" && Number.isFinite(diffRaw) ? diffRaw : null,
    comment: typeof row.comment === "string" ? row.comment : "",
    expectedSourceLabel: typeof row.expected_source_label === "string" ? row.expected_source_label : "",
    previousManualCountId: row.previous_manual_count_id || null,
    previousManualCountDateKey: row.previous_manual_count_date_key || null,
    previousManualCountTs: row.previous_manual_count_ts || null,
  };
}

/**
 * @param {{
 *   dateKey: string;
 *   ts: string;
 *   priorCloseDayStr?: string | null;
 *   expectedEnd: number | null;
 *   enteredOpening: number;
 *   diff: number | null;
 *   comment?: string;
 *   expectedSourceLabel?: string;
 *   previousManualCountId?: string | null;
 *   previousManualCountDateKey?: string | null;
 *   previousManualCountTs?: string | null;
 * }} payload
 */
export function manualCountPayloadToCreateBody(payload) {
  const expectedEnd = payload.expectedEnd;
  const diff = payload.diff;
  const hasExpected = expectedEnd !== null && typeof expectedEnd === "number" && Number.isFinite(expectedEnd);
  const hasDiff = diff !== null && typeof diff === "number" && Number.isFinite(diff);
  /** @type {Record<string, unknown>} */
  const body = {
    count_day: payload.dateKey,
    logged_at_utc: payload.ts,
    entered_opening: payload.enteredOpening,
    has_expected_end: hasExpected,
    has_diff: hasDiff,
    comment: typeof payload.comment === "string" ? payload.comment.trim() : "",
    expected_source_label:
      typeof payload.expectedSourceLabel === "string" ? payload.expectedSourceLabel.trim() : "",
  };
  if (hasExpected) body.expected_end = expectedEnd;
  if (hasDiff) body.diff = diff;
  const pClose = payload.priorCloseDayStr;
  if (typeof pClose === "string" && pClose.trim()) body.prior_close_day_str = pClose.trim();
  const prevId = payload.previousManualCountId;
  if (typeof prevId === "string" && prevId.trim()) body.previous_manual_count_id = prevId.trim();
  const prevDk = payload.previousManualCountDateKey;
  if (typeof prevDk === "string" && prevDk.trim()) body.previous_manual_count_date_key = prevDk.trim();
  const prevTs = payload.previousManualCountTs;
  if (typeof prevTs === "string" && prevTs.trim()) body.previous_manual_count_ts = prevTs.trim();
  return body;
}

/**
 * @param {{
 *   countDayMexico: string;
 *   loggedAtUtc: string;
 *   priorCloseDayStr?: string | null;
 *   expectedEnd: number | null;
 *   diff: number | null;
 *   expectedSourceLabel?: string;
 *   previousManualCountId?: string | null;
 *   previousManualCountDateKey?: string | null;
 *   previousManualCountTs?: string | null;
 * }} p
 */
export function manualCountRowUpdateFromExpectation(p) {
  const hasExpected = p.expectedEnd !== null && typeof p.expectedEnd === "number" && Number.isFinite(p.expectedEnd);
  const hasDiff = p.diff !== null && typeof p.diff === "number" && Number.isFinite(p.diff);
  /** @type {Record<string, unknown>} */
  const patch = {
    count_day: p.countDayMexico,
    logged_at_utc: p.loggedAtUtc,
    has_expected_end: hasExpected,
    has_diff: hasDiff,
    expected_source_label:
      typeof p.expectedSourceLabel === "string" ? p.expectedSourceLabel.trim() : "",
  };
  if (hasExpected) patch.expected_end = p.expectedEnd;
  if (hasDiff) patch.diff = p.diff;
  const pClose = p.priorCloseDayStr;
  if (typeof pClose === "string" && pClose.trim()) patch.prior_close_day_str = pClose.trim();
  const prevId = p.previousManualCountId;
  if (typeof prevId === "string" && prevId.trim()) patch.previous_manual_count_id = prevId.trim();
  const prevDk = p.previousManualCountDateKey;
  if (typeof prevDk === "string" && prevDk.trim()) patch.previous_manual_count_date_key = prevDk.trim();
  const prevTs = p.previousManualCountTs;
  if (typeof prevTs === "string" && prevTs.trim()) patch.previous_manual_count_ts = prevTs.trim();
  return patch;
}

export async function listManualCashCountRows() {
  try {
    const rows = await base44.entities.ManualCashCount.list("-created_date");
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.warn(
      "[manualCashCount] ManualCashCount.list failed — create the entity in Base44 or check permissions:",
      err,
    );
    return null;
  }
}

/**
 * @param {ReturnType<typeof manualCountPayloadToCreateBody>} body
 */
export async function createManualCashCountRow(body) {
  return base44.entities.ManualCashCount.create(body);
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} patch
 */
export async function updateManualCashCountRow(id, patch) {
  return base44.entities.ManualCashCount.update(id, patch);
}

export async function deleteManualCashCountRow(id) {
  return base44.entities.ManualCashCount.delete(id);
}
