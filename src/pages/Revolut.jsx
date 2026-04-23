// @ts-nocheck
import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Landmark,
  Loader2,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  formatRevolutLegsSummary,
  getRevolutIntegrationPreview,
  getRevolutResolvedConfig,
  hasRevolutApiConfig,
  isRevolutPersonalMode,
  REVOLUT_PRODUCTION_API_BASE_URL,
  REVOLUT_SANDBOX_API_BASE_URL,
} from "@/api/revolut";
import { buildDefaultAppSettings } from "@/lib/appSettings";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value || 0);

const formatRelativeDate = (value) =>
  value ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: enUS }) : "Unknown";

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

function ListCard({ title, description, icon: Icon, children }) {
  return (
    <Card className="flex h-full flex-col border-yellow-500/20 bg-[#242424] text-white shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-yellow-400">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        {description ? <p className="text-sm text-gray-400">{description}</p> : null}
      </CardHeader>
      <CardContent className="flex-1 space-y-3 p-4">{children}</CardContent>
    </Card>
  );
}

export default function Revolut() {
  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });
  const appSettings = React.useMemo(
    () => buildDefaultAppSettings(getResolvedIntegrationSettings(settings[0] || {})),
    [settings],
  );

  const revolutQuery = useQuery({
    queryKey: [
      "revolutIntegrationPreview",
      settings[0]?.id || "none",
      appSettings.revolut_connection_type,
      appSettings.revolut_access_token,
      appSettings.revolut_api_base_url,
      appSettings.revolut_account_id,
    ],
    queryFn: () => getRevolutIntegrationPreview(appSettings),
    enabled: hasRevolutApiConfig(appSettings),
    staleTime: 60_000,
  });

  const preview = revolutQuery.data;
  const config = getRevolutResolvedConfig(appSettings);
  const baseUrlDisplay = config.baseUrl || REVOLUT_PRODUCTION_API_BASE_URL;
  const isSandbox = baseUrlDisplay.toLowerCase().includes("sandbox");

  const keysUrl = "/IntegrationsHub?hub=keys";

  if (isRevolutPersonalMode(appSettings)) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="border-b border-yellow-500/20 py-5">
          <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">Revolut (personal)</h1>
                <p className="text-xs text-gray-500">
                  Business API sync is disabled — this app only automates Revolut Business (b2b), not private accounts.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1360px] space-y-6 px-3 py-6 sm:px-5 lg:px-6">
          <Card className="border-sky-500/25 bg-[#242424] shadow-none">
            <CardHeader>
              <CardTitle className="text-base text-sky-300">Varför syns inga transaktioner?</CardTitle>
              <p className="text-sm text-gray-400">
                Revolut erbjuder den officiella REST-integration vi använder (<code className="text-gray-400">b2b.revolut.com</code>) för{" "}
                <strong className="text-white">Revolut Business</strong>. Privatkonton använder inte samma API — därför kan vi inte göra samma anrop mot &quot;Revolut privat&quot; här.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-300">
              <p>
                <strong className="text-white">Nu:</strong> välj <strong className="text-white">Personal</strong> under Integrations → Revolut → Account type så att appen inte försöker anropa Business API i onödan. Bokför bank manuellt i kassan/rapporterna som idag.
              </p>
              <p>
                <strong className="text-white">När ni går över till Business:</strong> byt till <strong className="text-white">Business</strong> i samma fält, följ Revoluts guide för Business API (OAuth + READ), och klistra in token och rätt bas-URL — då aktiveras förhandsvisning av konton och transaktioner.
              </p>
              <p className="text-xs text-gray-500">
                EU Open Banking mot Revolut är ett separat flöde (samtycke, certifikat) och ingår inte i den här byggstenen.
              </p>
              <Button asChild className="bg-yellow-400 text-black hover:bg-yellow-300">
                <Link to={keysUrl}>Öppna Revolut-inställningar</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasRevolutApiConfig(appSettings)) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="border-b border-yellow-500/20 py-5">
          <div className="mx-auto max-w-[1360px] px-3 sm:px-5 lg:px-6">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">Revolut Business</h1>
                <p className="text-xs text-gray-500">
                  Official API: {REVOLUT_PRODUCTION_API_BASE_URL} (production) · {REVOLUT_SANDBOX_API_BASE_URL} (sandbox)
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1360px] space-y-6 px-3 py-6 sm:px-5 lg:px-6">
          <Card className="border-sky-500/25 bg-[#242424] shadow-none">
            <CardHeader>
              <CardTitle className="text-base text-sky-300">What you need to do</CardTitle>
              <p className="text-sm text-gray-400">
                This screen reads accounts and transactions from Revolut&apos;s Business API. You must complete a one-time setup in the Revolut Business dashboard, then paste credentials here (or set environment variables for local development).
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-300">
              <ol className="list-decimal space-y-3 pl-5 marker:text-yellow-400">
                <li>
                  In{" "}
                  <strong className="text-white">Revolut Business</strong>, open{" "}
                  <strong className="text-white">Settings → APIs → Business API</strong> and create or select your integration (certificate-based auth as required by Revolut).
                </li>
                <li>
                  Complete Revolut&apos;s OAuth / consent flow so you obtain a <strong className="text-white">Bearer access token</strong> with{" "}
                  <strong className="text-white">READ</strong> access to accounts and transactions (see Revolut docs: &quot;Make your first API request&quot;).
                </li>
                <li>
                  Set the <strong className="text-white">API base URL</strong> to match where the token was issued: production{" "}
                  <code className="rounded bg-black/40 px-1 text-sky-300">{REVOLUT_PRODUCTION_API_BASE_URL}</code> or sandbox{" "}
                  <code className="rounded bg-black/40 px-1 text-sky-300">{REVOLUT_SANDBOX_API_BASE_URL}</code>.
                </li>
                <li>
                  Optionally set an <strong className="text-white">account UUID</strong> to limit the transaction feed to one business account (copy from the accounts list after the first successful connection).
                </li>
              </ol>
              <p className="rounded-xl border border-yellow-500/15 bg-yellow-500/5 p-3 text-xs text-yellow-100/90">
                Access tokens expire about every <strong className="text-yellow-300">40 minutes</strong>. For unattended sync you will need to implement refresh using Revolut&apos;s token endpoint; this app stores the token you paste until you update it.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button asChild className="bg-yellow-400 text-black hover:bg-yellow-300">
                  <Link to={keysUrl}>Enter credentials (API Keys tab)</Link>
                </Button>
                <Button asChild variant="outline" className="border-sky-500/40 text-sky-300 hover:bg-sky-500/10">
                  <a href="https://developer.revolut.com/docs/guides/manage-accounts/api" target="_blank" rel="noreferrer">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Revolut Business API docs
                    <ExternalLink className="ml-2 h-3.5 w-3.5 opacity-70" />
                  </a>
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Local dev: you can set <code className="text-gray-400">VITE_REVOLUT_ACCESS_TOKEN</code>,{" "}
                <code className="text-gray-400">VITE_REVOLUT_API_BASE_URL</code>, and optionally <code className="text-gray-400">VITE_REVOLUT_ACCOUNT_ID</code> in{" "}
                <code className="text-gray-400">.env.local</code>. Production requests use the <code className="text-gray-400">revolutProxy</code> function to avoid browser CORS limits.
              </p>
            </CardContent>
          </Card>
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
                <h1 className="text-lg font-bold text-yellow-400">Revolut Business</h1>
                <p className="text-xs text-gray-500">
                  Accounts and transactions from{" "}
                  <span className="text-gray-400">{baseUrlDisplay}</span>
                  {isSandbox ? " (sandbox)" : " (production)"}. Endpoints: GET /accounts, GET /transactions.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="border-white/15 text-gray-200 hover:bg-white/5">
                <Link to={keysUrl}>Credentials</Link>
              </Button>
              <Button
                onClick={() => revolutQuery.refetch()}
                disabled={revolutQuery.isFetching}
                className="h-8 gap-2 bg-yellow-400 px-3 text-sm text-black hover:bg-yellow-300"
              >
                <RefreshCw className={`h-4 w-4 ${revolutQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1360px] px-3 py-5 sm:px-5 lg:px-6">
        {revolutQuery.isLoading || revolutQuery.isFetching ? (
          <div className="mb-5 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
            Loading live API data…
          </div>
        ) : null}

        {revolutQuery.isError ? (
          <Card className="mb-5 border-red-500/30 bg-[#242424] text-white shadow-none">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" />
              <div>
                <p className="font-semibold text-red-400">Could not load Revolut data</p>
                <p className="text-sm text-gray-300">{revolutQuery.error?.message || "Unknown error"}</p>
                <p className="mt-2 text-xs text-gray-500">
                  Check that your token is still valid, the base URL matches the token environment, and READ scope is granted.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {revolutQuery.isSuccess && !revolutQuery.isError ? (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Accounts"
                value={formatNumber(preview?.accounts?.length || 0)}
                hint="GET /accounts"
                icon={Landmark}
              />
              <MetricCard
                label="Transactions (preview)"
                value={formatNumber(preview?.transactions?.length || 0)}
                hint={
                  preview?.meta?.accountFilter
                    ? `Filtered · ${preview?.meta?.from || ""} → ${preview?.meta?.to || ""}`
                    : `Last ~30 days · ${preview?.meta?.from || ""} → ${preview?.meta?.to || ""}`
                }
                icon={ScanLine}
              />
              <MetricCard
                label="Environment"
                value={isSandbox ? "Sandbox" : "Production"}
                hint="Base URL must match where the token was issued"
                icon={ShieldCheck}
              />
              <MetricCard
                label="Account filter"
                value={appSettings.revolut_account_id?.trim() ? "One account" : "All accounts"}
                hint={appSettings.revolut_account_id?.trim() || "Optional UUID"}
                icon={Wallet}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ListCard title="Business accounts" description="Balances and currencies from GET /accounts." icon={Landmark}>
                {(preview?.accounts || []).length ? (
                  (preview?.accounts || []).map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-3">
                      <div>
                        <p className="font-medium text-white">{acc.name || acc.id}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {acc.state || "—"} · {acc.id}
                        </p>
                      </div>
                      <p className="font-semibold text-sky-300">
                        {Number(acc.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                        {acc.currency || ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No accounts returned.</p>
                )}
              </ListCard>

              <ListCard title="Recent transactions" description="GET /transactions (preview window; amounts per leg)." icon={ScanLine}>
                {(preview?.transactions || []).length ? (
                  (preview?.transactions || []).map((tx) => (
                    <div key={tx.id} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-white">{tx.type || "transaction"}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {tx.state || "—"} · {tx.created_at ? formatRelativeDate(tx.created_at) : "—"}
                          </p>
                        </div>
                        <Badge className="border-sky-500/30 bg-sky-500/15 text-sky-200">{tx.id?.slice(0, 8) || "—"}…</Badge>
                      </div>
                      {tx.reference ? <p className="mt-2 text-xs text-gray-500">Ref: {tx.reference}</p> : null}
                      <p className="mt-2 text-sm font-semibold text-white">{formatRevolutLegsSummary(tx)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No transactions in this window.</p>
                )}
              </ListCard>
            </div>

            <p className="mt-6 text-xs text-gray-500">
              Token lifetime: refresh via OAuth / Revolut&apos;s auth flow as in their documentation. Deployed apps call Revolut through the{" "}
              <code className="text-gray-400">revolutProxy</code> edge function unless you are running the Vite dev proxy.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
