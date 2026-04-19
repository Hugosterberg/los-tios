import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Banknote,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Package,
  Phone,
  MapPin,
  Printer,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { formatMexicoDateTimeMedium } from "@/lib/mexicoTime";
import { cn } from "@/lib/utils";
import { LoyverseReceiptRow } from "./LoyverseReceiptsSection";

const formatMXN = (v) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v || 0);

const RANGE_OPTIONS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

function recordInWindow(iso, start, end) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}

function isPaymentSettled(order) {
  const ps = order.payment_status;
  return ps === "paid" || ps === "confirmed";
}

function isPaidDeliveredOrder(order) {
  if (order.status !== "delivered") return false;
  if (order.payment_status && !isPaymentSettled(order)) return false;
  return true;
}

function loyverseReceiptIsCompleted(receipt) {
  const status = (
    receipt?.status ||
    receipt?.receipt_status ||
    (receipt?.canceled_at ? "cancelled" : "completed")
  ).toLowerCase();
  return !status.includes("cancel");
}

function paymentUi(order) {
  const m = String(order.payment_method || "cash").toLowerCase();
  if (m === "card") {
    return { Icon: CreditCard, label: "Card" };
  }
  if (m === "cash") {
    return { Icon: Banknote, label: "Cash" };
  }
  return { Icon: Banknote, label: m || "—" };
}

function AppPaidOrderRow({ order, onPrint }) {
  const [open, setOpen] = useState(false);
  const { Icon: PayIcon, label: payLabel } = paymentUi(order);
  const when = order.updated_date || order.created_date;
  const items = order.items || [];
  const total = Number(order.total_amount || 0);
  const orderTypeIcons = {
    "dine-in": Package,
    delivery: Truck,
    takeout: ShoppingBag,
  };
  const TypeIcon = orderTypeIcons[order.order_type] || Package;

  return (
    <div className="overflow-hidden rounded-lg border border-yellow-500/10 bg-[#242424]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-col gap-2 p-3 text-left transition-colors hover:bg-yellow-400/5 sm:flex-row sm:items-center"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
            <Badge className="border-yellow-500/30 bg-yellow-400/10 text-[10px] uppercase tracking-wide text-yellow-200">
              App order
            </Badge>
            <span className="text-sm font-semibold text-white">{order.customer_name || "Customer"}</span>
            <Badge variant="outline" className="border-yellow-500/20 text-[10px] text-gray-400">
              <TypeIcon className="mr-1 h-3 w-3" />
              {order.order_type || "order"}
            </Badge>
          </div>
          <p className="text-xs text-gray-400">
            {when ? formatMexicoDateTimeMedium(when) : "—"}
            {order.table_number ? ` · Table ${order.table_number}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:justify-end">
          <div className="flex items-center gap-1.5 text-gray-400">
            <PayIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">{payLabel}</span>
          </div>
          <span className="text-base font-bold tabular-nums text-yellow-400">{formatMXN(total)}</span>
          {open ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-yellow-500/10 bg-[#1a1a1a] px-3 pb-3 pt-2">
          <div className="flex flex-wrap gap-2">
            {onPrint && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 border-yellow-500/25 text-xs text-gray-200"
                onClick={() => onPrint(order)}
              >
                <Printer className="mr-1 h-3 w-3" />
                Receipt
              </Button>
            )}
            {order.loyverse_receipt_id && (
              <span className="inline-flex items-center rounded-md border border-yellow-500/20 px-2 py-1 text-[11px] text-gray-400">
                Loyverse receipt ID:{" "}
                <span className="ml-1 font-mono text-yellow-200/90">{String(order.loyverse_receipt_id).slice(0, 12)}…</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 text-sm text-gray-400 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              {order.customer_phone || "—"}
            </div>
            {order.delivery_address && (
              <div className="flex items-start gap-2 sm:col-span-2">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{order.delivery_address}</span>
              </div>
            )}
          </div>

          {order.special_instructions ? (
            <div className="rounded-lg border border-yellow-500/10 bg-[#242424] px-2.5 py-2 text-xs text-gray-300">
              <span className="text-gray-500">Note · </span>
              {order.special_instructions}
            </div>
          ) : null}

          <div>
            <p className="mb-1.5 text-xs text-gray-500">Items ({items.length})</p>
            <div className="space-y-1.5">
              {items.map((item, idx) => {
                const line = (item.price || 0) * (item.quantity || 0);
                return (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-2 rounded-lg bg-[#242424] px-2.5 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {item.quantity}× {item.item_name || "Item"}
                      </p>
                      {item.is_custom ? (
                        <span className="mt-0.5 inline-block text-[10px] text-purple-300">Custom</span>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-yellow-400">
                      {formatMXN(line)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between border-t border-yellow-500/10 pt-2 text-sm font-semibold">
            <span className="text-gray-400">Total</span>
            <span className="text-yellow-400">{formatMXN(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaidOrdersReceiptsFeed({
  orders = [],
  loyverseReceipts = [],
  dateWindow,
  range = "day",
  onRangeChange,
  periodLabel = "",
  loyverseLoading = false,
  loyverseError = false,
  onLoyverseRefresh,
  loyverseFetching = false,
  hasLoyverseConfig = false,
  onPrintReceipt,
  loyverseCustomers,
  loyverseEmployees,
  loyverseStores,
}) {
  const customerById = useMemo(() => {
    const m = new Map();
    for (const c of loyverseCustomers || []) {
      if (c?.id != null) m.set(c.id, c);
    }
    return m;
  }, [loyverseCustomers]);

  const employeeById = useMemo(() => {
    const m = new Map();
    for (const e of loyverseEmployees || []) {
      if (e?.id != null) m.set(e.id, e);
    }
    return m;
  }, [loyverseEmployees]);

  const storeById = useMemo(() => {
    const m = new Map();
    for (const s of loyverseStores || []) {
      if (s?.id != null) m.set(s.id, s);
    }
    return m;
  }, [loyverseStores]);
  const paidAppOrders = useMemo(() => {
    if (!dateWindow?.start || !dateWindow?.end) return [];
    return orders.filter((o) => {
      if (!isPaidDeliveredOrder(o)) return false;
      const t = o.updated_date || o.created_date;
      return recordInWindow(t, dateWindow.start, dateWindow.end);
    });
  }, [orders, dateWindow]);

  const loyverseCompleted = useMemo(
    () => loyverseReceipts.filter(loyverseReceiptIsCompleted),
    [loyverseReceipts],
  );

  const merged = useMemo(() => {
    const app = paidAppOrders.map((order) => ({
      kind: "app",
      sortTime: new Date(order.updated_date || order.created_date).getTime(),
      order,
    }));
    const lv = loyverseCompleted.map((receipt) => ({
      kind: "loyverse",
      sortTime: new Date(receipt.created_at || receipt.updated_at || 0).getTime(),
      receipt,
    }));
    return [...app, ...lv].sort((a, b) => b.sortTime - a.sortTime);
  }, [paidAppOrders, loyverseCompleted]);

  const totalCount = merged.length;

  return (
    <div className="mx-auto mb-6 w-full max-w-3xl">
      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Receipt className="h-4 w-4 shrink-0 text-yellow-400" />
            <h2 className="text-base font-bold text-yellow-400">Paid orders & receipts</h2>
            <Badge className="bg-yellow-400/10 text-yellow-300">{totalCount}</Badge>
          </div>
          {hasLoyverseConfig && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onLoyverseRefresh}
              disabled={loyverseFetching}
              className="h-7 shrink-0 gap-1.5 border-yellow-500/20 bg-transparent text-xs text-gray-300 hover:bg-yellow-400/10"
            >
              <RefreshCw className={`h-3 w-3 ${loyverseFetching ? "animate-spin" : ""}`} />
              Sync Loyverse
            </Button>
          )}
        </div>
        {typeof onRangeChange === "function" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {periodLabel ? (
              <p className="text-[11px] leading-snug text-gray-500">{periodLabel}</p>
            ) : (
              <span />
            )}
            <div className="flex gap-0.5 rounded-lg border border-yellow-500/15 bg-black/30 p-0.5">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onRangeChange(opt.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    range === opt.id ? "bg-yellow-400 text-black" : "text-gray-400 hover:text-white",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-[11px] leading-snug text-gray-400">
          Web orders marked delivered and paid (or card confirmed), plus Loyverse POS receipts (non-cancelled), including
          refunds/returns when the API returns them. For POS, we show dine-in / take-out / delivery, ticket notes, table,
          and customer names when Loyverse sends them (or when we can match a customer ID).
        </p>
      </div>

      {hasLoyverseConfig && loyverseError && (
        <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
          Could not load Loyverse receipts. Check the token under Integrations. App orders below may still be shown.
        </div>
      )}

      {hasLoyverseConfig && loyverseLoading && paidAppOrders.length === 0 && merged.length === 0 ? (
        <div className="rounded-xl border border-yellow-500/10 bg-[#242424] py-10 text-center text-sm text-gray-500">
          Loading paid orders and receipts…
        </div>
      ) : merged.length === 0 ? (
        <div className="rounded-xl border border-yellow-500/10 bg-[#242424] p-8 text-center text-sm text-gray-500">
          No paid orders or receipts in this period.
        </div>
      ) : (
        <div className="space-y-1.5">
          {merged.map((entry, idx) =>
            entry.kind === "app" ? (
              <AppPaidOrderRow
                key={`app-${entry.order.id}`}
                order={entry.order}
                onPrint={onPrintReceipt}
              />
            ) : (
              <LoyverseReceiptRow
                key={`lv-${entry.receipt.id || entry.receipt.receipt_number || idx}`}
                receipt={entry.receipt}
                customerById={customerById}
                employeeById={employeeById}
                storeById={storeById}
                leadBadge={
                  <Badge className="border-blue-500/30 bg-blue-500/15 text-[9px] uppercase tracking-wide text-blue-200">
                    POS
                  </Badge>
                }
              />
            ),
          )}
          {hasLoyverseConfig && loyverseLoading && (
            <p className="py-2 text-center text-[11px] text-gray-600">Refreshing Loyverse receipts…</p>
          )}
        </div>
      )}
    </div>
  );
}
