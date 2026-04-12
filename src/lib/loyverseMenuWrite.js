import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import {
  loyverseApiRequest,
  fetchLoyverseStoresList,
  fetchLoyverseCategoriesList,
  hasLoyverseApiConfig,
} from "@/api/loyverse";

/** Set VITE_LOYVERSE_WRITE_MENU=false to disable pushing menu changes to Loyverse. */
export function isLoyverseMenuWriteEnabled() {
  return import.meta.env.VITE_LOYVERSE_WRITE_MENU !== "false";
}

export function shouldSyncMenuToLoyverse(appSettingsRecord) {
  const settings = getResolvedIntegrationSettings(appSettingsRecord || {});
  return isLoyverseMenuWriteEnabled() && hasLoyverseApiConfig(settings);
}

function extractCreatedItemId(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw.item || raw.items?.[0] || raw.data?.item || raw;
  return item?.id || raw.id || null;
}

function priceOf(menuItem) {
  const n = Number(menuItem?.price);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build Loyverse item body — API expects variants + per-store prices for common setups.
 * @see https://developer.loyverse.com/docs/
 */
function buildItemBody(menuItem, { storeId, categoryId }) {
  const price = priceOf(menuItem);
  const name = String(menuItem?.name || "Menu item").trim() || "Menu item";
  const stores = storeId ? [{ store_id: storeId, price }] : [];

  const base = {
    name,
    color: "BLACK",
  };

  const desc = String(menuItem?.description || "").trim();
  if (desc) {
    base.description = desc.slice(0, 2000);
  }

  if (categoryId) {
    base.category_id = categoryId;
  }

  base.variants = [
    {
      name: "Regular",
      default_price: price,
      ...(stores.length ? { stores } : {}),
    },
  ];

  return base;
}

async function resolveStoreAndCategory(settings) {
  const stores = await fetchLoyverseStoresList(settings);
  const categories = await fetchLoyverseCategoriesList(settings);
  const configuredStore = String(settings.loyverse_store_id || "").trim();
  const storeId = configuredStore || stores[0]?.id || null;
  const configuredCat = String(settings.loyverse_default_category_id || "").trim();
  const categoryId = configuredCat || categories[0]?.id || null;
  return { storeId, categoryId };
}

/**
 * Create an item in Loyverse Back Office catalog.
 */
export async function createLoyverseMenuItem(settings, menuItem) {
  const { storeId, categoryId } = await resolveStoreAndCategory(settings);
  const body = buildItemBody(menuItem, { storeId, categoryId });

  try {
    const raw = await loyverseApiRequest("POST", "items", { body, settings });
    const id = extractCreatedItemId(raw);
    if (id) {
      return { id: String(id), raw };
    }
  } catch (firstErr) {
    /* try minimal body */
  }

  const price = priceOf(menuItem);
  const minimal = {
    name: String(menuItem?.name || "Item").trim(),
    default_price: price,
    ...(storeId ? { stores: [{ store_id: storeId, price }] } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
  };

  const raw = await loyverseApiRequest("POST", "items", { body: minimal, settings });
  const id = extractCreatedItemId(raw);
  return { id: id ? String(id) : null, raw };
}

/**
 * Update catalog item in Loyverse (price, name, availability mapping).
 */
export async function updateLoyverseMenuItem(settings, loyverseItemId, menuItem) {
  const id = String(loyverseItemId || "").trim();
  if (!id) {
    throw new Error("Missing Loyverse item id");
  }
  const { storeId, categoryId } = await resolveStoreAndCategory(settings);
  const body = buildItemBody(menuItem, { storeId, categoryId });
  body.is_archived = menuItem?.is_available === false;

  try {
    const raw = await loyverseApiRequest("PUT", `items/${id}`, { body, settings });
    return { id, raw };
  } catch {
    const raw = await loyverseApiRequest("POST", `items/${id}`, { body, settings });
    return { id, raw };
  }
}

/**
 * Remove item from Loyverse catalog.
 */
export async function deleteLoyverseMenuItem(settings, loyverseItemId) {
  const id = String(loyverseItemId || "").trim();
  if (!id) {
    return;
  }
  await loyverseApiRequest("DELETE", `items/${id}`, { settings });
}
