import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { getClipOverview, hasClipApiConfig } from "@/api/clip";
import { extractIngredientStringsFromDescription } from "@/lib/menuIngredients";

const isBrowser = typeof window !== "undefined";

export const isLocalDevMenuMode =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true";

const STORAGE_KEY = "los_tios_local_dev_menu_items_v1";

const sampleMenuItems = [];

const clone = (value) => JSON.parse(JSON.stringify(value));

function getMoneyValue(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    return getMoneyValue(value.amount ?? value.value ?? value.total ?? value.money_amount);
  }

  return 0;
}

function normalizeMenuCategory(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key.includes("pizza")) return "pizzas";
  if (key.includes("dessert") || key.includes("postre")) return "desserts";
  if (key.includes("drink") || key.includes("bebida")) return "beverages";
  if (key.includes("panini")) return "paninis";
  if (key.includes("appetizer") || key.includes("entrada")) return "appetizers";
  if (key.includes("salsa") || key.includes("sauce")) return "salsas";
  return key || "uncategorized";
}

function getLoyverseItemPrice(item) {
  const directPrice = getMoneyValue(item?.price ?? item?.default_price ?? item?.price_money);
  if (directPrice > 0) {
    return directPrice;
  }

  if (Array.isArray(item?.variants) && item.variants.length > 0) {
    const variantPrice = item.variants.reduce((max, variant) => {
      const value = getMoneyValue(
        variant?.default_price ??
        variant?.price ??
        variant?.price_money,
      );
      return Math.max(max, value);
    }, 0);
    return variantPrice > 0 ? variantPrice : 0;
  }

  return 0;
}

function isLikelyRealName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  if (/^unknown/i.test(normalized)) {
    return false;
  }
  return /[a-zA-Z\u00C0-\u017F]/.test(normalized);
}

function resolveLoyverseItemName(item) {
  const variantName = Array.isArray(item?.variants)
    ? item.variants.map((variant) => variant?.name).find(Boolean)
    : "";
  const bestCandidate = [
    item?.name,
    item?.item_name,
    item?.display_name,
    item?.title,
    variantName,
    item?.sku,
  ].find((candidate) => isLikelyRealName(candidate));

  if (bestCandidate) {
    return String(bestCandidate).trim();
  }

  if (item?.sku) {
    return `SKU ${item.sku}`;
  }
  if (item?.id) {
    return `Item ${item.id}`;
  }
  return "Menu item";
}

function mapLoyverseItemsToMenuItems(items = []) {
  return items
    .filter((item) => !item?.is_deleted)
    .map((item, index) => ({
      id: item.id || `loyverse-item-${index}`,
      source: "loyverse",
      name: resolveLoyverseItemName(item),
      name_en: resolveLoyverseItemName(item),
      description: item.description || "",
      description_en: item.description || "",
      category: normalizeMenuCategory(item?.category?.name || item?.category_name || item?.category_id),
      price: getLoyverseItemPrice(item),
      image_url: item.image_url || item.image || "",
      ingredients: extractIngredientStringsFromDescription(item.description || ""),
      is_vegetarian: false,
      is_available: item.available !== false && item.is_archived !== true,
      preparation_time: null,
      created_date: item.created_at || null,
      updated_date: item.updated_at || null,
    }))
    .filter((item) => item.price > 0 || item.name);
}

function normalizeSearchKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u017F]+/g, " ")
    .trim();
}

function isImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
  }
  if (raw.startsWith("data:image/")) {
    return true;
  }
  return /^(https?:)?\/\//i.test(raw) && /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(raw);
}

/** HTTP(S) image hosts often omit a file extension in the path — still treat as a curated dish photo. */
function isLikelyRemoteImageUrl(value) {
  const raw = String(value || "").trim();
  return /^https?:\/\//i.test(raw) && raw.length > 15;
}

function itemHasRenderableImage(item) {
  const u = item?.image_url;
  return isImageUrl(u) || isLikelyRemoteImageUrl(u);
}

/** True if the database already has at least one menu row with a real dish image (manual curated menu). */
function hasManualMenuItemsWithImages(dbItems) {
  if (!Array.isArray(dbItems)) return false;
  return dbItems.some((item) => itemHasRenderableImage(item));
}

/** Loyverse/Clip can hang in production (CORS, proxy, slow API) — never block the customer menu forever. */
const INTEGRATION_MENU_TIMEOUT_MS = 12_000;

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise.then(
      (v) => v,
      () => fallback,
    ),
    new Promise((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

/** Only https/http data:image — blocks javascript: and non-image data URLs (tampered rows). */
function isSafePublicImageUrl(url) {
  const s = String(url || "").trim();
  if (!s) return true;
  if (/^\s*javascript:/i.test(s)) return false;
  if (/^\s*data:(?!image\/)/i.test(s)) return false;
  if (s.startsWith("data:image/")) return true;
  if (/^https?:\/\//i.test(s)) return true;
  return false;
}

function isValidPublicMenuRow(item) {
  if (!item || typeof item !== "object") return false;
  if (item.is_available === false) return false;
  const name = String(item.name || item.name_en || "").trim();
  if (name.length < 2) return false;
  const price = Number(item.price);
  if (!Number.isFinite(price) || price < 0) return false;
  const category = String(item.category || "").trim();
  if (category.length < 1 || category.length > 80) return false;
  return true;
}

/**
 * Customer-facing menu row: curated DB fields only — no guessed Clip images, no Loyverse merge.
 * @returns {object | null}
 */
function normalizePublicCustomerMenuItem(item) {
  if (!isValidPublicMenuRow(item)) return null;
  const out = { ...item };
  if (out.image_url && !isSafePublicImageUrl(out.image_url)) {
    out.image_url = "";
  }
  delete out.source;
  delete out.loyverse_item_id;
  return out;
}

function getFirstImageField(payload) {
  const candidates = [
    payload?.image_url,
    payload?.image,
    payload?.photo_url,
    payload?.thumbnail_url,
    payload?.product_image_url,
    payload?.avatar_url,
  ];
  return candidates.find(isImageUrl) || "";
}

function getClipImageMapFromPayments(payments = []) {
  const imageMap = new Map();

  payments.forEach((payment) => {
    const paymentImage = getFirstImageField(payment);
    const paymentName = normalizeSearchKey(
      payment?.description ||
      payment?.concept ||
      payment?.title ||
      payment?.reference ||
      payment?.receipt_no,
    );

    if (paymentImage && paymentName && !imageMap.has(paymentName)) {
      imageMap.set(paymentName, paymentImage);
    }

    const lineCollections = [
      ...(Array.isArray(payment?.items) ? payment.items : []),
      ...(Array.isArray(payment?.line_items) ? payment.line_items : []),
      ...(Array.isArray(payment?.products) ? payment.products : []),
      ...(Array.isArray(payment?.details) ? payment.details : []),
    ];

    lineCollections.forEach((line) => {
      const image = getFirstImageField(line);
      const name = normalizeSearchKey(
        line?.name ||
        line?.item_name ||
        line?.description ||
        line?.title ||
        line?.sku,
      );
      if (image && name && !imageMap.has(name)) {
        imageMap.set(name, image);
      }
    });
  });

  return imageMap;
}

function matchClipImageForName(name, clipImageMap) {
  const target = normalizeSearchKey(name);
  if (!target || !clipImageMap.size) {
    return "";
  }

  if (clipImageMap.has(target)) {
    return clipImageMap.get(target);
  }

  for (const [key, image] of clipImageMap.entries()) {
    if (key.includes(target) || target.includes(key)) {
      return image;
    }
  }

  return "";
}

function enrichMenuItemsWithClipImages(menuItems, clipImageMap) {
  return (menuItems || []).map((item) => {
    if (itemHasRenderableImage(item)) {
      return item;
    }

    const clipImage = matchClipImageForName(item.name, clipImageMap);
    if (!clipImage) {
      return item;
    }

    return {
      ...item,
      image_url: clipImage,
    };
  });
}

async function getLiveMenuItemsFromLoyverse(settings) {
  if (!hasLoyverseApiConfig(settings)) {
    return [];
  }

  try {
    const overview = await getLoyverseOverview(settings);
    return mapLoyverseItemsToMenuItems(overview?.items || []);
  } catch {
    return [];
  }
}

async function getClipImageMap(settings) {
  if (!hasClipApiConfig(settings)) {
    return new Map();
  }

  try {
    const clipOverview = await getClipOverview(settings);
    return getClipImageMapFromPayments(clipOverview?.payments || []);
  } catch {
    return new Map();
  }
}

const readStoredItems = () => {
  if (!isBrowser) return clone(sampleMenuItems);

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const seeded = clone(sampleMenuItems);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fall through to reseed with defaults.
  }

  const seeded = clone(sampleMenuItems);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
};

const writeStoredItems = (items) => {
  if (!isBrowser) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const createLocalId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `local-dev-${crypto.randomUUID()}`;
  }
  return `local-dev-${Date.now()}`;
};

export const listMenuItems = async (remoteListFn) => {
  const settings = getResolvedIntegrationSettings();
  // Load DB first so a saved menu is not blocked by slow/hanging Loyverse or Clip calls.
  const remoteItems = await remoteListFn().catch(() => []);

  // Prefer saved MenuItem rows when any have images (e.g. pizzas on black background). Loyverse is only a fallback.
  if (hasManualMenuItemsWithImages(remoteItems)) {
    const needsClipFill = remoteItems.some((i) => !itemHasRenderableImage(i));
    const clipImageMap = needsClipFill
      ? await withTimeout(getClipImageMap(settings), INTEGRATION_MENU_TIMEOUT_MS, new Map())
      : new Map();
    return enrichMenuItemsWithClipImages(remoteItems, clipImageMap);
  }

  const [liveMenuItems, clipImageMap] = await Promise.all([
    withTimeout(getLiveMenuItemsFromLoyverse(settings), INTEGRATION_MENU_TIMEOUT_MS, []),
    withTimeout(getClipImageMap(settings), INTEGRATION_MENU_TIMEOUT_MS, new Map()),
  ]);
  const enrichedLiveMenuItems = enrichMenuItemsWithClipImages(liveMenuItems, clipImageMap);
  if (enrichedLiveMenuItems.length > 0) {
    return enrichedLiveMenuItems;
  }

  if (isLocalDevMenuMode) {
    return readStoredItems();
  }
  return Array.isArray(remoteItems) ? remoteItems : [];
};

export const createMenuItem = async (data, remoteCreateFn) => {
  if (!isLocalDevMenuMode) {
    return remoteCreateFn(data);
  }

  const now = new Date().toISOString();
  const createdItem = {
    ...data,
    id: createLocalId(),
    created_date: now,
    updated_date: now,
  };
  const items = [...readStoredItems(), createdItem];
  writeStoredItems(items);
  return createdItem;
};

export const updateMenuItem = async (id, data, remoteUpdateFn) => {
  if (!isLocalDevMenuMode) {
    return remoteUpdateFn(id, data);
  }

  const now = new Date().toISOString();
  const items = readStoredItems().map((item) =>
    item.id === id ? { ...item, ...data, updated_date: now } : item
  );
  writeStoredItems(items);
  return items.find((item) => item.id === id) ?? null;
};

export const deleteMenuItem = async (id, remoteDeleteFn) => {
  if (!isLocalDevMenuMode) {
    return remoteDeleteFn(id);
  }

  const items = readStoredItems().filter((item) => item.id !== id);
  writeStoredItems(items);
  return { id };
};
