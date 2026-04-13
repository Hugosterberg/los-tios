/**
 * Client-side store for Daily Cash: opening float per day + manual adjustment lines.
 * Complements the API: opening balances without a dedicated server entity.
 */

const isBrowser = typeof window !== "undefined";
const STORAGE_KEY = "los_tios_daily_cash_store_v1";

const defaultStore = () => ({
  openings: {},
  manualLines: {},
  detailOverrides: {},
  openingDiffEvents: [],
});

function readRaw() {
  if (!isBrowser) return defaultStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    const p = JSON.parse(raw);
    return {
      openings: typeof p.openings === "object" && p.openings !== null ? p.openings : {},
      manualLines: typeof p.manualLines === "object" && p.manualLines !== null ? p.manualLines : {},
      detailOverrides:
        typeof p.detailOverrides === "object" && p.detailOverrides !== null ? p.detailOverrides : {},
      openingDiffEvents: Array.isArray(p.openingDiffEvents) ? p.openingDiffEvents : [],
    };
  } catch {
    return defaultStore();
  }
}

function writeRaw(store) {
  if (!isBrowser) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getOpeningBalance(dateKey) {
  const v = readRaw().openings[dateKey];
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Earliest day in a Mexico `yyyy-MM` month that has a saved opening balance.
 * Keys in storage match {@link getMexicoDateKey} (America/Mexico_City).
 * @param {string} yearMonthKey
 * @returns {{ dateKey: string, value: number } | null}
 */
export function getEarliestOpeningInMexicoMonth(yearMonthKey) {
  const prefix = String(yearMonthKey || "").trim();
  if (!/^\d{4}-\d{2}$/.test(prefix)) return null;
  const { openings } = readRaw();
  let bestKey = null;
  let bestVal = null;
  for (const [k, v] of Object.entries(openings)) {
    if (typeof k !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    if (k.slice(0, 7) !== prefix) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (bestKey === null || k < bestKey) {
      bestKey = k;
      bestVal = n;
    }
  }
  if (bestKey === null || bestVal === null) return null;
  return { dateKey: bestKey, value: bestVal };
}

export function setOpeningBalance(dateKey, value) {
  const store = readRaw();
  if (value === null || value === undefined || value === "") {
    delete store.openings[dateKey];
  } else {
    const n = Number(value);
    if (Number.isFinite(n)) {
      store.openings[dateKey] = n;
    }
  }
  writeRaw(store);
}

export function getManualLines(dateKey) {
  const lines = readRaw().manualLines[dateKey];
  return Array.isArray(lines) ? lines : [];
}

export function addManualLine(dateKey, line) {
  const store = readRaw();
  const list = Array.isArray(store.manualLines[dateKey]) ? [...store.manualLines[dateKey]] : [];
  list.push(line);
  store.manualLines[dateKey] = list;
  writeRaw(store);
}

export function removeManualLine(dateKey, id) {
  const store = readRaw();
  const list = Array.isArray(store.manualLines[dateKey]) ? store.manualLines[dateKey] : [];
  const next = list.filter((x) => x.id !== id);
  if (next.length === 0) {
    delete store.manualLines[dateKey];
  } else {
    store.manualLines[dateKey] = next;
  }
  writeRaw(store);
}

/** Per-day labels for ledger rows that only exist client-side (e.g. Loyverse detail text). */
export function getDetailOverrides(dateKey) {
  const raw = readRaw().detailOverrides?.[dateKey];
  return raw && typeof raw === "object" ? { ...raw } : {};
}

export function setDetailOverride(dateKey, rowId, value) {
  const store = readRaw();
  if (!store.detailOverrides) {
    store.detailOverrides = {};
  }
  if (!store.detailOverrides[dateKey]) {
    store.detailOverrides[dateKey] = {};
  }
  const trimmed = value === null || value === undefined ? "" : String(value).trim();
  if (trimmed === "") {
    delete store.detailOverrides[dateKey][rowId];
    if (Object.keys(store.detailOverrides[dateKey]).length === 0) {
      delete store.detailOverrides[dateKey];
    }
  } else {
    store.detailOverrides[dateKey][rowId] = trimmed;
  }
  writeRaw(store);
}

export function updateManualLine(dateKey, lineId, patch) {
  const store = readRaw();
  const list = Array.isArray(store.manualLines[dateKey]) ? [...store.manualLines[dateKey]] : [];
  const idx = list.findIndex((x) => x.id === lineId);
  if (idx === -1) {
    return;
  }
  list[idx] = { ...list[idx], ...patch };
  store.manualLines[dateKey] = list;
  writeRaw(store);
}

const OPENING_DIFF_CAP = 250;

/**
 * When the counted opening for `dateKey` differs from the ledger-implied prior drawer close.
 * @param {{ dateKey: string, priorCloseDayStr: string, expectedEnd: number, enteredOpening: number, diff: number }} payload
 */
export function recordOpeningCountDiff(payload) {
  const { dateKey, priorCloseDayStr, expectedEnd, enteredOpening, diff } = payload;
  if (!dateKey || !priorCloseDayStr) return;
  if (![expectedEnd, enteredOpening, diff].every((x) => typeof x === "number" && Number.isFinite(x))) return;
  const store = readRaw();
  if (!Array.isArray(store.openingDiffEvents)) {
    store.openingDiffEvents = [];
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  store.openingDiffEvents.unshift({
    id,
    ts: new Date().toISOString(),
    dateKey,
    priorCloseDayStr,
    expectedEnd,
    enteredOpening,
    diff,
  });
  if (store.openingDiffEvents.length > OPENING_DIFF_CAP) {
    store.openingDiffEvents.length = OPENING_DIFF_CAP;
  }
  writeRaw(store);
}

/** Newest first */
export function listOpeningCountDiffs() {
  const ev = readRaw().openingDiffEvents;
  return Array.isArray(ev) ? [...ev] : [];
}
