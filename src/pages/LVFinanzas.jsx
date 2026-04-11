import React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  AlertTriangle,
  BadgePercent,
  CircleDollarSign,
  CreditCard,
  Receipt,
  RefreshCw,
  ScanLine,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function getReceiptStatus(receipt) {
  return (
    receipt.status ||
    receipt.receipt_status ||
    (receipt.canceled_at ? "cancelled" : "completed")
  ).toLowerCase();
}

function getMoneyValue(candidate) {
  if (typeof candidate === "number") return candidate;
  if (typeof candidate === "string") return Number(candidate) || 0;
  if (candidate && typeof candidate === "object") {
    return Number(candidate.amount ?? candidate.value) || 0;
  }
  return 0;
}

function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-yellow-500/10 bg-[#242424] p-8 text-center">
      <p className="font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm text-gray-400">{description}</p>
    </div>
  );
}

function MetricCard({ label, value, hint, icon: Icon }) {
  return (
    <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
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

export default function LVFinanzas() {
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
  const appOrders = appOrdersQuery.data || [];
  const receipts = overview?.receipts || [];
  const completedReceipts = receipts.filter((receipt) => !getReceiptStatus(receipt).includes("cancel"));
  const cancelledReceipts = receipts.filter((receipt) => getReceiptStatus(receipt).includes("cancel"));

  const deliveredOrders = appOrders.filter((order) => order.status === "delivered");
  const cashFromOrders = deliveredOrders
    .filter((order) => order.payment_method === "cash")
    .reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const cardFromOrders = appOrders
    .filter(
      (order) =>
        order.payment_method === "card" &&
        (order.status === "delivered" ||
          order.payment_status === "confirmed" ||
          order.payment_status === "paid"),
    )
    .reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const avgOrderValue = deliveredOrders.length
    ? deliveredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0) / deliveredOrders.length
    : 0;
  const pendingOrderValue = appOrders
    .filter((order) => order.status !== "delivered" && order.status !== "cancelled")
    .reduce((sum, order) => sum + (order.total_amount || 0), 0);

  const orderTypeBreakdown = [
    "dine-in",
    "takeout",
    "delivery",
  ].map((type) => {
    const matching = deliveredOrders.filter((order) => order.order_type === type);
    const revenue = matching.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    return {
      type,
      count: matching.length,
      revenue,
    };
  });

  const topCustomers = [...(overview?.customers || [])]
    .sort((a, b) => (b.totalSpentAmount || 0) - (a.totalSpentAmount || 0))
    .slice(0, 8);

  const recentFinancialActivity = [
    ...receipts.map((receipt) => ({
      id: `receipt-${receipt.id || receipt.receipt_number || Math.random()}`,
      source: "loyverse_receipt",
      title: receipt.receipt_number || receipt.receipt_no || receipt.id || "Loyverse receipt",
      subtitle: receipt.store_name || receipt.store_id || "Unknown store",
      amount: getMoneyValue(receipt.total_money ?? receipt.total_payment_money ?? receipt.total),
      status: getReceiptStatus(receipt),
      happenedAt: receipt.created_at || receipt.updated_at,
    })),
    ...appOrders.map((order) => ({
      id: `order-${order.id}`,
      source: "app_order",
      title: order.customer_name || order.id,
      subtitle: `${order.order_type || "unknown"}${order.table_number ? ` | Table ${order.table_number}` : ""}`,
      amount: order.total_amount || 0,
      status: order.status || "pending",
      happenedAt: order.updated_date || order.created_date,
    })),
  ]
    .sort((a, b) => new Date(b.happenedAt || 0).getTime() - new Date(a.happenedAt || 0).getTime())
    .slice(0, 14);

  const topDiscounts = (overview?.discounts || []).slice(0, 8);

  if (!hasLoyverseApiConfig(appSettings)) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="border-b border-yellow-500/20 py-5">
          <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">LV Finanzas</h1>
                <p className="text-xs text-gray-500">Loyverse finance analytics</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1360px] px-3 py-5 sm:px-5 lg:px-6">
          <EmptyState
            title="Missing Loyverse token"
            description="Add the Loyverse token in Settings, or set VITE_LOYVERSE_API_TOKEN in .env.local to load the Loyverse finance dashboard."
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
              <Wallet className="h-5 w-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">LV Finanzas</h1>
                <p className="text-xs text-gray-500">Loyverse + app finance history from {overviewQuery.data?.config?.baseUrl || LOYVERSE_API_BASE_URL}</p>
              </div>
            </div>
            <Button
              onClick={() => {
                overviewQuery.refetch();
                appOrdersQuery.refetch();
              }}
              disabled={overviewQuery.isFetching || appOrdersQuery.isFetching}
              className="h-8 gap-2 bg-yellow-400 px-3 text-sm text-black hover:bg-yellow-300"
            >
              <RefreshCw className={`h-4 w-4 ${(overviewQuery.isFetching || appOrdersQuery.isFetching) ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] px-3 py-5 sm:px-5 lg:px-6">
        {overviewQuery.isError ? (
          <Card className="mb-5 border-red-500/30 bg-[#242424] text-white shadow-none">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
              <div>
                <p className="font-semibold text-red-400">Could not load Loyverse finance data</p>
                <p className="text-sm text-gray-300">{overviewQuery.error.message}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            label="Loyverse Gross"
            value={formatCurrency(overview?.metrics?.grossSales)}
            hint={`${formatNumber(completedReceipts.length)} completed receipts`}
            icon={CircleDollarSign}
          />
          <MetricCard
            label="App Cash"
            value={formatCurrency(cashFromOrders)}
            hint="Delivered orders paid in cash"
            icon={Wallet}
          />
          <MetricCard
            label="App Card"
            value={formatCurrency(cardFromOrders)}
            hint="Delivered/paid card orders"
            icon={CreditCard}
          />
          <MetricCard
            label="Pending Value"
            value={formatCurrency(pendingOrderValue)}
            hint="Open orders still in flow"
            icon={TrendingUp}
          />
          <MetricCard
            label="Customers LTV"
            value={formatCurrency(overview?.metrics?.customerLifetimeValue)}
            hint={`${formatNumber(overview?.metrics?.activeCustomersCount)} active customers`}
            icon={Users}
          />
          <MetricCard
            label="Last Sync"
            value={overview?.metrics?.latestSyncAt ? formatRelativeDate(overview.metrics.latestSyncAt) : "N/A"}
            hint={overview?.metrics?.latestSyncAt ? formatDateTime(overview.metrics.latestSyncAt) : "Not synced yet"}
            icon={ScanLine}
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-[#242424] border border-yellow-500/20">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Overview</TabsTrigger>
            <TabsTrigger value="history" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">History</TabsTrigger>
            <TabsTrigger value="loyverse" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Loyverse Extras</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <Receipt className="h-4 w-4" />
                    Sales Mix
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {orderTypeBreakdown.map((entry) => (
                      <div key={entry.type} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{entry.type}</p>
                        <p className="mt-1 text-xl font-bold text-yellow-400">{formatCurrency(entry.revenue)}</p>
                        <p className="mt-1 text-xs text-gray-400">{formatNumber(entry.count)} delivered orders</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                    <p className="text-xs text-gray-500">Average delivered order</p>
                    <p className="mt-1 text-2xl font-bold text-yellow-400">{formatCurrency(avgOrderValue)}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatNumber(deliveredOrders.length)} delivered orders in app history</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <Users className="h-4 w-4" />
                    Top Customers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {topCustomers.length === 0 ? (
                    <EmptyState title="No spend history yet" description="Customer spend rankings will appear here once Loyverse customers accumulate visits or spending." />
                  ) : (
                    topCustomers.map((customer) => (
                      <div key={customer.id} className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                        <div>
                          <p className="font-semibold text-white">{customer.name || "Unnamed customer"}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {formatNumber(customer.total_visits)} visits | {formatNumber(customer.total_points)} points
                          </p>
                        </div>
                        <p className="font-bold text-yellow-400">{formatCurrency(customer.totalSpentAmount)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                  <TrendingUp className="h-4 w-4" />
                  Recent Financial Activity
                </CardTitle>
                <p className="text-sm text-gray-400">
                  Combined timeline of web app orders and Loyverse receipts.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {recentFinancialActivity.length === 0 ? (
                  <EmptyState title="No recent finance events" description="Orders and receipts will appear here as soon as data is available." />
                ) : (
                  recentFinancialActivity.map((event) => (
                    <div key={event.id} className="flex flex-col gap-3 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{event.title}</p>
                          <Badge className={event.source === "loyverse_receipt" ? "bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15" : "bg-yellow-500/15 text-yellow-200 hover:bg-yellow-500/15"}>
                            {event.source === "loyverse_receipt" ? "Loyverse" : "Web app"}
                          </Badge>
                          <Badge className="bg-black/30 text-gray-200 hover:bg-black/30">{event.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">{event.subtitle} | {formatDateTime(event.happenedAt)}</p>
                      </div>
                      <p className="font-bold text-yellow-400">{formatCurrency(event.amount)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loyverse" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <BadgePercent className="h-4 w-4" />
                    Discount Programs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {topDiscounts.length === 0 ? (
                    <EmptyState title="No discounts configured" description="Loyverse discount rules will show here when available." />
                  ) : (
                    topDiscounts.map((discount) => (
                      <div key={discount.id} className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                        <div>
                          <p className="font-semibold text-white">{discount.name || "Unnamed discount"}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {discount.type || "unknown"} | {formatDateTime(discount.created_at)}
                          </p>
                        </div>
                        <p className="font-bold text-yellow-400">
                          {discount.discount_percent != null
                            ? `${discount.discount_percent}%`
                            : formatCurrency(discount.amount)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <Store className="h-4 w-4" />
                    Ops Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Stores</p>
                      <p className="mt-1 text-xl font-bold text-yellow-400">{formatNumber(overview?.metrics?.storesCount)}</p>
                    </div>
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">POS devices</p>
                      <p className="mt-1 text-xl font-bold text-yellow-400">{formatNumber(overview?.metrics?.activePosDevicesCount)}</p>
                    </div>
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Loyverse receipts</p>
                      <p className="mt-1 text-xl font-bold text-yellow-400">{formatNumber(receipts.length)}</p>
                    </div>
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Cancelled receipts</p>
                      <p className="mt-1 text-xl font-bold text-yellow-400">{formatNumber(cancelledReceipts.length)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
