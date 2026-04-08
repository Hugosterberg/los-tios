import React, { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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
import { CheckCircle2, Eye, EyeOff, Info, KeyRound, Loader2, RefreshCw, Save, ShieldCheck, Wifi, XCircle, BookOpen } from "lucide-react";


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

export default function Integrations() {
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState({});
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
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
        const token = formData.loyverse_api_token?.trim();
        if (!token) throw new Error("Loyverse token is missing.");
        await base44.functions.invoke("loyverseProxy", {
          path: "receipts",
          apiToken: token,
          searchParams: { limit: 1 },
        });
        setTestResults((r) => ({ ...r, loyverse: { ok: true, message: "Loyverse connection successful." } }));
      } else if (sectionId === "clip") {
        const key = formData.clip_api_key?.trim();
        const secret = formData.clip_api_secret?.trim();
        const manualToken = formData.clip_api_token?.trim();
        const authToken = manualToken || (key && secret ? `Basic ${btoa(`${key}:${secret}`)}` : null);
        if (!authToken) throw new Error("Clip credentials are missing.");

        let authOk = false;
        const now = new Date();
        const paymentsFrom = new Date(now);
        paymentsFrom.setUTCDate(paymentsFrom.getUTCDate() - 29);
        paymentsFrom.setUTCHours(0, 0, 0, 0);

        const settlementsTo = new Date(now);
        settlementsTo.setUTCDate(settlementsTo.getUTCDate() - 1);
        settlementsTo.setUTCHours(23, 59, 59, 999);
        const settlementsFrom = new Date(settlementsTo);
        settlementsFrom.setUTCDate(settlementsFrom.getUTCDate() - 89);
        settlementsFrom.setUTCHours(0, 0, 0, 0);

        let paymentsOk = false;
        let settlementsOk = false;
        let lastClipError = null;

        try {
          await base44.functions.invoke("clipProxy", {
            path: "payment_methods",
            apiType: "payments",
            authToken,
          });
          authOk = true;
        } catch (e) {
          lastClipError = e;
        }

        try {
          await base44.functions.invoke("clipProxy", {
            path: "payments",
            apiType: "payments",
            authToken,
            searchParams: {
              from: paymentsFrom.toISOString().replace(/\.\d{3}Z$/, "Z"),
              to: now.toISOString().replace(/\.\d{3}Z$/, "Z"),
              size: 1,
            },
          });
          paymentsOk = true;
        } catch (e) {
          lastClipError = e;
        }

        try {
          await base44.functions.invoke("clipProxy", {
            path: "settlements",
            apiType: "settlements",
            authToken,
            searchParams: {
              from: settlementsFrom.toISOString().slice(0, 10),
              to: settlementsTo.toISOString().slice(0, 10),
            },
          });
          settlementsOk = true;
        } catch (e) {
          lastClipError = e;
        }

        if (!authOk && !paymentsOk && !settlementsOk) {
          const status = lastClipError?.response?.status;
          if (status === 404) {
            throw new Error("Clip returned 404 for auth and reporting checks. This suggests the proxy route or Clip endpoint mapping is off, or this Clip account does not have access to the requested API surfaces.");
          }
          throw new Error(lastClipError?.response?.data?.error || lastClipError?.message || "Clip connection test failed.");
        }

        setTestResults((r) => ({
          ...r,
          clip: {
            ok: true,
            message: authOk && paymentsOk && settlementsOk
              ? "Clip connection successful."
              : authOk
                ? "Clip auth works. Some reporting endpoints still need review."
                : "Clip connection partially successful. One API responded, but the other should be reviewed.",
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

  const [formData, setFormData] = useState(currentSettings);

  React.useEffect(() => {
    const mergedSettings = buildDefaultAppSettings(getResolvedIntegrationSettings(settings[0] || {}));
    setFormData(mergedSettings);
    saveStoredIntegrationSettings(mergedSettings);
  }, [settings]);

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
