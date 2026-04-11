/**
 * Client-side store for Daily Cash: opening float per day + manual adjustment lines.
 * Does not replace Base44 — complements it so start cash can be set without a new entity.
 */

const isBrowser = typeof window !== "undefined";
const STORAGE_KEY = "los_tios_daily_cash_store_v1";

const defaultStore = () => ({ openings: {}, manualLines: {} });

function readRaw() {
  if (!isBrowser) return defaultStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStore();
    const p = JSON.parse(raw);
    return {
      openings: typeof p.openings === "object" && p.openings !== null ? p.openings : {},
      manualLines: typeof p.manualLines === "object" && p.manualLines !== null ? p.manualLines : {},
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
