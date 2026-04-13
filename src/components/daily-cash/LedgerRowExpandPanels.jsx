import {
  collectLoyverseTicketNotes,
  getLoyverseDiningServiceName,
  getLoyverseReceiptTableLabel,
  getReceiptChannelMeta,
  resolvedLoyverseCustomerName,
  resolvedLoyverseEmployeeName,
  resolvedLoyverseStoreName,
} from "@/components/orders/LoyverseReceiptsSection";
import { cn } from "@/lib/utils";

function formatMx(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function paymentLineMoney(p) {
  const raw = p?.money_amount ?? p?.amount_money ?? p?.amount;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw) || 0;
  if (raw && typeof raw === "object") return Number(raw.amount ?? raw.value) || 0;
  return 0;
}

export function LoyverseLedgerDetailPanel({ receipt, customerById, employeeById, storeById }) {
  if (!receipt) return null;
  const channel = getReceiptChannelMeta(receipt);
  const Ch = channel.Icon;
  const diningService = getLoyverseDiningServiceName(receipt);
  const customer = resolvedLoyverseCustomerName(receipt, customerById);
  const emp = resolvedLoyverseEmployeeName(receipt, employeeById);
  const store = resolvedLoyverseStoreName(receipt, storeById);
  const notes = collectLoyverseTicketNotes(receipt);
  const table = getLoyverseReceiptTableLabel(receipt);
  const payments = Array.isArray(receipt.payments) ? receipt.payments : [];

  return (
    <div className="space-y-3 rounded-lg border border-yellow-500/15 bg-[#141210] p-3 text-sm">
      <div className="flex flex-col gap-1.5">
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
            channel.badgeClass,
          )}
        >
          <Ch className="h-3.5 w-3.5 shrink-0" />
          {channel.label}
        </span>
        {diningService && !channel.label.toLowerCase().includes(diningService.toLowerCase()) ? (
          <p className="text-[11px] text-gray-400">
            Loyverse dining name: <span className="text-gray-200">{diningService}</span>
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {customer ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Customer</p>
            <p className="text-gray-100">{customer}</p>
          </div>
        ) : null}
        {table ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Table / seat</p>
            <p className="text-gray-100">{table}</p>
          </div>
        ) : null}
        {store ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Store</p>
            <p className="text-gray-100">{store}</p>
          </div>
        ) : null}
        {emp ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Cashier</p>
            <p className="text-gray-100">{emp}</p>
          </div>
        ) : null}
      </div>
      {notes ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Ticket notes</p>
          <p className="leading-snug text-gray-200">{notes}</p>
        </div>
      ) : null}
      {receipt.delivery_address ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Delivery</p>
          <p className="leading-snug text-gray-200">{receipt.delivery_address}</p>
        </div>
      ) : null}
      {payments.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">All tenders on receipt</p>
          <div className="space-y-1">
            {payments.map((p, i) => (
              <div key={i} className="flex justify-between gap-2 rounded bg-black/30 px-2 py-1 text-xs">
                <span className="truncate text-gray-400">
                  {String(p?.type ?? p?.name ?? p?.payment_type ?? "Payment").trim()}
                </span>
                <span className="shrink-0 tabular-nums text-yellow-200/90">{formatMx(paymentLineMoney(p))}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppOrderLedgerDetailPanel({ order }) {
  if (!order) return null;
  const items = order.items || [];

  return (
    <div className="space-y-3 rounded-lg border border-yellow-500/15 bg-[#141210] p-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Customer</p>
          <p className="text-gray-100">{order.customer_name?.trim() || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Order type</p>
          <p className="text-gray-100 capitalize">{order.order_type?.replace(/_/g, " ") || "—"}</p>
        </div>
        {order.table_number ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Table</p>
            <p className="text-gray-100">{order.table_number}</p>
          </div>
        ) : null}
        {order.customer_phone ? (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Phone</p>
            <p className="text-gray-100">{order.customer_phone}</p>
          </div>
        ) : null}
      </div>
      {order.delivery_address ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Delivery address</p>
          <p className="leading-snug text-gray-200">{order.delivery_address}</p>
        </div>
      ) : null}
      {order.special_instructions ? (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Special instructions</p>
          <p className="leading-snug text-gray-200">{order.special_instructions}</p>
        </div>
      ) : null}
      {items.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Items</p>
          <ul className="space-y-1 text-xs text-gray-300">
            {items.map((it, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="min-w-0">
                  {it.quantity}× {it.item_name || "Item"}
                </span>
                <span className="shrink-0 tabular-nums text-yellow-200/80">
                  {formatMx((it.price || 0) * (it.quantity || 0))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
