import { Link } from "react-router-dom";
import { BellRing, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const severityStyles = {
  critical: "border-red-400/30 bg-red-400/10 text-red-300",
  high: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  low: "border-yellow-400/20 bg-yellow-400/8 text-yellow-300",
};

const statusIcons = {
  new: BellRing,
  acknowledged: Clock3,
  resolved: CheckCircle2,
};

export default function AlertFeed({ alerts }) {
  if (!alerts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-yellow-500/25 bg-yellow-500/[0.06] p-6 text-sm text-yellow-200/90">
        No open alerts. Financial controls and operating thresholds are healthy.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const StatusIcon = statusIcons[alert.status] || ShieldAlert;
        const sourceMeta = {
          clip: {
            label: "Clip",
            tone: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
          },
          loyverse: {
            label: "Loyverse",
            tone: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
          },
          both: {
            label: "Clip + Loyverse",
            tone: "border-amber-400/30 bg-amber-400/10 text-amber-100",
          },
          order_records: {
            label: "Order module",
            tone: "border-yellow-300/25 bg-yellow-300/8 text-yellow-300",
          },
          finance_ledger: {
            label: "Finance ledger",
            tone: "border-yellow-600/30 bg-yellow-600/10 text-yellow-100",
          },
          manual: {
            label: "Manual",
            tone: "border-yellow-500/20 bg-yellow-500/8 text-yellow-200",
          },
          mock: {
            label: "Hardcoded",
            tone: "border-yellow-400/20 bg-yellow-400/10 text-yellow-200",
          },
          live: {
            label: "Live data",
            tone: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
          },
        };
        const source = sourceMeta[alert.dataSource] || sourceMeta.mock;

        return (
          <Link
            key={alert.id}
            to={alert.href}
            className="block rounded-2xl border border-yellow-500/10 bg-[#1a1a1a] p-4 transition-all hover:border-yellow-400/30 hover:bg-[#202020]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("border text-[10px] uppercase tracking-[0.18em]", severityStyles[alert.severity])}>
                    {alert.severity}
                  </Badge>
                  <Badge className="border border-yellow-500/10 bg-black/20 text-[10px] uppercase tracking-[0.18em] text-gray-300">
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {alert.status}
                  </Badge>
                  <Badge
                    className={cn(
                      "border text-[10px] uppercase tracking-[0.18em]",
                      source.tone
                    )}
                  >
                    {source.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{alert.summary}</p>
                  <p className="mt-1 text-sm text-gray-400">{alert.suggestedAction}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500 lg:text-right">
                <p>{alert.timestamp}</p>
                <p className="mt-1">Owner: {alert.owner}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
