import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Receipt, RefreshCw, Truck, ChevronDown, ChevronUp, Banknote, CreditCard } from "lucide-react";
import { format } from "date-fns";

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

function ReceiptRow({ receipt }) {
  const [open, setOpen] = useState(false);
  const status = getReceiptStatus(receipt);
  const total = getReceiptTotal(receipt);
  const items = getItems(receipt);
  const isCancelled = status.includes("cancel");
  const isCard = (receipt.payment_type || "").toLowerCase().includes("card") ||
    (receipt.payments || []).some((p) => (p.payment_type || "").toLowerCase() !== "cash");
  const PayIcon = isCard ? CreditCard : Banknote;

  const createdAt = receipt.created_at || receipt.updated_at;

  return (
    <div className="rounded-xl border border-yellow-500/10 bg-[#242424] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex flex-col md:flex-row md:items-center gap-3 p-4 text-left hover:bg-yellow-400/5 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
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
            {createdAt ? format(new Date(createdAt), "d MMM yyyy, HH:mm") : "—"}
            {receipt.customer_name ? ` · ${receipt.customer_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5 text-gray-400">
            <PayIcon className="w-3.5 h-3.5" />
            <span className="text-xs">{isCard ? "Tarjeta" : "Efectivo"}</span>
          </div>
          <span className="text-yellow-400 font-bold text-lg">{formatMXN(total)}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-yellow-500/10 px-4 pb-4 pt-3 space-y-2 bg-[#1a1a1a]">
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
                  <div key={i} className="flex justify-between items-center bg-[#242424] rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-300">{p.payment_type || "payment"}</span>
                    <span className="text-yellow-400 font-semibold">{formatMXN(p.money_amount ?? p.amount ?? 0)}</span>
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

export default function LoyverseReceiptsSection({ receipts, isLoading, isError, onRefresh, isFetching, hasConfig }) {
  if (!hasConfig) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-yellow-400" />
          <h2 className="text-base font-bold text-yellow-400">Loyverse Receipts</h2>
          {receipts.length > 0 && (
            <Badge className="bg-yellow-400/10 text-yellow-300">{receipts.length}</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          className="h-7 gap-1.5 border-yellow-500/20 bg-transparent text-gray-300 hover:bg-yellow-400/10 text-xs"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
          Sync
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 text-sm">Cargando recibos de Loyverse...</div>
      ) : isError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-red-400 text-sm">
          No se pudo conectar con Loyverse. Verifica el token en Integraciones.
        </div>
      ) : receipts.length === 0 ? (
        <div className="rounded-xl border border-yellow-500/10 bg-[#242424] p-6 text-center text-gray-500 text-sm">
          No hay recibos en Loyverse aún.
        </div>
      ) : (
        <div className="space-y-2">
          {receipts.map((r) => (
            <ReceiptRow key={r.id || r.receipt_number || Math.random()} receipt={r} />
          ))}
        </div>
      )}
    </div>
  );
}