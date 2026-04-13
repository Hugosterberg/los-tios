import { eachDayOfInterval, format, getISODay, parseISO } from "date-fns";

/** Persisted at end of notes: ISO weekdays 1=Mon … 7=Sun */
export const WORK_DAYS_NOTE_RE = /\[lt_work_days:([0-7,]+)\]\s*$/;

/** Persisted at end of notes after work_days: default shift window for templates / accrual */
export const WORK_HOURS_NOTE_RE = /\[lt_default_hours:([^\]]+)\]\s*$/;

export const WORK_DAY_DEFS = [
  { key: "mon", label: "Mon", iso: 1 },
  { key: "tue", label: "Tue", iso: 2 },
  { key: "wed", label: "Wed", iso: 3 },
  { key: "thu", label: "Thu", iso: 4 },
  { key: "fri", label: "Fri", iso: 5 },
  { key: "sat", label: "Sat", iso: 6 },
  { key: "sun", label: "Sun", iso: 7 },
];

export function defaultWorkDayChecks() {
  return { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false };
}

function checksFromIsoSet(set) {
  const o = {};
  for (const d of WORK_DAY_DEFS) {
    o[d.key] = set.has(d.iso);
  }
  return o;
}

export function isoDaysFromChecks(checks) {
  return WORK_DAY_DEFS.filter((d) => checks[d.key]).map((d) => d.iso);
}

/** @param {Record<string, boolean>} checks */
export function parseWorkDaysFromEmployee(employee) {
  if (!employee) return defaultWorkDayChecks();
  const raw = employee.work_days;
  if (typeof raw === "string" && raw.trim()) {
    const set = new Set(
      raw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n >= 1 && n <= 7),
    );
    if (set.size) return checksFromIsoSet(set);
  }
  const m = String(employee.notes || "").match(WORK_DAYS_NOTE_RE);
  if (m) {
    const set = new Set(
      m[1]
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => n >= 1 && n <= 7),
    );
    if (set.size) return checksFromIsoSet(set);
  }
  return defaultWorkDayChecks();
}

/** True if workdays were saved on the employee (avoid treating parser defaults as real schedule). */
export function hasExplicitWorkDaysConfig(employee) {
  if (!employee) return false;
  if (typeof employee.work_days === "string" && employee.work_days.trim()) return true;
  return WORK_DAYS_NOTE_RE.test(String(employee.notes || ""));
}

/** Whether `day` (calendar Date) is a configured work weekday for this employee. */
export function employeeWorksOnCalendarDate(employee, day) {
  if (!employee || employee.is_active === false) return false;
  if (!hasExplicitWorkDaysConfig(employee)) return false;
  const iso = getISODay(day);
  const checks = parseWorkDaysFromEmployee(employee);
  const def = WORK_DAY_DEFS.find((d) => d.iso === iso);
  return def ? Boolean(checks[def.key]) : false;
}

/** True if any active employee has this calendar weekday in their saved workdays. */
export function anyActiveEmployeeWorksOnCalendarDate(employees, day) {
  if (!Array.isArray(employees)) return false;
  for (const e of employees) {
    if (!e || e.is_active === false) continue;
    if (employeeWorksOnCalendarDate(e, day)) return true;
  }
  return false;
}

export function stripWorkDaysTag(notes) {
  return String(notes || "")
    .replace(/\[lt_work_days:[0-7,]+\]/gi, "")
    .replace(WORK_DAYS_NOTE_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether bulk tools (e.g. weekly template “Create shifts”) may add shifts for this person.
 * Default true when unset — backward compatible.
 */
export function getAutoRegisterShifts(employee) {
  if (!employee) return true;
  const v = employee.auto_register_shifts;
  if (typeof v === "boolean") return v;
  if (v === "0" || v === 0 || v === "false" || v === false) return false;
  if (v === "1" || v === 1 || v === "true" || v === true) return true;
  return true;
}

export function stripWorkHoursTag(notes) {
  return String(notes || "")
    .replace(/\[lt_default_hours:[^\]]+\]\s*/g, "")
    .replace(/\s+$/, "");
}

/** @returns {{ defaultShiftStart: string, defaultShiftEnd: string }} */
export function parseDefaultWorkHoursFromEmployee(employee) {
  const fallback = { defaultShiftStart: "09:00", defaultShiftEnd: "17:00" };
  const m = String(employee?.notes || "").match(WORK_HOURS_NOTE_RE);
  if (!m) return fallback;
  const inner = m[1].trim();
  const dash = inner.indexOf("-");
  if (dash === -1) return fallback;
  const start = inner.slice(0, dash).trim();
  const end = inner.slice(dash + 1).trim();
  if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) return fallback;
  return { defaultShiftStart: start, defaultShiftEnd: end };
}

export function mergeNotesWithDefaultHours(notes, start, end) {
  const base = stripWorkHoursTag(notes).trimEnd();
  const tag = `[lt_default_hours:${start}-${end}]`;
  if (!base) return tag;
  return `${base}\n\n${tag}`;
}

function hoursBetweenTimes(start, end) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

/** Positive hours between saved default shift times, or 8 if the range is invalid. */
export function defaultTemplateHoursForEmployee(employee) {
  const { defaultShiftStart, defaultShiftEnd } = parseDefaultWorkHoursFromEmployee(employee);
  const h = hoursBetweenTimes(defaultShiftStart, defaultShiftEnd);
  return h > 0 ? h : DEFAULT_TEMPLATE_HOURS;
}

export function mergeNotesWithWorkDays(userNotes, checks) {
  const base = stripWorkDaysTag(userNotes);
  const days = isoDaysFromChecks(checks);
  const tag = `[lt_work_days:${days.join(",")}]`;
  if (!days.length) return base;
  if (!base) return tag;
  return `${base}\n\n${tag}`;
}

export function shiftAmountForEmployee(employee, hoursWorked) {
  if (!employee) return 0;
  const h = Number(hoursWorked) || 0;
  if (employee.payment_type === "daily") {
    return Number(employee.daily_rate) || 0;
  }
  return h * (Number(employee.hourly_rate) || 0);
}

/** Hours assumed for hourly employees when no shift row exists (template accrual). */
export const DEFAULT_TEMPLATE_HOURS = 8;

function hasNonCancelledShiftForEmployeeOnDate(shifts, employeeId, dateStr) {
  return shifts.some(
    (s) => s.date === dateStr && s.employee_id === employeeId && s.status !== "cancelled",
  );
}

function employeeWorksOnDateString(employee, dateStr) {
  const iso = getISODay(parseISO(`${dateStr}T12:00:00`));
  const checks = parseWorkDaysFromEmployee(employee);
  const def = WORK_DAY_DEFS.find((d) => d.iso === iso);
  return def ? Boolean(checks[def.key]) : false;
}

/** Unpaid / accrued shift payouts for a calendar day (YYYY-MM-DD). */
export function unpaidShiftLaborForDate(dateStr, shifts) {
  return shifts
    .filter((s) => s.date === dateStr && s.status !== "cancelled" && s.status !== "paid")
    .reduce((sum, s) => sum + Number(s.amount || 0), 0);
}

/**
 * Expected labor when an active employee is scheduled (workday checkboxes) but has no shift row that day.
 * Avoids double-counting: days with any non-cancelled shift use shift amounts instead.
 */
export function templateLaborAccrualForDate(dateStr, employees, shifts) {
  let sum = 0;
  for (const e of employees) {
    if (e?.is_active === false) continue;
    if (!employeeWorksOnDateString(e, dateStr)) continue;
    if (hasNonCancelledShiftForEmployeeOnDate(shifts, e.id, dateStr)) continue;
    sum += shiftAmountForEmployee(e, defaultTemplateHoursForEmployee(e));
  }
  return sum;
}

export function totalExpectedLaborForDate(dateStr, employees, shifts) {
  return unpaidShiftLaborForDate(dateStr, shifts) + templateLaborAccrualForDate(dateStr, employees, shifts);
}

/**
 * Who contributes to {@link totalExpectedLaborForDate} for this day: unpaid shift payouts per person,
 * else template accrual when they have a workday but no shift row.
 * @returns {{ name: string, amount: number }[]} sorted by name
 */
export function expectedLaborEntriesForDate(dateStr, employees, shifts) {
  /** @type {Map<string, { name: string, amount: number }>} */
  const map = new Map();

  for (const s of shifts) {
    if (s.date !== dateStr || s.status === "cancelled" || s.status === "paid") continue;
    const amt = Number(s.amount || 0);
    if (!Number.isFinite(amt) || Math.abs(amt) < 0.0001) continue;
    const key = s.employee_id ? String(s.employee_id) : `orphan:${s.id}`;
    const nameFromShift = String(s.employee_name || "").trim();
    const nameFromEmp = s.employee_id
      ? String(employees.find((e) => e.id === s.employee_id)?.name || "").trim()
      : "";
    const name = nameFromShift || nameFromEmp || "Staff";
    const prev = map.get(key);
    if (prev) {
      map.set(key, { name: prev.name || name, amount: prev.amount + amt });
    } else {
      map.set(key, { name, amount: amt });
    }
  }

  for (const e of employees) {
    if (!e || e.is_active === false) continue;
    if (!employeeWorksOnDateString(e, dateStr)) continue;
    if (hasNonCancelledShiftForEmployeeOnDate(shifts, e.id, dateStr)) continue;
    const h = defaultTemplateHoursForEmployee(e);
    const amt = shiftAmountForEmployee(e, h);
    if (!Number.isFinite(amt) || amt < 0.005) continue;
    const key = String(e.id);
    if (map.has(key)) continue;
    map.set(key, { name: String(e.name || "").trim() || "Staff", amount: amt });
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
  );
}

export function sumTemplateLaborBetween(rangeStart, rangeEnd, employees, shifts) {
  if (!rangeStart || !rangeEnd || rangeEnd < rangeStart) return 0;
  let t = 0;
  for (const day of eachDayOfInterval({ start: rangeStart, end: rangeEnd })) {
    const dateStr = format(day, "yyyy-MM-dd");
    t += templateLaborAccrualForDate(dateStr, employees, shifts);
  }
  return t;
}
