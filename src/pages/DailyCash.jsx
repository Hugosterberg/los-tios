import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Banknote,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { appParams } from "@/lib/app-params";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { getRecordDate, getReceiptPaymentMethod, getReceiptTotal } from "@/lib/mergedSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { listOrders, updateOrderEntity } from "@/lib/local-dev-orders";
import {
  isLocalFinanceMode,
  localCreateCompanyTransaction,
  localDeleteCompanyTransaction,
  localListCompanyTransactions,
  localListExpenses,
  localListEmployees,
  localListShifts,
  localUpdateCompanyTransaction,
  localUpdateExpense,
} from "@/lib/localDevFinance";
import { expectedLaborEntriesForDate, totalExpectedLaborForDate } from "@/lib/employeeLabor";
import {
  addManualLine,
  disposeDailyCashPersistence,
  flushDailyCashPersistImmediate,
  getDetailOverrides,
  getEarliestOpeningInMexicoMonth,
  getLedgerTimeOverrides,
  getManualLines,
  getOpeningBalance,
  getOpeningCountMeta,
  initDailyCashPersistenceLocal,
  initDailyCashPersistenceRemote,
  listOpeningCountDiffs,
  recordOpeningCountDiff,
  removeOpeningCountDiff,
  removeManualLine,
  setDetailOverride,
  setLedgerTimeOverride,
  setOpeningBalance,
  updateOpeningCountDiffComment,
  updateOpeningCountDiffDateTime,
  moveManualLineToDay,
  updateManualLine,
} from "@/lib/dailyCashLocal";
import {
  AppOrderLedgerDetailPanel,
  LoyverseLedgerDetailPanel,
} from "@/components/daily-cash/LedgerRowExpandPanels";
import { MexicoWallDatePicker } from "@/components/daily-cash/MexicoWallDatePicker";
import { MexicoWallTimePicker } from "@/components/daily-cash/MexicoWallTimePicker";
import {
  dateFromMexicoDateKey,
  formatMexicoDateShort,
  formatMexicoLongDateEn,
  formatMexicoMonthShortDayYearEn,
  formatMexicoTime,
  formatMexicoWeekdayLongEn,
  getMexicoDateAndTimePartsForInput,
  getMexicoDateKey,
  getMexicoNowDateKey,
  getMexicoYearMonthKey,
  isPlainDateKey,
  matchesMexicoCalendarDay,
  mexicoWallDateTimeToUtcIso,
  normalizeHHmm,
  withMexicoCreatedDateForPayload,
} from "@/lib/mexicoTime";

/** Marks rows created from Daily Cash so they can be removed / undone from this page */
const DAILY_CASH_TX_MARKER = "los_tios:daily_cash";

/** Mexico wall date + time for a saved manual count — fixes sort vs register purchases when you log late. */
function ManualCountWhenCell({ ev, onCommit }) {
  const init = () => getMexicoDateAndTimePartsForInput(ev.ts);
  const [dateKey, setDateKey] = useState(() => init().dateKey);
  const [timeHHmm, setTimeHHmm] = useState(() => init().timeHHmm);

  useLayoutEffect(() => {
    const p = getMexicoDateAndTimePartsForInput(ev.ts);
    setDateKey(p.dateKey);
    setTimeHHmm(p.timeHHmm);
  }, [ev.id, ev.ts]);

  const commitIfChanged = useCallback(
    (overrideDateKey) => {
      const d = (overrideDateKey ?? dateKey ?? "").trim();
      const t = normalizeHHmm(timeHHmm);
      if (!d || !t) return;
      const iso = mexicoWallDateTimeToUtcIso(d, t);
      if (!iso) return;
      const wall = getMexicoDateAndTimePartsForInput(ev.ts);
      if (wall.dateKey === d && wall.timeHHmm === t) return;
      onCommit(ev.id, d, t);
    },
    [ev.id, ev.ts, onCommit, dateKey, timeHHmm],
  );

  return (
    <div className="flex min-w-[11rem] flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <MexicoWallDatePicker value={dateKey} onChange={setDateKey} onPopoverClose={commitIfChanged} />
      <MexicoWallTimePicker
        value={timeHHmm}
        onChange={(v) => setTimeHHmm(v)}
        onPopoverClose={() => commitIfChanged()}
      />
    </div>
  );
}

/**
 * Editable TIME for ledger rows — stages changes until “Save time changes” below.
 * Loyverse / labor rows still use AppSettings overrides on save.
 */
function LedgerTimeCell({ row, ledgerDay, pendingEdit, onStageChange, onClearPending, onReset }) {
  const overrideIso = getLedgerTimeOverrides(ledgerDay)[row.id];
  const refIso = (() => {
    if (pendingEdit) {
      const iso = mexicoWallDateTimeToUtcIso(pendingEdit.dateKeyMexico, normalizeHHmm(pendingEdit.timeHHmm));
      if (iso) return iso;
    }
    return overrideIso ?? new Date(row.sortTime).toISOString();
  })();
  const initParts = () => getMexicoDateAndTimePartsForInput(refIso);
  const [dateKey, setDateKey] = useState(() => initParts().dateKey);
  const [timeHHmm, setTimeHHmm] = useState(() => initParts().timeHHmm);
  const dateKeyRef = useRef(dateKey);
  const timeHHmmRef = useRef(timeHHmm);

  useLayoutEffect(() => {
    dateKeyRef.current = dateKey;
  }, [dateKey]);
  useLayoutEffect(() => {
    timeHHmmRef.current = timeHHmm;
  }, [timeHHmm]);

  useLayoutEffect(() => {
    const ri = (() => {
      if (pendingEdit) {
        const iso = mexicoWallDateTimeToUtcIso(pendingEdit.dateKeyMexico, normalizeHHmm(pendingEdit.timeHHmm));
        if (iso) return iso;
      }
      return overrideIso ?? new Date(row.sortTime).toISOString();
    })();
    const p = getMexicoDateAndTimePartsForInput(ri);
    setDateKey(p.dateKey);
    setTimeHHmm(p.timeHHmm);
  }, [row.id, row.sortTime, ledgerDay, overrideIso, pendingEdit]);

  const stageIfChanged = useCallback(
    (dRaw, tRaw) => {
      const d = String(dRaw ?? "").trim();
      const t = normalizeHHmm(tRaw);
      if (!d || !t) return;
      const iso = mexicoWallDateTimeToUtcIso(d, t);
      if (!iso) return;
      const compareIso = overrideIso ?? new Date(row.sortTime).toISOString();
      const wall = getMexicoDateAndTimePartsForInput(compareIso);
      if (wall.dateKey === d && wall.timeHHmm === t) {
        onClearPending?.(ledgerDay, row.id);
        return;
      }
      onStageChange?.(ledgerDay, row.id, d, t);
    },
    [row.id, row.sortTime, ledgerDay, overrideIso, onStageChange, onClearPending],
  );

  const commitIfChanged = useCallback(
    (overrideDateKey) => {
      const d = (overrideDateKey ?? dateKeyRef.current ?? "").trim();
      const t = normalizeHHmm(timeHHmmRef.current);
      stageIfChanged(d, t);
    },
    [stageIfChanged],
  );

  if (row.isManualCountReset) {
    return <span className="tabular-nums text-gray-500">{row.timeLabel}</span>;
  }

  const showReset = Boolean(overrideIso || pendingEdit);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {showReset ? (
        <button
          type="button"
          className="shrink-0 rounded px-1 py-0.5 text-[10px] font-medium text-amber-400/90 underline-offset-2 hover:text-amber-300 hover:underline"
          title="Restore original time and clear unsaved edits"
          onClick={() => onReset(row.id)}
        >
          Reset
        </button>
      ) : null}
      <MexicoWallDatePicker
        value={dateKey}
        onChange={(k) => {
          setDateKey(k);
          dateKeyRef.current = k;
        }}
        onPopoverClose={commitIfChanged}
      />
      <MexicoWallTimePicker
        value={timeHHmm}
        onChange={(v) => {
          setTimeHHmm(v);
          timeHHmmRef.current = v;
        }}
        onInteractiveCommit={(next) => {
          timeHHmmRef.current = next;
          setTimeHHmm(next);
          stageIfChanged(dateKeyRef.current, next);
        }}
        onPopoverClose={() => commitIfChanged()}
      />
    </div>
  );
}

function applyLedgerTimeOverrides(dayStr, rows) {
  const ov = getLedgerTimeOverrides(dayStr);
  if (!ov || Object.keys(ov).length === 0) {
    const copy = [...rows];
    copy.sort((a, b) => b.sortTime - a.sortTime);
    return copy;
  }
  const next = rows.map((r) => {
    const iso = ov[r.id];
    if (!iso) return r;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return r;
    return { ...r, sortTime: t, timeLabel: rowTimeLabel(iso) };
  });
  next.sort((a, b) => b.sortTime - a.sortTime);
  return next;
}

/** Unsaved TIME edits (before "Save") — preview sort using staged Mexico wall time. */
function applyPendingLedgerSort(dayStr, rows, pendingMap) {
  if (!pendingMap || Object.keys(pendingMap).length === 0) {
    const copy = [...rows];
    copy.sort((a, b) => b.sortTime - a.sortTime);
    return copy;
  }
  const next = rows.map((r) => {
    const key = `${dayStr}::${r.id}`;
    const p = pendingMap[key];
    if (!p) return r;
    const iso = mexicoWallDateTimeToUtcIso(p.dateKeyMexico, normalizeHHmm(p.timeHHmm));
    if (!iso) return r;
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return r;
    return { ...r, sortTime: t, timeLabel: rowTimeLabel(iso) };
  });
  next.sort((a, b) => b.sortTime - a.sortTime);
  return next;
}

function ledgerPendingKey(ledgerDay, rowId) {
  return `${ledgerDay}::${rowId}`;
}

function dayKey(d) {
  return getMexicoDateKey(d);
}

function offsetMexicoDateKey(dateKey, deltaDays) {
  return dayKey(addDays(dateFromMexicoDateKey(dateKey), deltaDays));
}

function formatMx(value) {
  if (value === null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value);
}

function rowTimeLabel(iso) {
  return formatMexicoTime(iso);
}

function rowSortTime(iso, fallbackDayStr) {
  const t = new Date(iso || `${fallbackDayStr}T12:00:00`).getTime();
  return Number.isFinite(t) ? t : new Date(`${fallbackDayStr}T12:00:00`).getTime();
}

function matchesDay(isoDate, key) {
  return matchesMexicoCalendarDay(isoDate, key);
}

function expensePaymentSourceLabel(paymentSource) {
  const ps = String(paymentSource || "company_cash");
  if (ps === "company_cash") return "Cash drawer";
  if (ps === "company_account") return "Company account / card";
  if (ps === "individual") return "Individual";
  return ps;
}

/** Map edited ledger detail back to Order.customer_name (display is `Order · ${name}`). */
function detailEditToCustomerName(text) {
  const t = text.trim();
  const prefix = "Order · ";
  if (t.startsWith(prefix)) {
    return t.slice(prefix.length).trim() || "Customer";
  }
  return t || "Customer";
}

function LedgerDetailCell({ displayDetail, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayDetail);
  const skipBlurCommit = useRef(false);

  useEffect(() => {
    if (!editing) {
      setDraft(displayDetail);
    }
  }, [displayDetail, editing]);

  const submit = () => {
    const p = onCommit(draft);
    Promise.resolve(p).finally(() => setEditing(false));
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (skipBlurCommit.current) {
            skipBlurCommit.current = false;
            return;
          }
          submit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            skipBlurCommit.current = true;
            setDraft(displayDetail);
            setEditing(false);
          }
        }}
        className="h-8 border-yellow-500/40 bg-[#0f0f0c] text-sm text-gray-200"
      />
    );
  }

  return (
    <button
      type="button"
      className="w-full min-w-[6rem] rounded px-1 py-0.5 text-left text-gray-400 hover:bg-yellow-500/10 hover:text-gray-200"
      onClick={() => {
        skipBlurCommit.current = false;
        setDraft(displayDetail);
        setEditing(true);
      }}
    >
      {displayDetail || "—"}
    </button>
  );
}

/** Align with Loyverse overview: exclude voided / cancelled receipts */
function isLoyverseReceiptCompleted(receipt) {
  const status =
    receipt?.status ||
    receipt?.receipt_status ||
    (receipt?.canceled_at ? "cancelled" : "completed");
  return !String(status).toLowerCase().includes("cancel");
}

function orderCashPaymentSettled(order) {
  const ps = order.payment_status;
  if (ps == null || ps === "") return true;
  return ps === "paid" || ps === "confirmed";
}

/** @param {string} dayStr YYYY-MM-DD */
function buildDayTableRows(dayStr, { orders, transactions, expenses, loyverseRows, manualLines }) {
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
      String(t.notes || "") === DAILY_CASH_TX_MARKER || String(t.notes || "").includes(DAILY_CASH_TX_MARKER);
    const txDateKey = isPlainDateKey(String(t.date)) ? String(t.date).trim().slice(0, 10) : dayStr;
    const whenIso =
      t.created_date ||
      mexicoWallDateTimeToUtcIso(txDateKey, "12:00") ||
      new Date(`${dayStr}T12:00:00-06:00`).toISOString();
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
    const exDateKey = isPlainDateKey(String(e.date)) ? String(e.date).trim().slice(0, 10) : dayStr;
    const whenIso =
      e.created_date ||
      mexicoWallDateTimeToUtcIso(exDateKey, "12:00") ||
      new Date(`${dayStr}T12:00:00-06:00`).toISOString();
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

/** Salary expenses already logged as paid from the cash drawer this calendar day (Finance). */
function salaryCashDrawerTotalForDay(dayStr, expenses) {
  let sum = 0;
  for (const e of expenses) {
    if (!matchesDay(e.date, dayStr)) continue;
    if (String(e.category || "").toLowerCase() !== "salaries") continue;
    if (String(e.payment_source || "company_cash") !== "company_cash") continue;
    sum += Number(e.amount || 0);
  }
  return sum;
}

/**
 * Append one synthetic OUT row for wages still expected from the drawer (unpaid shifts + template),
 * net of Finance "salaries" already marked paid from cash that day — avoids double-counting.
 */
function formatLaborCashDetailFromEntries(entries) {
  if (!entries.length) {
    return "Expected cash wages from employee calendar";
  }
  const names = entries.map((e) => e.name).filter(Boolean);
  const uniq = [...new Set(names)];
  const list =
    uniq.length <= 6 ? uniq.join(", ") : `${uniq.slice(0, 5).join(", ")} +${uniq.length - 5}`;
  return `Expected cash wages from employee calendar (${list})`;
}

function mergeLaborCashLedgerRows(dayStr, baseRows, employees, shifts, expenses) {
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
    /** Sort last in "newest first" tables (early instant same calendar day). */
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

function latestManualCountForDay(events, dayStr) {
  const list = Array.isArray(events) ? events : [];
  return (
    list
      .filter((ev) => ev?.dateKey === dayStr && Number.isFinite(Number(ev.enteredOpening)))
      .sort((a, b) => rowSortTime(b.ts, dayStr) - rowSortTime(a.ts, dayStr))[0] || null
  );
}

function withManualCountResetRow(dayStr, rows, manualCount) {
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

function sumDrawerCashTotals(rows, resetAfterTime = null) {
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

function normalizeLedgerPayLabel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Match Loyverse payment labels (Efectivo, Cash, etc.) — same idea as Orders POS rows. */
function isCashLikeLedgerMethod(raw) {
  const m = normalizeLedgerPayLabel(raw);
  if (m === "cash" || m === "efectivo") return true;
  if (m.includes("efectivo")) return true;
  if (m.includes("cash") && !m.includes("cashback")) return true;
  return false;
}

function paymentLineLabel(p) {
  return String(p?.type ?? p?.name ?? p?.payment_type ?? "").trim();
}

function paymentLineMoney(p) {
  const raw = p?.money_amount ?? p?.amount_money ?? p?.amount;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw) || 0;
  if (raw && typeof raw === "object") return Number(raw.amount ?? raw.value) || 0;
  return 0;
}

function isLoyverseRefundReceipt(receipt) {
  const rt = String(receipt?.receipt_type || receipt?.type || "").toLowerCase();
  if (rt.includes("refund") || rt.includes("return")) return true;
  const t = getReceiptTotal(receipt);
  if (t < -0.009) return true;
  return false;
}

function buildLoyverseRowsForWindow(overview, rangeStart, rangeEnd) {
  const byDay = new Map();
  if (!overview?.receipts?.length) return byDay;
  const receipts = overview.receipts.filter(isLoyverseReceiptCompleted);
  if (!receipts.length) return byDay;
  const storeMap = new Map((overview.stores || []).map((s) => [s.id, s.name || s.id]));

  for (const receipt of receipts) {
    const ts = getRecordDate(receipt);
    if (ts < rangeStart || ts > rangeEnd) continue;

    const rid = receipt?.id ?? receipt?.receipt_number ?? "unknown";
    const dayStr = getMexicoDateKey(ts);
    const branch = storeMap.get(receipt.store_id) || receipt.store_id || "";
    const parts = [];
    if (receipt?.receipt_number != null && String(receipt.receipt_number).trim() !== "") {
      parts.push(`#${receipt.receipt_number}`);
    }
    if (branch) parts.push(branch);
    const baseDetail = parts.length > 0 ? parts.join(" · ") : "Loyverse (cash)";
    const isRefund = isLoyverseRefundReceipt(receipt);
    const timeIso = receipt?.created_at ?? receipt?.receipt_date ?? ts.toISOString();

    const payments = Array.isArray(receipt.payments) ? receipt.payments : [];

    const pushRow = (suffix, cashAmount, detailNote) => {
      const raw = Number(cashAmount);
      if (!Number.isFinite(raw) || Math.abs(raw) < 0.0001) return;
      const magnitude = Math.abs(raw);
      const signed = isRefund ? -magnitude : magnitude;
      const row = {
        id: `loyverse-${rid}${suffix}`,
        sortTime: ts.getTime(),
        timeLabel: rowTimeLabel(timeIso),
        source: isRefund ? "Loyverse refund" : "Loyverse POS",
        detail: (() => {
          const bits = [];
          if (isRefund) bits.push("Refund");
          if (detailNote) bits.push(detailNote);
          bits.push(baseDetail);
          return bits.join(" · ");
        })(),
        inAmount: signed > 0.009 ? signed : null,
        outAmount: signed < -0.009 ? Math.abs(signed) : null,
        receipt,
      };
      if (!byDay.has(dayStr)) byDay.set(dayStr, []);
      byDay.get(dayStr).push(row);
    };

    if (payments.length === 0) {
      const method = String(getReceiptPaymentMethod(receipt) || "");
      if (!isCashLikeLedgerMethod(method)) continue;
      pushRow("", Math.abs(getReceiptTotal(receipt)), null);
      continue;
    }

    payments.forEach((p, i) => {
      if (!isCashLikeLedgerMethod(paymentLineLabel(p))) return;
      let amt = paymentLineMoney(p);
      if (!Number.isFinite(amt) || Math.abs(amt) < 0.0001) {
        if (payments.length === 1) amt = Math.abs(getReceiptTotal(receipt));
        else return;
      }
      const note = payments.length > 1 ? `Cash ${i + 1}/${payments.length}` : null;
      pushRow(`-p${i}`, Math.abs(amt), note);
    });
  }

  return byDay;
}

export default function DailyCash() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => dateFromMexicoDateKey(getMexicoNowDateKey()));
  const [periodMode, setPeriodMode] = useState(/** @type {"today" | "month" | "history"} */ ("today"));
  const prevPeriodMode = useRef(periodMode);

  useEffect(() => {
    if (periodMode === "today" && prevPeriodMode.current !== "today") {
      setSelectedDate(dateFromMexicoDateKey(getMexicoNowDateKey()));
    }
    prevPeriodMode.current = periodMode;
  }, [periodMode]);

  const mexicoToday = dateFromMexicoDateKey(getMexicoNowDateKey());
  const todayStr = dayKey(mexicoToday);
  const formDayStr = dayKey(selectedDate);
  const heroDate = selectedDate;
  const viewingToday = formDayStr === todayStr;

  const useLocalFinance = isLocalFinanceMode();
  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" || !appParams.appId || !appParams.serverUrl);

  /** Full calendar month so day-to-day navigation still has Loyverse rows + prior-close math. */
  const loyverseWindow = useMemo(
    () => ({
      start: startOfMonth(selectedDate),
      end: endOfMonth(selectedDate),
    }),
    [selectedDate],
  );

  const loyverseWindowKey = `${format(loyverseWindow.start, "yyyy-MM-dd")}_${format(loyverseWindow.end, "yyyy-MM-dd")}`;

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });
  const settingsRowId = settings[0]?.id;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const appSettings = useMemo(() => getResolvedIntegrationSettings(settings[0] || {}), [settings]);

  const loyverseQuery = useQuery({
    queryKey: ["dailyCashLoyverse", settings[0]?.id || "none", loyverseWindowKey],
    queryFn: () =>
      getLoyverseOverview(appSettings, {
        start: loyverseWindow.start,
        end: loyverseWindow.end,
      }),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });
  const loyverseOverview = loyverseQuery.data;

  const loyverseCustomerById = useMemo(() => {
    const m = new Map();
    for (const c of loyverseOverview?.customers || []) {
      if (c?.id != null) m.set(c.id, c);
    }
    return m;
  }, [loyverseOverview?.customers]);

  const loyverseEmployeeById = useMemo(() => {
    const m = new Map();
    for (const e of loyverseOverview?.employees || []) {
      if (e?.id != null) m.set(e.id, e);
    }
    return m;
  }, [loyverseOverview?.employees]);

  const loyverseStoreById = useMemo(() => {
    const m = new Map();
    for (const s of loyverseOverview?.stores || []) {
      if (s?.id != null) m.set(s.id, s);
    }
    return m;
  }, [loyverseOverview?.stores]);

  const [expandedLedgerKey, setExpandedLedgerKey] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    setExpandedLedgerKey(null);
  }, [formDayStr, periodMode, loyverseWindowKey]);

  const [openingInput, setOpeningInput] = useState("");
  const [openingComment, setOpeningComment] = useState("");
  const [storeTick, setStoreTick] = useState(0);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [manualNote, setManualNote] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDir, setManualDir] = useState("in");

  /** @type {null | { kind: 'legacy'; dayStr: string; line: object } | { kind: 'registered'; snapshot: object }} */
  const [lastRemovedManual, setLastRemovedManual] = useState(null);

  /** Staged ledger TIME edits — key `${ledgerDay}::${rowId}` until user clicks “Save time changes”. */
  const [pendingLedgerTimes, setPendingLedgerTimes] = useState(
    /** @type {Record<string, { ledgerDay: string; rowId: string; dateKeyMexico: string; timeHHmm: string }>} */ ({}),
  );
  const [savingLedgerTimes, setSavingLedgerTimes] = useState(false);
  const pendingLedgerCount = Object.keys(pendingLedgerTimes).length;

  useLayoutEffect(() => {
    if (isLocalOnlyMode) {
      disposeDailyCashPersistence();
      initDailyCashPersistenceLocal();
      setStoreTick((t) => t + 1);
      return () => {
        void flushDailyCashPersistImmediate();
        disposeDailyCashPersistence();
      };
    }
    if (!settingsRowId) {
      disposeDailyCashPersistence();
      return;
    }
    const cached = queryClient.getQueryData(["appSettings"]);
    const rowFromCache = Array.isArray(cached) ? cached.find((r) => r?.id === settingsRowId) : null;
    const rowFromRender = Array.isArray(settingsRef.current)
      ? settingsRef.current.find((r) => r?.id === settingsRowId)
      : null;
    const row = rowFromCache ?? rowFromRender;
    const serverJson = typeof row?.daily_cash_store_json === "string" ? row.daily_cash_store_json : "";

    const persist = async (json) => {
      await base44.entities.AppSettings.update(settingsRowId, { daily_cash_store_json: json });
      queryClient.setQueryData(["appSettings"], (prev) => {
        if (!prev?.length) return prev;
        const first = prev[0];
        if (first?.id !== settingsRowId) return prev;
        return [{ ...first, daily_cash_store_json: json }, ...prev.slice(1)];
      });
    };

    disposeDailyCashPersistence();
    const { migrated } = initDailyCashPersistenceRemote(serverJson, persist);
    if (migrated) {
      void flushDailyCashPersistImmediate().catch((err) => {
        console.error("[dailyCash] migration persist failed", err);
      });
    }
    setStoreTick((t) => t + 1);

    return () => {
      void flushDailyCashPersistImmediate();
      disposeDailyCashPersistence();
    };
  }, [isLocalOnlyMode, settingsRowId, queryClient]);

  useEffect(() => {
    if (isLocalOnlyMode || !settingsRowId) return undefined;
    const flush = () => {
      void flushDailyCashPersistImmediate();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [isLocalOnlyMode, settingsRowId]);

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), "-created_date"),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["companyTransactions", useLocalFinance ? "local" : "remote"],
    queryFn: () =>
      useLocalFinance
        ? localListCompanyTransactions()
        : base44.entities.CompanyTransaction.list("-date"),
  });

  const createCompanyTx = useMutation({
    mutationFn: (data) =>
      useLocalFinance
        ? localCreateCompanyTransaction(data)
        : base44.entities.CompanyTransaction.create(withMexicoCreatedDateForPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyTransactions"] });
    },
  });

  const deleteCompanyTx = useMutation({
    mutationFn: (id) =>
      useLocalFinance ? localDeleteCompanyTransaction(id) : base44.entities.CompanyTransaction.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyTransactions"] });
    },
  });

  const saveTransactionDescription = useMutation({
    mutationFn: ({ id, data }) =>
      useLocalFinance
        ? localUpdateCompanyTransaction(id, data)
        : base44.entities.CompanyTransaction.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyTransactions"] });
    },
  });

  const saveOrderDetail = useMutation({
    mutationFn: ({ id, data }) =>
      updateOrderEntity(id, data, (orderId, payload) => base44.entities.Order.update(orderId, payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const saveExpenseDetail = useMutation({
    mutationFn: ({ id, data }) =>
      useLocalFinance ? localUpdateExpense(id, data) : base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListExpenses() : base44.entities.Expense.list("-date")),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListShifts() : base44.entities.Shift.list("-date")),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListEmployees() : base44.entities.Employee.list("name")),
  });

  const expectedLaborDay = useMemo(
    () => totalExpectedLaborForDate(formDayStr, employees, shifts),
    [formDayStr, employees, shifts],
  );

  /** Hero “Sunday box”: names in extralight white, caption in gold — same hierarchy as weekday / long date. */
  const laborCalendarHeroTitle = useMemo(() => {
    if (periodMode !== "today") return null;
    if (!Number.isFinite(expectedLaborDay) || expectedLaborDay < 0.005) return null;
    const entries = expectedLaborEntriesForDate(formDayStr, employees, shifts);
    const uniq = [...new Set(entries.map((e) => e.name).filter(Boolean))];
    if (!uniq.length) return "Staff";
    return uniq.length <= 5 ? uniq.join(", ") : `${uniq.slice(0, 4).join(", ")} +${uniq.length - 4}`;
  }, [periodMode, formDayStr, employees, shifts, expectedLaborDay]);

  const monthEarliestOpening = useMemo(() => {
    if (periodMode !== "month") return null;
    return getEarliestOpeningInMexicoMonth(getMexicoYearMonthKey(selectedDate));
  }, [periodMode, selectedDate, storeTick]);

  const loyverseByDay = useMemo(
    () => buildLoyverseRowsForWindow(loyverseOverview, loyverseWindow.start, loyverseWindow.end),
    [loyverseOverview, loyverseWindow.start, loyverseWindow.end],
  );

  /** Most recent day before `formDayStr` with a saved opening — its drawer end is the implied prior close. */
  const priorDrawerClose = useMemo(() => {
    if (periodMode !== "today") return null;
    let d = offsetMexicoDateKey(formDayStr, -1);
    for (let i = 0; i < 120; i++) {
      const opening = getOpeningBalance(d);
      if (opening === null) {
        d = offsetMexicoDateKey(d, -1);
        continue;
      }
      const lv = loyverseByDay.get(d) || [];
      const rows = applyLedgerTimeOverrides(
        d,
        mergeLaborCashLedgerRows(
          d,
          buildDayTableRows(d, {
            orders,
            transactions,
            expenses,
            loyverseRows: lv,
            manualLines: getManualLines(d),
          }),
          employees,
          shifts,
          expenses,
        ),
      );
      const reset = latestManualCountForDay(listOpeningCountDiffs(), d);
      const resetTime = reset ? rowSortTime(reset.ts, d) : null;
      const t = sumDrawerCashTotals(rows, resetTime);
      const anchor = reset ? Number(reset.enteredOpening) : opening;
      return { closeDayStr: d, priorOpening: anchor, net: t.net, end: anchor + t.net };
    }
    return null;
  }, [periodMode, formDayStr, loyverseByDay, orders, transactions, expenses, employees, shifts, storeTick]);

  useEffect(() => {
    setOpeningComment("");
    if (periodMode === "month") {
      setOpeningInput(monthEarliestOpening === null ? "" : String(monthEarliestOpening.value));
      return;
    }
    const v = getOpeningBalance(formDayStr);
    if (v !== null) {
      setOpeningInput(String(v));
    } else {
      setOpeningInput("");
    }
  }, [formDayStr, storeTick, periodMode, monthEarliestOpening]);

  const openingCountDiffHistory = useMemo(() => listOpeningCountDiffs(), [storeTick]);

  /** Ledger rows for any Mexico day — used when Today row cache is empty (e.g. Difference history tab). */
  const buildLedgerRowsForMexicoDay = useCallback(
    (dayStr) => {
      const manualCount = latestManualCountForDay(openingCountDiffHistory, dayStr);
      const lv = loyverseByDay.get(dayStr) || [];
      const baseRows = mergeLaborCashLedgerRows(
        dayStr,
        buildDayTableRows(dayStr, {
          orders,
          transactions,
          expenses,
          loyverseRows: lv,
          manualLines: getManualLines(dayStr),
        }),
        employees,
        shifts,
        expenses,
      );
      return applyLedgerTimeOverrides(dayStr, withManualCountResetRow(dayStr, baseRows, manualCount));
    },
    [loyverseByDay, orders, transactions, expenses, employees, shifts, openingCountDiffHistory, storeTick],
  );

  const selectedDayManualCount = useMemo(
    () => latestManualCountForDay(openingCountDiffHistory, formDayStr),
    [openingCountDiffHistory, formDayStr],
  );

  const persistOpening = useCallback(() => {
    const trimmed = openingInput.trim();
    const trimmedComment = openingComment.trim();
    const oldPersisted = getOpeningBalance(formDayStr);
    if (trimmed === "") {
      setOpeningBalance(formDayStr, null);
      setOpeningComment("");
      setStoreTick((t) => t + 1);
      return;
    } else {
      const n = parseFloat(trimmed.replace(",", "."));
      if (Number.isFinite(n)) {
        const expectedEnd =
          periodMode === "today" && priorDrawerClose != null && Number.isFinite(priorDrawerClose.end)
            ? priorDrawerClose.end
            : null;
        const diff = expectedEnd === null ? null : n - expectedEnd;
        if (oldPersisted !== n || trimmedComment !== "") {
          recordOpeningCountDiff({
            dateKey: formDayStr,
            priorCloseDayStr: priorDrawerClose?.closeDayStr || null,
            expectedEnd,
            enteredOpening: n,
            diff,
            comment: trimmedComment,
          });
          setOpeningComment("");
        }
      }
    }
    setStoreTick((t) => t + 1);
  }, [formDayStr, openingComment, openingInput, periodMode, priorDrawerClose]);

  const persistedOpening = useMemo(() => getOpeningBalance(formDayStr), [formDayStr, storeTick]);
  const openingCountMeta = useMemo(() => getOpeningCountMeta(formDayStr), [formDayStr, storeTick]);

  const openingDiffVsPriorClose = useMemo(() => {
    if (periodMode !== "today" || priorDrawerClose == null || persistedOpening === null) return null;
    const diff = persistedOpening - priorDrawerClose.end;
    if (!Number.isFinite(diff) || Math.abs(diff) < 0.005) return null;
    return diff;
  }, [periodMode, priorDrawerClose, persistedOpening]);

  const tableRows = useMemo(() => {
    if (periodMode === "month" || periodMode === "history") return [];
    const lv = loyverseByDay.get(formDayStr) || [];
    const rows = mergeLaborCashLedgerRows(
      formDayStr,
      buildDayTableRows(formDayStr, {
        orders,
        transactions,
        expenses,
        loyverseRows: lv,
        manualLines: getManualLines(formDayStr),
      }),
      employees,
      shifts,
      expenses,
    );
    return applyPendingLedgerSort(
      formDayStr,
      applyLedgerTimeOverrides(
        formDayStr,
        withManualCountResetRow(formDayStr, rows, selectedDayManualCount),
      ),
      pendingLedgerTimes,
    );
  }, [
    periodMode,
    formDayStr,
    orders,
    transactions,
    expenses,
    loyverseByDay,
    employees,
    shifts,
    storeTick,
    selectedDayManualCount,
    pendingLedgerTimes,
  ]);

  const monthLedgerSections = useMemo(() => {
    if (periodMode !== "month") return [];
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    return eachDayOfInterval({ start, end })
      .map((d) => {
        const ds = dayKey(d);
        const lv = loyverseByDay.get(ds) || [];
        const baseRows = mergeLaborCashLedgerRows(
          ds,
          buildDayTableRows(ds, {
            orders,
            transactions,
            expenses,
            loyverseRows: lv,
            manualLines: getManualLines(ds),
          }),
          employees,
          shifts,
          expenses,
        );
        const reset = latestManualCountForDay(openingCountDiffHistory, ds);
        const rows = applyPendingLedgerSort(
          ds,
          applyLedgerTimeOverrides(ds, withManualCountResetRow(ds, baseRows, reset)),
          pendingLedgerTimes,
        );
        const t = sumDrawerCashTotals(rows, reset ? rowSortTime(reset.ts, ds) : null);
        const labor = totalExpectedLaborForDate(ds, employees, shifts);
        return {
          dateStr: ds,
          label: format(d, "EEE d MMM yyyy", { locale: enUS }),
          rows,
          totals: t,
          labor,
        };
      })
      .filter((s) => s.dateStr <= todayStr)
      .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
  }, [
    periodMode,
    selectedDate,
    todayStr,
    orders,
    transactions,
    expenses,
    loyverseByDay,
    employees,
    shifts,
    storeTick,
    openingCountDiffHistory,
    pendingLedgerTimes,
  ]);

  const monthDrawerTotals = useMemo(() => {
    if (periodMode !== "month") return null;
    return monthLedgerSections.reduce(
      (acc, s) => ({
        cashIn: acc.cashIn + s.totals.cashIn,
        cashOut: acc.cashOut + s.totals.cashOut,
      }),
      { cashIn: 0, cashOut: 0 },
    );
  }, [periodMode, monthLedgerSections]);

  const laborInNet = useMemo(() => {
    if (periodMode === "month") {
      return monthLedgerSections.reduce((sum, s) => {
        const laborRow = s.rows.find((r) => r.isSyntheticLabor);
        return sum + (laborRow?.outAmount || 0);
      }, 0);
    }
    const laborRow = tableRows.find((r) => r.isSyntheticLabor);
    return laborRow?.outAmount || 0;
  }, [periodMode, tableRows, monthLedgerSections]);

  const totals = useMemo(() => {
    if (periodMode === "month" && monthDrawerTotals) {
      const net = monthDrawerTotals.cashIn - monthDrawerTotals.cashOut;
      return {
        cashIn: monthDrawerTotals.cashIn,
        cashOut: monthDrawerTotals.cashOut,
        net,
        opening: null,
        end: null,
      };
    }
    const resetTime = selectedDayManualCount ? rowSortTime(selectedDayManualCount.ts, formDayStr) : null;
    const t = sumDrawerCashTotals(tableRows, resetTime);
    const opening = selectedDayManualCount ? Number(selectedDayManualCount.enteredOpening) : getOpeningBalance(formDayStr);
    const end = opening !== null && Number.isFinite(opening) ? opening + t.net : null;
    return { ...t, opening, end };
  }, [periodMode, monthDrawerTotals, tableRows, formDayStr, storeTick, selectedDayManualCount]);

  /**
   * Expected physical drawer cash (manual count + ledger net).
   * On Difference history: always **Mexico today** (live). On Today / Month: **selected** calendar day.
   */
  const expectedCashHeroDayStr = periodMode === "history" ? todayStr : formDayStr;

  const expectedDrawerEndHero = useMemo(() => {
    const dayStr = expectedCashHeroDayStr;
    const manualCount = latestManualCountForDay(openingCountDiffHistory, dayStr);
    let rows;
    if (periodMode === "month") {
      const section = monthLedgerSections.find((s) => s.dateStr === dayStr);
      if (!section) return null;
      rows = section.rows;
    } else if (periodMode === "today" && dayStr === formDayStr) {
      rows = tableRows;
    } else {
      rows = buildLedgerRowsForMexicoDay(dayStr);
    }
    const resetTime = manualCount ? rowSortTime(manualCount.ts, dayStr) : null;
    const t = sumDrawerCashTotals(rows, resetTime);
    const opening = manualCount ? Number(manualCount.enteredOpening) : getOpeningBalance(dayStr);
    if (opening === null || !Number.isFinite(opening)) return null;
    return opening + t.net;
  }, [
    periodMode,
    expectedCashHeroDayStr,
    formDayStr,
    todayStr,
    tableRows,
    monthLedgerSections,
    openingCountDiffHistory,
    storeTick,
    buildLedgerRowsForMexicoDay,
  ]);

  const goPrevMonth = () => setSelectedDate((d) => subMonths(d, 1));
  const goNextMonth = () => setSelectedDate((d) => addMonths(d, 1));
  const goPrevDay = () => setSelectedDate((d) => addDays(d, -1));
  const goNextDay = () =>
    setSelectedDate((d) => {
      const next = addDays(d, 1);
      if (dayKey(next) > todayStr) return d;
      return next;
    });
  const isCalendarMonthCurrent = isSameMonth(selectedDate, new Date());

  const handleRegisterManualCash = async () => {
    const n = parseFloat(String(manualAmount).replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    const payload = {
      type: manualDir === "in" ? "contribution" : "withdrawal",
      contributor_name: "Manual cash",
      amount: n,
      date: formDayStr,
      payment_method: "cash",
      description:
        manualNote.trim() || (manualDir === "in" ? "Cash in (manual)" : "Cash out (manual)"),
      notes: DAILY_CASH_TX_MARKER,
      reference_number: "",
    };
    try {
      await createCompanyTx.mutateAsync(payload);
      setManualNote("");
      setManualAmount("");
      setLastRemovedManual(null);
    } catch (e) {
      console.error(e);
      alert("Could not register cash. Check your connection and try again.");
    }
  };

  const handleRemoveRow = (row) => {
    if (row.isManual && row.manualId) {
      const ledgerDay = row._ledgerDay || formDayStr;
      const full = getManualLines(ledgerDay).find((m) => m.id === row.manualId);
      removeManualLine(ledgerDay, row.manualId);
      setLastRemovedManual(full ? { kind: "legacy", dayStr: ledgerDay, line: full } : null);
      setStoreTick((t) => t + 1);
      return;
    }
    if (row.isRegisteredManual && row.transactionId) {
      const snap = transactions.find((x) => x.id === row.transactionId);
      if (!snap) return;
      deleteCompanyTx.mutate(row.transactionId, {
        onSuccess: () => {
          setLastRemovedManual({ kind: "registered", snapshot: { ...snap } });
        },
      });
    }
  };

  const handleManualCountCommentCommit = useCallback((eventId, value) => {
    updateOpeningCountDiffComment(eventId, value);
    setStoreTick((t) => t + 1);
  }, []);

  const handleManualCountDateTimeCommit = useCallback((eventId, dateKeyMexico, timeHHmm) => {
    updateOpeningCountDiffDateTime(eventId, dateKeyMexico, timeHHmm);
    setStoreTick((t) => t + 1);
  }, []);

  const handleStageLedgerTime = useCallback((ledgerDay, rowId, dateKeyMexico, timeHHmm) => {
    const key = ledgerPendingKey(ledgerDay, rowId);
    setPendingLedgerTimes((prev) => ({
      ...prev,
      [key]: { ledgerDay, rowId, dateKeyMexico, timeHHmm },
    }));
  }, []);

  const handleClearPendingLedgerTime = useCallback((ledgerDay, rowId) => {
    const key = ledgerPendingKey(ledgerDay, rowId);
    setPendingLedgerTimes((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const persistLedgerTimeCommit = useCallback(
    async (ledgerDay, rowId, dateKeyMexico, timeHHmm) => {
      const iso = mexicoWallDateTimeToUtcIso(dateKeyMexico, timeHHmm);
      if (!iso) throw new Error("Invalid date or time");

      const clearOverridesForRow = () => {
        setLedgerTimeOverride(ledgerDay, rowId, null);
        if (dateKeyMexico !== ledgerDay) {
          setLedgerTimeOverride(dateKeyMexico, rowId, null);
        }
      };

      const persistOverrideOnly = () => {
        setLedgerTimeOverride(ledgerDay, rowId, iso);
        setStoreTick((t) => t + 1);
        void flushDailyCashPersistImmediate();
      };

      if (rowId.startsWith("loyverse-") || rowId.startsWith("labor-cash-")) {
        persistOverrideOnly();
        return;
      }

      if (rowId.startsWith("manual-count-reset-")) {
        return;
      }

      if (rowId.startsWith("man-")) {
        const manualId = rowId.slice("man-".length);
        moveManualLineToDay(ledgerDay, dateKeyMexico, manualId, { createdAt: iso });
        clearOverridesForRow();
        setStoreTick((t) => t + 1);
        void flushDailyCashPersistImmediate();
        return;
      }

      if (rowId.startsWith("exp-")) {
        const id = rowId.slice("exp-".length);
        if (useLocalFinance) {
          await localUpdateExpense(id, { date: dateKeyMexico, created_date: iso });
        } else {
          await base44.entities.Expense.update(id, { date: dateKeyMexico, created_date: iso });
        }
        queryClient.invalidateQueries({ queryKey: ["expenses"] });
        clearOverridesForRow();
        setStoreTick((t) => t + 1);
        return;
      }

      if (rowId.startsWith("tx-in-") || rowId.startsWith("tx-out-")) {
        const id = rowId.startsWith("tx-in-") ? rowId.slice("tx-in-".length) : rowId.slice("tx-out-".length);
        if (useLocalFinance) {
          await localUpdateCompanyTransaction(id, { date: dateKeyMexico, created_date: iso });
        } else {
          await base44.entities.CompanyTransaction.update(id, { date: dateKeyMexico, created_date: iso });
        }
        queryClient.invalidateQueries({ queryKey: ["companyTransactions"] });
        clearOverridesForRow();
        setStoreTick((t) => t + 1);
        return;
      }

      if (rowId.startsWith("order-")) {
        const id = rowId.slice("order-".length);
        const payload = { created_date: iso, updated_date: new Date().toISOString() };
        await updateOrderEntity(id, payload, (orderId, p) => base44.entities.Order.update(orderId, p));
        queryClient.invalidateQueries({ queryKey: ["orders"] });
        clearOverridesForRow();
        setStoreTick((t) => t + 1);
        return;
      }

      persistOverrideOnly();
    },
    [queryClient, useLocalFinance],
  );

  const handleSavePendingLedgerTimes = useCallback(async () => {
    const entries = Object.entries(pendingLedgerTimes);
    if (!entries.length) return;
    setSavingLedgerTimes(true);
    const remaining =
      /** @type {Record<string, { ledgerDay: string; rowId: string; dateKeyMexico: string; timeHHmm: string }>} */ ({});
    try {
      for (const [key, e] of entries) {
        try {
          await persistLedgerTimeCommit(e.ledgerDay, e.rowId, e.dateKeyMexico, e.timeHHmm);
        } catch (err) {
          console.error("[ledgerTime]", err);
          remaining[key] = e;
        }
      }
      setPendingLedgerTimes(remaining);
      setStoreTick((t) => t + 1);
      if (Object.keys(remaining).length) {
        alert("Some rows could not be saved. Check the network and try again for the remaining edits.");
      }
    } finally {
      setSavingLedgerTimes(false);
    }
  }, [pendingLedgerTimes, persistLedgerTimeCommit]);

  const handleLedgerTimeReset = useCallback((ledgerDay, rowId) => {
    const key = ledgerPendingKey(ledgerDay, rowId);
    setPendingLedgerTimes((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setLedgerTimeOverride(ledgerDay, rowId, null);
    setStoreTick((t) => t + 1);
    void flushDailyCashPersistImmediate();
  }, []);

  const handleRemoveManualCountDiff = useCallback((eventId) => {
    if (!window.confirm("Delete this logged manual count?")) return;
    removeOpeningCountDiff(eventId);
    setStoreTick((t) => t + 1);
  }, []);

  const handleUndoManual = async () => {
    if (!lastRemovedManual) return;
    if (lastRemovedManual.kind === "legacy") {
      addManualLine(lastRemovedManual.dayStr, lastRemovedManual.line);
      setLastRemovedManual(null);
      setStoreTick((t) => t + 1);
      return;
    }
    if (lastRemovedManual.kind === "registered" && lastRemovedManual.snapshot) {
      const { id: _id, created_date: _c, ...rest } = lastRemovedManual.snapshot;
      try {
        await createCompanyTx.mutateAsync(rest);
        setLastRemovedManual(null);
      } catch (e) {
        console.error(e);
        alert("Could not undo. Try again.");
      }
    }
  };

  const handleDetailCommit = useCallback(
    async (row, text) => {
      const trimmed = text.trim();
      const baseDetail = row.detail;

      try {
        const ledgerDay = row._ledgerDay || formDayStr;
        if (row.id.startsWith("loyverse-")) {
          if (trimmed === baseDetail) {
            setDetailOverride(ledgerDay, row.id, null);
          } else {
            setDetailOverride(ledgerDay, row.id, trimmed);
          }
          setStoreTick((t) => t + 1);
          return;
        }

        if (row.id.startsWith("labor-cash-")) {
          if (trimmed === baseDetail) {
            setDetailOverride(ledgerDay, row.id, null);
          } else {
            setDetailOverride(ledgerDay, row.id, trimmed);
          }
          setStoreTick((t) => t + 1);
          return;
        }

        if (row.id.startsWith("order-")) {
          const orderId = row.id.slice("order-".length);
          await saveOrderDetail.mutateAsync({
            id: orderId,
            data: { customer_name: detailEditToCustomerName(text) },
          });
          return;
        }

        if ((row.id.startsWith("tx-in-") || row.id.startsWith("tx-out-")) && row.transactionId) {
          const fallback = row.inAmount != null ? "Cash contribution" : "Cash withdrawal";
          await saveTransactionDescription.mutateAsync({
            id: row.transactionId,
            data: { description: trimmed || fallback },
          });
          return;
        }

        if (row.id.startsWith("exp-")) {
          const expId = row.id.slice("exp-".length);
          await saveExpenseDetail.mutateAsync({
            id: expId,
            data: { name: trimmed || "Expense" },
          });
          return;
        }

        if (row.isManual && row.manualId) {
          updateManualLine(ledgerDay, row.manualId, { note: trimmed || "Adjustment" });
          setStoreTick((t) => t + 1);
        }
      } catch (e) {
        console.error(e);
        alert("Could not save detail. Try again.");
      }
    },
    [formDayStr, saveOrderDetail, saveTransactionDescription, saveExpenseDetail],
  );

  const weekday = formatMexicoWeekdayLongEn(heroDate);
  const longDate = formatMexicoLongDateEn(heroDate);

  const renderLedgerTableRows = (rows, sectionDayStr) => {
    const ov = getDetailOverrides(sectionDayStr);
    const sectionManualCount = latestManualCountForDay(openingCountDiffHistory, sectionDayStr);
    const sectionResetTime = sectionManualCount ? rowSortTime(sectionManualCount.ts, sectionDayStr) : null;
    return rows.flatMap((r, i) => {
      const expandKey = `${sectionDayStr}::${r.id}`;
      const isExpanded = expandedLedgerKey === expandKey;
      const canExpand = Boolean(r.receipt || r.order);
      const rowStripe = i % 2 === 1 ? "bg-black/20" : "bg-transparent";
      const excludedByManualCount =
        sectionResetTime != null && !r.isManualCountReset && Number.isFinite(r.sortTime) && r.sortTime <= sectionResetTime;

      const mainTr = (
        <tr
          key={`${sectionDayStr}-${r.id}`}
          className={cn(
            "border-b border-yellow-500/10 transition-colors hover:bg-yellow-500/[0.03]",
            rowStripe,
            r.isManualCountReset && "bg-emerald-500/[0.06] hover:bg-emerald-500/[0.09]",
            excludedByManualCount && "opacity-45",
          )}
          title={excludedByManualCount ? "Before the latest manual count, so it is not included in End cash." : undefined}
        >
          <td className="w-10 px-1 py-1 align-middle">
            {canExpand ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 text-gray-500 hover:bg-yellow-500/10 hover:text-yellow-200"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Hide details" : "Show details"}
                onClick={() => setExpandedLedgerKey((prev) => (prev === expandKey ? null : expandKey))}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            ) : (
              <span className="inline-block w-8" />
            )}
          </td>
          <td className="min-w-[10rem] px-2 py-1 align-top tabular-nums text-gray-500">
            <LedgerTimeCell
              row={r}
              ledgerDay={sectionDayStr}
              pendingEdit={pendingLedgerTimes[ledgerPendingKey(sectionDayStr, r.id)]}
              onStageChange={handleStageLedgerTime}
              onClearPending={handleClearPendingLedgerTime}
              onReset={(rowId) => handleLedgerTimeReset(sectionDayStr, rowId)}
            />
          </td>
          <td className={cn("px-3 py-2 text-gray-300", r.isManualCountReset && "font-semibold text-emerald-200")}>
            {r.source}
          </td>
          <td className="px-2 py-1 align-middle text-gray-400">
            {r.isManualCountReset ? (
              <span className="block px-1 py-1 text-emerald-100/90">{r.detail}</span>
            ) : (
              <LedgerDetailCell
                displayDetail={ov[r.id] ?? r.detail}
                onCommit={(value) => handleDetailCommit(r, value)}
              />
            )}
          </td>
          <td className="px-3 py-2 text-right font-medium tabular-nums text-emerald-300/90">
            {r.inAmount != null ? formatMx(r.inAmount) : "—"}
          </td>
          <td
            className={cn(
              "px-3 py-2 text-right font-medium tabular-nums",
              r.outAmount != null ? "text-rose-300/85" : r.ledgerOutAmount != null ? "text-gray-500" : "",
            )}
            title={
              r.isSyntheticLabor
                ? "Out amount is net of Finance salaries already paid from cash today."
                : r.ledgerOutAmount != null
                  ? "Not deducted from drawer — expense paid from account, card, or individual"
                  : undefined
            }
          >
            {r.outAmount != null
              ? formatMx(r.outAmount)
              : r.ledgerOutAmount != null
                ? formatMx(r.ledgerOutAmount)
                : "—"}
          </td>
          <td className="px-1 py-1 text-right">
            {r.isManual || r.isRegisteredManual ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={deleteCompanyTx.isPending}
                className="h-8 w-8 text-gray-500 hover:bg-rose-950/40 hover:text-rose-400 disabled:opacity-40"
                onClick={() => handleRemoveRow(r)}
                aria-label={r.isRegisteredManual ? "Remove registered cash entry" : "Remove manual line"}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <span className="inline-block w-8" />
            )}
          </td>
        </tr>
      );

      if (!canExpand || !isExpanded) return [mainTr];

      const detailTr = (
        <tr key={`${sectionDayStr}-${r.id}-detail`} className={rowStripe}>
          <td colSpan={7} className="border-b border-yellow-500/10 px-3 pb-3 pt-0">
            {r.receipt ? (
              <LoyverseLedgerDetailPanel
                receipt={r.receipt}
                customerById={loyverseCustomerById}
                employeeById={loyverseEmployeeById}
                storeById={loyverseStoreById}
              />
            ) : (
              <AppOrderLedgerDetailPanel order={r.order} />
            )}
          </td>
        </tr>
      );

      return [mainTr, detailTr];
    });
  };

  const differenceHistoryPanel = (
    <div className="rounded-xl border border-amber-500/20 bg-[#14120c] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Table scope
          </span>
          <span>
            Every row is <span className="font-medium text-gray-300">one saved count</span> for one Mexico day — not filtered by the
            month you might have open elsewhere.
          </span>
        </div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-500/90">All logged manual counts</p>
      <p className="mt-1 text-xs text-gray-500">
        Each row is a saved physical count (Mexico calendar day) with the calculated expected drawer total, your actual count, and
        the <span className="text-gray-400">± difference</span> (green = over expected, red = under).{" "}
        <span className="text-gray-400">
          “Logged at” uses Mexico time — edit date/time if you counted after the fact so the ledger order and End cash match reality.
        </span>{" "}
        Optional comment for variance notes.{" "}
        {isLocalOnlyMode ? (
          <>Stored in this browser in local dev — switch to </>
        ) : (
          <>Synced to your workspace — switch to </>
        )}
        <strong className="text-gray-300">Today</strong> to add entries.
      </p>
      <div className="mt-3 max-h-[min(75vh,880px)] overflow-auto rounded-lg border border-yellow-500/15">
        <table className="w-full min-w-[900px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-yellow-500/20 bg-yellow-500/10 text-[10px] font-semibold uppercase tracking-wide text-yellow-200/90">
              <th className="px-2 py-2">Logged at (Mexico)</th>
              <th className="px-2 py-2">Count day</th>
              <th className="px-2 py-2">Expected source</th>
              <th className="px-2 py-2">Comment</th>
              <th className="px-2 py-2 text-right">Expected</th>
              <th className="px-2 py-2 text-right">Actual manual</th>
              <th className="px-2 py-2 text-right">Diff</th>
              <th className="w-10 px-1 py-2" />
            </tr>
          </thead>
          <tbody>
            {openingCountDiffHistory.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center text-sm text-gray-500">
                  No manual counts yet. Open <strong className="text-gray-300">Today</strong>, enter the MXN in the drawer, leave the
                  field (blur) to save — each save appears here with expected vs actual and the difference.
                </td>
              </tr>
            ) : (
              openingCountDiffHistory.map((ev) => (
                <tr key={ev.id} className="border-b border-yellow-500/10 text-gray-300">
                  <td className="px-2 py-1.5 align-top">
                    <ManualCountWhenCell ev={ev} onCommit={handleManualCountDateTimeCommit} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">{ev.dateKey}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-gray-400">
                    {ev.priorCloseDayStr || "No prior close"}
                  </td>
                  <td className="max-w-[240px] px-2 py-1.5">
                    <Input
                      defaultValue={ev.comment || ""}
                      onBlur={(e) => handleManualCountCommentCommit(ev.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      placeholder="Why?"
                      className="h-7 border-yellow-500/15 bg-black/20 px-2 text-[11px] text-gray-200 placeholder:text-gray-700"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-gray-400">
                    {ev.expectedEnd == null ? "-" : formatMx(ev.expectedEnd)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono tabular-nums text-yellow-100/90">
                    {formatMx(ev.enteredOpening)}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right font-mono font-medium tabular-nums",
                      ev.diff == null ? "text-gray-500" : ev.diff > 0 ? "text-emerald-400/90" : "text-rose-400/90",
                    )}
                  >
                    {ev.diff == null ? "-" : `${ev.diff > 0 ? "+" : ""}${formatMx(ev.diff)}`}
                  </td>
                  <td className="px-1 py-1.5 text-right">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-gray-600 hover:bg-rose-950/40 hover:text-rose-300"
                      onClick={() => handleRemoveManualCountDiff(ev.id)}
                      aria-label="Delete logged manual count"
                      title="Delete logged manual count"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0f0c] text-white">
      <div className="relative overflow-hidden border-b border-yellow-500/15 bg-gradient-to-br from-[#1a1810] via-[#14120c] to-[#0c0c0a]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(250,204,21,0.12),transparent)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl border border-yellow-500/25 bg-yellow-400/10 shadow-[0_0_24px_rgba(250,204,21,0.12)]">
                <Banknote className="h-5 w-5 text-yellow-400" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-yellow-500/80">
                  Daily cash
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-yellow-100 sm:text-3xl">
                  Register & movement
                </h1>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-400 sm:text-[0.9375rem] sm:leading-relaxed">
                  {periodMode === "history" ? (
                    <>
                      <strong className="font-medium text-gray-200">Difference history</strong> is a read-only audit of every
                      saved manual cash count: timestamp, optional comment, <strong className="font-medium text-gray-200">expected</strong>{" "}
                      drawer from calculations, your <strong className="font-medium text-gray-200">actual</strong> count, and{" "}
                      <strong className="font-medium text-gray-200">± difference</strong>. Add new counts on{" "}
                      <strong className="font-medium text-gray-200">Today</strong>.{" "}
                      {isLocalOnlyMode ? (
                        <>In this local dev session, counts stay in the browser only.</>
                      ) : (
                        <>Counts sync to your workspace so they survive clearing browser data.</>
                      )}
                    </>
                  ) : (
                    <>
                      <strong className="font-medium text-gray-200">Cash in/out</strong> follows the physical drawer (Loyverse cash,
                      cash orders, manual cash, and Finance expenses paid from <strong className="font-medium text-gray-200">Cash</strong>
                      ). <strong className="font-medium text-gray-200">All other expenses</strong> for the same day (account, card,
                      individual) also appear in muted amounts so nothing is hidden — they do not change drawer math.{" "}
                      <strong className="font-medium text-gray-200">Today</strong> is one Mexico calendar day at a time (not past
                      today). <strong className="font-medium text-gray-200">Month</strong> lists each day in the month.{" "}
                      {isLocalOnlyMode ? (
                        <>Manual counts and drawer data stay in this browser in local dev.</>
                      ) : (
                        <>Manual counts and drawer totals sync to app settings when you are signed in.</>
                      )}
                    </>
                  )}
                </p>
                <div
                  className="mt-4 inline-flex rounded-xl border border-yellow-500/40 bg-[#0c0c0a]/90 p-1 shadow-inner shadow-black/40"
                  role="group"
                  aria-label="Daily cash view: Today, Month, or Difference history"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPeriodMode("today")}
                    className={cn(
                      "h-9 rounded-lg px-4 text-sm font-semibold transition-all",
                      periodMode === "today"
                        ? "bg-yellow-400 text-black shadow-sm hover:bg-yellow-300"
                        : "text-gray-200 hover:bg-yellow-500/15 hover:text-yellow-50"
                    )}
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPeriodMode("month")}
                    className={cn(
                      "h-9 rounded-lg px-4 text-sm font-semibold transition-all",
                      periodMode === "month"
                        ? "bg-yellow-400 text-black shadow-sm hover:bg-yellow-300"
                        : "text-gray-200 hover:bg-yellow-500/15 hover:text-yellow-50"
                    )}
                  >
                    Month
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPeriodMode("history")}
                    className={cn(
                      "h-9 rounded-lg px-3 text-xs font-semibold transition-all sm:px-4 sm:text-sm",
                      periodMode === "history"
                        ? "bg-yellow-400 text-black shadow-sm hover:bg-yellow-300"
                        : "text-gray-200 hover:bg-yellow-500/15 hover:text-yellow-50"
                    )}
                  >
                    Difference history
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-yellow-500/15 bg-black/25 px-3 py-2 text-[11px] text-gray-400">
                  <span className="shrink-0 rounded border border-yellow-500/25 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-yellow-500/90">
                    View scope
                  </span>
                  <span>
                    {periodMode === "history" ? (
                      <>
                        <span className="font-medium text-gray-300">All saved counts</span> — any Mexico day, newest first in the
                        table. <span className="text-gray-500">Live drawer expectation stays on the right (always Mexico today).</span>
                      </>
                    ) : periodMode === "month" ? (
                      <>
                        <span className="font-medium text-gray-300">Whole month</span>{" "}
                        <span className="tabular-nums text-yellow-200/70">{format(selectedDate, "MMMM yyyy", { locale: enUS })}</span>
                        {" — "}
                        ledger lists each day ≤ today; manual count box uses the day you pick in the header.
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-gray-300">Single day</span>{" "}
                        <span className="tabular-nums text-yellow-200/70">{formDayStr}</span> — cards, labor callout, and ledger below
                        all match this Mexico date.
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-0.5 sm:pb-1">
              {periodMode === "history" ? (
                <p className="max-w-[16rem] pb-1 text-right text-[11px] leading-snug text-gray-500 sm:max-w-[22rem]">
                  Audit log only — switch to <span className="text-gray-400">Today</span> to add counts
                </p>
              ) : periodMode === "month" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={goPrevMonth}
                    className="h-11 w-11 rounded-xl border-yellow-500/25 bg-black/20 text-yellow-200 hover:bg-yellow-500/10"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-11 w-11 rounded-xl border-yellow-500/25 bg-black/20 text-yellow-300 hover:bg-yellow-500/10"
                        aria-label="Pick date in month"
                      >
                        <CalendarDays className="h-5 w-5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto border border-yellow-500/30 bg-[#1a1810] p-2 text-gray-100 shadow-xl"
                      align="end"
                    >
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => {
                          if (d) {
                            setSelectedDate(d);
                            setCalendarOpen(false);
                          }
                        }}
                        initialFocus
                        className="rounded-lg [--cell-size:2.25rem]"
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={goNextMonth}
                    className="h-11 w-11 rounded-xl border-yellow-500/25 bg-black/20 text-yellow-200 hover:bg-yellow-500/10"
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={goPrevDay}
                    className="h-9 w-9 rounded-lg text-yellow-200/80 hover:bg-yellow-500/10 hover:text-yellow-100"
                    aria-label="Previous day"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-yellow-200/70 hover:bg-yellow-500/10 hover:text-yellow-100"
                        aria-label="Pick day"
                      >
                        <CalendarDays className="h-4 w-4 opacity-80" strokeWidth={1.5} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto border border-yellow-500/30 bg-[#1a1810] p-2 text-gray-100 shadow-xl"
                      align="end"
                    >
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => {
                          if (d) {
                            setSelectedDate(d);
                            setCalendarOpen(false);
                          }
                        }}
                        disabled={(d) => dayKey(d) > todayStr}
                        initialFocus
                        className="rounded-lg [--cell-size:2.25rem]"
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={goNextDay}
                    disabled={formDayStr >= todayStr}
                    className="h-9 w-9 rounded-lg text-yellow-200/80 hover:bg-yellow-500/10 hover:text-yellow-100 disabled:opacity-25"
                    aria-label="Next day"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="relative rounded-2xl border border-yellow-500/20 bg-black/25 px-6 py-8 shadow-[inset_0_1px_0_rgba(250,204,21,0.06)] sm:px-10 sm:py-10 sm:pr-40">
            {periodMode === "today" && viewingToday && (
              <span className="absolute right-6 top-6 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-yellow-300">
                Today
              </span>
            )}
            {periodMode === "month" && isCalendarMonthCurrent && (
              <span className="absolute right-6 top-6 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-yellow-400/90">
                This month
              </span>
            )}
            {periodMode === "history" && (
              <span className="absolute right-6 top-6 rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-200/90">
                Audit log
              </span>
            )}
            <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
              <div className="min-w-0 flex-1">
                <p
                  className="text-4xl font-extralight tracking-[-0.04em] text-yellow-50 sm:text-5xl md:text-6xl"
                  style={{ fontFeatureSettings: '"ss01", "cv02"' }}
                >
                  {periodMode === "history"
                    ? "Difference history"
                    : periodMode === "month"
                      ? format(selectedDate, "MMMM yyyy", { locale: enUS })
                      : weekday}
                </p>
                <p className="mt-2 text-lg font-medium text-yellow-500/90 sm:text-xl">
                  {periodMode === "history"
                    ? "Expected drawer vs manual count · every save with timestamp"
                    : periodMode === "month"
                      ? "All days · incomes & expenses in the list below"
                      : longDate}
                </p>
                {laborCalendarHeroTitle != null && (
                  <div className="mt-5 inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border border-yellow-500/15 bg-black/20 px-3 py-2 text-xs sm:text-sm">
                    <span className="font-medium text-yellow-200/90">{laborCalendarHeroTitle}</span>
                    <span className="text-gray-500">Expected cash wages from employee calendar</span>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-yellow-500/15 pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-yellow-500/75">
                  Expected company cash
                </p>
                <p className="mt-1.5 max-w-[19rem] text-[11px] leading-relaxed text-gray-500">
                  {periodMode === "history" ? (
                    <>
                      <span className="font-medium text-yellow-600/85">Live · Mexico today</span>{" "}
                      <span className="tabular-nums text-gray-400">({todayStr})</span> — physical drawer: manual count + cash in/out
                      through the drawer. The audit table below covers <span className="text-gray-400">all days</span>, not only
                      today.
                    </>
                  ) : periodMode === "month" ? (
                    <>
                      <span className="font-medium text-gray-300">Selected header day</span>{" "}
                      <span className="tabular-nums text-gray-400">{formDayStr}</span> — same as{" "}
                      <span className="text-yellow-600/90">End cash</span> for that day. Month ledger further down lists every day in
                      the month separately.
                    </>
                  ) : (
                    <>
                      Physical drawer for Mexico day{" "}
                      <span className="font-medium tabular-nums text-gray-400">{formDayStr}</span>: manual count + cash in/out
                      through the drawer. Same as <span className="text-yellow-600/90">End cash</span> below — updates live.
                    </>
                  )}
                </p>
                <p
                  className="mt-4 text-4xl font-light tabular-nums tracking-tight text-yellow-100 sm:text-5xl md:text-6xl"
                  style={{ fontFeatureSettings: '"tnum", "ss01"' }}
                  aria-live="polite"
                >
                  {expectedDrawerEndHero != null ? formatMx(expectedDrawerEndHero) : "—"}
                </p>
                <p className="mt-2 text-[10px] font-medium uppercase tracking-widest text-gray-600">MXN · in drawer</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {periodMode === "history" ? (
          differenceHistoryPanel
        ) : (
        <>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-yellow-500/15 bg-[#14120c] px-3 py-2 text-[11px] text-gray-400">
          <span className="rounded border border-yellow-500/25 bg-yellow-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-yellow-600/90">
            Block scope
          </span>
          {periodMode === "month" ? (
            <span>
              Manual count, net, end cash, register cash, labor, and ledger below follow{" "}
              <span className="font-medium text-yellow-200/80">this month + header day {formDayStr}</span> (see View scope above).
            </span>
          ) : (
            <span>
              Everything in this section is for <span className="font-medium tabular-nums text-yellow-200/80">{formDayStr}</span>{" "}
              only (Mexico).
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-yellow-500/15 bg-[#161612] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              {periodMode === "month" ? "Manual counting (month)" : "Manual counting"}
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="pb-2 text-sm text-gray-500">MXN</span>
              <Input
                type="text"
                inputMode="decimal"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                onBlur={persistOpening}
                placeholder="Manual count"
                readOnly={periodMode === "month"}
                className="h-11 border-yellow-500/20 bg-[#0f0f0c] text-xl font-semibold tabular-nums text-yellow-100 placeholder:text-gray-600 read-only:cursor-default read-only:opacity-90"
              />
            </div>
            <div className="mt-2 space-y-2 text-[11px] text-gray-600">
              {periodMode === "month" ? (
                <p>
                  {monthEarliestOpening ? (
                    <>
                      Earliest manual count saved this month:{" "}
                      <span className="tabular-nums text-gray-400">{formatMexicoDateShort(monthEarliestOpening.dateKey)}</span>
                      . Use Today to edit a specific day.
                    </>
                  ) : (
                    "No manual counting saved for any day in this month (Mexico calendar). Use Today to add one."
                  )}
                </p>
              ) : (
                <>
                  {persistedOpening === null ? (
                    <p className="font-medium text-amber-300/90">Manual counting not done this day.</p>
                  ) : (
                    <p>
                      Updated cash from manual count at{" "}
                      <span className="font-medium tabular-nums text-gray-300">
                        {formatMexicoDateShort(openingCountMeta?.updatedAt || formDayStr)}{" "}
                        {formatMexicoTime(openingCountMeta?.updatedAt)}
                      </span>
                      . End cash = manual count + net for the day.
                    </p>
                  )}
                  <p>
                    Enter the exact physical cash count for {formDayStr}. Saving a number records the update time and compares it
                    with the calculated expected value.
                  </p>
                  {priorDrawerClose ? (
                    <div className="border-t border-yellow-500/10 pt-2">
                      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gray-500">
                        Expected from calculations
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-yellow-100/90">{formatMx(priorDrawerClose.end)}</p>
                      <p className="mt-0.5 text-[10px] text-gray-500">
                        Prior drawer close ·{" "}
                        {formatMexicoMonthShortDayYearEn(`${priorDrawerClose.closeDayStr}T12:00:00`)}
                      </p>
                    </div>
                  ) : null}
                  {openingDiffVsPriorClose != null && priorDrawerClose ? (
                    <p
                      className={cn(
                        "text-[11px] tabular-nums",
                        openingDiffVsPriorClose > 0 ? "text-emerald-400/85" : "text-rose-400/85",
                      )}
                    >
                      vs prior close ({formatMexicoMonthShortDayYearEn(`${priorDrawerClose.closeDayStr}T12:00:00`)}):{" "}
                      {openingDiffVsPriorClose > 0 ? "+" : ""}
                      {formatMx(openingDiffVsPriorClose)}
                    </p>
                  ) : null}
                  <div className="pt-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      Comment (optional)
                    </Label>
                    <Input
                      type="text"
                      value={openingComment}
                      onChange={(e) => setOpeningComment(e.target.value)}
                      onBlur={persistOpening}
                      placeholder="Why does it differ?"
                      className="mt-1 h-9 border-yellow-500/15 bg-[#0f0f0c] text-xs text-gray-200 placeholder:text-gray-600"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-yellow-500/15 bg-[#161612] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
              {periodMode === "month" ? "Net cash drawer (month)" : "Net cash (day)"}
            </p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums",
                totals.net >= 0 ? "text-emerald-400/95" : "text-rose-400/95",
              )}
            >
              {formatMx(totals.net)}
            </p>
            <p className="mt-2 text-[11px] text-gray-600">
              In {formatMx(totals.cashIn)} · Out {formatMx(totals.cashOut)}
              {periodMode === "month" ? " · drawer only" : selectedDayManualCount ? " · after manual count" : ""}
            </p>
            {laborInNet > 0 && (
              <p className="mt-1 text-[11px] text-sky-400/80">
                Of which salary: {formatMx(laborInNet)}
              </p>
            )}
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-gradient-to-br from-[#1f1c12] to-[#14120c] p-4 shadow-[0_0_40px_rgba(250,204,21,0.06)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-yellow-600/90">
              {periodMode === "month" ? "End cash (use Today)" : "End cash"}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-yellow-200">
              {totals.end !== null ? formatMx(totals.end) : "—"}
            </p>
            <p className="mt-2 text-[11px] text-yellow-700/80">
              {periodMode === "month"
                ? "Manual counts apply per day in Today view"
                : totals.opening !== null
                  ? selectedDayManualCount
                    ? "Manual count + net after that time"
                    : "Manual count + net for the day"
                  : "Manual counting not done this day"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/25 bg-[#101820] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-500/90">Labor (employees)</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs text-gray-500">
                {periodMode === "month"
                  ? `Expected labor for ${formDayStr} (calendar) — each day in the list shows its own total`
                  : "Expected labor (unpaid shifts + workdays without a shift row)"}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-sky-200">{formatMx(expectedLaborDay)}</p>
            </div>
            <p className="max-w-xl text-[11px] leading-relaxed text-gray-500 sm:text-right">
              Matches Dashboard logic for this date: shift amounts until paid, plus daily wage (or 8h × hourly) for active
              staff on their workdays when no calendar shift exists. The ledger adds a <strong className="text-gray-400">Labor (cash)</strong>{" "}
              row for the drawer impact (net of salaries already logged from cash that day); paid salaries also appear as Finance
              expenses.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-yellow-500/15 bg-[#161612] p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-yellow-200">Register manual cash</h2>
              <p className="text-[11px] text-gray-500">
                Creates a <strong className="text-gray-400">company cash transaction</strong> for{" "}
                <strong className="text-yellow-200/80">{formDayStr}</strong>
                {periodMode === "month"
                  ? " (pick the day with the calendar in the header). Visible under Finance / Company account."
                  : " (visible under Finance / Company account)."}
                {useLocalFinance ? " In local finance dev mode, rows stay in this browser." : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!lastRemovedManual || createCompanyTx.isPending}
              onClick={() => void handleUndoManual()}
              className="h-8 gap-1.5 border-yellow-500/30 text-gray-200 hover:bg-yellow-500/10 disabled:opacity-30"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo last removed
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[8rem] flex-1 space-y-1.5">
              <Label className="text-[10px] text-gray-500">Note</Label>
              <Input
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="e.g. Coin bag, rounding"
                className="h-9 border-yellow-500/20 bg-[#0f0f0c] text-sm"
              />
            </div>
            <div className="w-full space-y-1.5 sm:w-28">
              <Label className="text-[10px] text-gray-500">Amount</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 border-yellow-500/20 bg-[#0f0f0c] text-sm tabular-nums"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-yellow-500/15 bg-black/30 p-0.5">
              <button
                type="button"
                onClick={() => setManualDir("in")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  manualDir === "in" ? "bg-yellow-400 text-black" : "text-gray-400 hover:text-white",
                )}
              >
                In
              </button>
              <button
                type="button"
                onClick={() => setManualDir("out")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  manualDir === "out" ? "bg-rose-500/90 text-white" : "text-gray-400 hover:text-white",
                )}
              >
                Out
              </button>
            </div>
            <Button
              type="button"
              disabled={createCompanyTx.isPending}
              onClick={() => void handleRegisterManualCash()}
              className="h-9 gap-1.5 bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {createCompanyTx.isPending ? "Saving…" : "Register cash"}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-yellow-500/20 bg-[#10100c]">
          <div className="border-b border-yellow-500/15 bg-[#1a1810] px-4 py-2.5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-600/90">
              {periodMode === "month" ? "Month ledger (day by day)" : "Day ledger"}
            </h2>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500">
              {periodMode === "month"
                ? `Each section is one Mexico day in ${format(selectedDate, "MMMM yyyy", { locale: enUS })} · days after today hidden`
                : `Mexico day ${formDayStr} · totals row matches the cards above`}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
              Every <strong className="font-medium text-gray-300">Finance expense</strong> is listed.{" "}
              <strong className="font-medium text-rose-300/80">Out</strong> in full color hits the cash drawer;{" "}
              <strong className="font-medium text-gray-400">muted Out</strong> is non-drawer (card/account/individual). Includes
              Loyverse <strong className="text-gray-300">cash / Efectivo</strong> (each tender line),{" "}
              <strong className="text-gray-300">cash refunds</strong>, delivered cash orders, company transactions, and manual
              lines. Expected <strong className="text-gray-300">staff wages paid from cash</strong> appear as{" "}
              <strong className="text-gray-300">Labor (cash)</strong> OUT when not already covered by a Finance salary expense from
              the drawer that day. A <strong className="text-gray-300">Manual count</strong> row resets End cash from that exact
              Puerto Escondido time; older rows stay visible but no longer affect the after-count total. Rows are{" "}
              <strong className="text-gray-300">newest first</strong>. Use{" "}
              <strong className="text-gray-300">▾</strong> on Loyverse and app cash orders for ticket notes, channel, table, and
              line items. In <strong className="text-gray-300">Month</strong>, each date is a section (newest day first; future
              days hidden) with subtotals + labor (header). Click detail to edit (blur or Enter).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-yellow-500/20 bg-[#14120c] text-left text-[10px] font-semibold uppercase tracking-wider text-yellow-600/90">
                  <th className="w-10 px-1 py-2.5" aria-label="Expand" />
                  <th className="whitespace-nowrap px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="min-w-[12rem] px-3 py-2.5">Detail</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right text-emerald-500/90">In</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right text-rose-400/90">Out</th>
                  <th className="w-12 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {periodMode === "month" ? (
                  monthLedgerSections.map((section) => (
                    <Fragment key={section.dateStr}>
                      <tr className="border-b border-yellow-500/30 bg-yellow-500/10">
                        <td colSpan={7} className="px-3 py-2.5 text-xs font-semibold leading-relaxed text-yellow-100">
                          <span className="text-yellow-200">{section.label}</span>
                          <span className="ml-2 font-normal text-gray-400">
                            Drawer: In {formatMx(section.totals.cashIn)} · Out {formatMx(section.totals.cashOut)} · Net{" "}
                            {formatMx(section.totals.net)}
                          </span>
                          <span className="ml-2 font-normal text-sky-300/90">Labor {formatMx(section.labor)}</span>
                        </td>
                      </tr>
                      {section.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="border-b border-yellow-500/10 px-4 py-4 text-center text-sm text-gray-600">
                            No movements or expenses this day.
                          </td>
                        </tr>
                      ) : (
                        renderLedgerTableRows(section.rows, section.dateStr)
                      )}
                    </Fragment>
                  ))
                ) : tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-gray-500">
                      No cash movements or expenses for this day.
                    </td>
                  </tr>
                ) : (
                  renderLedgerTableRows(tableRows, formDayStr)
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-yellow-500/25 bg-[#181610] text-sm font-semibold">
                  <td colSpan={4} className="px-3 py-3 text-right uppercase tracking-[0.18em] text-yellow-600/90">
                    Total
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-emerald-300/95">
                    {formatMx(totals.cashIn)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-rose-300/95">
                    {formatMx(totals.cashOut)}
                  </td>
                  <td className="px-2 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-yellow-500/15 bg-[#14120c] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-gray-500">
              {pendingLedgerCount > 0 ? (
                <>
                  <span className="font-medium text-amber-200/90">{pendingLedgerCount} unsaved time change(s).</span> Use{" "}
                  <strong className="text-gray-300">Save time changes</strong> to write to the database (or app settings for
                  Loyverse rows).
                </>
              ) : (
                <>
                  After changing date or time in the <strong className="text-gray-400">Time</strong> column, click{" "}
                  <strong className="text-gray-300">Save time changes</strong> so updates persist and the list stays sorted.
                </>
              )}
            </p>
            <Button
              type="button"
              disabled={pendingLedgerCount === 0 || savingLedgerTimes}
              onClick={() => void handleSavePendingLedgerTimes()}
              className="h-9 shrink-0 gap-2 bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-40"
            >
              {savingLedgerTimes ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {savingLedgerTimes ? "Saving…" : "Save time changes"}
            </Button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
