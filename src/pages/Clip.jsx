import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  AlertTriangle,
  CircleDollarSign,
  CreditCard,
  Database,
  ExternalLink,
  Landmark,
  MonitorSmartphone,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Workflow,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { base44 } from "@/api/base44Client";
import {
  CLIP_API_CATALOG,
  CLIP_PAYMENTS_API_BASE_URL,
  CLIP_SETTLEMENTS_API_BASE_URL,
  getClipOverview,
  hasClipApiConfig,
} from "@/api/clip";

const formatCurrency = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value || 0);

const formatNumber = (value) => new Intl.NumberFormat("es-MX").format(value || 0);

const formatRelativeDate = (value) =>
  value
    ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: enUS })
    : "Unknown time";

const formatDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("es-MX", {
        timeZone: "America/Mexico_City",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "N/A";

function getStringValue(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getAmount(value) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    return getAmount(value.amount ?? value.value ?? value.total ?? value.net ?? value.gross);
  }

  return 0;
}

function getPaymentAmount(payment) {
  return getAmount(
    payment.amount ??
      payment.total_amount ??
      payment.total ??
      payment.authorized_amount ??
      payment.approved_amount,
  );
}

function getRefundAmount(payment) {
  return getAmount(payment.amount_refunded ?? payment.refunded_amount ?? payment.refund_amount);
}

function getTipAmount(payment) {
  return getAmount(payment.tip_amount ?? payment.tip ?? payment.tip_total);
}

function getPaymentStatus(payment) {
  return getStringValue(payment.status, payment.payment_status, payment.state).toLowerCase() || "unknown";
}

function getPaymentTimestamp(payment) {
  return (
    payment.created_at ||
    payment.approved_at ||
    payment.updated_at ||
    payment.paid_at ||
    payment.date ||
    null
  );
}

function getPaymentId(payment, index) {
  return (
    payment.id ||
    payment.payment_id ||
    payment.reference ||
    payment.external_reference ||
    payment.folio ||
    `payment-${index}`
  );
}

function getCardBrand(payment) {
  return getStringValue(
    payment.card_brand,
    payment.brand,
    payment.card?.brand,
    payment.payment_method_details?.card_brand,
    payment.payment_method?.brand,
  );
}

function getTerminalLabel(payment) {
  return getStringValue(
    payment.terminal_name,
    payment.terminal_id,
    payment.reader_name,
    payment.reader_id,
    payment.device_name,
    payment.device_id,
    payment.pos_name,
    payment.pos_id,
  );
}

function getPaymentCustomer(payment) {
  return getStringValue(
    payment.customer_name,
    payment.customer?.name,
    payment.cardholder_name,
    payment.buyer_name,
    payment.order_name,
  );
}

function getSettlementTimestamp(settlement) {
  return settlement.deposit_date || settlement.created_at || settlement.date || settlement.updated_at || null;
}

function getSettlementId(settlement, index) {
  return (
    settlement.id ||
    settlement.settlement_id ||
    settlement.reference ||
    settlement.folio ||
    `settlement-${index}`
  );
}

function getSettlementNet(settlement) {
  return getAmount(settlement.net_amount ?? settlement.net_total ?? settlement.amount_net ?? settlement.net);
}

function getSettlementGross(settlement) {
  return getAmount(settlement.gross_amount ?? settlement.gross_total ?? settlement.amount_gross ?? settlement.gross);
}

function getSettlementFees(settlement) {
  return getAmount(settlement.fee_amount ?? settlement.fees ?? settlement.commission_amount);
}

function getSettlementStatus(settlement) {
  return getStringValue(settlement.status, settlement.state).toLowerCase() || "processed";
}

function formatFieldLabel(path) {
  return path
    .replace(/\.(\d+)\./g, "[$1].")
    .replace(/\.(\d+)$/g, "[$1]")
    .replace(/_/g, " ");
}

function collectObjectPaths(value, prefix = "", accumulator = new Set()) {
  if (Array.isArray(value)) {
    if (!prefix) {
      value.forEach((item) => collectObjectPaths(item, "", accumulator));
      return accumulator;
    }

    if (value.length === 0) {
      accumulator.add(prefix);
      return accumulator;
    }

    value.forEach((item, index) => {
      collectObjectPaths(item, `${prefix}.${index}`, accumulator);
    });
    return accumulator;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0 && prefix) {
      accumulator.add(prefix);
    }

    entries.forEach(([key, nestedValue]) => {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      accumulator.add(nextPrefix);
      collectObjectPaths(nestedValue, nextPrefix, accumulator);
    });
  }

  return accumulator;
}

function summarizeObject(value, maxLength = 160) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  if (typeof value === "string") {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    const serialized = JSON.stringify(value);
    return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}...` : serialized;
  } catch {
    return String(value);
  }
}

function RawJsonCard({ title, data, description }) {
  return (
    <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
          <Database className="h-4 w-4" />
          {title}
        </CardTitle>
        {description ? <p className="text-sm text-gray-400">{description}</p> : null}
      </CardHeader>
      <CardContent className="p-4">
        <pre className="max-h-[520px] overflow-auto rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 text-xs leading-6 text-gray-300">
          {JSON.stringify(data, null, 2)}
        </pre>
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

function getCatalogStatusClasses(status) {
  if (status === "live") {
    return "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15";
  }

  return "bg-blue-500/15 text-blue-300 hover:bg-blue-500/15";
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

export default function Clip() {
  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });
  const appSettings = settings[0] || {};
  const clipQuery = useQuery({
    queryKey: ["clipOverview", settings[0]?.id || "none"],
    queryFn: () => getClipOverview(appSettings),
    enabled: hasClipApiConfig(appSettings),
    staleTime: 60_000,
  });

  const overview = clipQuery.data;
  const payments = overview?.payments || [];
  const settlements = overview?.settlements || [];
  const paymentPayload = overview?.raw?.paymentsPayload;
  const settlementsPayload = overview?.raw?.settlementsPayload;

  const approvedPayments = payments.filter((payment) => {
    const status = getPaymentStatus(payment);
    return status.includes("approved") || status.includes("paid") || status.includes("captured");
  });
  const declinedPayments = payments.filter((payment) => {
    const status = getPaymentStatus(payment);
    return status.includes("declined") || status.includes("rejected") || status.includes("failed");
  });
  const refundedPayments = payments.filter((payment) => getRefundAmount(payment) > 0);

  const statusBreakdown = Object.entries(
    payments.reduce((accumulator, payment) => {
      const status = getPaymentStatus(payment);
      accumulator[status] = (accumulator[status] || 0) + 1;
      return accumulator;
    }, {}),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  const terminalBreakdown = Object.entries(
    payments.reduce((accumulator, payment) => {
      const terminal = getTerminalLabel(payment) || "Terminal not identified";
      const current = accumulator[terminal] || { count: 0, volume: 0 };
      current.count += 1;
      current.volume += getPaymentAmount(payment);
      accumulator[terminal] = current;
      return accumulator;
    }, {}),
  )
    .map(([terminal, summary]) => ({ terminal, ...summary }))
    .sort((left, right) => right.volume - left.volume)
    .slice(0, 8);

  const brandBreakdown = Object.entries(
    payments.reduce((accumulator, payment) => {
      const brand = getCardBrand(payment) || "Unknown brand";
      const current = accumulator[brand] || { count: 0, volume: 0 };
      current.count += 1;
      current.volume += getPaymentAmount(payment);
      accumulator[brand] = current;
      return accumulator;
    }, {}),
  )
    .map(([brand, summary]) => ({ brand, ...summary }))
    .sort((left, right) => right.volume - left.volume)
    .slice(0, 8);

  const latestPayments = payments.slice(0, 20);
  const latestSettlements = settlements.slice(0, 20);
  const syncedTerminalCount = terminalBreakdown.length;
  const knownBrandCount = brandBreakdown.filter((entry) => entry.brand !== "Unknown brand").length;
  const liveApiCount = CLIP_API_CATALOG.filter((entry) => entry.status === "live").length;
  const documentedApiCount = CLIP_API_CATALOG.length - liveApiCount;
  const paymentFieldList = Array.from(collectObjectPaths(payments)).sort();
  const settlementFieldList = Array.from(collectObjectPaths(settlements)).sort();
  const paymentRecordPreview = payments[0] || null;
  const settlementRecordPreview = settlements[0] || null;

  if (!hasClipApiConfig(appSettings)) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="border-b border-yellow-500/20 py-5">
          <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">Clip</h1>
                <p className="text-xs text-gray-500">Clip payments, terminals, and deposits</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1360px] px-3 py-5 sm:px-5 lg:px-6">
          <EmptyState
            title="Missing Clip credentials"
            description="Add Clip credentials in Settings, or provide VITE_CLIP_API_KEY and VITE_CLIP_API_SECRET in .env.local."
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
              <CreditCard className="h-5 w-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">Clip</h1>
                <p className="text-xs text-gray-500">
                  Payments from {overview?.config?.paymentsBaseUrl || CLIP_PAYMENTS_API_BASE_URL} and settlements from {overview?.config?.settlementsBaseUrl || CLIP_SETTLEMENTS_API_BASE_URL}
                </p>
              </div>
            </div>
            <Button
              onClick={() => clipQuery.refetch()}
              disabled={clipQuery.isFetching}
              className="h-8 gap-2 bg-yellow-400 px-3 text-sm text-black hover:bg-yellow-300"
            >
              <RefreshCw className={`h-4 w-4 ${clipQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] px-3 py-5 sm:px-5 lg:px-6">
        {clipQuery.isError ? (
          <Card className="mb-5 border-red-500/30 bg-[#242424] text-white shadow-none">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
              <div>
                <p className="font-semibold text-red-400">Could not load Clip data</p>
                <p className="text-sm text-gray-300">{clipQuery.error.message}</p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            label="Payments"
            value={formatNumber(overview?.metrics?.paymentsCount)}
            hint={`${formatNumber(approvedPayments.length)} approved in current range`}
            icon={CreditCard}
          />
          <MetricCard
            label="Gross Volume"
            value={formatCurrency(overview?.metrics?.grossVolume)}
            hint={`${formatCurrency(overview?.metrics?.tipsVolume)} in tips`}
            icon={CircleDollarSign}
          />
          <MetricCard
            label="Refunds"
            value={formatCurrency(overview?.metrics?.refundedVolume)}
            hint={`${formatNumber(refundedPayments.length)} refunded payments`}
            icon={Wallet}
          />
          <MetricCard
            label="Deposits"
            value={formatCurrency(overview?.metrics?.netDeposits)}
            hint={`${formatNumber(overview?.metrics?.settlementsCount)} settlements synced`}
            icon={Landmark}
          />
          <MetricCard
            label="Terminals"
            value={formatNumber(syncedTerminalCount)}
            hint={`${formatNumber(knownBrandCount)} card brands detected`}
            icon={MonitorSmartphone}
          />
          <MetricCard
            label="API Coverage"
            value={`${formatNumber(liveApiCount)} live`}
            hint={`${formatNumber(documentedApiCount)} documented next`}
            icon={Workflow}
          />
          <MetricCard
            label="Last Sync"
            value={overview?.metrics?.latestSyncAt ? formatRelativeDate(overview.metrics.latestSyncAt) : "N/A"}
            hint={overview?.metrics?.latestSyncAt ? formatDateTime(overview.metrics.latestSyncAt) : "Not synced yet"}
            icon={ScanLine}
          />
        </div>

        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 border border-yellow-500/20 bg-[#242424]">
            <TabsTrigger value="payments" className="text-xs text-gray-400 data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
              Payments
            </TabsTrigger>
            <TabsTrigger value="settlements" className="text-xs text-gray-400 data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
              Settlements
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-xs text-gray-400 data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
              Terminal Insights
            </TabsTrigger>
            <TabsTrigger value="api-explorer" className="text-xs text-gray-400 data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
              API Explorer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <ScanLine className="h-4 w-4" />
                    Payment Status Mix
                  </CardTitle>
                  <p className="text-sm text-gray-400">
                    Current Clip payment feed grouped by status.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Approved</p>
                      <p className="mt-1 text-2xl font-bold text-yellow-400">{formatNumber(approvedPayments.length)}</p>
                    </div>
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Declined</p>
                      <p className="mt-1 text-2xl font-bold text-yellow-400">{formatNumber(declinedPayments.length)}</p>
                    </div>
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Refunded</p>
                      <p className="mt-1 text-2xl font-bold text-yellow-400">{formatNumber(refundedPayments.length)}</p>
                    </div>
                  </div>

                  {statusBreakdown.length === 0 ? (
                    <EmptyState
                      title="No payment statuses yet"
                      description="Clip statuses will appear here once the payments endpoint returns records."
                    />
                  ) : (
                    statusBreakdown.map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-black/30 text-gray-200 hover:bg-black/30">{status}</Badge>
                        </div>
                        <p className="font-bold text-yellow-400">{formatNumber(count)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <CreditCard className="h-4 w-4" />
                    Latest Payments
                  </CardTitle>
                  <p className="text-sm text-gray-400">
                    Most recent transactions returned by Clip, including terminal and card metadata when available.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {clipQuery.isLoading ? (
                    <EmptyState title="Loading payments..." description="Pulling the latest Clip payment history." />
                  ) : latestPayments.length === 0 ? (
                    <EmptyState title="No payments returned" description="Clip has not returned payment records for the current date range yet." />
                  ) : (
                    latestPayments.map((payment, index) => {
                      const status = getPaymentStatus(payment);
                      const terminal = getTerminalLabel(payment);
                      const brand = getCardBrand(payment);
                      const customer = getPaymentCustomer(payment);

                      return (
                        <div
                          key={getPaymentId(payment, index)}
                          className="flex flex-col gap-3 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{getPaymentId(payment, index)}</p>
                              <Badge className="bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15">{status}</Badge>
                              {brand ? <Badge className="bg-black/30 text-gray-200 hover:bg-black/30">{brand}</Badge> : null}
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              {customer || "No customer label"}
                              {terminal ? ` | ${terminal}` : ""}
                              {getPaymentTimestamp(payment) ? ` | ${formatDateTime(getPaymentTimestamp(payment))}` : ""}
                            </p>
                            {(getRefundAmount(payment) > 0 || getTipAmount(payment) > 0) ? (
                              <p className="mt-2 text-xs text-gray-500">
                                Refunded {formatCurrency(getRefundAmount(payment))} | Tip {formatCurrency(getTipAmount(payment))}
                              </p>
                            ) : null}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-left md:text-right">
                            <div>
                              <p className="text-xs text-gray-500">Amount</p>
                              <p className="font-bold text-yellow-400">{formatCurrency(getPaymentAmount(payment))}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Net after refund</p>
                              <p className="font-bold text-yellow-400">
                                {formatCurrency(getPaymentAmount(payment) - getRefundAmount(payment))}
                              </p>
                            </div>
                          </div>
                          <details className="w-full rounded-xl border border-yellow-500/10 bg-black/10 p-3 md:max-w-[420px]">
                            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                              API details
                            </summary>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-300">
                              {Object.entries(payment)
                                .slice(0, 12)
                                .map(([key, value]) => (
                                  <div key={key} className="grid grid-cols-[140px_1fr] gap-3 rounded-lg border border-yellow-500/10 bg-[#1a1a1a] px-3 py-2">
                                    <span className="text-gray-500">{formatFieldLabel(key)}</span>
                                    <span className="break-all text-right md:text-left">{summarizeObject(value)}</span>
                                  </div>
                                ))}
                            </div>
                          </details>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settlements" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <Landmark className="h-4 w-4" />
                    Deposit Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Gross deposits</p>
                      <p className="mt-1 text-2xl font-bold text-yellow-400">{formatCurrency(overview?.metrics?.grossDeposits)}</p>
                    </div>
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Net deposits</p>
                      <p className="mt-1 text-2xl font-bold text-yellow-400">{formatCurrency(overview?.metrics?.netDeposits)}</p>
                    </div>
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Settlements</p>
                      <p className="mt-1 text-2xl font-bold text-yellow-400">{formatNumber(settlements.length)}</p>
                    </div>
                  </div>

                  {latestSettlements.length === 0 ? (
                    <EmptyState title="No settlements returned" description="Deposits from Clip will appear here when the settlements endpoint returns data." />
                  ) : (
                    latestSettlements.slice(0, 6).map((settlement, index) => (
                      <div key={getSettlementId(settlement, index)} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-white">{getSettlementId(settlement, index)}</p>
                          <Badge className="bg-black/30 text-gray-200 hover:bg-black/30">
                            {getSettlementStatus(settlement)}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">
                          {getSettlementTimestamp(settlement) ? formatDateTime(getSettlementTimestamp(settlement)) : "No settlement date"}
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-gray-500">Gross</p>
                            <p className="font-bold text-yellow-400">{formatCurrency(getSettlementGross(settlement))}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Fees</p>
                            <p className="font-bold text-yellow-400">{formatCurrency(getSettlementFees(settlement))}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Net</p>
                            <p className="font-bold text-yellow-400">{formatCurrency(getSettlementNet(settlement))}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <Wallet className="h-4 w-4" />
                    Settlement History
                  </CardTitle>
                  <p className="text-sm text-gray-400">
                    Deposit and payout records from Clip settlements.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {clipQuery.isLoading ? (
                    <EmptyState title="Loading settlements..." description="Pulling the latest deposit history from Clip." />
                  ) : latestSettlements.length === 0 ? (
                    <EmptyState title="No settlement history yet" description="Once Clip returns deposits, they will appear here automatically." />
                  ) : (
                    latestSettlements.map((settlement, index) => (
                      <div
                        key={getSettlementId(settlement, index)}
                        className="flex flex-col gap-3 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{getSettlementId(settlement, index)}</p>
                            <Badge className="bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15">
                              {getSettlementStatus(settlement)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">
                            {getSettlementTimestamp(settlement)
                              ? formatDateTime(getSettlementTimestamp(settlement))
                              : "No date available"}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-left md:text-right">
                          <div>
                            <p className="text-xs text-gray-500">Gross</p>
                            <p className="font-bold text-yellow-400">{formatCurrency(getSettlementGross(settlement))}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Fees</p>
                            <p className="font-bold text-yellow-400">{formatCurrency(getSettlementFees(settlement))}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Net</p>
                            <p className="font-bold text-yellow-400">{formatCurrency(getSettlementNet(settlement))}</p>
                          </div>
                        </div>
                        <details className="w-full rounded-xl border border-yellow-500/10 bg-black/10 p-3 md:max-w-[420px]">
                          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                            API details
                          </summary>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-300">
                            {Object.entries(settlement)
                              .slice(0, 12)
                              .map(([key, value]) => (
                                <div key={key} className="grid grid-cols-[140px_1fr] gap-3 rounded-lg border border-yellow-500/10 bg-[#1a1a1a] px-3 py-2">
                                  <span className="text-gray-500">{formatFieldLabel(key)}</span>
                                  <span className="break-all text-right md:text-left">{summarizeObject(value)}</span>
                                </div>
                              ))}
                          </div>
                        </details>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <MonitorSmartphone className="h-4 w-4" />
                    Terminal Activity
                  </CardTitle>
                  <p className="text-sm text-gray-400">
                    Terminals or readers inferred from the payment payload.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {terminalBreakdown.length === 0 ? (
                    <EmptyState title="No terminal labels found" description="Clip did not expose reader or terminal identifiers in the current payment payload." />
                  ) : (
                    terminalBreakdown.map((entry) => (
                      <div key={entry.terminal} className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                        <div>
                          <p className="font-semibold text-white">{entry.terminal}</p>
                          <p className="mt-1 text-xs text-gray-400">{formatNumber(entry.count)} payments</p>
                        </div>
                        <p className="font-bold text-yellow-400">{formatCurrency(entry.volume)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <CreditCard className="h-4 w-4" />
                    Card Brands
                  </CardTitle>
                  <p className="text-sm text-gray-400">
                    Brand mix detected in Clip transactions.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {brandBreakdown.length === 0 ? (
                    <EmptyState title="No card metadata yet" description="Card brands will appear here once Clip returns them in the payment details." />
                  ) : (
                    brandBreakdown.map((entry) => (
                      <div key={entry.brand} className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                        <div>
                          <p className="font-semibold text-white">{entry.brand}</p>
                          <p className="mt-1 text-xs text-gray-400">{formatNumber(entry.count)} transactions</p>
                        </div>
                        <p className="font-bold text-yellow-400">{formatCurrency(entry.volume)}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="api-explorer" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none xl:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <ShieldCheck className="h-4 w-4" />
                    Clip API Coverage
                  </CardTitle>
                  <p className="text-sm text-gray-400">
                    Official Clip surfaces mapped into this admin view, plus adjacent APIs we can wire in next.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Token</p>
                      <p className="mt-1 font-semibold text-white">{hasClipApiConfig(appSettings) ? "Configured" : "Missing"}</p>
                      <p className="mt-1 text-xs text-gray-500">Loaded from saved Settings or from `VITE_CLIP_API_KEY` + `VITE_CLIP_API_SECRET`, or from a prebuilt `VITE_CLIP_API_TOKEN`.</p>
                    </div>
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Live today</p>
                      <p className="mt-1 font-semibold text-white">{formatNumber(liveApiCount)} API groups</p>
                      <p className="mt-1 text-xs text-gray-500">Transactions and settlements are already connected.</p>
                    </div>
                    <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                      <p className="text-xs text-gray-500">Ready to extend</p>
                      <p className="mt-1 font-semibold text-white">{formatNumber(documentedApiCount)} API groups</p>
                      <p className="mt-1 text-xs text-gray-500">Checkout, refunds, webhooks and PinPad are documented by Clip.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {CLIP_API_CATALOG.map((entry) => (
                      <div key={entry.key} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white">{entry.name}</p>
                              <Badge className={getCatalogStatusClasses(entry.status)}>
                                {entry.status === "live" ? "Live in dashboard" : "Documented by Clip"}
                              </Badge>
                              <Badge className="bg-black/30 text-gray-200 hover:bg-black/30">{entry.authHeader}</Badge>
                            </div>
                            <p className="mt-2 text-sm text-gray-300">{entry.summary}</p>
                          </div>
                          <a
                            href={entry.docsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-yellow-300 hover:text-yellow-200"
                          >
                            Docs
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                          {entry.capabilities.map((capability) => (
                            <div
                              key={capability}
                              className="rounded-lg border border-yellow-500/10 bg-black/20 px-3 py-2 text-sm text-gray-300"
                            >
                              {capability}
                            </div>
                          ))}
                        </div>

                        <p className="mt-3 text-xs text-gray-500">{entry.limits}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <Database className="h-4 w-4" />
                    Payment Fields Found
                  </CardTitle>
                  <p className="text-sm text-gray-400">
                    Unique fields detected across the current Clip payments payload.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {paymentFieldList.length === 0 ? (
                    <EmptyState title="No payment fields detected" description="Field discovery will populate once payments are returned from Clip." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {paymentFieldList.map((field) => (
                        <Badge key={field} className="bg-black/30 text-gray-200 hover:bg-black/30">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
                    <Database className="h-4 w-4" />
                    Settlement Fields Found
                  </CardTitle>
                  <p className="text-sm text-gray-400">
                    Unique fields detected across the current Clip settlements payload.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  {settlementFieldList.length === 0 ? (
                    <EmptyState title="No settlement fields detected" description="Field discovery will populate once settlements are returned from Clip." />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {settlementFieldList.map((field) => (
                        <Badge key={field} className="bg-black/30 text-gray-200 hover:bg-black/30">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <RawJsonCard
                title="Payments Response"
                description={`Current request window: ${overview?.ranges?.payments?.from || "N/A"} to ${overview?.ranges?.payments?.to || "N/A"}`}
                data={paymentPayload || paymentRecordPreview || {}}
              />

              <RawJsonCard
                title="Settlements Response"
                description={`Current request window: ${overview?.ranges?.settlements?.from || "N/A"} to ${overview?.ranges?.settlements?.to || "N/A"}`}
                data={settlementsPayload || settlementRecordPreview || {}}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
