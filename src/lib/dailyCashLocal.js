/**
 * Client-side store for Daily Cash: opening float per day + manual adjustment lines.
 * Complements the API: opening balances without a dedicated server entity.
 */

const isBrowser = typeof window !== "undefined";
const STORAGE_KEY = "los_tios_daily_cash_store_v1";

const defaultStore = () => ({ openings: {}, manualLines: {}, detailOverrides: {} });

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
