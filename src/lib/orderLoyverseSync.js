import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import {
  createLoyverseReceipt,
  fetchLoyversePaymentTypes,
  fetchLoyverseStoresList,
  hasLoyverseApiConfig,
} from "@/api/loyverse";

function buildMenuItemMap(menuItems) {
  return new Map((menuItems || []).map((m) => [m.id, m]));
}

function pickPaymentTypeId(paymentTypes, method) {
  const m = String(method || "cash").toLowerCase();
  const list = paymentTypes || [];
  const label = (pt) => String(pt?.name || pt?.type || "").toLowerCase();
  if (m === "card") {
    return (
      list.find((pt) => label(pt).includes("card")) ||
      list.find((pt) => label(pt).includes("credit")) ||
      list.find((pt) => label(pt).includes("debit")) ||
      list[0]
    );
  }
  return list.find((pt) => label(pt).includes("cash")) || list[0];
}

function extractReceiptId(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const r = payload.receipt || payload.data?.receipt;
  if (r?.id) {
    return r.id;
  }
  if (Array.isArray(payload.receipts) && payload.receipts[0]?.id) {
    return payload.receipts[0].id;
  }
  if (payload.id) {
    return payload.id;
  }
  return null;
}

/**
 * When a web order is paid/delivered, create a matching Loyverse sales receipt so it appears in Loyverse Back Office.
 * Requires each order line's menu item to have `loyverse_item_id` set (Loyverse item UUID from Back Office → Items).
 *
 * Open tabs are not pushed live — Loyverse has no open-order API; only finalized sales are posted.
 */
export async function syncCompletedOrderToLoyverse(order, menuItems, appSettingsRecord) {
  const settings = getResolvedIntegrationSettings(appSettingsRecord || {});
  if (!hasLoyverseApiConfig(settings)) {
    return { ok: false, skipped: true, reason: "no_loyverse_token" };
  }
  if (order?.loyverse_receipt_id) {
    return { ok: true, skipped: true, reason: "already_synced", receiptId: order.loyverse_receipt_id };
  }
  if (order?.status !== "delivered" || order?.payment_status !== "paid") {
    return { ok: false, skipped: true, reason: "not_completed" };
  }

  const itemMap = buildMenuItemMap(menuItems);
  const receiptLines = [];

  for (const line of order.items || []) {
    if (line?.is_custom) {
      continue;
    }
    const mi = line.menu_item_id ? itemMap.get(line.menu_item_id) : null;
    const loyId = mi?.loyverse_item_id != null ? String(mi.loyverse_item_id).trim() : "";
    if (!loyId) {
      continue;
    }
    const qty = Number(line.quantity) || 1;
    const unit = Number(line.price) || 0;
    receiptLines.push({
      item_id: loyId,
      quantity: qty,
      item_price: unit,
    });
  }

  if (!receiptLines.length) {
    return {
      ok: false,
      skipped: true,
      reason: "no_loyverse_item_ids",
      message:
        "No order lines have a Loyverse item ID. Open Menu and set the Loyverse item ID for each product that should sync.",
    };
  }

  const [paymentTypes, stores] = await Promise.all([
    fetchLoyversePaymentTypes(settings),
    fetchLoyverseStoresList(settings),
  ]);

  const configuredStore = String(settings.loyverse_store_id || "").trim();
  const storeId = configuredStore || stores[0]?.id;
  if (!storeId) {
    return { ok: false, skipped: true, reason: "no_store", message: "No Loyverse store found. Set Store ID under Integrations." };
  }

  const pt = pickPaymentTypeId(paymentTypes, order.payment_method);
  const paymentTypeId = pt?.id;
  if (!paymentTypeId) {
    return {
      ok: false,
      skipped: true,
      reason: "no_payment_type",
      message: "No matching payment type in Loyverse (Cash/Card). Check the API token and payment_types.",
    };
  }

  const total = receiptLines.reduce((sum, l) => sum + l.item_price * l.quantity, 0);

  const body = {
    store_id: storeId,
    receipt_lines: receiptLines,
    payments: [{ payment_type_id: paymentTypeId, payment_amount: total }],
  };

  try {
    const raw = await createLoyverseReceipt(settings, body);
    const receiptId = extractReceiptId(raw);
    return { ok: true, skipped: false, receiptId, raw };
  } catch (e) {
    return {
      ok: false,
      skipped: false,
      reason: "api_error",
      message: e?.message || String(e),
    };
  }
}
