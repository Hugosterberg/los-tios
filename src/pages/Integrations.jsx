import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { getClipOverview, hasClipApiConfig, CLIP_API_CATALOG } from "@/api/clip";
import { getLoyverseOverview, hasLoyverseApiConfig } from "@/api/loyverse";
import { buildDefaultAppSettings, INTEGRATION_SETTINGS_SECTIONS } from "@/lib/appSettings";
import { appParams } from "@/lib/app-params";
import { getResolvedIntegrationSettings, saveStoredIntegrationSettings } from "@/lib/integrationSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, Eye, EyeOff, KeyRound, Loader2, PackageSearch, Receipt, RefreshCw, Save, ShieldCheck, ShoppingBag, Store, Users, Wifi, XCircle, BookOpen } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("es-MX");
const CHART_COLORS = ["#facc15", "#f59e0b", "#f97316", "#fb7185", "#38bdf8", "#34d399", "#a78bfa"];


function fieldHasValue(value) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function buildSectionStatus(section, formData) {
  const totalFields = section.fields.length;
  const completedFields = section.fields.filter((field) => fieldHasValue(formData[field.key])).length;

  return {
    totalFields,
    completedFields,
    isConfigured: completedFields > 0,
  };
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return integerFormatter.format(Number(value || 0));
}

function maskSecret(value) {
  const raw = String(value || "");
  if (!raw) {
    return "Not configured";
  }
  if (raw.length <= 8) {
    return "••••••••";
  }
  return `${raw.slice(0, 4)}••••••••${raw.slice(-4)}`;
}

function DataStateCard({ title, description, query, configured }) {
  if (!configured) {
    return (
      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-200">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-yellow-100/80">{description}</p>
      </div>
    );
  }

  if (query.isLoading || query.isFetching) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-gray-300">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-yellow-300" />
          <span>Loading live API data...</span>
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
        <p className="font-medium">{title}</p>
        <p className="mt-1">{query.error?.message || "Unknown error while loading API data."}</p>
      </div>
    );
  }

  return null;
}

function MetricTile({ label, value, hint, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-yellow-300" /> : null}
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-2 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

function RankingCard({ title, subtitle, rows, renderRow, emptyText }) {
  return (
    <Card className="border-white/10 bg-[#141414] shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-white">{title}</CardTitle>
        {subtitle ? <CardDescription className="text-gray-400">{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length ? rows.map(renderRow) : <p className="text-sm text-gray-500">{emptyText}</p>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <Card className="border-white/10 bg-[#141414] shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-white">{title}</CardTitle>
        {subtitle ? <CardDescription className="text-gray-400">{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="h-72">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function Integrations() {
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState({});
  const [showSnapshotSecrets, setShowSnapshotSecrets] = useState({
    clip: false,
    loyverse: false,
  });
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const [formData, setFormData] = useState(() => buildDefaultAppSettings(getResolvedIntegrationSettings()));
  const deferredFormData = React.useDeferredValue(formData);
  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" || !appParams.appId || !appParams.serverUrl);

  const runTest = async (sectionId) => {
    setTesting((t) => ({ ...t, [sectionId]: true }));
    setTestResults((r) => ({ ...r, [sectionId]: null }));
    try {
      if (sectionId === "notion") {
        try {
          await base44.functions.invoke("notionProxy", { path: "users/me", method: "GET" });
          setTestResults((r) => ({ ...r, notion: { ok: true, message: "Notion connection successful." } }));
        } catch (e) {
          throw new Error(e?.response?.data?.error || e?.message || "Error connecting to Notion.");
        }
      } else if (sectionId === "loyverse") {
        if (!hasLoyverseApiConfig(formData)) throw new Error("Loyverse token is missing.");
        await getLoyverseOverview(formData);
        setTestResults((r) => ({ ...r, loyverse: { ok: true, message: "Loyverse connection successful." } }));
      } else if (sectionId === "clip") {
        if (!hasClipApiConfig(formData)) throw new Error("Clip credentials are missing.");
        const overview = await getClipOverview(formData);
        setTestResults((r) => ({
          ...r,
          clip: {
            ok: true,
            message: overview?.paymentMethods?.length
              ? "Clip connection successful."
              : "Clip reporting loaded, but no payment methods were returned.",
          },
        }));
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Unknown error.";
      setTestResults((r) => ({ ...r, [sectionId]: { ok: false, message: msg } }));
    } finally {
      setTesting((t) => ({ ...t, [sectionId]: false }));
    }
  };

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });

  const currentSettings = useMemo(
    () => buildDefaultAppSettings(getResolvedIntegrationSettings(settings[0] || {})),
    [settings],
  );

  React.useEffect(() => {
    const mergedSettings = buildDefaultAppSettings(getResolvedIntegrationSettings(settings[0] || {}));
    setFormData(mergedSettings);
    saveStoredIntegrationSettings(mergedSettings);
  }, [settings]);

  const clipOverviewQuery = useQuery({
    queryKey: [
      "integrations",
      "clipOverview",
      deferredFormData.clip_api_key,
      deferredFormData.clip_api_secret,
      deferredFormData.clip_api_token,
      deferredFormData.clip_payments_api_base_url,
      deferredFormData.clip_settlements_api_base_url,
    ],
    queryFn: () => getClipOverview(deferredFormData),
    enabled: hasClipApiConfig(deferredFormData),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const loyverseOverviewQuery = useQuery({
    queryKey: [
      "integrations",
      "loyverseOverview",
      deferredFormData.loyverse_api_token,
      deferredFormData.loyverse_api_base_url,
    ],
    queryFn: () => getLoyverseOverview(deferredFormData),
    enabled: hasLoyverseApiConfig(deferredFormData),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const saveSettings = useMutation({
    mutationFn: (data) => {
      if (isLocalOnlyMode) {
        saveStoredIntegrationSettings(data);
        return Promise.resolve(data);
      }

      if (settings[0]) {
        return base44.entities.AppSettings.update(settings[0].id, data);
      }

      return base44.entities.AppSettings.create(data);
    },
    onSuccess: (_, values) => {
      if (!isLocalOnlyMode) {
        queryClient.invalidateQueries({ queryKey: ["appSettings"] });
      }
      saveStoredIntegrationSettings(values);
      window.alert(isLocalOnlyMode ? "Settings saved locally." : "Settings saved successfully.");
    },
  });

  const handleFieldChange = (key, value) => {
    setFormData((current) => {
      const next = {
        ...current,
        [key]: value,
      };
      saveStoredIntegrationSettings({ [key]: value });
      return next;
    });
  };

  const toggleSecretVisibility = (key) => {
    setShowSecrets((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    saveSettings.mutate(formData);
  };

  const resetSection = (section) => {
    const confirmed = window.confirm(
      `Reset all fields in ${section.title} to default values?`,
    );

    if (!confirmed) {
      return;
    }

    setFormData((current) => {
      const next = { ...current };
      for (const field of section.fields) {
        next[field.key] = currentSettings[field.key] ?? "";
      }
      const resetValues = Object.fromEntries(
        section.fields.map((field) => [field.key, currentSettings[field.key] ?? ""]),
      );
      saveStoredIntegrationSettings(resetValues);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-yellow-500/10 border-t-yellow-400" />
          <p className="mt-4 text-sm text-gray-400">Loading integration settings...</p>
        </div>
      </div>
    );
  }

  const clipOverview = clipOverviewQuery.data;
  const loyverseOverview = loyverseOverviewQuery.data;
  const clipConfigured = hasClipApiConfig(formData);
  const loyverseConfigured = hasLoyverseApiConfig(formData);
  const topClipPaymentTypes = clipOverview?.analytics?.paymentTypeSummary?.slice(0, 6) || [];
  const topClipIssuers = clipOverview?.analytics?.issuerSummary?.slice(0, 6) || [];
  const clipDaily = clipOverview?.analytics?.dailyPayments?.slice(-7).reverse() || [];
  const clipSettlementBrands = clipOverview?.analytics?.settlementCardBrands?.slice(0, 6) || [];
  const topLoyverseProducts = loyverseOverview?.analytics?.productSales?.slice(0, 8) || [];
  const loyversePaymentMethods = loyverseOverview?.analytics?.paymentMethodSummary?.slice(0, 6) || [];
  const loyverseStores = loyverseOverview?.analytics?.salesByStore?.slice(0, 6) || [];
  const loyverseEmployees = loyverseOverview?.analytics?.salesByEmployee?.slice(0, 6) || [];
  const loyverseDaily = loyverseOverview?.analytics?.dailySales?.slice(-7).reverse() || [];
  const latestReceipts = loyverseOverview?.receipts?.slice(0, 6) || [];
  const latestClipPayments = clipOverview?.payments?.slice(0, 6) || [];
  const latestSettlementPayments = clipOverview?.settlementPayments?.slice(0, 6) || [];
  const clipPaymentTypeChartData = topClipPaymentTypes.map((row) => ({
    name: row.name,
    amount: row.amount,
    count: row.count,
  }));
  const clipDailyChartData = clipDaily.map((row) => ({
    day: row.day.slice(5),
    gross: row.grossAmount,
    refunds: row.refundedAmount,
    tips: row.tipsAmount,
  }));
  const clipSettlementBrandChartData = clipSettlementBrands.map((row) => ({
    name: row.brand,
    value: row.amount,
  }));
  const loyverseProductChartData = topLoyverseProducts.map((row) => ({
    name: row.itemName.length > 22 ? `${row.itemName.slice(0, 22)}…` : row.itemName,
    revenue: row.netRevenue,
    quantity: row.quantity,
  }));
  const loyverseDailyChartData = loyverseDaily.map((row) => ({
    day: row.day.slice(5),
    sales: row.salesAmount,
    discounts: row.discountsAmount,
  }));
  const loyversePaymentChartData = loyversePaymentMethods.map((row) => ({
    name: row.name,
    value: row.amount,
  }));

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <div className="border-b border-yellow-500/20 bg-gradient-to-r from-[#151515] via-[#1d1602] to-[#151515]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-yellow-400/10 p-3 text-yellow-300">
                  <KeyRound className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Integrations</h1>
                  <p className="mt-2 text-sm text-gray-400">
                    Manage all API keys, tokens, base URLs and sensitive credentials from one place.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-yellow-500/20 bg-black/30 px-4 py-3">
              <ShieldCheck className="h-5 w-5 text-yellow-300" />
              <div className="text-sm">
                <p className="font-medium text-white">Instant local sync</p>
                  <p className="text-gray-400">
                    {isLocalOnlyMode
                      ? "Changes are cached locally for API views, with .env.local used as fallback."
                      : "Changes are saved to the database and also cached in localStorage for API views."}
                  </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-yellow-500/20 bg-[#171717] shadow-xl">
            <CardHeader>
              <CardTitle className="text-white">Integration Data Snapshot</CardTitle>
              <CardDescription className="text-gray-400">
                Review exact integration metadata first, then reveal keys only when needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Clip</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSnapshotSecrets((current) => ({ ...current, clip: !current.clip }))}
                    className="h-8 px-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
                  >
                    {showSnapshotSecrets.clip ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                    {showSnapshotSecrets.clip ? "Hide keys" : "Show keys"}
                  </Button>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <p className="text-gray-500">Payments base URL</p>
                    <p className="mt-1 font-mono text-gray-200 break-all">{formData.clip_payments_api_base_url || "Not configured"}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <p className="text-gray-500">Settlements base URL</p>
                    <p className="mt-1 font-mono text-gray-200 break-all">{formData.clip_settlements_api_base_url || "Not configured"}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <p className="text-gray-500">API key</p>
                    <p className="mt-1 font-mono text-gray-200 break-all">
                      {showSnapshotSecrets.clip ? (formData.clip_api_key || "Not configured") : maskSecret(formData.clip_api_key)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <p className="text-gray-500">API secret</p>
                    <p className="mt-1 font-mono text-gray-200 break-all">
                      {showSnapshotSecrets.clip ? (formData.clip_api_secret || "Not configured") : maskSecret(formData.clip_api_secret)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <p className="text-gray-500">Manual token</p>
                    <p className="mt-1 font-mono text-gray-200 break-all">
                      {showSnapshotSecrets.clip ? (formData.clip_api_token || "Not configured") : maskSecret(formData.clip_api_token)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">Loyverse</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSnapshotSecrets((current) => ({ ...current, loyverse: !current.loyverse }))}
                    className="h-8 px-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white"
                  >
                    {showSnapshotSecrets.loyverse ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
                    {showSnapshotSecrets.loyverse ? "Hide keys" : "Show keys"}
                  </Button>
                </div>

                <div className="mt-3 space-y-2 text-xs">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <p className="text-gray-500">API base URL</p>
                    <p className="mt-1 font-mono text-gray-200 break-all">{formData.loyverse_api_base_url || "Not configured"}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                    <p className="text-gray-500">API token</p>
                    <p className="mt-1 font-mono text-gray-200 break-all">
                      {showSnapshotSecrets.loyverse ? (formData.loyverse_api_token || "Not configured") : maskSecret(formData.loyverse_api_token)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20 bg-[#171717] shadow-xl">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-white">Credentials Vault</CardTitle>
                  <CardDescription className="text-gray-400">
                    Use tabs to manage Clip and Loyverse credentials. Fields marked as secrets can be hidden or revealed.
                  </CardDescription>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <Label htmlFor="show-all-secrets" className="text-sm text-gray-300">
                  Show secrets
                </Label>
                <Switch
                  id="show-all-secrets"
                  checked={Object.values(showSecrets).some(Boolean)}
                  onCheckedChange={(checked) => {
                    const next = {};
                    for (const section of INTEGRATION_SETTINGS_SECTIONS) {
                      for (const field of section.fields) {
                        if (field.secret) {
                          next[field.key] = checked;
                        }
                      }
                    }
                    setShowSecrets(next);
                  }}
                />
              </div>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue={INTEGRATION_SETTINGS_SECTIONS[0]?.id} className="space-y-6">
                <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
                  {INTEGRATION_SETTINGS_SECTIONS.map((section) => {
                    const status = buildSectionStatus(section, formData);
                    return (
                      <TabsTrigger
                        key={section.id}
                        value={section.id}
                        className="rounded-xl border border-white/10 bg-[#101010] px-4 py-3 text-left text-gray-300 data-[state=active]:border-yellow-400/50 data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-semibold">{section.title}</p>
                            <p className="text-xs text-gray-500">
                              {status.completedFields}/{status.totalFields} fields configured
                            </p>
                          </div>
                          <Badge className={status.isConfigured ? "bg-emerald-500/15 text-emerald-300" : "bg-gray-500/15 text-gray-300"}>
                            {status.isConfigured ? "Ready" : "Pending"}
                          </Badge>
                        </div>
                      </TabsTrigger>
                    );
                  })}

                {/* Notion tab trigger */}
                  <TabsTrigger
                    value="notion"
                    className="rounded-xl border border-white/10 bg-[#101010] px-4 py-3 text-left text-gray-300 data-[state=active]:border-yellow-400/50 data-[state=active]:bg-yellow-400/10 data-[state=active]:text-yellow-300"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold">Notion</p>
                        <p className="text-xs text-gray-500">OAuth connected</p>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-300">Ready</Badge>
                    </div>
                  </TabsTrigger>
                  </TabsList>

                {/* Notion tab content */}
                <TabsContent value="notion" className="mt-0">
                  <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-yellow-400" /> Notion
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm text-gray-400">
                        Connected via OAuth ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â no API keys needed. Test that the connection is alive.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {testResults["notion"] && (
                        <span className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 border ${testResults["notion"].ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
                          {testResults["notion"].ok
                            ? <CheckCircle2 className="h-3.5 w-3.5" />
                            : <XCircle className="h-3.5 w-3.5" />}
                          {testResults["notion"].message}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => runTest("notion")}
                        disabled={testing["notion"]}
                        className="border-yellow-500/30 bg-transparent text-yellow-300 hover:bg-yellow-400/10 hover:text-yellow-200"
                      >
                        {testing["notion"]
                          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          : <Wifi className="mr-2 h-4 w-4" />}
                        Test connection
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {INTEGRATION_SETTINGS_SECTIONS.map((section) => (
                  <TabsContent key={section.id} value={section.id} className="mt-0">
                    <div className="space-y-6">

                      {/* Clip auth status banner */}
                      {section.id === "clip" && (() => {
                        const key = formData.clip_api_key?.trim();
                        const secret = formData.clip_api_secret?.trim();
                        const manualToken = formData.clip_api_token?.trim();
                        const hasManual = Boolean(manualToken);
                        const hasAuto = Boolean(key && secret);
                        const generatedToken = hasAuto ? `Basic ${btoa(`${key}:${secret}`)}` : null;

                        return (
                          <div className={`rounded-2xl border p-4 text-sm ${hasManual || hasAuto ? "border-emerald-500/30 bg-emerald-500/10" : "border-yellow-500/30 bg-yellow-500/10"}`}>
                            <div className="flex items-start gap-3">
                              {hasManual || hasAuto
                                ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                                : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                              }
                              <div className="space-y-1">
                                {hasManual ? (
                                  <p className="text-emerald-300 font-medium">Manual token configured ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â will be used directly.</p>
                                ) : hasAuto ? (
                                  <>
                                    <p className="text-emerald-300 font-medium">Token auto-generated from public key + secret.</p>
                                    <p className="font-mono text-xs text-gray-400 break-all">{generatedToken}</p>
                                  </>
                                ) : (
                                  <p className="text-yellow-300 font-medium">Missing credentials ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â configure the public key and secret to generate a Basic token.</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 p-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-white">{section.title}</h2>
                          <p className="mt-1 max-w-2xl text-sm text-gray-400">{section.description}</p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {testResults[section.id] && (
                            <span className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 border ${testResults[section.id].ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
                              {testResults[section.id].ok
                                ? <CheckCircle2 className="h-3.5 w-3.5" />
                                : <XCircle className="h-3.5 w-3.5" />}
                              {testResults[section.id].message}
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => runTest(section.id)}
                            disabled={testing[section.id]}
                            className="border-yellow-500/30 bg-transparent text-yellow-300 hover:bg-yellow-400/10 hover:text-yellow-200"
                          >
                            {testing[section.id]
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : <Wifi className="mr-2 h-4 w-4" />}
                              Test connection
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => resetSection(section)}
                              className="border-white/10 bg-transparent text-gray-200 hover:bg-white/5 hover:text-white"
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Reset
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {section.fields.map((field) => {
                          const isVisibleSecret = field.secret && showSecrets[field.key];
                          return (
                            <div
                              key={field.key}
                              className={`rounded-2xl border border-white/10 bg-[#141414] p-4 ${field.fullWidth ? "lg:col-span-2" : ""}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                  <Label htmlFor={field.key} className="text-sm font-medium text-white">
                                    {field.label}
                                  </Label>
                                  {field.helperText ? (
                                    <p className="text-xs leading-5 text-gray-400">{field.helperText}</p>
                                  ) : null}
                                </div>

                                {field.secret ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleSecretVisibility(field.key)}
                                    className="h-9 w-9 shrink-0 text-gray-400 hover:bg-white/5 hover:text-white"
                                  >
                                    {isVisibleSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                  </Button>
                                ) : null}
                              </div>

                              <div className="mt-4">
                                <Input
                                  id={field.key}
                                  type={field.secret && !isVisibleSecret ? "password" : "text"}
                                  value={formData[field.key] || ""}
                                  onChange={(event) => handleFieldChange(field.key, event.target.value)}
                                  placeholder={field.placeholder}
                                  autoComplete="off"
                                  className="border-white/10 bg-[#0d0d0d] text-white placeholder:text-gray-500"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {section.id === "clip" ? (
                        <div className="space-y-4">
                          <DataStateCard
                            title="Clip live data unavailable"
                            description="Configure Clip credentials above to load payment methods, transactions, settlements, fee breakdowns, issuers, and recent payment activity."
                            query={clipOverviewQuery}
                            configured={clipConfigured}
                          />

                          {clipConfigured && !clipOverviewQuery.isLoading && !clipOverviewQuery.isFetching && !clipOverviewQuery.isError ? (
                            <>
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <MetricTile label="Approved volume" value={formatCurrency(clipOverview?.metrics?.grossVolume)} hint={`${formatNumber(clipOverview?.metrics?.approvedPaymentsCount)} approved payments`} icon={CreditCard} />
                                <MetricTile label="Net deposits" value={formatCurrency(clipOverview?.metrics?.netDeposits)} hint={`${formatNumber(clipOverview?.metrics?.settlementsCount)} settlements`} icon={Store} />
                                <MetricTile label="Settlement fees" value={formatCurrency(clipOverview?.metrics?.totalSettlementFees)} hint={`Tax ${formatCurrency(clipOverview?.metrics?.totalSettlementTax)} | retention ${formatCurrency(clipOverview?.metrics?.totalSettlementRetention)}`} icon={Receipt} />
                                <MetricTile label="Average ticket" value={formatCurrency(clipOverview?.metrics?.averageTicket)} hint={`${formatNumber(clipOverview?.metrics?.paymentMethodsCount)} payment methods available`} icon={ShoppingBag} />
                              </div>

                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                <ChartCard
                                  title="Payment mix by volume"
                                  subtitle="Approved Clip transactions grouped by method."
                                >
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={clipPaymentTypeChartData}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                      <XAxis dataKey="name" stroke="#9ca3af" tickLine={false} axisLine={false} />
                                      <YAxis stroke="#9ca3af" tickFormatter={(value) => formatNumber(value)} tickLine={false} axisLine={false} />
                                      <Tooltip
                                        formatter={(value, key) => key === "count" ? formatNumber(value) : formatCurrency(value)}
                                        contentStyle={{ backgroundColor: "#101010", border: "1px solid rgba(250, 204, 21, 0.15)", borderRadius: "16px" }}
                                      />
                                      <Bar dataKey="amount" radius={[10, 10, 0, 0]} fill="#facc15" />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard
                                  title="Daily payment trend"
                                  subtitle="Gross approved payments and refunds over the latest 7 days."
                                >
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={clipDailyChartData}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                      <XAxis dataKey="day" stroke="#9ca3af" tickLine={false} axisLine={false} />
                                      <YAxis stroke="#9ca3af" tickFormatter={(value) => formatNumber(value)} tickLine={false} axisLine={false} />
                                      <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ backgroundColor: "#101010", border: "1px solid rgba(250, 204, 21, 0.15)", borderRadius: "16px" }}
                                      />
                                      <Line type="monotone" dataKey="gross" stroke="#facc15" strokeWidth={3} dot={{ r: 4 }} />
                                      <Line type="monotone" dataKey="refunds" stroke="#fb7185" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard
                                  title="Settlement card brands"
                                  subtitle="Brand share from recent settlement detail rows."
                                >
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie data={clipSettlementBrandChartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                                        {clipSettlementBrandChartData.map((entry, index) => (
                                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                      </Pie>
                                      <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ backgroundColor: "#101010", border: "1px solid rgba(250, 204, 21, 0.15)", borderRadius: "16px" }}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </ChartCard>
                              </div>

                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                <RankingCard
                                  title="Accepted payment methods"
                                  subtitle="Live from `GET /payment_methods`."
                                  rows={clipOverview?.paymentMethods || []}
                                  emptyText="Clip did not return any payment methods."
                                  renderRow={(method) => (
                                    <div key={method.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="font-medium text-white">{method.name || method.id}</p>
                                          <p className="mt-1 text-xs text-gray-400">{method.type || "unknown"} | status {method.status || "unknown"}</p>
                                        </div>
                                        <Badge className="bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/10">{method.id}</Badge>
                                      </div>
                                    </div>
                                  )}
                                />

                                <RankingCard
                                  title="Documented Clip surfaces"
                                  subtitle="Cross-checked against the official Clip docs."
                                  rows={CLIP_API_CATALOG}
                                  emptyText="No documented API surfaces loaded."
                                  renderRow={(api) => (
                                    <div key={api.key} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="font-medium text-white">{api.name}</p>
                                          <p className="mt-1 text-xs text-gray-400">{api.summary}</p>
                                        </div>
                                        <Badge className={api.status === "live" ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15" : "bg-gray-500/15 text-gray-300 hover:bg-gray-500/15"}>
                                          {api.status}
                                        </Badge>
                                      </div>
                                      <p className="mt-2 text-xs text-gray-500">{api.capabilities.join(" | ")}</p>
                                    </div>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                <RankingCard
                                  title="Payment type mix"
                                  subtitle="Approved payments grouped by method/type."
                                  rows={topClipPaymentTypes}
                                  emptyText="No approved payment mix available yet."
                                  renderRow={(row) => (
                                    <div key={row.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div>
                                        <p className="font-medium text-white">{row.name}</p>
                                        <p className="mt-1 text-xs text-gray-400">{formatNumber(row.count)} payments | {row.type}</p>
                                      </div>
                                      <p className="font-semibold text-yellow-300">{formatCurrency(row.amount)}</p>
                                    </div>
                                  )}
                                />

                                <RankingCard
                                  title="Card issuers"
                                  subtitle="Issuer aggregation from approved payments."
                                  rows={topClipIssuers}
                                  emptyText="No issuer data returned yet."
                                  renderRow={(row) => (
                                    <div key={row.issuer} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div>
                                        <p className="font-medium text-white">{row.issuer}</p>
                                        <p className="mt-1 text-xs text-gray-400">{formatNumber(row.count)} payments</p>
                                      </div>
                                      <p className="font-semibold text-yellow-300">{formatCurrency(row.amount)}</p>
                                    </div>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                <RankingCard
                                  title="Daily payment volume"
                                  subtitle="Last 7 settled days from approved Clip transactions."
                                  rows={clipDaily}
                                  emptyText="No daily payment history yet."
                                  renderRow={(row) => (
                                    <div key={row.day} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="font-medium text-white">{row.day}</p>
                                        <p className="font-semibold text-yellow-300">{formatCurrency(row.grossAmount)}</p>
                                      </div>
                                      <p className="mt-1 text-xs text-gray-400">{formatNumber(row.count)} payments | refunds {formatCurrency(row.refundedAmount)} | tips {formatCurrency(row.tipsAmount)}</p>
                                    </div>
                                  )}
                                />

                                <RankingCard
                                  title="Recent payments"
                                  subtitle="Latest transactions returned by `GET /payments`."
                                  rows={latestClipPayments}
                                  emptyText="No Clip payments returned."
                                  renderRow={(payment) => (
                                    <div key={payment.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="font-medium text-white">{payment.description || payment.receipt_no || payment.id}</p>
                                          <p className="mt-1 text-xs text-gray-400">{payment.payment_method?.id || payment.payment_method?.type || "unknown"} | {payment.payment_method?.card?.issuer || "Unknown issuer"}</p>
                                        </div>
                                        <Badge className="bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/10">{payment.status || "unknown"}</Badge>
                                      </div>
                                      <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(payment.amount)}</p>
                                    </div>
                                  )}
                                />

                                <RankingCard
                                  title="Settlement detail rows"
                                  subtitle="Live from recent `GET /settlements/{id}` detail payloads."
                                  rows={latestSettlementPayments}
                                  emptyText="No settlement detail rows were returned."
                                  renderRow={(payment, index) => (
                                    <div key={`${payment.receipt_no}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="font-medium text-white">{payment.receipt_no || "No receipt number"}</p>
                                          <p className="mt-1 text-xs text-gray-400">{payment.card?.brand || payment.payment_method || "unknown"} | {payment.card?.issuer || "Unknown issuer"}</p>
                                        </div>
                                        <p className="font-semibold text-yellow-300">{formatCurrency(payment.settled_amount)}</p>
                                      </div>
                                      <p className="mt-1 text-xs text-gray-400">Fee {formatCurrency(payment?.charges?.charge?.fee)} | tax {formatCurrency(payment?.charges?.charge?.tax)} | gross {formatCurrency(payment.amount)}</p>
                                    </div>
                                  )}
                                />
                              </div>

                              <RankingCard
                                title="Settlement card brands"
                                subtitle="Brand-level aggregation from settlement detail rows."
                                rows={clipSettlementBrands}
                                emptyText="No card brand breakdown available yet."
                                renderRow={(row) => (
                                  <div key={row.brand} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                                    <div>
                                      <p className="font-medium text-white">{row.brand}</p>
                                      <p className="mt-1 text-xs text-gray-400">{formatNumber(row.count)} settlement rows | fees {formatCurrency(row.feeAmount)}</p>
                                    </div>
                                    <p className="font-semibold text-yellow-300">{formatCurrency(row.amount)}</p>
                                  </div>
                                )}
                              />
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {section.id === "loyverse" ? (
                        <div className="space-y-4">
                          <DataStateCard
                            title="Loyverse live data unavailable"
                            description="Configure a Loyverse token above to load menu items, receipts, sold quantities, stores, staff, discounts, devices, and other catalog data."
                            query={loyverseOverviewQuery}
                            configured={loyverseConfigured}
                          />

                          {loyverseConfigured && !loyverseOverviewQuery.isLoading && !loyverseOverviewQuery.isFetching && !loyverseOverviewQuery.isError ? (
                            <>
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <MetricTile label="Gross sales" value={formatCurrency(loyverseOverview?.metrics?.grossSales)} hint={`${formatNumber(loyverseOverview?.metrics?.completedReceiptsCount)} completed receipts`} icon={Store} />
                                <MetricTile label="Average receipt" value={formatCurrency(loyverseOverview?.metrics?.averageReceiptValue)} hint={`Discounts ${formatCurrency(loyverseOverview?.metrics?.totalDiscountAmount)} | tax ${formatCurrency(loyverseOverview?.metrics?.totalTaxAmount)}`} icon={Receipt} />
                                <MetricTile label="Menu catalog" value={`${formatNumber(loyverseOverview?.metrics?.itemsCount)} items`} hint={`${formatNumber(loyverseOverview?.metrics?.categoriesCount)} categories | ${formatNumber(loyverseOverview?.metrics?.modifiersCount)} modifiers`} icon={PackageSearch} />
                                <MetricTile label="Customers & staff" value={`${formatNumber(loyverseOverview?.metrics?.customersCount)} customers`} hint={`${formatNumber(loyverseOverview?.metrics?.employeesCount)} employees | ${formatNumber(loyverseOverview?.metrics?.activePosDevicesCount)} active POS devices`} icon={Users} />
                              </div>

                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                <ChartCard
                                  title="Top products by revenue"
                                  subtitle="Net revenue from Loyverse receipt line items."
                                >
                                  <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={loyverseProductChartData} layout="vertical" margin={{ left: 12, right: 12 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                      <XAxis type="number" stroke="#9ca3af" tickFormatter={(value) => formatNumber(value)} tickLine={false} axisLine={false} />
                                      <YAxis type="category" dataKey="name" width={110} stroke="#9ca3af" tickLine={false} axisLine={false} />
                                      <Tooltip
                                        formatter={(value, key) => key === "quantity" ? formatNumber(value) : formatCurrency(value)}
                                        contentStyle={{ backgroundColor: "#101010", border: "1px solid rgba(250, 204, 21, 0.15)", borderRadius: "16px" }}
                                      />
                                      <Bar dataKey="revenue" radius={[0, 10, 10, 0]} fill="#facc15" />
                                    </BarChart>
                                  </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard
                                  title="Daily sales trend"
                                  subtitle="Sales and discounts from the latest 7 days of receipts."
                                >
                                  <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={loyverseDailyChartData}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                                      <XAxis dataKey="day" stroke="#9ca3af" tickLine={false} axisLine={false} />
                                      <YAxis stroke="#9ca3af" tickFormatter={(value) => formatNumber(value)} tickLine={false} axisLine={false} />
                                      <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ backgroundColor: "#101010", border: "1px solid rgba(250, 204, 21, 0.15)", borderRadius: "16px" }}
                                      />
                                      <Line type="monotone" dataKey="sales" stroke="#facc15" strokeWidth={3} dot={{ r: 4 }} />
                                      <Line type="monotone" dataKey="discounts" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </ChartCard>

                                <ChartCard
                                  title="Payment method share"
                                  subtitle="Receipt payment methods grouped by amount."
                                >
                                  <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                      <Pie data={loyversePaymentChartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                                        {loyversePaymentChartData.map((entry, index) => (
                                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                      </Pie>
                                      <Tooltip
                                        formatter={(value) => formatCurrency(value)}
                                        contentStyle={{ backgroundColor: "#101010", border: "1px solid rgba(250, 204, 21, 0.15)", borderRadius: "16px" }}
                                      />
                                    </PieChart>
                                  </ResponsiveContainer>
                                </ChartCard>
                              </div>

                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                <RankingCard
                                  title="Top sold products"
                                  subtitle="Computed from Loyverse receipt line items."
                                  rows={topLoyverseProducts}
                                  emptyText="No sold-product data available yet."
                                  renderRow={(row) => (
                                    <div key={row.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div>
                                        <p className="font-medium text-white">{row.itemName}</p>
                                        <p className="mt-1 text-xs text-gray-400">{formatNumber(row.quantity)} sold | discounts {formatCurrency(row.discounts)}</p>
                                      </div>
                                      <p className="font-semibold text-yellow-300">{formatCurrency(row.netRevenue)}</p>
                                    </div>
                                  )}
                                />

                                <RankingCard
                                  title="Payment method breakdown"
                                  subtitle="Grouped from the payments array embedded in receipts."
                                  rows={loyversePaymentMethods}
                                  emptyText="No receipt payment methods returned yet."
                                  renderRow={(row) => (
                                    <div key={row.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div>
                                        <p className="font-medium text-white">{row.name}</p>
                                        <p className="mt-1 text-xs text-gray-400">{formatNumber(row.count)} payments | type {row.type}</p>
                                      </div>
                                      <p className="font-semibold text-yellow-300">{formatCurrency(row.amount)}</p>
                                    </div>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                <RankingCard
                                  title="Sales by store"
                                  subtitle="Live store aggregation from receipts."
                                  rows={loyverseStores}
                                  emptyText="No store-level sales returned."
                                  renderRow={(row) => (
                                    <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="font-medium text-white">{row.storeName}</p>
                                        <p className="font-semibold text-yellow-300">{formatCurrency(row.salesAmount)}</p>
                                      </div>
                                      <p className="mt-1 text-xs text-gray-400">{formatNumber(row.receiptsCount)} receipts | discounts {formatCurrency(row.discountsAmount)}</p>
                                    </div>
                                  )}
                                />

                                <RankingCard
                                  title="Sales by employee"
                                  subtitle="Receipt ownership grouped by employee."
                                  rows={loyverseEmployees}
                                  emptyText="No employee-linked receipts returned."
                                  renderRow={(row) => (
                                    <div key={row.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="font-medium text-white">{row.employeeName}</p>
                                        <p className="font-semibold text-yellow-300">{formatCurrency(row.salesAmount)}</p>
                                      </div>
                                      <p className="mt-1 text-xs text-gray-400">{formatNumber(row.receiptsCount)} receipts</p>
                                    </div>
                                  )}
                                />

                                <RankingCard
                                  title="Daily sales"
                                  subtitle="Last 7 sales days from Loyverse receipts."
                                  rows={loyverseDaily}
                                  emptyText="No daily sales history available."
                                  renderRow={(row) => (
                                    <div key={row.day} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="font-medium text-white">{row.day}</p>
                                        <p className="font-semibold text-yellow-300">{formatCurrency(row.salesAmount)}</p>
                                      </div>
                                      <p className="mt-1 text-xs text-gray-400">{formatNumber(row.receiptsCount)} receipts | discounts {formatCurrency(row.discountsAmount)}</p>
                                    </div>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                <RankingCard
                                  title="Latest receipts"
                                  subtitle="Recent Loyverse tickets with totals and payment count."
                                  rows={latestReceipts}
                                  emptyText="No receipts returned by Loyverse."
                                  renderRow={(receipt) => (
                                    <div key={receipt.receipt_number || receipt.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="font-medium text-white">{receipt.receipt_number || receipt.id}</p>
                                          <p className="mt-1 text-xs text-gray-400">{receipt.dining_option || receipt.source || "unknown source"} | {receipt.payments?.length || 0} payments</p>
                                        </div>
                                        <p className="font-semibold text-yellow-300">{formatCurrency(receipt.total_money || receipt.total_payment_money || receipt.total)}</p>
                                      </div>
                                    </div>
                                  )}
                                />

                                <RankingCard
                                  title="Catalog depth"
                                  subtitle="What the current token exposes beyond receipts."
                                  rows={[
                                    { key: "items", label: "Items", value: loyverseOverview?.metrics?.itemsCount, extra: `${formatNumber(loyverseOverview?.metrics?.variantsCount)} variants` },
                                    { key: "categories", label: "Categories", value: loyverseOverview?.metrics?.categoriesCount, extra: `${formatNumber(loyverseOverview?.metrics?.itemsWithoutCategoryCount)} uncategorized items` },
                                    { key: "modifiers", label: "Modifier groups", value: loyverseOverview?.metrics?.modifiersCount, extra: `${formatNumber(loyverseOverview?.metrics?.modifierOptionsCount)} modifier options` },
                                    { key: "discounts", label: "Discounts", value: loyverseOverview?.metrics?.discountsCount, extra: `Total receipt discounts ${formatCurrency(loyverseOverview?.metrics?.totalDiscountAmount)}` },
                                    { key: "taxes", label: "Taxes", value: loyverseOverview?.metrics?.taxesCount, extra: `Receipt tax total ${formatCurrency(loyverseOverview?.metrics?.totalTaxAmount)}` },
                                    { key: "employees", label: "Employees", value: loyverseOverview?.metrics?.employeesCount, extra: `${formatNumber(loyverseOverview?.metrics?.ownerEmployeesCount)} owners` },
                                    { key: "devices", label: "POS devices", value: loyverseOverview?.metrics?.posDevicesCount, extra: `${formatNumber(loyverseOverview?.metrics?.activePosDevicesCount)} active` },
                                    { key: "shifts", label: "Shifts", value: loyverseOverview?.metrics?.shiftsCount, extra: `${formatNumber(loyverseOverview?.metrics?.inventoryLevelsCount)} inventory levels` },
                                  ]}
                                  emptyText="No catalog data available."
                                  renderRow={(row) => (
                                    <div key={row.key} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                                      <div>
                                        <p className="font-medium text-white">{row.label}</p>
                                        <p className="mt-1 text-xs text-gray-400">{row.extra}</p>
                                      </div>
                                      <p className="font-semibold text-yellow-300">{formatNumber(row.value)}</p>
                                    </div>
                                  )}
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </TabsContent>
                ))}


              </Tabs>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="submit"
              disabled={saveSettings.isPending}
              className="bg-yellow-400 text-black hover:bg-yellow-300"
            >
              <Save className="mr-2 h-4 w-4" />
              {saveSettings.isPending ? "Saving..." : "Save integration settings"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
