import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  AlertTriangle,
  CircleDollarSign,
  Receipt,
  RefreshCw,
  ScanLine,
  ShoppingBag,
  Store,
  Table2,
  XCircle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getLoyverseOverview, hasLoyverseApiConfig, LOYVERSE_API_BASE_URL } from "@/api/loyverse";
import { appParams } from "@/lib/app-params";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { listOrders } from "@/lib/local-dev-orders";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value || 0);

const formatRelativeDate = (value) =>
  value
    ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: enUS })
    : "Unknown time";

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "N/A";

const ACTIVE_ORDER_STATUSES = ["pending", "preparing", "ready", "out_for_delivery"];
const TABLE_NUMBERS = new Set(["1", "2", "3", "4", "5", "6"]);

function normalizeTableNumber(value) {
  if (value === null || value === undefined) return "";
  const match = String(value).match(/\d+/);
  return match ? match[0] : String(value).trim();
}

function getReceiptStatus(receipt) {
  return (
    receipt.status ||
    receipt.receipt_status ||
    (receipt.canceled_at ? "cancelled" : "completed")
  ).toLowerCase();
}

function getReceiptId(receipt) {
  return receipt.receipt_number || receipt.receipt_no || receipt.id || "Unknown";
}

function getMoneyValue(candidate) {
  if (typeof candidate === "number") return candidate;
  if (typeof candidate === "string") return Number(candidate) || 0;
  if (candidate && typeof candidate === "object") {
    return Number(candidate.amount ?? candidate.value) || 0;
  }
  return 0;
}

function getReceiptTotal(receipt) {
  return getMoneyValue(receipt.total_money ?? receipt.total_payment_money ?? receipt.total);
}

function getReceiptItems(receipt) {
  return (
    receipt.line_items ||
    receipt.receipt_items ||
    receipt.items ||
    receipt.positions ||
    []
  );
}

function getReceiptItemName(item) {
  return item.item_name || item.name || item.description || item.item_id || "Unnamed item";
}

function getReceiptItemQuantity(item) {
  return item.quantity ?? item.qty ?? 0;
}

function getReceiptItemPrice(item) {
  return getMoneyValue(item.price_money ?? item.price ?? item.cost_money ?? item.amount_money);
}

function MetricCard({ label, value, hint, icon: Icon }) {
  return (
    <Card className="border-yellow-500/20 bg-[#242424] text-white">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</p>
          <Icon className="h-4 w-4 text-yellow-400" />
        </div>
        <p className="text-2xl font-bold text-yellow-400">{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-yellow-500/10 bg-[#242424] p-8 text-center">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-gray-400">{description}</p>
    </div>
  );
}

export default function LoyverseOrders() {
  const [selectedView, setSelectedView] = React.useState("all");
  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" || !appParams.appId || !appParams.serverUrl);
  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });
  const appSettings = React.useMemo(() => getResolvedIntegrationSettings(settings[0] || {}), [settings]);

  const overviewQuery = useQuery({
    queryKey: ["loyverseOverview", settings[0]?.id || "none"],
    queryFn: () => getLoyverseOverview(appSettings),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });
  const appOrdersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), "-created_date"),
  });

  const overview = overviewQuery.data;
  const receipts = overview?.receipts || [];
  const appOrders = appOrdersQuery.data || [];
  const completedReceipts = receipts.filter((receipt) => !getReceiptStatus(receipt).includes("cancel"));
  const cancelledReceipts = receipts.filter((receipt) => getReceiptStatus(receipt).includes("cancel"));
  const displayedReceipts =
    selectedView === "completed"
      ? completedReceipts
      : selectedView === "cancelled"
        ? cancelledReceipts
        : receipts;
  const activeTableOrders = appOrders.filter((order) => {
    const normalizedTable = normalizeTableNumber(order.table_number);
    return order.order_type === "dine-in" && TABLE_NUMBERS.has(normalizedTable) && ACTIVE_ORDER_STATUSES.includes(order.status);
  });
  const tableHistory = appOrders
    .filter((order) => {
      const normalizedTable = normalizeTableNumber(order.table_number);
      return order.order_type === "dine-in" && TABLE_NUMBERS.has(normalizedTable) && order.status === "delivered";
    })
    .sort((a, b) => new Date(b.updated_date || b.created_date).getTime() - new Date(a.updated_date || a.created_date).getTime())
    .slice(0, 12);
  const tableCards = Array.from({ length: 6 }, (_, index) => {
    const tableNumber = String(index + 1);
    const activeOrder = activeTableOrders.find(
      (order) => normalizeTableNumber(order.table_number) === tableNumber,
    );
    const latestClosedOrder = tableHistory.find(
      (order) => normalizeTableNumber(order.table_number) === tableNumber,
    );

    return {
      tableNumber,
      activeOrder,
      latestClosedOrder,
    };
  });

  if (!hasLoyverseApiConfig(appSettings)) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="border-b border-yellow-500/20 py-5">
          <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">Loyverse Orders</h1>
                <p className="text-xs text-gray-500">Loyverse receipts feed</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1360px] px-3 py-5 sm:px-5 lg:px-6">
          <EmptyState
            title="Missing Loyverse token"
            description="Add the Loyverse token in Settings, or set VITE_LOYVERSE_API_TOKEN in .env.local to load receipts from Loyverse."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="border-b border-yellow-500/20">
        <div className="mx-auto max-w-[1360px] px-3 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">Loyverse Orders</h1>
                <p className="text-xs text-gray-500">Receipts and payment data from {overviewQuery.data?.config?.baseUrl || LOYVERSE_API_BASE_URL}</p>
              </div>
            </div>
            <Button
              onClick={() => overviewQuery.refetch()}
              disabled={overviewQuery.isFetching}
              className="h-8 gap-2 bg-yellow-400 px-3 text-sm text-black hover:bg-yellow-300"
            >
              <RefreshCw className={`h-4 w-4 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] px-3 py-5 sm:px-5 lg:px-6">
        {overviewQuery.isError ? (
          <Card className="mb-5 border-red-500/30 bg-[#242424] text-white">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
              <div>
                <p className="font-semibold text-red-400">Could not load Loyverse receipts</p>
                <p className="text-sm text-gray-300">{overviewQuery.error.message}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricCard
            label="All Receipts"
            value={formatNumber(receipts.length)}
            hint="Returned by the receipts endpoint"
            icon={Receipt}
          />
          <MetricCard
            label="Completed"
            value={formatNumber(completedReceipts.length)}
            hint="Non-cancelled receipts"
            icon={CircleDollarSign}
          />
          <MetricCard
            label="Cancelled"
            value={formatNumber(cancelledReceipts.length)}
            hint="Cancelled/canceled receipts"
            icon={XCircle}
          />
          <MetricCard
            label="Last Sync"
            value={overview?.metrics?.latestSyncAt ? formatRelativeDate(overview.metrics.latestSyncAt) : "N/A"}
            hint={overview?.metrics?.latestSyncAt ? formatDateTime(overview.metrics.latestSyncAt) : "Not synced yet"}
            icon={ScanLine}
          />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                <Table2 className="h-4 w-4" />
                Tables
              </CardTitle>
              <p className="text-sm text-gray-400">
                Live table note status from the web app order flow, used here because Loyverse is not returning table resources.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tableCards.map((table) => (
                  <div
                    key={table.tableNumber}
                    className={`rounded-2xl border p-4 ${
                      table.activeOrder
                        ? "border-yellow-400/40 bg-yellow-400/10"
                        : "border-yellow-500/10 bg-[#1a1a1a]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-bold text-white">Table {table.tableNumber}</p>
                      <Badge
                        className={
                          table.activeOrder
                            ? "bg-yellow-400 text-black hover:bg-yellow-400"
                            : "bg-black/30 text-gray-300 hover:bg-black/30"
                        }
                      >
                        {table.activeOrder ? "Open note" : "Free"}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-gray-500">Current note</p>
                    <p className="mt-1 text-xl font-bold text-yellow-400">
                      {table.activeOrder ? formatCurrency(table.activeOrder.total_amount) : formatCurrency(0)}
                    </p>
                    <p className="mt-2 text-sm text-gray-400">
                      {table.activeOrder
                        ? `${(table.activeOrder.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0)} items | ${table.activeOrder.status || "pending"}`
                        : "No active note"}
                    </p>
                    <div className="mt-4 rounded-xl border border-yellow-500/10 bg-black/20 p-3">
                      <p className="text-xs text-gray-500">Last closed note</p>
                      <p className="mt-1 font-semibold text-white">
                        {table.latestClosedOrder ? formatCurrency(table.latestClosedOrder.total_amount) : "No history yet"}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {table.latestClosedOrder
                          ? formatDateTime(table.latestClosedOrder.updated_date || table.latestClosedOrder.created_date)
                          : "This table has not been closed yet"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                <ShoppingBag className="h-4 w-4" />
                Note History
              </CardTitle>
              <p className="text-sm text-gray-400">
                Recent closed dine-in notes from the app, shown alongside Loyverse receipts.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {appOrdersQuery.isLoading ? (
                <EmptyState title="Loading table history..." description="Pulling recent dine-in note history from the app." />
              ) : tableHistory.length === 0 ? (
                <EmptyState title="No closed table notes yet" description="Closed table history will appear here once dine-in orders are completed." />
              ) : (
                tableHistory.map((order) => (
                  <div
                    key={order.id}
                    className="flex flex-col gap-3 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white">Table {normalizeTableNumber(order.table_number)}</p>
                        <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">
                          {order.payment_method || "paid"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {order.customer_name || "No customer name"} | {formatDateTime(order.updated_date || order.created_date)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-left md:text-right">
                      <div>
                        <p className="text-xs text-gray-500">Items</p>
                        <p className="font-bold text-yellow-400">
                          {formatNumber((order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total</p>
                        <p className="font-bold text-yellow-400">{formatCurrency(order.total_amount)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setSelectedView("all")}
            className={`rounded-xl border p-3 text-left transition-colors ${
              selectedView === "all"
                ? "border-yellow-300 bg-yellow-400 text-black"
                : "border-yellow-500/20 bg-[#242424]"
            }`}
          >
            <p className="mb-1 text-xs text-gray-500">All</p>
            <p className={`text-xl font-bold ${selectedView === "all" ? "text-black" : "text-gray-300"}`}>{receipts.length}</p>
          </button>
          <button
            type="button"
            onClick={() => setSelectedView("completed")}
            className={`rounded-xl border p-3 text-left transition-colors ${
              selectedView === "completed"
                ? "border-yellow-300 bg-yellow-400 text-black"
                : "border-yellow-500/20 bg-[#242424]"
            }`}
          >
            <p className="mb-1 text-xs text-gray-500">Completed</p>
            <p className={`text-xl font-bold ${selectedView === "completed" ? "text-black" : "text-yellow-400"}`}>{completedReceipts.length}</p>
          </button>
          <button
            type="button"
            onClick={() => setSelectedView("cancelled")}
            className={`rounded-xl border p-3 text-left transition-colors ${
              selectedView === "cancelled"
                ? "border-yellow-300 bg-yellow-400 text-black"
                : "border-yellow-500/20 bg-[#242424]"
            }`}
          >
            <p className="mb-1 text-xs text-gray-500">Cancelled</p>
            <p className={`text-xl font-bold ${selectedView === "cancelled" ? "text-black" : "text-yellow-400"}`}>{cancelledReceipts.length}</p>
          </button>
        </div>

        {overviewQuery.isLoading ? (
          <EmptyState
            title="Loading Loyverse receipts..."
            description="Pulling the latest receipt feed from Loyverse."
          />
        ) : displayedReceipts.length === 0 ? (
          <EmptyState
            title="No receipts returned by Loyverse"
            description="This account currently returns zero records from the receipts endpoint. When Loyverse starts exposing receipts here, they will appear on this page automatically."
          />
        ) : (
          <div className="space-y-3">
            {displayedReceipts.map((receipt) => {
              const status = getReceiptStatus(receipt);
              const receiptItems = getReceiptItems(receipt);
              const totalItems = receiptItems.reduce(
                (sum, item) => sum + (Number(getReceiptItemQuantity(item)) || 0),
                0,
              );

              return (
                <Card key={receipt.id || `${getReceiptId(receipt)}-${receipt.created_at || ""}`} className="border-yellow-500/10 bg-[#242424] text-white shadow-none">
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible>
                      <AccordionItem value={receipt.id || getReceiptId(receipt)} className="border-none">
                        <AccordionTrigger className="px-4 py-4 hover:no-underline">
                          <div className="flex w-full flex-col gap-3 text-left md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-white">{getReceiptId(receipt)}</p>
                                <Badge
                                  className={
                                    status.includes("cancel")
                                      ? "bg-red-500/15 text-red-300 hover:bg-red-500/15"
                                      : "bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15"
                                  }
                                >
                                  {status}
                                </Badge>
                                {(receipt.store_name || receipt.store_id) ? (
                                  <Badge className="bg-black/30 text-gray-200 hover:bg-black/30">
                                    <Store className="mr-1 h-3 w-3" />
                                    {receipt.store_name || receipt.store_id}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-2 text-xs text-gray-400">
                                {formatDateTime(receipt.created_at || receipt.updated_at)} | {formatRelativeDate(receipt.created_at || receipt.updated_at)}
                              </p>
                            </div>
                            <div className="mr-6 grid grid-cols-3 gap-6 text-left md:text-right">
                              <div>
                                <p className="text-xs text-gray-500">Items</p>
                                <p className="font-bold text-yellow-400">{formatNumber(totalItems)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Lines</p>
                                <p className="font-bold text-yellow-400">{formatNumber(receiptItems.length)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">Total</p>
                                <p className="font-bold text-yellow-400">{formatCurrency(getReceiptTotal(receipt))}</p>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="border-t border-yellow-500/10 px-4 pb-4 pt-4">
                          {receiptItems.length === 0 ? (
                            <EmptyState
                              title="No line items in payload"
                              description="This receipt record does not expose item lines in the current Loyverse response."
                            />
                          ) : (
                            <div className="space-y-2">
                              {receiptItems.map((item, index) => (
                                <div
                                  key={`${receipt.id || getReceiptId(receipt)}-${index}`}
                                  className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-white">{getReceiptItemName(item)}</p>
                                    <p className="text-xs text-gray-400">
                                      Qty {formatNumber(getReceiptItemQuantity(item))}
                                    </p>
                                  </div>
                                  <p className="font-bold text-yellow-400">
                                    {formatCurrency(getReceiptItemPrice(item))}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
