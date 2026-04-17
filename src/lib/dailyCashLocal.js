/**
 * Daily Cash store: opening float per day, manual adjustment lines, opening count history.
 * In production this syncs to AppSettings.daily_cash_store_json; local dev can use localStorage only.
 */

const isBrowser = typeof window !== "undefined";
const STORAGE_KEY = "los_tios_daily_cash_store_v1";
const PERSIST_DEBOUNCE_MS = 650;

/** @type {"none" | "localStorage" | "remote"} */
let persistenceMode = "none";
/** @type {null | ((json: string) => Promise<void>)} */
let persistFn = null;
let persistDebounceTimer = null;

const defaultStore = () => ({
  openings: {},
  openingCountMeta: {},
  manualLines: {},
  detailOverrides: {},
  openingDiffEvents: [],
});

/** @type {ReturnType<typeof defaultStore>} */
let internalStore = defaultStore();

function normalizeParsed(p) {
  if (!p || typeof p !== "object") return defaultStore();
  return {
    openings: typeof p.openings === "object" && p.openings !== null ? p.openings : {},
    openingCountMeta:
      typeof p.openingCountMeta === "object" && p.openingCountMeta !== null ? p.openingCountMeta : {},
    manualLines: typeof p.manualLines === "object" && p.manualLines !== null ? p.manualLines : {},
    detailOverrides:
      typeof p.detailOverrides === "object" && p.detailOverrides !== null ? p.detailOverrides : {},
    openingDiffEvents: Array.isArray(p.openingDiffEvents) ? p.openingDiffEvents : [],
  };
}

function readLocalStorageStore() {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeParsed(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalStorageStore(store) {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

function clearLocalStorageStore() {
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function hasMeaningfulData(s) {
  if (!s) return false;
  if (Object.keys(s.openings || {}).length > 0) return true;
  if (Object.keys(s.openingCountMeta || {}).length > 0) return true;
  for (const v of Object.values(s.manualLines || {})) {
    if (Array.isArray(v) && v.length > 0) return true;
  }
  if (Object.keys(s.detailOverrides || {}).length > 0) return true;
  if (Array.isArray(s.openingDiffEvents) && s.openingDiffEvents.length > 0) return true;
  return false;
}

function parseServerJson(str) {
  const t = String(str || "").trim();
  if (!t) return null;
  try {
    return normalizeParsed(JSON.parse(t));
  } catch {
    return null;
  }
}

function scheduleRemotePersist() {
  if (persistenceMode !== "remote" || !persistFn || !isBrowser) return;
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = setTimeout(() => {
    persistDebounceTimer = null;
    const json = JSON.stringify(internalStore);
    Promise.resolve(persistFn(json)).catch((err) => {
      console.error("[dailyCash] persist failed", err);
    });
  }, PERSIST_DEBOUNCE_MS);
}

function readRaw() {
  return internalStore;
}

function writeRaw(store) {
  internalStore = store;
  if (!isBrowser) return;
  if (persistenceMode === "localStorage") {
    writeLocalStorageStore(store);
  } else if (persistenceMode === "remote") {
    scheduleRemotePersist();
  }
}

/** Local-only dev: read/write the legacy localStorage key. */
export function initDailyCashPersistenceLocal() {
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = null;
  persistFn = null;
  persistenceMode = "localStorage";
  internalStore = readLocalStorageStore() || defaultStore();
}

/**
 * Remote mode: hydrate from `daily_cash_store_json`, migrate legacy localStorage once if server empty.
 * @param {string} serverJson
 * @param {(json: string) => Promise<void>} persistAsync
 * @returns {{ migrated: boolean }}
 */
export function initDailyCashPersistenceRemote(serverJson, persistAsync) {
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = null;
  persistenceMode = "remote";
  persistFn = persistAsync;

  const fromServer = parseServerJson(serverJson);
  const fromLs = readLocalStorageStore();
  let migrated = false;

  if (hasMeaningfulData(fromServer)) {
    internalStore = fromServer;
    clearLocalStorageStore();
  } else if (hasMeaningfulData(fromLs)) {
    internalStore = fromLs;
    migrated = true;
  } else {
    internalStore = defaultStore();
    clearLocalStorageStore();
  }

  return { migrated };
}

/** Flush current store to the server (no debounce). Call after migration. */
export async function flushDailyCashPersistImmediate() {
  if (persistenceMode !== "remote" || !persistFn || !isBrowser) return;
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = null;
  const json = JSON.stringify(internalStore);
  await persistFn(json);
  clearLocalStorageStore();
}

export function disposeDailyCashPersistence() {
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = null;
  persistFn = null;
  persistenceMode = "none";
  internalStore = defaultStore();
}

export function getOpeningBalance(dateKey) {
  const v = readRaw().openings[dateKey];
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function getOpeningCountMeta(dateKey) {
  const raw = readRaw().openingCountMeta?.[dateKey];
  return raw && typeof raw === "object" ? { ...raw } : null;
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
    delete store.openingCountMeta[dateKey];
  } else {
    const n = Number(value);
    if (Number.isFinite(n)) {
      store.openings[dateKey] = n;
      store.openingCountMeta[dateKey] = {
        updatedAt: new Date().toISOString(),
      };
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
 * Manual count history for the opening cash drawer.
 * @param {{ dateKey: string, priorCloseDayStr?: string | null, expectedEnd: number | null, enteredOpening: number, diff: number | null, comment?: string }} payload
 */
export function recordOpeningCountDiff(payload) {
  const { dateKey, priorCloseDayStr, expectedEnd, enteredOpening, diff } = payload;
  const comment = typeof payload.comment === "string" ? payload.comment.trim() : "";
  if (!dateKey) return;
  if (typeof enteredOpening !== "number" || !Number.isFinite(enteredOpening)) return;
  if (expectedEnd !== null && (typeof expectedEnd !== "number" || !Number.isFinite(expectedEnd))) return;
  if (diff !== null && (typeof diff !== "number" || !Number.isFinite(diff))) return;
  const store = readRaw();
  if (!Array.isArray(store.openingDiffEvents)) {
    store.openingDiffEvents = [];
  }
  if (!store.openingCountMeta || typeof store.openingCountMeta !== "object") {
    store.openingCountMeta = {};
  }
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const ts = new Date().toISOString();
  store.openings[dateKey] = enteredOpening;
  store.openingCountMeta[dateKey] = { updatedAt: ts };
  store.openingDiffEvents.unshift({
    id,
    ts,
    dateKey,
    priorCloseDayStr: priorCloseDayStr || null,
    expectedEnd,
    enteredOpening,
    diff,
    comment,
  });
  if (store.openingDiffEvents.length > OPENING_DIFF_CAP) {
    store.openingDiffEvents.length = OPENING_DIFF_CAP;
  }
  writeRaw(store);
}

function syncOpeningFromLatestDiff(store, dateKey) {
  const latest = (Array.isArray(store.openingDiffEvents) ? store.openingDiffEvents : [])
    .filter((ev) => ev?.dateKey === dateKey && Number.isFinite(Number(ev.enteredOpening)))
    .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())[0];
  if (latest) {
    store.openings[dateKey] = Number(latest.enteredOpening);
    store.openingCountMeta[dateKey] = { updatedAt: latest.ts };
  } else {
    delete store.openings[dateKey];
    delete store.openingCountMeta[dateKey];
  }
}

export function removeOpeningCountDiff(id) {
  const store = readRaw();
  const list = Array.isArray(store.openingDiffEvents) ? store.openingDiffEvents : [];
  const removed = list.find((ev) => ev?.id === id);
  if (!removed) return;
  store.openingDiffEvents = list.filter((ev) => ev?.id !== id);
  if (!store.openingCountMeta || typeof store.openingCountMeta !== "object") {
    store.openingCountMeta = {};
  }
  syncOpeningFromLatestDiff(store, removed.dateKey);
  writeRaw(store);
}

export function updateOpeningCountDiffComment(id, comment) {
  const store = readRaw();
  const list = Array.isArray(store.openingDiffEvents) ? [...store.openingDiffEvents] : [];
  const idx = list.findIndex((ev) => ev?.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], comment: typeof comment === "string" ? comment.trim() : "" };
  store.openingDiffEvents = list;
  writeRaw(store);
}

/** Newest first */
export function listOpeningCountDiffs() {
  const ev = readRaw().openingDiffEvents;
  return Array.isArray(ev) ? [...ev] : [];
}
