import React from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertTriangle,
  CreditCard,
  Receipt,
  RefreshCw,
  ScanLine,
  Store,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { getClipOverview, hasClipApiConfig } from "@/api/clip";
import { appParams } from "@/lib/app-params";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { isLocalFinanceMode, localListExpenses, localListCompanyTransactions } from "@/lib/localDevFinance";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);

function SourceCard({ title, icon: Icon, value, hint }) {
  return (
    <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
      <CardContent className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{title}</p>
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

export default function FinanceSummary() {
  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" || !appParams.appId || !appParams.serverUrl);

  const useLocalFinance = isLocalFinanceMode();

  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["companyTransactions", useLocalFinance ? "local" : "remote"],
    queryFn: () =>
      useLocalFinance ? localListCompanyTransactions() : base44.entities.CompanyTransaction.list("-date"),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", useLocalFinance ? "local" : "remote"],
    queryFn: () => (useLocalFinance ? localListExpenses() : base44.entities.Expense.list("-date")),
  });

  const appSettings = React.useMemo(() => getResolvedIntegrationSettings(settings[0] || {}), [settings]);

  const loyverseOverviewQuery = useQuery({
    queryKey: ["financeSummary", "loyverse", settings[0]?.id || "none"],
    queryFn: () => getLoyverseOverview(appSettings),
    enabled: hasLoyverseApiConfig(appSettings),
    staleTime: 60_000,
  });

  const clipOverviewQuery = useQuery({
    queryKey: ["financeSummary", "clip", settings[0]?.id || "none"],
    queryFn: () => getClipOverview(appSettings),
    enabled: hasClipApiConfig(appSettings),
    staleTime: 60_000,
  });

  const loyverseOverview = loyverseOverviewQuery.data;
  const clipOverview = clipOverviewQuery.data;

  const totalContributions = transactions
    .filter((entry) => entry.type === "contribution")
    .reduce((sum, entry) => sum + (entry.amount || 0), 0);

  const totalWithdrawals = transactions
    .filter((entry) => entry.type === "withdrawal")
    .reduce((sum, entry) => sum + (entry.amount || 0), 0);

  const totalExpensesAmount = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  /** All ledger expense rows (incl. Shopping List) for summaries — previously only non-shopping "manual" expenses were summed. */
  const ledgerNet = totalContributions - totalWithdrawals - totalExpensesAmount;

  const loyverseGrossSales = loyverseOverview?.metrics?.grossSales || 0;
  const loyverseReceiptsCount = loyverseOverview?.metrics?.receiptsCount || 0;
  const loyverseCompletedCount = loyverseOverview?.metrics?.completedReceiptsCount || 0;
  const loyverseCancelledCount = loyverseOverview?.metrics?.cancelledReceiptsCount || 0;

  const clipGrossVolume = clipOverview?.metrics?.grossVolume || 0;
  const clipPaymentsCount = clipOverview?.metrics?.paymentsCount || 0;
  const clipRefundedVolume = clipOverview?.metrics?.refundedVolume || 0;
  const clipNetDeposits = clipOverview?.metrics?.netDeposits || 0;

  const trackedVolume = loyverseGrossSales + clipGrossVolume + totalContributions;

  const recentManualEntries = [
    ...transactions.map((entry) => ({
      id: `transaction-${entry.id}`,
      title: entry.contributor_name || "Manual transaction",
      subtitle: entry.description || entry.payment_method || "Manual transaction",
      type: entry.type === "contribution" ? "Contribution" : "Withdrawal",
      amount: entry.amount || 0,
      date: entry.date,
      positive: entry.type === "contribution",
    })),
    ...expenses.map((entry) => ({
      id: `expense-${entry.id}`,
      title: entry.name || "Expense",
      subtitle: entry.from_shopping_list
        ? `Shopping list · ${entry.category || "ingredients"}`
        : entry.category || "Expense",
      type: "Expense",
      amount: entry.amount || 0,
      date: entry.date,
      positive: false,
    })),
  ]
    .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
    .slice(0, 12);

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 py-5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-6 w-6 text-yellow-400" />
              <div>
                <h1 className="text-xl font-bold text-yellow-400">Finance</h1>
                <p className="text-xs text-gray-500">Summary across Loyverse, Clip and manual entries</p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                loyverseOverviewQuery.refetch();
                clipOverviewQuery.refetch();
              }}
              disabled={loyverseOverviewQuery.isFetching || clipOverviewQuery.isFetching}
              className="bg-yellow-400 text-black hover:bg-yellow-300"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${(loyverseOverviewQuery.isFetching || clipOverviewQuery.isFetching) ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {(loyverseOverviewQuery.isError || clipOverviewQuery.isError) && (
          <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {loyverseOverviewQuery.isError && (
              <Card className="border-red-500/30 bg-[#242424] text-white shadow-none">
                <CardContent className="flex items-start gap-3 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
                  <div>
                    <p className="font-semibold text-red-400">Could not load Loyverse data</p>
                    <p className="text-sm text-gray-300">{loyverseOverviewQuery.error.message}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {clipOverviewQuery.isError && (
              <Card className="border-red-500/30 bg-[#242424] text-white shadow-none">
                <CardContent className="flex items-start gap-3 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
                  <div>
                    <p className="font-semibold text-red-400">Could not load Clip data</p>
                    <p className="text-sm text-gray-300">{clipOverviewQuery.error.message}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 bg-[#242424] border border-yellow-500/20">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">All</TabsTrigger>
            <TabsTrigger value="loyverse" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Loyverse</TabsTrigger>
            <TabsTrigger value="clip" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Clip</TabsTrigger>
            <TabsTrigger value="manual" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SourceCard
                title="Tracked Volume"
                icon={Wallet}
                value={formatCurrency(trackedVolume)}
                hint="Loyverse gross sales + Clip gross volume + manual contributions"
              />
              <SourceCard
                title="Loyverse"
                icon={Store}
                value={formatCurrency(loyverseGrossSales)}
                hint={`${loyverseReceiptsCount} receipts`}
              />
              <SourceCard
                title="Clip"
                icon={CreditCard}
                value={formatCurrency(clipGrossVolume)}
                hint={`${clipPaymentsCount} payments`}
              />
              <SourceCard
                title="Manual"
                icon={TrendingUp}
                value={formatCurrency(ledgerNet)}
                hint={`${transactions.length} transactions and ${expenses.length} expenses (all sources)`}
              />
            </div>
          </TabsContent>

          <TabsContent value="loyverse" className="space-y-4">
            {hasLoyverseApiConfig(appSettings) ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <SourceCard title="Gross Sales" icon={Store} value={formatCurrency(loyverseGrossSales)} />
                <SourceCard title="Receipts" icon={Receipt} value={String(loyverseReceiptsCount)} />
                <SourceCard title="Completed" icon={TrendingUp} value={String(loyverseCompletedCount)} />
                <SourceCard title="Cancelled" icon={TrendingDown} value={String(loyverseCancelledCount)} />
                <SourceCard
                  title="Last Sync"
                  icon={ScanLine}
                  value={
                    loyverseOverview?.metrics?.latestSyncAt
                      ? format(new Date(loyverseOverview.metrics.latestSyncAt), "dd MMM yyyy HH:mm", { locale: es })
                      : "Not synced"
                  }
                />
              </div>
            ) : (
              <EmptyState title="Loyverse is not configured" description="Add a Loyverse token in Integrations to populate this tab." />
            )}
          </TabsContent>

          <TabsContent value="clip" className="space-y-4">
            {hasClipApiConfig(appSettings) ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <SourceCard title="Gross Volume" icon={CreditCard} value={formatCurrency(clipGrossVolume)} />
                <SourceCard title="Payments" icon={Receipt} value={String(clipPaymentsCount)} />
                <SourceCard title="Refunded" icon={TrendingDown} value={formatCurrency(clipRefundedVolume)} />
                <SourceCard title="Net Deposits" icon={Wallet} value={formatCurrency(clipNetDeposits)} />
                <SourceCard
                  title="Last Sync"
                  icon={ScanLine}
                  value={
                    clipOverview?.metrics?.latestSyncAt
                      ? format(new Date(clipOverview.metrics.latestSyncAt), "dd MMM yyyy HH:mm", { locale: es })
                      : "Not synced"
                  }
                />
              </div>
            ) : (
              <EmptyState title="Clip is not configured" description="Add Clip credentials in Integrations to populate this tab." />
            )}
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SourceCard title="Contributions" icon={TrendingUp} value={formatCurrency(totalContributions)} hint={`${transactions.filter((entry) => entry.type === "contribution").length} entries`} />
              <SourceCard title="Withdrawals" icon={TrendingDown} value={formatCurrency(totalWithdrawals)} hint={`${transactions.filter((entry) => entry.type === "withdrawal").length} entries`} />
              <SourceCard title="All expenses" icon={Receipt} value={formatCurrency(totalExpensesAmount)} hint={`${expenses.length} expense rows (incl. shopping)`} />
              <SourceCard title="Ledger net" icon={Wallet} value={formatCurrency(ledgerNet)} hint="Contributions − withdrawals − all expenses" />
            </div>

            <Card className="border-yellow-500/20 bg-[#242424] text-white shadow-none">
              <CardHeader>
                <CardTitle>Recent Manual Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentManualEntries.length > 0 ? (
                  recentManualEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-3">
                      <div>
                        <p className="font-semibold text-white">{entry.title}</p>
                        <p className="text-xs text-gray-400">{entry.type} | {entry.subtitle} | {entry.date}</p>
                      </div>
                      <p className={`font-bold ${entry.positive ? "text-yellow-400" : "text-yellow-400/70"}`}>
                        {entry.positive ? "+" : "-"}{formatCurrency(entry.amount)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No transactions or expenses recorded yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
