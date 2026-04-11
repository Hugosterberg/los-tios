/**
 * Offline / no-Base44 dev storage for Shopping list + Expenses.
 * Active in DEV when Base44 env is missing or clearly placeholder, or when
 * VITE_LOCAL_DEV_FINANCE=true. Prevents "App not found" during local UI work.
 */

const isBrowser = typeof window !== "undefined";

const SHOPPING_KEY = "los_tios_local_shopping_list_v1";
const EXPENSE_KEY = "los_tios_local_expenses_v1";
const COMPANY_TX_KEY = "los_tios_local_company_transactions_v1";

const clone = (v) => JSON.parse(JSON.stringify(v));

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Use local finance storage in dev when Base44 is not configured. */
export function isLocalFinanceMode() {
  if (!import.meta.env.DEV) return false;
  if (import.meta.env.VITE_LOCAL_DEV_FINANCE === "false") return false;
  if (import.meta.env.VITE_LOCAL_DEV_FINANCE === "true") return true;
  const id = import.meta.env.VITE_BASE44_APP_ID;
  const url = import.meta.env.VITE_BASE44_BACKEND_URL;
  if (!id?.trim() || !url?.trim()) return true;
  if (/your_base44|placeholder|changeme/i.test(String(id))) return true;
  return false;
}

function readShopping() {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(SHOPPING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeShopping(items) {
  if (!isBrowser) return;
  window.localStorage.setItem(SHOPPING_KEY, JSON.stringify(items));
}

function readExpenses() {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(EXPENSE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeExpenses(items) {
  if (!isBrowser) return;
  window.localStorage.setItem(EXPENSE_KEY, JSON.stringify(items));
}

function readCompanyTransactions() {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(COMPANY_TX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCompanyTransactions(items) {
  if (!isBrowser) return;
  window.localStorage.setItem(COMPANY_TX_KEY, JSON.stringify(items));
}

export async function localListShoppingList() {
  const items = readShopping();
  return [...items].sort((a, b) =>
    String(b.created_date || "").localeCompare(String(a.created_date || "")),
  );
}

export async function localCreateShoppingList(data) {
  const items = readShopping();
  const now = new Date().toISOString();
  const row = {
    ...clone(data),
    id: createId("shop"),
    created_date: now,
    updated_date: now,
  };
  items.push(row);
  writeShopping(items);
  return row;
}

export async function localUpdateShoppingList(id, data) {
  const items = readShopping();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) throw new Error("Shopping list item not found");
  const updated = {
    ...items[idx],
    ...clone(data),
    id,
    updated_date: new Date().toISOString(),
  };
  items[idx] = updated;
  writeShopping(items);
  return updated;
}

export async function localDeleteShoppingList(id) {
  const items = readShopping().filter((x) => x.id !== id);
  writeShopping(items);
  return { id };
}

export async function localListExpenses() {
  const items = readExpenses();
  return [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export async function localCreateExpense(data) {
  const items = readExpenses();
  const row = {
    ...clone(data),
    id: createId("exp"),
    created_date: new Date().toISOString(),
  };
  items.push(row);
  writeExpenses(items);
  return row;
}

/** Local CompanyTransaction rows (dev / no Base44). */
export async function localListCompanyTransactions() {
  const items = readCompanyTransactions();
  return [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export async function localCreateCompanyTransaction(data) {
  const items = readCompanyTransactions();
  const now = new Date().toISOString();
  const row = {
    ...clone(data),
    id: createId("ctx"),
    created_date: now,
  };
  items.push(row);
  writeCompanyTransactions(items);
  return row;
}

export async function localDeleteCompanyTransaction(id) {
  const items = readCompanyTransactions().filter((x) => x.id !== id);
  writeCompanyTransactions(items);
  return { id };
}
