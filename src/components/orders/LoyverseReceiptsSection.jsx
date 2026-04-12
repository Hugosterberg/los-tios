import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Truck, ChevronDown, ChevronUp, Banknote, CreditCard } from "lucide-react";
import { formatMexicoDateTimeMedium } from "@/lib/mexicoTime";
import { getReceiptPaymentMethod } from "@/lib/mergedSales";

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

function getItems(r) {
  return r.line_items || r.receipt_items || r.items || r.positions || [];
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

export function LoyverseReceiptRow({ receipt, leadBadge = null }) {
  const [open, setOpen] = useState(false);
  const status = getReceiptStatus(receipt);
  const total = getReceiptTotal(receipt);
  const items = getItems(receipt);
  const isCancelled = status.includes("cancel");
  const { Icon: PayIcon, label: payLabel } = getReceiptPayUi(receipt);

  const createdAt = receipt.created_at || receipt.updated_at;

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
            <Badge className={isCancelled ? "bg-red-500/15 text-red-300" : "bg-green-500/15 text-green-300"}>
              {status}
            </Badge>
            {receipt.order_type && (
              <Badge className="bg-blue-500/15 text-blue-300">
                <Truck className="w-3 h-3 mr-1" />
                {receipt.order_type}
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {createdAt ? formatMexicoDateTimeMedium(createdAt) : "—"}
            {receipt.customer_name ? ` · ${receipt.customer_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 text-gray-400">
            <PayIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-xs">{payLabel}</span>
          </div>
          <span className="text-yellow-400 font-bold text-base tabular-nums">{formatMXN(total)}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-yellow-500/10 px-3 pb-3 pt-2 space-y-2 bg-[#1a1a1a]">
          {/* Raw fields */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            {receipt.store_id && (
              <div className="bg-[#242424] rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Store ID</p>
                <p className="text-sm text-white font-medium">{receipt.store_id}</p>
              </div>
            )}
            {receipt.employee_id && (
              <div className="bg-[#242424] rounded-lg px-3 py-2">
                <p className="text-xs text-gray-500">Employee</p>
                <p className="text-sm text-white font-medium">{receipt.employee_id}</p>
              </div>
            )}
            {receipt.note && (
              <div className="bg-[#242424] rounded-lg px-3 py-2 col-span-2">
                <p className="text-xs text-gray-500">Note</p>
                <p className="text-sm text-white">{receipt.note}</p>
              </div>
            )}
            {receipt.delivery_address && (
              <div className="bg-[#242424] rounded-lg px-3 py-2 col-span-2">
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