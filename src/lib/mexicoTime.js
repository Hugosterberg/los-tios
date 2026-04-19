/**
 * Puerto Escondido / Los Tíos — civil time aligns with America/Mexico_City
 * (Mexico no longer observes DST in most regions).
 */
export const MEXICO_DISPLAY_TIMEZONE = "America/Mexico_City";

const TZ = MEXICO_DISPLAY_TIMEZONE;

function toDate(input) {
  if (input == null || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isPlainDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** Civil noon on `dateKey` anchored to Mexico_City (DST-aware via mexicoWallDateTimeToUtcIso). */
function mexicoCivilNoonInstant(dateKey) {
  if (!isPlainDateKey(dateKey)) return null;
  const iso = mexicoWallDateTimeToUtcIso(dateKey, "12:00");
  return iso ? new Date(iso) : null;
}

/** Short weekday (es-MX) for a yyyy-MM-dd calendar key. */
export function formatMexicoWeekdayShortFromDateKey(dateKey) {
  const inst = mexicoCivilNoonInstant(dateKey);
  if (!inst || Number.isNaN(inst.getTime())) return "";
  const raw = new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    weekday: "short",
  }).format(inst);
  return raw.replace(/\.$/, "").trim();
}

/** Hour 0–23 in America/Mexico_City for an instant (merged sale timestamps). */
export function getMexicoHourFromInstant(isoLike) {
  const d = toDate(isoLike);
  if (!d) return -1;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "numeric",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value;
  const n = h != null ? Number(h) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : -1;
}

/** YYYY-MM-DD in Mexico for an instant (API timestamps, Date objects). */
export function getMexicoDateKey(isoLike) {
  const d = toDate(isoLike);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function getMexicoYearMonthKey(isoLike) {
  const k = getMexicoDateKey(isoLike);
  return k.length >= 7 ? k.slice(0, 7) : "";
}

export function getMexicoNowDateKey() {
  return getMexicoDateKey(Date.now());
}

export function getMexicoNowYearMonth() {
  return getMexicoYearMonthKey(Date.now());
}

/** Label for a `yyyy-MM` month key (e.g. statistics / registered purchases). */
export function formatMexicoMonthYearLabel(yearMonthKey) {
  if (!yearMonthKey || !/^\d{4}-\d{2}$/.test(String(yearMonthKey).trim())) {
    return String(yearMonthKey || "");
  }
  const [y, m] = String(yearMonthKey).trim().split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Local Date at calendar noon for a Mexico date key (pickers / state). */
export function dateFromMexicoDateKey(key) {
  if (!isPlainDateKey(key)) return new Date();
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** HH:mm (24h) in Mexico — cash ledger TIME column, dashboards. */
export function formatMexicoTime(isoLike, fallback = "—") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Mexico civil date + HH:mm for HTML date/time inputs (ledger editing).
 * @returns {{ dateKey: string, timeHHmm: string }}
 */
export function getMexicoDateAndTimePartsForInput(isoLike) {
  const d = toDate(isoLike);
  if (!d) return { dateKey: "", timeHHmm: "" };
  const dateKey = getMexicoDateKey(isoLike);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return { dateKey, timeHHmm: `${h.padStart(2, "0")}:${m.padStart(2, "0")}` };
}

/** Normalize time strings (e.g. 9:05 → 09:05) for Mexico wall inputs. */
export function normalizeHHmm(raw) {
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  return `${String(Number(m[1])).padStart(2, "0")}:${String(Number(m[2])).padStart(2, "0")}`;
}

/**
 * UTC instant from a Mexico wall date + time (America/Mexico_City, DST-aware).
 * Uses the Temporal-free approach: binary-search the UTC offset that Intl.DateTimeFormat
 * would display as the given local wall time, so DST transitions are handled correctly.
 * @param {string} dateKey yyyy-MM-dd
 * @param {string} timeHHmm HH:mm (24h)
 * @returns {string | null} ISO string
 */
export function mexicoWallDateTimeToUtcIso(dateKey, timeHHmm) {
  if (!isPlainDateKey(dateKey)) return null;
  const m = String(timeHHmm).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(min) || hh < 0 || hh > 23 || min < 0 || min > 59) {
    return null;
  }

  // Target wall-clock minutes since midnight in Mexico City
  const targetWallMins = hh * 60 + min;

  // Helper: given a UTC timestamp (ms), return the wall-clock minutes in Mexico City
  const wallMinsAt = (ms) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const ph = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const pm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return ph * 60 + pm;
  };

  // Approximate starting UTC using a fixed -06:00 anchor, then correct for actual offset
  const [y, mo, d] = dateKey.split("-").map(Number);
  const pad = (n) => String(n).padStart(2, "0");
  const approxUtcMs = new Date(
    `${String(y).padStart(4, "0")}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(min)}:00-06:00`,
  ).getTime();
  if (!Number.isFinite(approxUtcMs)) return null;

  // Compute actual Mexico offset at this approximate time and correct
  const actualWall = wallMinsAt(approxUtcMs);
  const diffMins = targetWallMins - actualWall;
  // Handle midnight wrap-around (±720 min guard)
  const correctedMs = approxUtcMs - diffMins * 60_000;

  // Verify (should be exact; DST ambiguity resolved by preferring standard time)
  const verifyWall = wallMinsAt(correctedMs);
  if (verifyWall !== targetWallMins) {
    // One more correction pass for edge cases
    const diff2 = targetWallMins - verifyWall;
    const finalMs = correctedMs - diff2 * 60_000;
    if (Number.isFinite(finalMs)) return new Date(finalMs).toISOString();
  }

  if (!Number.isFinite(correctedMs)) return null;
  return new Date(correctedMs).toISOString();
}

/** Current HH:mm (24h) in America/Mexico_City — for anchoring "now" on the Mexico wall clock. */
export function getMexicoNowTimeHHmm() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(now);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

/**
 * UTC ISO instant for when a finance row was "recorded": Mexico calendar `dateKey` at Mexico-local time.
 * Same Mexico day as today → current Mexico clock; backdated days → 12:00 Mexico (stable).
 */
export function mexicoBusinessDayCreatedAtIso(dateKey) {
  if (!isPlainDateKey(dateKey)) return new Date().toISOString();
  const todayMx = getMexicoNowDateKey();
  const hhmm = dateKey === todayMx ? getMexicoNowTimeHHmm() : "12:00";
  return mexicoWallDateTimeToUtcIso(dateKey, hhmm) || new Date().toISOString();
}

/**
 * Ensures `created_date` reflects Puerto Escondido (Mexico) local civil time on the business `date` field.
 * Use when calling remote APIs that accept `created_date` on create.
 */
export function withMexicoCreatedDateForPayload(data, { dateField = "date" } = {}) {
  if (!data || typeof data !== "object") return data;
  const explicit = data.created_date;
  if (explicit != null && String(explicit).trim() !== "") {
    /* Caller already set created_date (e.g. from a picked wall time) — never overwrite. */
    return data;
  }
  const raw = data[dateField];
  const dk = isPlainDateKey(raw) ? String(raw).trim().slice(0, 10) : getMexicoNowDateKey();
  return { ...data, created_date: mexicoBusinessDayCreatedAtIso(dk) };
}

export function formatMexicoDateTimeSlashed(isoLike, fallback = "—") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatMexicoDateTimeMedium(isoLike, fallback = "—") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatMexicoDateTimeMediumShort(isoLike, fallback = "N/A") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatMexicoOrderList(isoLike, fallback = "—") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatMexicoTableService(isoLike, fallback = "—") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatMexicoGeneratedTimestamp() {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** yyyy-MM-dd HH:mm in Mexico — dedupe / sync views */
export function formatMexicoDateTimeNumeric(isoLike, fallback = "N/A") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const y = g("year");
  const m = g("month");
  const day = g("day");
  const h = g("hour");
  const min = g("minute");
  if (!y || !m || !day) return fallback;
  return `${y}-${m}-${day} ${h}:${min}`;
}

export function formatMexicoLongDateEs(isoLike, fallback = "") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatMexicoMonthDayShort(isoLike, fallback = "—") {
  if (isPlainDateKey(String(isoLike || "").trim())) {
    return formatMexicoMonthDayShort(`${String(isoLike).trim()}T12:00:00`, fallback);
  }
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  }).format(d);
}

export function formatMexicoDateShort(isoLike, fallback = "—") {
  if (isPlainDateKey(String(isoLike || "").trim())) {
    return formatMexicoDateShort(`${String(isoLike).trim()}T12:00:00`, fallback);
  }
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Short date in English for the Mexico calendar day (e.g. 12 Apr 2026). */
export function formatMexicoDateShortEn(isoLike, fallback = "—") {
  if (isPlainDateKey(String(isoLike || "").trim())) {
    return formatMexicoDateShortEn(`${String(isoLike).trim()}T12:00:00`, fallback);
  }
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Month label in English for a `yyyy-MM` key (America/Mexico_City). */
export function formatMexicoMonthYearLabelEn(yearMonthKey) {
  if (!yearMonthKey || !/^\d{4}-\d{2}$/.test(String(yearMonthKey).trim())) {
    return String(yearMonthKey || "");
  }
  const [y, m] = String(yearMonthKey).trim().split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  }).format(d);
}

export function formatMexicoWeekdayLongEn(isoLike, fallback = "") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "long",
  }).format(d);
}

export function formatMexicoLongDateEn(isoLike, fallback = "") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatMexicoMonthDayShortEn(isoLike, fallback = "") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatMexicoMonthShortDayYearEn(isoLike, fallback = "") {
  const d = toDate(isoLike);
  if (!d) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/**
 * Match a ledger row to a selected business day in Mexico.
 * Plain YYYY-MM-DD (no time) compares as that calendar date.
 */
export function matchesMexicoCalendarDay(value, dayKey) {
  if (value == null || dayKey == null) return false;
  const s = String(value).trim();
  if (isPlainDateKey(s) && !s.includes("T")) {
    return s === dayKey;
  }
  return getMexicoDateKey(value) === dayKey;
}