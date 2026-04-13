import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Banknote,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import { formatMexicoDateTimeMedium } from "@/lib/mexicoTime";
import { getReceiptPaymentMethod } from "@/lib/mergedSales";
import { cn } from "@/lib/utils";

const EMPTY_MAP = new Map();

const formatMXN = (v) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v || 0);

function getReceiptStatus(r) {
  return (r.status || r.receipt_status || (r.canceled_at ? "cancelled" : "completed")).toLowerCase();
}

function getReceiptTotal(r) {
  const raw = r.total_money ?? r.total_payment_money ?? r.total;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw) || 0;
  if (raw && typeof raw === "object") return Number(raw.amount ?? raw.value) || 0;
  return 0;
}

function isRefundReceipt(r) {
  const rt = String(r?.receipt_type || r?.type || "").toLowerCase();
  if (rt.includes("refund") || rt.includes("return")) return true;
  return getReceiptTotal(r) < -0.009;
}

function getItems(r) {
  return r.line_items || r.receipt_items || r.items || r.positions || [];
}

/** @param {Map} map */
function mapName(map, id) {
  if (!id || !(map instanceof Map)) return "";
  const row = map.get(id);
  if (!row || typeof row !== "object") return "";
  return String(row.name ?? row.customer_name ?? row.employee_name ?? row.title ?? "").trim();
}

export function resolvedLoyverseCustomerName(receipt, customerById) {
  const direct = String(receipt?.customer_name ?? "").trim();
  if (direct) return direct;
  return mapName(customerById || EMPTY_MAP, receipt?.customer_id);
}

export function resolvedLoyverseEmployeeName(receipt, employeeById) {
  return mapName(employeeById || EMPTY_MAP, receipt?.employee_id);
}

export function resolvedLoyverseStoreName(receipt, storeById) {
  return mapName(storeById || EMPTY_MAP, receipt?.store_id);
}

/** Ticket / receipt notes (names on bill, table notes, etc.) — Loyverse field names vary. */
export function collectLoyverseTicketNotes(receipt) {
  if (!receipt || typeof receipt !== "object") return "";
  const keys = [
    "note",
    "notes",
    "internal_note",
    "customer_note",
    "comment",
    "comments",
    "reference",
    "invoice_note",
    "description",
  ];
  const seen = new Set();
  const parts = [];
  for (const k of keys) {
    const v = receipt[k];
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    const low = s.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    parts.push(s);
  }
  return parts.join(" · ");
}

export function getLoyverseReceiptTableLabel(receipt) {
  const t =
    receipt?.table_number ?? receipt?.table_name ?? receipt?.table ?? receipt?.table_id ?? receipt?.dining_table;
  if (t == null || String(t).trim() === "") return "";
  return `Table ${String(t).trim()}`;
}

function normalizeDiningToken(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s·•,]+/g, "_")
    .replace(/_+/g, "_");
}

/** Loyverse Back Office names for dining types (e.g. "PXM Entregas") — skip when matching these generic buckets. */
const GENERIC_DINING_KEYS = new Set([
  "delivery",
  "deliveries",
  "entrega",
  "entregas",
  "envio",
  "envío",
  "shipping",
  "dine_in",
  "dine-in",
  "dinein",
  "eat_in",
  "eatin",
  "restaurant",
  "in_store",
  "instore",
  "pickup",
  "takeout",
  "take_out",
  "carry_out",
  "carryout",
  "togo",
  "to_go",
  "online",
  "web",
  "pos",
  "unknown",
  "dine",
  "take",
  "out",
  "",
]);

function coerceLoyverseDisplayText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") {
    return String(value.name ?? value.title ?? value.label ?? value.display_name ?? "").trim();
  }
  return "";
}

/**
 * Custom dining / delivery service name from Loyverse (e.g. a named delivery type "PXM Entregas").
 * Checks object-shaped `dining_option`, then common string fields.
 */
export function getLoyverseDiningServiceName(receipt) {
  if (!receipt || typeof receipt !== "object") return "";

  const candidates = [];
  const push = (v) => {
    const s = coerceLoyverseDisplayText(v);
    if (s) candidates.push(s);
  };

  const d = receipt.dining_option;
  if (d && typeof d === "object") {
    push(d.name);
    push(d.title);
    push(d.label);
    push(d.display_name);
  }
  push(d);
  push(receipt.dining_option_name);
  push(receipt.dining_type_name);
  push(receipt.dining_type);
  push(receipt.order_channel);
  push(receipt.sales_channel_name);
  push(receipt.channel_name);
  push(receipt.source);
  push(receipt.order_type);

  const seen = new Set();
  for (const s of candidates) {
    const key = normalizeDiningToken(s);
    if (!key || GENERIC_DINING_KEYS.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    return s;
  }
  return "";
}

function combinedReceiptChannelText(receipt) {
  const parts = [];
  const d = receipt?.dining_option;
  if (d && typeof d === "object") {
    parts.push(coerceLoyverseDisplayText(d));
    if (d.type != null && String(d.type).trim()) parts.push(String(d.type));
    if (d.code != null && String(d.code).trim()) parts.push(String(d.code));
  } else {
    parts.push(coerceLoyverseDisplayText(d));
  }
  parts.push(receipt?.source, receipt?.order_type, receipt?.receipt_type);
  return parts.filter(Boolean).join(" ");
}

function receiptLooksLikeDelivery(receipt, value) {
  const v = String(value || "").toLowerCase();
  if (receipt?.delivery_address && String(receipt.delivery_address).trim()) {
    if (v.includes("pickup") || v.includes("takeout") || v.includes("carry") || v.includes("dine")) {
      return false;
    }
    return true;
  }
  return (
    v.includes("delivery") ||
    v.includes("marketplace") ||
    v.includes("uber") ||
    v.includes("rappi") ||
    v.includes("doordash") ||
    v.includes("entrega")
  );
}

/**
 * Dine-in / take-out / delivery from Loyverse dining_option, source, order_type, etc.
 * Includes custom Back Office dining names (e.g. "PXM Entregas") when present in the payload.
 * @returns {{ label: string, Icon: React.ComponentType<{ className?: string }>, badgeClass: string, serviceName?: string }}
 */
export function getReceiptChannelMeta(receipt) {
  const combined = combinedReceiptChannelText(receipt);
  const raw = receipt?.dining_option ?? receipt?.source ?? receipt?.order_type ?? receipt?.receipt_type ?? "";
  const value = String(combined || raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  const serviceName = getLoyverseDiningServiceName(receipt);

  const withService = (baseLabel, meta) => {
    if (!serviceName) return { ...meta, label: baseLabel, serviceName: undefined };
    const low = baseLabel.toLowerCase();
    const snLow = serviceName.toLowerCase();
    if (low.includes(snLow)) return { ...meta, label: baseLabel, serviceName };
    return { ...meta, label: `${baseLabel} · ${serviceName}`, serviceName };
  };

  if (
    value.includes("dine") ||
    value.includes("eat_in") ||
    value.includes("eatin") ||
    value === "in_store" ||
    value.includes("restaurant")
  ) {
    return withService("Dine-in", {
      Icon: UtensilsCrossed,
      badgeClass: "bg-amber-500/15 text-amber-200",
    });
  }
  if (receiptLooksLikeDelivery(receipt, value)) {
    return withService("Delivery", { Icon: Truck, badgeClass: "bg-violet-500/15 text-violet-200" });
  }
  if (
    value.includes("pickup") ||
    value.includes("takeout") ||
    value.includes("take_out") ||
    value.includes("carry") ||
    value.includes("to_go") ||
    value.includes("togo")
  ) {
    return withService("Take-out", { Icon: ShoppingBag, badgeClass: "bg-sky-500/15 text-sky-200" });
  }
  if (value.includes("web") || value.includes("online") || value.includes("ecommerce") || value.includes("shopify")) {
    return withService("Online", { Icon: ShoppingBag, badgeClass: "bg-emerald-500/15 text-emerald-200" });
  }

  const display =
    (typeof raw === "object" && raw ? coerceLoyverseDisplayText(raw) : String(raw).trim()) ||
    combined.trim() ||
    "POS";
  const base = display || "POS";
  if (serviceName && !base.toLowerCase().includes(serviceName.toLowerCase())) {
    return {
      label: `${base} · ${serviceName}`,
      Icon: Truck,
      badgeClass: "bg-blue-500/15 text-blue-200",
      serviceName,
    };
  }
  return {
    label: base,
    Icon: Truck,
    badgeClass: "bg-blue-500/15 text-blue-200",
    serviceName: serviceName || undefined,
  };
}

/** Loyverse uses `payments[].type` / `name`; `payment_type` is often missing — do not treat empty as "not cash". */
function paymentLineMethod(p) {
  return String(p?.type ?? p?.name ?? p?.payment_type ?? "").trim();
}

function isCashLike(method) {
  const s = method.toLowerCase();
  return s === "cash" || s.includes("efectivo") || (s.includes("cash") && !s.includes("cashback"));
}

function isCardLike(method) {
  const s = method.toLowerCase();
  return (
    s.includes("card") ||
    s.includes("tarjeta") ||
    s.includes("debit") ||
    s.includes("credit") ||
    s.includes("visa") ||
    s.includes("mastercard")
  );
}

function getReceiptPayUi(receipt) {
  const payments = Array.isArray(receipt.payments) ? receipt.payments : [];
  if (payments.length === 0) {
    const m = String(getReceiptPaymentMethod(receipt) || "");
    if (isCashLike(m)) return { Icon: Banknote, label: "Efectivo" };
    if (isCardLike(m)) return { Icon: CreditCard, label: "Tarjeta" };
    return { Icon: CreditCard, label: m || "—" };
  }

  const methods = payments.map(paymentLineMethod);
  if (payments.length === 1) {
    const m = methods[0];
    if (isCashLike(m)) return { Icon: Banknote, label: "Efectivo" };
    if (isCardLike(m)) return { Icon: CreditCard, label: "Tarjeta" };
    return { Icon: CreditCard, label: m || "—" };
  }

  const cashN = methods.filter(isCashLike).length;
  const cardN = methods.filter(isCardLike).length;
  if (cashN === payments.length) return { Icon: Banknote, label: "Efectivo" };
  if (cardN === payments.length) return { Icon: CreditCard, label: "Tarjeta" };
  if (cashN > 0 && cardN === 0) return { Icon: Banknote, label: "Efectivo" };
  if (cardN > 0 && cashN === 0) return { Icon: CreditCard, label: "Tarjeta" };
  return { Icon: CreditCard, label: "Mixto" };
}

export function LoyverseReceiptRow({
  receipt,
  leadBadge = null,
  customerById,
  employeeById,
  storeById,
}) {
  const [open, setOpen] = useState(false);
  const status = getReceiptStatus(receipt);
  const total = getReceiptTotal(receipt);
  const items = getItems(receipt);
  const isCancelled = status.includes("cancel");
  const isRefund = isRefundReceipt(receipt);
  const { Icon: PayIcon, label: payLabel } = getReceiptPayUi(receipt);
  const channel = getReceiptChannelMeta(receipt);
  const ChannelIcon = channel.Icon;
  const diningServiceLabel = getLoyverseDiningServiceName(receipt);
  const showDiningServiceRow =
    Boolean(diningServiceLabel) && !channel.label.toLowerCase().includes(diningServiceLabel.toLowerCase());
  const customerLabel = resolvedLoyverseCustomerName(receipt, customerById);
  const ticketNotes = collectLoyverseTicketNotes(receipt);
  const tableLabel = getLoyverseReceiptTableLabel(receipt);
  const storeName = resolvedLoyverseStoreName(receipt, storeById);
  const employeeName = resolvedLoyverseEmployeeName(receipt, employeeById);

  const createdAt = receipt.created_at || receipt.updated_at;

  const summaryParts = [];
  if (createdAt) summaryParts.push(formatMexicoDateTimeMedium(createdAt));
  if (customerLabel) summaryParts.push(customerLabel);
  if (tableLabel) summaryParts.push(tableLabel);
  if (ticketNotes) {
    const short = ticketNotes.length > 96 ? `${ticketNotes.slice(0, 93)}…` : ticketNotes;
    summaryParts.push(short);
  }
  const summaryLine = summaryParts.length ? summaryParts.join(" · ") : "—";

  return (
    <div className="rounded-lg border border-yellow-500/10 bg-[#242424] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-col sm:flex-row sm:items-center gap-2 p-3 text-left hover:bg-yellow-400/5 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            {leadBadge}
            <span className="font-semibold text-white text-sm">
              #{receipt.receipt_number || receipt.id?.slice(0, 8) || "—"}
            </span>
            <Badge className={cn("flex items-center gap-1 text-[10px] font-medium", channel.badgeClass)}>
              <ChannelIcon className="h-3 w-3 shrink-0" />
              {channel.label}
            </Badge>
            <Badge className={isCancelled ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"}>
              {status}
            </Badge>
            {isRefund && !isCancelled ? (
              <Badge className="bg-rose-500/20 text-rose-200">Refund</Badge>
            ) : null}
          </div>
          <p className="text-xs leading-snug text-gray-300">{summaryLine}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-gray-400">
            <PayIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs">{payLabel}</span>
          </div>
          <span
            className={cn(
              "font-bold text-base tabular-nums",
              isRefund ? "text-rose-300" : "text-yellow-400",
            )}
          >
            {formatMXN(total)}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-yellow-500/10 px-3 pb-3 pt-2 space-y-2 bg-[#1a1a1a]">
          <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-2">
            {receipt.store_id ? (
              <div className="rounded-lg bg-[#242424] px-3 py-2">
                <p className="text-xs text-gray-500">Store</p>
                <p className="text-sm font-medium text-white">{storeName || "—"}</p>
                {storeName ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-gray-500" title={receipt.store_id}>
                    {receipt.store_id}
                  </p>
                ) : (
                  <p className="mt-0.5 font-mono text-[10px] text-gray-500">{receipt.store_id}</p>
                )}
              </div>
            ) : null}
            {receipt.employee_id ? (
              <div className="rounded-lg bg-[#242424] px-3 py-2">
                <p className="text-xs text-gray-500">Cashier / staff</p>
                <p className="text-sm font-medium text-white">{employeeName || "—"}</p>
                {employeeName ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-gray-500" title={receipt.employee_id}>
                    {receipt.employee_id}
                  </p>
                ) : (
                  <p className="mt-0.5 font-mono text-[10px] text-gray-500">{receipt.employee_id}</p>
                )}
              </div>
            ) : null}
            {customerLabel || receipt.customer_id ? (
              <div className="rounded-lg bg-[#242424] px-3 py-2 sm:col-span-2">
                <p className="text-xs text-gray-500">Customer</p>
                <p className="text-sm font-medium text-white">{customerLabel || "—"}</p>
                {receipt.customer_id ? (
                  <p className="mt-0.5 truncate font-mono text-[10px] text-gray-500" title={receipt.customer_id}>
                    {receipt.customer_id}
                  </p>
                ) : null}
              </div>
            ) : null}
            {ticketNotes ? (
              <div className="rounded-lg bg-[#242424] px-3 py-2 sm:col-span-2">
                <p className="text-xs text-gray-500">Ticket notes</p>
                <p className="text-sm text-gray-100">{ticketNotes}</p>
              </div>
            ) : null}
            {showDiningServiceRow ? (
              <div className="rounded-lg bg-[#242424] px-3 py-2 sm:col-span-2">
                <p className="text-xs text-gray-500">Dining / delivery service (Loyverse)</p>
                <p className="text-sm font-medium text-white">{diningServiceLabel}</p>
              </div>
            ) : null}
            {receipt.delivery_address && (
              <div className="rounded-lg bg-[#242424] px-3 py-2 sm:col-span-2">
                <p className="text-xs text-gray-500">Delivery address</p>
                <p className="text-sm text-white">{receipt.delivery_address}</p>
              </div>
            )}
          </div>

          {/* Payments */}
          {receipt.payments && receipt.payments.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1.5">Payments</p>
              <div className="space-y-1.5">
                {receipt.payments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center bg-[#242424] rounded-lg px-2.5 py-1.5 gap-2">
                    <span className="text-sm text-gray-300 truncate">
                      {paymentLineMethod(p) || "payment"}
                    </span>
                    <span className="text-yellow-400 font-semibold tabular-nums shrink-0">
                      {formatMXN(
                        typeof p.money_amount === "object" && p.money_amount?.amount != null
                          ? p.money_amount.amount
                          : p.money_amount ?? p.amount ?? 0,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Line items */}
          {items.length > 0 ? (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Items ({items.length})</p>
              <div className="space-y-1.5">
                {items.map((item, idx) => {
                  const qty = item.quantity ?? item.qty ?? 1;
                  const price = (() => {
                    const raw = item.price_money ?? item.price ?? item.cost_money ?? item.amount_money;
                    if (typeof raw === "number") return raw;
                    if (typeof raw === "string") return Number(raw) || 0;
                    if (raw && typeof raw === "object") return Number(raw.amount ?? raw.value) || 0;
                    return 0;
                  })();
                  const name = item.item_name || item.name || item.description || item.item_id || "Item";
                  return (
                    <div key={idx} className="flex justify-between items-start bg-[#242424] rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm text-white font-medium">{name}</p>
                        <p className="text-xs text-gray-500">x{qty} · {formatMXN(price)} c/u</p>
                      </div>
                      <span className="text-yellow-400 font-semibold">{formatMXN(price * qty)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No line items in this receipt payload.</p>
          )}

          <div className="pt-2 border-t border-yellow-500/10 flex justify-between font-bold text-base">
            <span className="text-gray-300">Total</span>
            <span className="text-yellow-400">{formatMXN(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}