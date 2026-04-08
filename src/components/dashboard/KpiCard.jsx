import React from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function Sparkline({ values = [], tone = "neutral" }) {
  if (!values.length) {
    return <div className="h-10 rounded-lg bg-white/5" />;
  }

  const width = 120;
  const height = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  const stroke =
    tone === "positive" ? "#4ade80" : tone === "negative" ? "#fb7185" : "#fbbf24";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

export default function KpiCard({ item }) {
  const trendPositive = item.trend === "up";
  const trendIcon = trendPositive ? ArrowUpRight : ArrowDownRight;
  const deltaTone = trendPositive ? "positive" : "negative";
  const TrendIcon = trendIcon;
  const href = item.href || "#";
  const sourceTone =
    item.dataSource === "live"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : "border-amber-400/20 bg-amber-400/10 text-amber-200";

  return (
    <Link
      to={href}
      className="group block rounded-2xl border border-yellow-500/15 bg-[#242424] p-4 transition-all duration-300 hover:border-yellow-400/40 hover:bg-[#2b2b2b]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.22em] text-gray-500">{item.label}</p>
            <Badge className={cn("border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]", sourceTone)}>
              {item.dataSource === "live" ? "Live data" : "Hardcoded"}
            </Badge>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{item.value}</p>
        </div>
        <Badge
          className={cn(
            "border px-2 py-1 text-[10px] uppercase tracking-[0.16em]",
            deltaTone === "positive"
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
              : "border-rose-400/25 bg-rose-400/10 text-rose-300"
          )}
        >
          <TrendIcon className="mr-1 h-3 w-3" />
          {item.delta}
        </Badge>
      </div>

      <div className="mt-4">
        <Sparkline values={item.sparkline} tone={item.sparkTone || deltaTone} />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-gray-400">{item.comparisonLabel}</span>
        <span className="inline-flex items-center gap-1 text-yellow-400 transition-colors group-hover:text-yellow-300">
          View details
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}
