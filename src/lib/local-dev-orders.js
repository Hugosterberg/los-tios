import { getMexicoNowDateKey, mexicoBusinessDayCreatedAtIso } from "@/lib/mexicoTime";

const isBrowser = typeof window !== "undefined";

export const isLocalDevOrdersMode =
  import.meta.env.DEV && import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true";

const STORAGE_KEY = "los_tios_local_dev_orders_v1";

const clone = (value) => JSON.parse(JSON.stringify(value));

const readStoredOrders = () => {
  if (!isBrowser) return [];

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredOrders = (orders) => {
  if (!isBrowser) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
};

const createLocalId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `local-order-${crypto.randomUUID()}`;
  }
  return `local-order-${Date.now()}`;
};

const sortOrders = (orders, orderBy) => {
  if (orderBy === "-created_date") {
    return [...orders].sort(
      (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
    );
  }
  return orders;
};

export const listOrders = async (remoteListFn, orderBy) => {
  if (isLocalDevOrdersMode) {
    return sortOrders(readStoredOrders(), orderBy);
  }
  return remoteListFn(orderBy);
};

export const createOrderEntity = async (data, remoteCreateFn) => {
  if (!isLocalDevOrdersMode) {
    return remoteCreateFn(data);
  }

  const now = mexicoBusinessDayCreatedAtIso(getMexicoNowDateKey());
  const createdOrder = {
    ...data,
    id: createLocalId(),
    created_date: now,
    updated_date: new Date().toISOString(),
  };

  const orders = [createdOrder, ...readStoredOrders()];
  writeStoredOrders(orders);
  return createdOrder;
};

export const updateOrderEntity = async (id, data, remoteUpdateFn) => {
  if (!isLocalDevOrdersMode) {
    return remoteUpdateFn(id, data);
  }

  const now = new Date().toISOString();
  const orders = readStoredOrders().map((order) =>
    order.id === id ? { ...order, ...data, updated_date: now } : order
  );
  writeStoredOrders(orders);
  return orders.find((order) => order.id === id) ?? null;
};

export const deleteOrderEntity = async (id, remoteDeleteFn) => {
  if (!isLocalDevOrdersMode) {
    return remoteDeleteFn(id);
  }

  const orders = readStoredOrders().filter((order) => order.id !== id);
  writeStoredOrders(orders);
  return { id };
};
