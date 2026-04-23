import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getDashboardSourceMeta } from "@/components/dashboard/sourceMeta";

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
    tone === "positive" ? "#facc15" : tone === "negative" ? "#fb7185" : "#fbbf24";

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

export default function KpiCard({ item, onOpenBreakdown }) {
  const trendPositive = item.trend === "up";
  const trendIcon = trendPositive ? ArrowUpRight : ArrowDownRight;
  const deltaTone = trendPositive ? "positive" : "negative";
  const TrendIcon = trendIcon;
  const href = item.href || "#";
  const interactiveBreakdown = Boolean(item.breakdown && onOpenBreakdown);
  const source = getDashboardSourceMeta(item.dataSource);

  const cardBody = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.22em] text-gray-500">{item.label}</p>
            <Badge className={cn("border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]", source.tone)}>
              {source.label}
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

      <div className="mt-4 flex items-center justify-between gap-2 text-xs">
        <span className="min-w-0 flex-1 text-gray-400">{item.comparisonLabel}</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-yellow-400 transition-colors group-hover:text-yellow-300">
          {interactiveBreakdown ? "How it's calculated" : "View details"}
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </>
  );

  if (interactiveBreakdown) {
    return (
      <div className="group block rounded-2xl border border-yellow-500/15 bg-[#242424] transition-all duration-300 hover:border-yellow-400/40 hover:bg-[#2b2b2b]">
        <button
          type="button"
          className="w-full rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500/40"
          onClick={() => onOpenBreakdown(item)}
        >
          {cardBody}
        </button>
        <div className="border-t border-white/[0.06] px-4 py-2.5">
          <Link
            to={href}
            className="inline-flex items-center gap-1 text-[11px] text-yellow-500/80 transition-colors hover:text-yellow-300"
            onClick={(e) => e.stopPropagation()}
          >
            Open related section
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Link
      to={href}
      className="group block rounded-2xl border border-yellow-500/15 bg-[#242424] p-4 transition-all duration-300 hover:border-yellow-400/40 hover:bg-[#2b2b2b]"
    >
      {cardBody}
    </Link>
  );
}
