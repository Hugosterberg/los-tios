/**
 * Offline dev storage for Shopping list + Expenses when you explicitly opt in.
 * In DEV, active only when VITE_LOCAL_DEV_FINANCE=true; otherwise shopping/expenses
 * use the hosted API (same as production).
 */

const isBrowser = typeof window !== "undefined";

const SHOPPING_KEY = "los_tios_local_shopping_list_v1";
const EXPENSE_KEY = "los_tios_local_expenses_v1";
const COMPANY_TX_KEY = "los_tios_local_company_transactions_v1";
const EMPLOYEE_KEY = "los_tios_local_employees_v1";
const SHIFT_KEY = "los_tios_local_shifts_v1";

import { getMexicoNowDateKey, isPlainDateKey, mexicoBusinessDayCreatedAtIso } from "@/lib/mexicoTime";

const clone = (v) => JSON.parse(JSON.stringify(v));

function createId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Use local finance storage in dev only when VITE_LOCAL_DEV_FINANCE=true. */
export function isLocalFinanceMode() {
  if (!import.meta.env.DEV) return false;
  return import.meta.env.VITE_LOCAL_DEV_FINANCE === "true";
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

function readEmployees() {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(EMPLOYEE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEmployees(items) {
  if (!isBrowser) return;
  window.localStorage.setItem(EMPLOYEE_KEY, JSON.stringify(items));
}

function readShifts() {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(SHIFT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeShifts(items) {
  if (!isBrowser) return;
  window.localStorage.setItem(SHIFT_KEY, JSON.stringify(items));
}

export async function localListShoppingList() {
  const items = readShopping();
  return [...items].sort((a, b) =>
    String(b.created_date || "").localeCompare(String(a.created_date || "")),
  );
}

export async function localCreateShoppingList(data) {
  const items = readShopping();
  const now = mexicoBusinessDayCreatedAtIso(getMexicoNowDateKey());
  const row = {
    ...clone(data),
    id: createId("shop"),
    created_date: now,
    updated_date: new Date().toISOString(),
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
  const dateKey = isPlainDateKey(data?.date) ? String(data.date).trim().slice(0, 10) : getMexicoNowDateKey();
  const explicitCd = data?.created_date;
  const row = {
    ...clone(data),
    id: createId("exp"),
    created_date:
      explicitCd != null && String(explicitCd).trim() !== ""
        ? String(explicitCd).trim()
        : mexicoBusinessDayCreatedAtIso(dateKey),
  };
  items.push(row);
  writeExpenses(items);
  return row;
}

export async function localUpdateExpense(id, data) {
  const items = readExpenses();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) throw new Error("Expense not found");
  const updated = {
    ...items[idx],
    ...clone(data),
    id,
  };
  items[idx] = updated;
  writeExpenses(items);
  return updated;
}

export async function localDeleteExpense(id) {
  const items = readExpenses().filter((x) => x.id !== id);
  writeExpenses(items);
  return { id };
}

/** Local CompanyTransaction rows when API is offline. */
export async function localListCompanyTransactions() {
  const items = readCompanyTransactions();
  return [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export async function localCreateCompanyTransaction(data) {
  const items = readCompanyTransactions();
  const dateKey = isPlainDateKey(data?.date) ? String(data.date).trim().slice(0, 10) : getMexicoNowDateKey();
  const explicitCd = data?.created_date;
  const row = {
    ...clone(data),
    id: createId("ctx"),
    created_date:
      explicitCd != null && String(explicitCd).trim() !== ""
        ? String(explicitCd).trim()
        : mexicoBusinessDayCreatedAtIso(dateKey),
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

export async function localUpdateCompanyTransaction(id, data) {
  const items = readCompanyTransactions();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) throw new Error("Company transaction not found");
  const updated = {
    ...items[idx],
    ...clone(data),
    id,
  };
  items[idx] = updated;
  writeCompanyTransactions(items);
  return updated;
}

/** Local Employee rows when the hosted API is unavailable (same dev gate as shopping/expenses). */
export async function localListEmployees() {
  const items = readEmployees();
  return [...items].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }));
}

export async function localCreateEmployee(data) {
  const items = readEmployees();
  const now = mexicoBusinessDayCreatedAtIso(getMexicoNowDateKey());
  const row = {
    ...clone(data),
    id: createId("emp"),
    created_date: now,
    updated_date: new Date().toISOString(),
  };
  items.push(row);
  writeEmployees(items);
  return row;
}

export async function localUpdateEmployee(id, data) {
  const items = readEmployees();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) throw new Error("Employee not found");
  const updated = {
    ...items[idx],
    ...clone(data),
    id,
    updated_date: new Date().toISOString(),
  };
  items[idx] = updated;
  writeEmployees(items);
  return updated;
}

export async function localDeleteEmployee(id) {
  const items = readEmployees().filter((x) => x.id !== id);
  writeEmployees(items);
  const shifts = readShifts().filter((s) => s.employee_id !== id);
  writeShifts(shifts);
  return { id };
}

export async function localListShifts() {
  const items = readShifts();
  return [...items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

export async function localCreateShift(data) {
  const items = readShifts();
  const now = mexicoBusinessDayCreatedAtIso(getMexicoNowDateKey());
  const row = {
    ...clone(data),
    id: createId("shf"),
    created_date: now,
    updated_date: new Date().toISOString(),
  };
  items.push(row);
  writeShifts(items);
  return row;
}

export async function localUpdateShift(id, data) {
  const items = readShifts();
  const idx = items.findIndex((x) => x.id === id);
  if (idx === -1) throw new Error("Shift not found");
  const updated = {
    ...items[idx],
    ...clone(data),
    id,
    updated_date: new Date().toISOString(),
  };
  items[idx] = updated;
  writeShifts(items);
  return updated;
}

export async function localDeleteShift(id) {
  const items = readShifts().filter((x) => x.id !== id);
  writeShifts(items);
  return { id };
}
