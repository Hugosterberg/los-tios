/**
 * Daily Cash store: opening float per day, manual adjustment lines, opening count history.
 * In production this syncs to the `DailyCashLedger` Base44 entity (`ledger_payload_json`);
 * `AppSettings.daily_cash_store_json` is only a legacy read fallback until you migrate rows.
 * Local dev without backend uses localStorage only.
 */

import { isPlainDateKey, mexicoWallDateTimeToUtcIso } from "@/lib/mexicoTime";

const isBrowser = typeof window !== "undefined";
const STORAGE_KEY = "los_tios_daily_cash_store_v1";
const PERSIST_DEBOUNCE_MS = 650;

/** @type {"none" | "localStorage" | "remote"} */
let persistenceMode = "none";
/** @type {null | ((json: string) => Promise<void>)} */
let persistFn = null;
let persistDebounceTimer = null;

/** Settled after every remote AppSettings write started from this module (flush + debounced persist). */
let remotePersistIdle = Promise.resolve();

function chainRemotePersistPromise(p) {
  remotePersistIdle = remotePersistIdle.then(() => p).catch(() => {});
}

/** Wait for in-flight remote persists so the next page does not hydrate from stale React Query data. */
export function awaitDailyCashRemotePersistIdle() {
  return remotePersistIdle;
}

const defaultStore = () => ({
  openings: {},
  openingCountMeta: {},
  manualLines: {},
  detailOverrides: {},
  ledgerTimeOverrides: {},
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
    ledgerTimeOverrides:
      typeof p.ledgerTimeOverrides === "object" && p.ledgerTimeOverrides !== null ? p.ledgerTimeOverrides : {},
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
  for (const v of Object.values(s.ledgerTimeOverrides || {})) {
    if (v && typeof v === "object" && Object.keys(v).length > 0) return true;
  }
  if (Array.isArray(s.openingDiffEvents) && s.openingDiffEvents.length > 0) return true;
  return false;
}

/** Deep-merge two stores; `overlay` wins on conflicts (same keys / line ids / event ids). */
function mergeDailyCashStores(base, overlay) {
  const a = normalizeParsed(JSON.parse(JSON.stringify(base)));
  const b = normalizeParsed(JSON.parse(JSON.stringify(overlay)));
  const out = {
    openings: { ...a.openings, ...b.openings },
    openingCountMeta: { ...a.openingCountMeta, ...b.openingCountMeta },
    manualLines: { ...a.manualLines },
    detailOverrides: { ...a.detailOverrides },
    ledgerTimeOverrides: { ...a.ledgerTimeOverrides },
    openingDiffEvents: [],
  };
  for (const [dayKey, lines] of Object.entries(b.manualLines || {})) {
    if (!Array.isArray(lines)) continue;
    const existing = Array.isArray(out.manualLines[dayKey]) ? [...out.manualLines[dayKey]] : [];
    const byId = new Map(existing.map((x) => [x.id, x]));
    for (const line of lines) {
      if (line?.id) byId.set(line.id, line);
    }
    out.manualLines[dayKey] = [...byId.values()];
  }
  for (const [dayKey, rows] of Object.entries(b.detailOverrides || {})) {
    if (!rows || typeof rows !== "object") continue;
    out.detailOverrides[dayKey] = { ...(out.detailOverrides[dayKey] || {}), ...rows };
  }
  for (const [dayKey, rows] of Object.entries(b.ledgerTimeOverrides || {})) {
    if (!rows || typeof rows !== "object") continue;
    out.ledgerTimeOverrides[dayKey] = { ...(out.ledgerTimeOverrides[dayKey] || {}), ...rows };
  }
  const byEvId = new Map();
  for (const ev of [...(a.openingDiffEvents || []), ...(b.openingDiffEvents || [])]) {
    if (ev?.id) byEvId.set(ev.id, ev);
  }
  out.openingDiffEvents = [...byEvId.values()].sort(
    (x, y) => new Date(y.ts || 0).getTime() - new Date(x.ts || 0).getTime(),
  );
  return normalizeParsed(out);
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

/** @param {string | undefined | null} str */
export function parseDailyCashStoreFromJsonString(str) {
  return parseServerJson(str);
}

/** @param {string | undefined | null} str */
export function dailyCashStoreJsonStringHasMeaningfulData(str) {
  return hasMeaningfulData(parseServerJson(str));
}

function scheduleRemotePersist() {
  if (persistenceMode !== "remote" || !persistFn || !isBrowser) return;
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = setTimeout(() => {
    persistDebounceTimer = null;
    const json = JSON.stringify(internalStore);
    const fn = persistFn;
    if (!fn) return;
    const p = Promise.resolve(fn(json)).catch((err) => {
      console.error("[dailyCash] persist failed", err);
    });
    chainRemotePersistPromise(p);
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
 * @returns {{ migrated: boolean, memoryMerged: boolean }}
 */
export function initDailyCashPersistenceRemote(serverJson, persistAsync) {
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = null;
  persistenceMode = "remote";
  persistFn = persistAsync;

  const memoryBefore = normalizeParsed(JSON.parse(JSON.stringify(readRaw())));
  const memoryHadData = hasMeaningfulData(memoryBefore);

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

  let memoryMerged = false;
  if (memoryHadData) {
    /* Keep any in-memory writes made before remote hydration finished (e.g. Shopping writing
       a ledger time override right after mount). Without this overlay, a non-empty server store
       can wipe the fresh override and Daily Cash falls back to the raw API timestamp. */
    internalStore = mergeDailyCashStores(internalStore, memoryBefore);
    memoryMerged = true;
  }

  return { migrated, memoryMerged };
}

/** Flush current store to the server (no debounce). Call after migration. */
export async function flushDailyCashPersistImmediate() {
  if (persistenceMode !== "remote" || !persistFn || !isBrowser) return;
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = null;
  const fn = persistFn;
  const json = JSON.stringify(internalStore);
  const persistPromise = Promise.resolve(fn(json));
  chainRemotePersistPromise(persistPromise);
  await persistPromise;
  clearLocalStorageStore();
}

export function disposeDailyCashPersistence() {
  clearTimeout(persistDebounceTimer);
  persistDebounceTimer = null;
  persistFn = null;
  persistenceMode = "none";
  /* Keep internalStore — resetting here dropped manual counts entered before remote init (settings row still loading). */
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

/** Per-day ledger TIME overrides (ISO instant) — Loyverse/API times vs local correction. */
export function getLedgerTimeOverrides(dateKey) {
  const raw = readRaw().ledgerTimeOverrides?.[dateKey];
  return raw && typeof raw === "object" ? { ...raw } : {};
}

export function setLedgerTimeOverride(dateKey, rowId, isoOrNull) {
  const store = readRaw();
  if (!store.ledgerTimeOverrides) {
    store.ledgerTimeOverrides = {};
  }
  if (!store.ledgerTimeOverrides[dateKey]) {
    store.ledgerTimeOverrides[dateKey] = {};
  }
  if (isoOrNull === null || isoOrNull === undefined || isoOrNull === "") {
    delete store.ledgerTimeOverrides[dateKey][rowId];
    if (Object.keys(store.ledgerTimeOverrides[dateKey]).length === 0) {
      delete store.ledgerTimeOverrides[dateKey];
    }
  } else {
    const s = String(isoOrNull).trim();
    const t = new Date(s).getTime();
    if (!Number.isFinite(t)) return;
    store.ledgerTimeOverrides[dateKey][rowId] = s;
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

/** Move a manual line to another Mexico calendar day (e.g. after editing ledger TIME date). */
export function moveManualLineToDay(fromKey, toKey, lineId, patch) {
  if (!fromKey || !toKey || !lineId) return;
  if (fromKey === toKey) {
    updateManualLine(fromKey, lineId, patch);
    return;
  }
  const store = readRaw();
  const fromList = Array.isArray(store.manualLines[fromKey]) ? [...store.manualLines[fromKey]] : [];
  const idx = fromList.findIndex((x) => x.id === lineId);
  if (idx === -1) return;
  const [line] = fromList.splice(idx, 1);
  if (fromList.length === 0) delete store.manualLines[fromKey];
  else store.manualLines[fromKey] = fromList;
  const nextLine = { ...line, ...patch };
  const toList = Array.isArray(store.manualLines[toKey]) ? [...store.manualLines[toKey]] : [];
  toList.push(nextLine);
  store.manualLines[toKey] = toList;
  writeRaw(store);
}

const OPENING_DIFF_CAP = 250;

/**
 * Manual count history for the opening cash drawer.
 * @param {{ dateKey: string, ts?: string, priorCloseDayStr?: string | null, expectedEnd: number | null, enteredOpening: number, diff: number | null, comment?: string, expectedSourceLabel?: string, previousManualCountId?: string | null, previousManualCountDateKey?: string | null, previousManualCountTs?: string | null }} payload
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
  const ts = typeof payload.ts === "string" && payload.ts.trim() !== "" ? payload.ts.trim() : new Date().toISOString();
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
    expectedSourceLabel: typeof payload.expectedSourceLabel === "string" ? payload.expectedSourceLabel.trim() : "",
    previousManualCountId: payload.previousManualCountId || null,
    previousManualCountDateKey: payload.previousManualCountDateKey || null,
    previousManualCountTs: payload.previousManualCountTs || null,
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

/**
 * Adjust when a manual count was logged (Mexico wall date + time). Updates ledger sort order,
 * "latest manual count" selection, and per-day opening sync.
 * @param {string} id event id
 * @param {string} dateKeyMexico yyyy-MM-dd (Mexico calendar day this count applies to)
 * @param {string} timeHHmm HH:mm (24h)
 */
export function updateOpeningCountDiffDateTime(id, dateKeyMexico, timeHHmm, patch = null) {
  if (!isPlainDateKey(dateKeyMexico)) return;
  const iso = mexicoWallDateTimeToUtcIso(dateKeyMexico, timeHHmm);
  if (!iso) return;
  const store = readRaw();
  const list = Array.isArray(store.openingDiffEvents) ? [...store.openingDiffEvents] : [];
  const idx = list.findIndex((ev) => ev?.id === id);
  if (idx === -1) return;
  const prev = list[idx];
  const prevDateKey = prev.dateKey;
  list[idx] = { ...prev, ...(patch && typeof patch === "object" ? patch : {}), ts: iso, dateKey: dateKeyMexico };
  store.openingDiffEvents = list;
  syncOpeningFromLatestDiff(store, prevDateKey);
  if (prevDateKey !== dateKeyMexico) {
    syncOpeningFromLatestDiff(store, dateKeyMexico);
  }
  writeRaw(store);
}

/** Newest first */
export function listOpeningCountDiffs() {
  const ev = readRaw().openingDiffEvents;
  return Array.isArray(ev)
    ? [...ev].sort((a, b) => new Date(b?.ts || 0).getTime() - new Date(a?.ts || 0).getTime())
    : [];
}
