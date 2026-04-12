const INTEGRATION_SETTINGS_STORAGE_KEY = "los_tios_integration_settings_v1";

const isBrowser = typeof window !== "undefined";

function parseStoredSettings() {
  if (!isBrowser) {
    return {};
  }

  const raw = window.localStorage.getItem(INTEGRATION_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripEmptyStringValues(settings = {}) {
  return Object.fromEntries(
    Object.entries(settings).filter(([, value]) => {
      if (typeof value === "string") {
        return value.trim().length > 0;
      }

      return value !== undefined && value !== null;
    }),
  );
}

function readEnvSettings() {
  return {
    clip_api_key: normalizeString(import.meta.env.VITE_CLIP_API_KEY),
    clip_api_secret: normalizeString(import.meta.env.VITE_CLIP_API_SECRET),
    clip_api_token: normalizeString(import.meta.env.VITE_CLIP_API_TOKEN),
    clip_payments_api_base_url: normalizeString(import.meta.env.VITE_CLIP_PAYMENTS_API_BASE_URL),
    clip_settlements_api_base_url: normalizeString(import.meta.env.VITE_CLIP_SETTLEMENTS_API_BASE_URL),
    loyverse_api_token: normalizeString(import.meta.env.VITE_LOYVERSE_API_TOKEN),
    loyverse_api_base_url: normalizeString(import.meta.env.VITE_LOYVERSE_API_BASE_URL),
    loyverse_store_id: normalizeString(import.meta.env.VITE_LOYVERSE_STORE_ID),
    loyverse_default_category_id: normalizeString(import.meta.env.VITE_LOYVERSE_DEFAULT_CATEGORY_ID),
    notion_internal_token: normalizeString(import.meta.env.VITE_NOTION_INTERNAL_TOKEN),
    revolut_connection_type: normalizeString(import.meta.env.VITE_REVOLUT_CONNECTION_TYPE),
    revolut_api_base_url: normalizeString(import.meta.env.VITE_REVOLUT_API_BASE_URL),
    revolut_access_token: normalizeString(import.meta.env.VITE_REVOLUT_ACCESS_TOKEN),
    revolut_account_id: normalizeString(import.meta.env.VITE_REVOLUT_ACCOUNT_ID),
  };
}

function buildResolvedSettings(settings = {}) {
  return {
    ...stripEmptyStringValues(readEnvSettings()),
    ...stripEmptyStringValues(parseStoredSettings()),
    ...stripEmptyStringValues(settings),
  };
}

export function getStoredIntegrationSettings() {
  return parseStoredSettings();
}

export function getEnvIntegrationSettings() {
  return readEnvSettings();
}

export function getResolvedIntegrationSettings(settings = {}) {
  return buildResolvedSettings(settings);
}

export function saveStoredIntegrationSettings(settings) {
  if (!isBrowser) {
    return;
  }

  const current = parseStoredSettings();
  window.localStorage.setItem(
    INTEGRATION_SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...current,
      ...settings,
    }),
  );
}

export function buildClipResolvedConfig(settings = {}) {
  const merged = buildResolvedSettings(settings);

  return {
    apiKey: normalizeString(merged.clip_api_key),
    apiSecret: normalizeString(merged.clip_api_secret),
    authToken: normalizeString(merged.clip_api_token),
    paymentsBaseUrl: normalizeString(merged.clip_payments_api_base_url),
    settlementsBaseUrl: normalizeString(merged.clip_settlements_api_base_url),
  };
}

export function buildLoyverseResolvedConfig(settings = {}) {
  const merged = buildResolvedSettings(settings);

  return {
    apiToken: normalizeString(merged.loyverse_api_token),
    baseUrl: normalizeString(merged.loyverse_api_base_url),
    storeId: normalizeString(merged.loyverse_store_id),
    defaultCategoryId: normalizeString(merged.loyverse_default_category_id),
  };
}

/** @returns {"business" | "personal"} */
export function normalizeRevolutConnectionType(value) {
  const v = normalizeString(value).toLowerCase();
  return v === "personal" ? "personal" : "business";
}

export function buildRevolutResolvedConfig(settings = {}) {
  const merged = buildResolvedSettings(settings);

  return {
    accessToken: normalizeString(merged.revolut_access_token),
    baseUrl: normalizeString(merged.revolut_api_base_url),
    accountId: normalizeString(merged.revolut_account_id),
    connectionType: normalizeRevolutConnectionType(merged.revolut_connection_type),
  };
}
