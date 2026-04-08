import React from "react";
import { Link } from "react-router-dom";
import { BellRing, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const severityStyles = {
  critical: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  high: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  medium: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  low: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
};

const statusIcons = {
  new: BellRing,
  acknowledged: Clock3,
  resolved: CheckCircle2,
};

export default function AlertFeed({ alerts }) {
  if (!alerts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-emerald-400/20 bg-emerald-400/5 p-6 text-sm text-emerald-200">
        No open alerts. Financial controls and operating thresholds are healthy.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const StatusIcon = statusIcons[alert.status] || ShieldAlert;

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
                      alert.dataSource === "live"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                    )}
                  >
                    {alert.dataSource === "live" ? "Live data" : "Hardcoded"}
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
