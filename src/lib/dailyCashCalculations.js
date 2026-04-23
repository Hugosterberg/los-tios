// @ts-nocheck
import { resolveRecordIsoTimestamp } from "@/lib/businessTimestamps";
import {
  formatMexicoTime,
  isPlainDateKey,
  matchesMexicoCalendarDay,
  mexicoWallDateTimeToUtcIso,
} from "@/lib/mexicoTime";

export function rowTimeLabel(iso) {
  return formatMexicoTime(iso);
}

export function rowSortTime(iso, fallbackDayStr) {
  const t = new Date(iso || `${fallbackDayStr}T12:00:00`).getTime();
  return Number.isFinite(t) ? t : new Date(`${fallbackDayStr}T12:00:00`).getTime();
}

function matchesDay(isoDate, key) {
  return matchesMexicoCalendarDay(isoDate, key);
}

export function expensePaymentSourceLabel(paymentSource) {
  const ps = String(paymentSource || "company_cash");
  if (ps === "company_cash") return "Cash drawer";
  if (ps === "company_account") return "Company account / card";
  if (ps === "individual") return "Individual";
  return ps;
}

export function orderCashPaymentSettled(order) {
  const ps = order.payment_status;
  if (ps == null || ps === "") return true;
  return ps === "paid" || ps === "confirmed";
}

/** @param {string} dayStr YYYY-MM-DD */
export function buildDayTableRows(dayStr, { orders, transactions, expenses, loyverseRows, manualLines, dailyCashTxMarker }) {
  const rows = [];

  for (const o of orders) {
    const orderWhen = o.updated_date || o.created_date;
    if (!matchesDay(orderWhen, dayStr)) continue;
    if (String(o.payment_method || "").toLowerCase() !== "cash" || o.status !== "delivered") continue;
    if (!orderCashPaymentSettled(o)) continue;
    const amt = Number(o.total_amount || 0);
    rows.push({
      _ledgerDay: dayStr,
      id: `order-${o.id}`,
      sortTime: new Date(orderWhen || 0).getTime(),
      timeLabel: rowTimeLabel(orderWhen),
      source: "Customer order",
      detail: o.customer_name ? `Order · ${o.customer_name}` : "Order (cash)",
      inAmount: amt,
      outAmount: null,
      order: o,
    });
  }

  for (const lv of loyverseRows) {
    rows.push({ ...lv, _ledgerDay: dayStr });
  }

  for (const t of transactions) {
    if (!matchesDay(t.date, dayStr)) continue;
    if (t.payment_method !== "cash") continue;
    const amt = Number(t.amount || 0);
    const isDailyCashRegistered =
      String(t.notes || "") === dailyCashTxMarker || String(t.notes || "").includes(dailyCashTxMarker);
    const whenIso = resolveRecordIsoTimestamp(t, {
      timestampFields: ["recorded_at", "created_date", "created_at"],
      dateField: "date",
      fallbackDateKey: dayStr,
    });
    if (t.type === "contribution") {
      rows.push({
        _ledgerDay: dayStr,
        id: `tx-in-${t.id}`,
        sortTime: new Date(whenIso).getTime(),
        timeLabel: rowTimeLabel(whenIso),
        source: isDailyCashRegistered ? "Manual cash" : "Company transaction",
        detail: t.description || t.contributor_name || "Cash contribution",
        inAmount: amt,
        outAmount: null,
        isRegisteredManual: isDailyCashRegistered,
        transactionId: t.id,
      });
    } else if (t.type === "withdrawal") {
      rows.push({
        _ledgerDay: dayStr,
        id: `tx-out-${t.id}`,
        sortTime: new Date(whenIso).getTime(),
        timeLabel: rowTimeLabel(whenIso),
        source: isDailyCashRegistered ? "Manual cash" : "Company transaction",
        detail: t.description || t.contributor_name || "Cash withdrawal",
        inAmount: null,
        outAmount: amt,
        isRegisteredManual: isDailyCashRegistered,
        transactionId: t.id,
      });
    }
  }

  for (const e of expenses) {
    if (!matchesDay(e.date, dayStr)) continue;
    const amt = Number(e.amount || 0);
    const fromShopping = Boolean(e.from_shopping_list);
    const ps = String(e.payment_source || "company_cash");
    const fromCashDrawer = ps === "company_cash";
    const whenIso = resolveRecordIsoTimestamp(e, {
      timestampFields: ["recorded_at", "created_date", "created_at"],
      dateField: "date",
      fallbackDateKey: dayStr,
    });
    let sourceLabel;
    if (fromCashDrawer) {
      sourceLabel = fromShopping ? "Register purchase" : "Expense (cash drawer)";
    } else if (fromShopping) {
      sourceLabel = `Shopping → ${expensePaymentSourceLabel(ps)}`;
    } else {
      sourceLabel = `Expense (${expensePaymentSourceLabel(ps)})`;
    }
    rows.push({
      _ledgerDay: dayStr,
      id: `exp-${e.id}`,
      sortTime: new Date(whenIso).getTime(),
      timeLabel: rowTimeLabel(whenIso),
      source: sourceLabel,
      detail: e.name || e.category || (fromShopping ? "Purchase" : "Expense"),
      inAmount: null,
      outAmount: fromCashDrawer ? amt : null,
      ledgerOutAmount: fromCashDrawer ? null : amt,
      expense: e,
    });
  }

  for (const m of manualLines) {
    const amt = Number(m.amount || 0);
    const isIn = m.direction === "in";
    rows.push({
      _ledgerDay: dayStr,
      id: `man-${m.id}`,
      sortTime: new Date(m.createdAt || `${dayStr}T12:00:00`).getTime(),
      timeLabel: rowTimeLabel(m.createdAt),
      source: "Manual adjustment",
      detail: m.note || "Adjustment",
      inAmount: isIn ? amt : null,
      outAmount: isIn ? null : amt,
      isManual: true,
      manualId: m.id,
    });
  }

  rows.sort((a, b) => b.sortTime - a.sortTime);
  return rows;
}

export function salaryCashDrawerTotalForDay(dayStr, expenses) {
  let sum = 0;
  for (const e of expenses) {
    if (!matchesDay(e.date, dayStr)) continue;
    if (String(e.category || "").toLowerCase() !== "salaries") continue;
    if (String(e.payment_source || "company_cash") !== "company_cash") continue;
    sum += Number(e.amount || 0);
  }
  return sum;
}

export function formatLaborCashDetailFromEntries(entries) {
  if (!entries.length) {
    return "Expected cash wages from employee calendar";
  }
  const names = entries.map((e) => e.name).filter(Boolean);
  const uniq = [...new Set(names)];
  const list =
    uniq.length <= 6 ? uniq.join(", ") : `${uniq.slice(0, 5).join(", ")} +${uniq.length - 5}`;
  return `Expected cash wages from employee calendar (${list})`;
}

export function mergeLaborCashLedgerRows(dayStr, baseRows, employees, shifts, expenses, {
  totalExpectedLaborForDate,
  expectedLaborEntriesForDate,
} = {}) {
  const expected = totalExpectedLaborForDate(dayStr, employees, shifts);
  const paidFromDrawer = salaryCashDrawerTotalForDay(dayStr, expenses);
  const netOut = Math.max(0, expected - paidFromDrawer);
  if (!Number.isFinite(netOut) || netOut < 0.005) {
    return baseRows;
  }
  const laborEntries = expectedLaborEntriesForDate(dayStr, employees, shifts);
  const laborRow = {
    _ledgerDay: dayStr,
    id: `labor-cash-${dayStr}`,
    sortTime: new Date(`${dayStr}T00:00:00`).getTime() - 60_000,
    timeLabel: "—",
    source: "Labor (cash)",
    detail: formatLaborCashDetailFromEntries(laborEntries),
    inAmount: null,
    outAmount: netOut,
    isSyntheticLabor: true,
  };
  const merged = [...baseRows, laborRow];
  merged.sort((a, b) => b.sortTime - a.sortTime);
  return merged;
}

export function latestManualCountForDay(events, dayStr) {
  const list = Array.isArray(events) ? events : [];
  return (
    list
      .filter((ev) => ev?.dateKey === dayStr && Number.isFinite(Number(ev.enteredOpening)))
      .sort((a, b) => rowSortTime(b.ts, dayStr) - rowSortTime(a.ts, dayStr))[0] || null
  );
}

export function latestManualCountBefore(events, iso, excludeId = null) {
  const target = new Date(iso || 0).getTime();
  if (!Number.isFinite(target)) return null;
  return (
    (Array.isArray(events) ? events : [])
      .filter((ev) => {
        if (!ev || (excludeId && ev.id === excludeId)) return false;
        if (!Number.isFinite(Number(ev.enteredOpening))) return false;
        const t = new Date(ev.ts || 0).getTime();
        return Number.isFinite(t) && t < target;
      })
      .sort((a, b) => new Date(b.ts || 0).getTime() - new Date(a.ts || 0).getTime())[0] || null
  );
}

export function withManualCountResetRow(dayStr, rows, manualCount, { formatMx }) {
  if (!manualCount) return rows;
  const amount = Number(manualCount.enteredOpening);
  if (!Number.isFinite(amount)) return rows;
  const resetRow = {
    _ledgerDay: dayStr,
    id: `manual-count-reset-${manualCount.id || manualCount.ts || dayStr}`,
    sortTime: rowSortTime(manualCount.ts, dayStr),
    timeLabel: rowTimeLabel(manualCount.ts),
    source: "Manual count",
    detail: manualCount.comment
      ? `Drawer counted: ${formatMx(amount)} · ${manualCount.comment}`
      : `Drawer counted: ${formatMx(amount)}`,
    inAmount: null,
    outAmount: null,
    resetAmount: amount,
    isManualCountReset: true,
  };
  const merged = [...rows.filter((row) => row.id !== resetRow.id), resetRow];
  merged.sort((a, b) => b.sortTime - a.sortTime);
  return merged;
}

export function sumDrawerCashTotals(rows, resetAfterTime = null) {
  let cashIn = 0;
  let cashOut = 0;
  for (const r of rows) {
    if (r.isManualCountReset) continue;
    if (resetAfterTime != null && Number.isFinite(resetAfterTime) && r.sortTime <= resetAfterTime) continue;
    if (r.inAmount) cashIn += r.inAmount;
    if (r.outAmount) cashOut += r.outAmount;
  }
  return { cashIn, cashOut, net: cashIn - cashOut };
}

export function formatManualCountSourceLabel(previousManualCount, priorClose) {
  if (previousManualCount?.ts) {
    return `Manual count ${previousManualCount.dateKey} ${rowTimeLabel(previousManualCount.ts)}`;
  }
  if (priorClose?.closeDayStr) {
    return `Prior close ${priorClose.closeDayStr}`;
  }
  return "No prior count";
}
