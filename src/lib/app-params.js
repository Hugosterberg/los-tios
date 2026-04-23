// @ts-nocheck
const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const normalizeAppParam = (value) => {
	if (value === null || value === undefined) return null;
	const trimmed = String(value).trim();
	if (!trimmed) return null;
	const lowered = trimmed.toLowerCase();
	if (lowered === "null" || lowered === "undefined") return null;
	return trimmed;
}

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = normalizeAppParam(urlParams.get(paramName));
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	const normalizedDefaultValue = normalizeAppParam(defaultValue);
	if (normalizedDefaultValue) {
		storage.setItem(storageKey, normalizedDefaultValue);
		return normalizedDefaultValue;
	}
	const rawStoredValue = storage.getItem(storageKey);
	const storedValue = normalizeAppParam(rawStoredValue);
	if (rawStoredValue && !storedValue) {
		storage.removeItem(storageKey);
	}
	if (storedValue) {
		return storedValue;
	}
	return null;
}

const getAppParams = () => {
	return {
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
		serverUrl: getAppParamValue("server_url", { defaultValue: import.meta.env.VITE_BASE44_BACKEND_URL }),
		token: getAppParamValue("access_token", { removeFromUrl: true }),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
		functionsVersion: getAppParamValue("functions_version"),
	}
}


export const appParams = {
	...getAppParams()
}
