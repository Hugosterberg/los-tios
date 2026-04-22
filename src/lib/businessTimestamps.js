import {
  isPlainDateKey,
  mexicoBusinessDayCreatedAtIso,
  mexicoWallDateTimeToUtcIso,
  withMexicoCreatedDateForPayload,
} from "@/lib/mexicoTime";

function omitField(obj, field) {
  if (!obj || typeof obj !== "object" || !(field in obj)) return obj;
  const { [field]: _omitted, ...rest } = obj;
  return rest;
}

export function withOptionalIsoTimestampForPayload(
  data,
  { dateField = "date", timestampField = "recorded_at", fallbackTimeHHmm = null } = {},
) {
  if (!data || typeof data !== "object") return data;
  const explicit = data[timestampField];
  if (explicit != null && String(explicit).trim() !== "") {
    return data;
  }
  const raw = data[dateField];
  const dk = isPlainDateKey(raw) ? String(raw).trim().slice(0, 10) : null;
  if (!dk) return data;
  const iso =
    (fallbackTimeHHmm ? mexicoWallDateTimeToUtcIso(dk, fallbackTimeHHmm) : null) ||
    mexicoBusinessDayCreatedAtIso(dk);
  return iso ? { ...data, [timestampField]: iso } : data;
}

export function resolveRecordIsoTimestamp(
  record,
  {
    timestampFields = ["recorded_at", "purchased_at", "created_date", "created_at", "updated_date", "updated_at"],
    dateField = "date",
    fallbackDateKey = null,
    fallbackTimeHHmm = "12:00",
  } = {},
) {
  if (record && typeof record === "object") {
    for (const field of timestampFields) {
      const raw = record[field];
      if (typeof raw === "string" && raw.trim()) {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) return raw.trim();
      }
    }
    const rawDate = record[dateField];
    if (isPlainDateKey(rawDate)) {
      return (
        mexicoWallDateTimeToUtcIso(String(rawDate).trim().slice(0, 10), fallbackTimeHHmm) ||
        null
      );
    }
  }
  if (fallbackDateKey && isPlainDateKey(fallbackDateKey)) {
    return mexicoWallDateTimeToUtcIso(String(fallbackDateKey).trim().slice(0, 10), fallbackTimeHHmm) || null;
  }
  return null;
}

export async function createEntityWithOptionalTimestamp(
  entityApi,
  data,
  { dateField = "date", timestampField = "recorded_at", ensureCreatedDate = true, fallbackTimeHHmm = null } = {},
) {
  let payload = data;
  if (ensureCreatedDate) {
    payload = withMexicoCreatedDateForPayload(payload, { dateField });
  }
  payload = withOptionalIsoTimestampForPayload(payload, { dateField, timestampField, fallbackTimeHHmm });
  try {
    return await entityApi.create(payload);
  } catch (error) {
    const fallback = omitField(payload, timestampField);
    if (fallback === payload) throw error;
    return await entityApi.create(fallback);
  }
}

export async function updateEntityWithOptionalTimestamp(
  entityApi,
  id,
  data,
  { timestampField = "recorded_at" } = {},
) {
  try {
    return await entityApi.update(id, data);
  } catch (error) {
    const fallback = omitField(data, timestampField);
    if (fallback === data) throw error;
    return await entityApi.update(id, fallback);
  }
}
