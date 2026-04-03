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

export function getStoredIntegrationSettings() {
  return parseStoredSettings();
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
  const stored = parseStoredSettings();
  const merged = { ...stored, ...settings };

  return {
    apiKey: normalizeString(merged.clip_api_key) || normalizeString(import.meta.env.VITE_CLIP_API_KEY),
    apiSecret: normalizeString(merged.clip_api_secret) || normalizeString(import.meta.env.VITE_CLIP_API_SECRET),
    authToken: normalizeString(merged.clip_api_token) || normalizeString(import.meta.env.VITE_CLIP_API_TOKEN),
    paymentsBaseUrl:
      normalizeString(merged.clip_payments_api_base_url) ||
      normalizeString(import.meta.env.VITE_CLIP_PAYMENTS_API_BASE_URL),
    settlementsBaseUrl:
      normalizeString(merged.clip_settlements_api_base_url) ||
      normalizeString(import.meta.env.VITE_CLIP_SETTLEMENTS_API_BASE_URL),
  };
}

export function buildLoyverseResolvedConfig(settings = {}) {
  const stored = parseStoredSettings();
  const merged = { ...stored, ...settings };

  return {
    apiToken: normalizeString(merged.loyverse_api_token) || normalizeString(import.meta.env.VITE_LOYVERSE_API_TOKEN),
    baseUrl:
      normalizeString(merged.loyverse_api_base_url) ||
      normalizeString(import.meta.env.VITE_LOYVERSE_API_BASE_URL),
  };
}
