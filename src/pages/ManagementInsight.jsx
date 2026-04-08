import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Building2, DatabaseZap, FileJson, PanelsTopLeft, ShieldCheck } from "lucide-react";
import DashboardPanel from "@/components/dashboard/DashboardPanel";
import InsightTable from "@/components/dashboard/InsightTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  apiContracts,
  detailViews,
  domainModels,
  integrationBlueprint,
  reconciliationRows,
  suggestedComponents,
  suggestedPages,
  syncArchitectureNotes,
} from "@/features/dashboard/mockData";
import { createPageUrl } from "@/utils";

export default function ManagementInsight() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view") || "payments-reconciliation";
  const detail = detailViews[view] || detailViews["payments-reconciliation"];

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to={createPageUrl("Dashboard")} className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">{detail.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">{detail.summary}</p>
          </div>
          <Button asChild className="bg-yellow-400 text-black hover:bg-yellow-300">
            <Link to={`${createPageUrl("Dashboard")}?focus=${view}`}>Return with focus</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {detail.focusMetrics.map((metric) => (
            <DashboardPanel key={metric.label} className="bg-[#242424]" contentClassName="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{metric.label}</p>
              <p className="mt-3 text-2xl font-semibold text-white">{metric.value}</p>
            </DashboardPanel>
          ))}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <DashboardPanel
            title="Suggested Page Structure"
            description="Recommended management navigation and ownership boundaries for the admin experience."
            action={
              <Badge className="border border-amber-400/20 bg-amber-400/10 text-amber-200">
                <PanelsTopLeft className="mr-1 h-3 w-3" />
                UX blueprint
              </Badge>
            }
          >
            <div className="space-y-3">
              {suggestedPages.map((page) => (
                <div key={page.page} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-amber-300" />
                    <p className="text-sm font-semibold text-white">{page.page}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{page.purpose}</p>
                </div>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Reusable Components"
            description="Reusable building blocks that keep the dashboard consistent and extensible."
            action={
              <Badge className="border border-sky-400/20 bg-sky-400/10 text-sky-200">
                <DatabaseZap className="mr-1 h-3 w-3" />
                System UI
              </Badge>
            }
          >
            <div className="flex flex-wrap gap-2">
              {suggestedComponents.map((component) => (
                <Badge key={component} className="border border-white/10 bg-white/5 text-slate-200">
                  {component}
                </Badge>
              ))}
            </div>
          </DashboardPanel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <DashboardPanel
            title="Internal Domain Models"
            description="Normalized entities to keep provider-specific data separate from analytics and UI state."
            action={
              <Badge className="border border-emerald-400/20 bg-emerald-400/10 text-emerald-200">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Audit-ready
              </Badge>
            }
          >
            <div className="space-y-4">
              {domainModels.map((model) => (
                <div key={model.entity} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">{model.entity}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{model.fields.join(" | ")}</p>
                </div>
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Integration Mapping Layer"
            description="Provider-specific ingest mapped into internal entities and sync responsibilities."
            action={
              <Badge className="border border-rose-400/20 bg-rose-400/10 text-rose-200">
                <FileJson className="mr-1 h-3 w-3" />
                TODO wiring
              </Badge>
            }
          >
            <div className="space-y-4">
              {integrationBlueprint.map((provider) => (
                <div key={provider.provider} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">{provider.provider}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Ingest</p>
                  <p className="mt-1 text-sm text-slate-300">{provider.ingest.join(", ")}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">Mapped Internal Entities</p>
                  <p className="mt-1 text-sm text-slate-300">{provider.mapTo.join(", ")}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">TODO</p>
                  <p className="mt-1 text-sm text-slate-400">{provider.todo}</p>
                </div>
              ))}
            </div>
          </DashboardPanel>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <InsightTable
            title="Reconciliation Contract Example"
            subtitle="Example data shape for source-by-source payment matching."
            columns={[
              { key: "source_system", label: "Source system" },
              { key: "expected_amount", label: "Expected amount" },
              { key: "actual_amount", label: "Actual amount" },
              { key: "difference", label: "Difference" },
              { key: "status", label: "Status" },
              { key: "last_sync_time", label: "Last sync time" },
            ]}
            rows={reconciliationRows}
            defaultSortKey="last_sync_time"
          />

          <DashboardPanel title="API Contract Examples" description="Suggested endpoints for the analytics and sync orchestration layer.">
            <div className="space-y-4">
              {apiContracts.map((contract) => (
                <div key={contract.endpoint} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-white">{contract.endpoint}</p>
                  <p className="mt-2 text-sm text-slate-400">{contract.purpose}</p>
                  <pre className="mt-3 overflow-x-auto rounded-xl border border-white/5 bg-[#0b1120] p-3 text-xs text-slate-300">
                    {contract.sample}
                  </pre>
                </div>
              ))}
            </div>
          </DashboardPanel>
        </div>

        <DashboardPanel title="Backend Architecture Notes" description="Operational guidance for sync jobs, retries, logging, and financial auditability." className="mt-6">
          <div className="grid gap-3 md:grid-cols-2">
            {syncArchitectureNotes.map((note) => (
              <div key={note} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-sm text-slate-300">
                {note}
              </div>
            ))}
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
