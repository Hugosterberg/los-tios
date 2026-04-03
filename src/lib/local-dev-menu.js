const isBrowser = typeof window !== "undefined";

export const isLocalDevMenuMode =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true";

const STORAGE_KEY = "los_tios_local_dev_menu_items_v1";

const sampleMenuItems = [
  {
    id: "local-dev-margherita",
    name: "Pizza Margherita",
    name_en: "Margherita Pizza",
    description: "Tomate, mozzarella, albahaca fresca y aceite de oliva.",
    description_en: "Tomato, mozzarella, fresh basil and olive oil.",
    category: "pizzas",
    price: 160,
    image_url:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=80",
    ingredients: ["Tomate", "Mozzarella", "Albahaca", "Aceite de oliva"],
    is_vegetarian: true,
    is_available: true,
    preparation_time: 12,
    created_date: "2026-03-29T00:00:00.000Z",
    updated_date: "2026-03-29T00:00:00.000Z",
  },
];

const clone = (value) => JSON.parse(JSON.stringify(value));

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
  if (isLocalDevMenuMode) {
    return readStoredItems();
  }
  return remoteListFn();
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
  writeStoredItems(items.length > 0 ? items : clone(sampleMenuItems));
  return { id };
};
