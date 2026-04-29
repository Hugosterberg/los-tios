// @ts-nocheck
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const fmtMoney = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(value || 0);

const fmtNum = (value) => new Intl.NumberFormat("es-MX").format(value || 0);

function Row({ label, value, muted, emphasize }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-white/[0.06] py-2.5 text-sm last:border-0",
        muted && "text-gray-500",
        emphasize && "font-semibold text-white",
      )}
    >
      <span className="min-w-0 flex-1 leading-snug text-gray-400">{label}</span>
      <span className={cn("shrink-0 tabular-nums text-gray-100", emphasize && "text-yellow-100")}>{value}</span>
    </div>
  );
}

export default function KpiBreakdownDialog({ open, onOpenChange, title, filterSummary, breakdown }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] w-[calc(100vw-2rem)] max-w-2xl overflow-x-hidden overflow-y-auto border-yellow-500/20 bg-[#161616] text-gray-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-yellow-50">{title || "KPI details"}</DialogTitle>
          {filterSummary ? (
            <DialogDescription className="text-left text-xs leading-relaxed text-gray-500">
              {filterSummary}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-6 pt-1">
          {!breakdown ? (
            <p className="text-sm text-gray-500">Select a KPI card to inspect the calculation.</p>
          ) : null}
          {breakdown?.type === "net-sales" && (
            <>
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Sum by source</p>
                <div className="rounded-xl border border-yellow-500/10 bg-black/25 px-3">
                  <Row label="Loyverse (canonical receipts after dedupe)" value={fmtMoney(breakdown.loyverse)} />
                  <Row label="Clip (approved payments not removed as duplicate)" value={fmtMoney(breakdown.clip)} />
                  <Row label="Manual (Finance contributions in window)" value={fmtMoney(breakdown.manual)} />
                  <Row label="Net sales (sum)" value={fmtMoney(breakdown.total)} emphasize />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  Each line uses the same deduplicated pipeline as the card: same-amount events within the time window are
                  collapsed using your priority rule so Loyverse + Clip double-posts do not inflate totals.
                </p>
              </section>
              {breakdown.eventRows?.length ? (
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Included sales (newest first, max {fmtNum(breakdown.eventRows.length)} shown)
                  </p>
                  <div className="max-h-72 overflow-y-auto overflow-x-hidden rounded-lg border border-white/10">
                    <table className="w-full table-fixed text-left text-[11px]">
                      <thead className="sticky top-0 bg-[#1f1f1f] text-[10px] uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="px-2 py-1.5">Time</th>
                          <th className="px-2 py-1.5">Source</th>
                          <th className="px-2 py-1.5">Amount</th>
                          <th className="px-2 py-1.5">Pay</th>
                          <th className="px-2 py-1.5">Channel</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        {breakdown.eventRows.map((r, i) => (
                          <tr key={`${r.id}-${i}`} className="border-t border-white/5">
                            <td className="break-words px-2 py-1.5">{r.time}</td>
                            <td className="break-words px-2 py-1.5">{r.source}</td>
                            <td className="break-words px-2 py-1.5 tabular-nums">{r.amount}</td>
                            <td className="break-words px-2 py-1.5" title={r.payment}>
                              {r.payment}
                            </td>
                            <td className="break-words px-2 py-1.5" title={r.channel}>
                              {r.channel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <p className="text-[11px] text-gray-500">No included sales rows in the selected period.</p>
              )}
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Deduplication</p>
                <div className="rounded-xl border border-yellow-500/10 bg-black/25 px-3">
                  <Row
                    label="Pairs removed (current filters)"
                    value={fmtNum(breakdown.dedupeFilteredCount)}
                    emphasize
                  />
                  <Row label="Pairs removed (all sources / branches, same window)" value={fmtNum(breakdown.dedupeTotalCount)} muted />
                </div>
                {breakdown.dedupeRows?.length ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[11px] text-gray-500">
                      Sample matches (up to {breakdown.dedupeRows.length} of {fmtNum(breakdown.dedupeFilteredCount)} filtered)
                    </p>
                    <div className="max-h-48 overflow-y-auto overflow-x-hidden rounded-lg border border-white/10">
                      <table className="w-full table-fixed text-left text-[11px]">
                        <thead className="sticky top-0 bg-[#1f1f1f] text-[10px] uppercase tracking-wider text-gray-500">
                          <tr>
                            <th className="px-2 py-1.5">Removed</th>
                            <th className="px-2 py-1.5">Kept</th>
                            <th className="px-2 py-1.5">Amount</th>
                            <th className="px-2 py-1.5">Window</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-300">
                          {breakdown.dedupeRows.map((r) => (
                            <tr key={r.id} className="border-t border-white/5">
                              <td className="break-words px-2 py-1.5">{r.removed_source}</td>
                              <td className="break-words px-2 py-1.5">{r.kept_source}</td>
                              <td className="break-words px-2 py-1.5 tabular-nums">{r.amount}</td>
                              <td className="break-words px-2 py-1.5">{r.matched_window}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-gray-500">No duplicate pairs matched the current filters.</p>
                )}
              </section>
            </>
          )}

          {breakdown?.type === "orders-count" && (
            <>
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">How the count is built</p>
                <div className="rounded-xl border border-yellow-500/10 bg-black/25 px-3">
                  <Row label="Total canonical sale events" value={fmtNum(breakdown.total)} emphasize />
                  <Row label="Of which · Loyverse" value={fmtNum(breakdown.bySource.loyverse)} />
                  <Row label="Of which · Clip" value={fmtNum(breakdown.bySource.clip)} />
                  <Row label="Of which · Manual" value={fmtNum(breakdown.bySource.manual)} />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  This is <strong className="font-medium text-gray-400">not</strong> the Order module row count — it is one row
                  per deduplicated payment/receipt event in the merged sales pipeline (aligned with Net Sales / AOV).
                </p>
              </section>
              {breakdown.eventRows?.length ? (
                <section>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                    Events (newest first, max {fmtNum(breakdown.eventRows.length)} shown)
                  </p>
                  <div className="max-h-56 overflow-y-auto overflow-x-hidden rounded-lg border border-white/10">
                    <table className="w-full table-fixed text-left text-[11px]">
                      <thead className="sticky top-0 bg-[#1f1f1f] text-[10px] uppercase tracking-wider text-gray-500">
                        <tr>
                          <th className="px-2 py-1.5">Time</th>
                          <th className="px-2 py-1.5">Src</th>
                          <th className="px-2 py-1.5">Amount</th>
                          <th className="px-2 py-1.5">Pay</th>
                          <th className="px-2 py-1.5">Id</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-300">
                        {breakdown.eventRows.map((r, i) => (
                          <tr key={`${r.id}-${i}`} className="border-t border-white/5">
                            <td className="break-words px-2 py-1.5">{r.time}</td>
                            <td className="break-words px-2 py-1.5">{r.source}</td>
                            <td className="break-words px-2 py-1.5 tabular-nums">{r.amount}</td>
                            <td className="break-words px-2 py-1.5" title={r.payment}>
                              {r.payment}
                            </td>
                            <td className="break-all px-2 py-1.5 font-mono text-[10px]" title={r.id}>
                              {r.id}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          )}

          {breakdown?.type === "average-order-value" && (
            <section>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Formula</p>
              <div className="rounded-xl border border-yellow-500/10 bg-black/25 px-3">
                <Row label="Sum of canonical sale amounts" value={fmtMoney(breakdown.sumAmounts)} />
                <Row label="÷ Event count" value={fmtNum(breakdown.count)} />
                <Row label="Average order value" value={fmtMoney(breakdown.aov)} emphasize />
              </div>
              <div className="mt-3 rounded-xl border border-yellow-500/10 bg-black/25 px-3">
                <p className="py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Average by source</p>
                <Row label="Loyverse (avg)" value={breakdown.avgLoyverse != null ? fmtMoney(breakdown.avgLoyverse) : "—"} />
                <Row label="Clip (avg)" value={breakdown.avgClip != null ? fmtMoney(breakdown.avgClip) : "—"} />
                <Row label="Manual (avg)" value={breakdown.avgManual != null ? fmtMoney(breakdown.avgManual) : "—"} />
              </div>
            </section>
          )}

          {breakdown?.type === "gross-profit" && (
            <>
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Revenue base</p>
                <div className="rounded-xl border border-yellow-500/10 bg-black/25 px-3">
                  <Row label={breakdown.revenueLabel} value={fmtMoney(breakdown.grossSales)} emphasize />
                </div>
                <p className="mt-2 text-[11px] text-gray-500">{breakdown.revenueNote}</p>
              </section>
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">Ingredient cost</p>
                <div className="rounded-xl border border-yellow-500/10 bg-black/25 px-3">
                  {breakdown.lines.map((line, i) => (
                    <Row key={i} label={line.label} value={line.value} muted={line.muted} emphasize={line.emphasize} />
                  ))}
                  <Row label="Gross profit" value={fmtMoney(breakdown.grossProfit)} emphasize />
                </div>
                {breakdown.isEstimated ? (
                  <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
                    {breakdown.estimateNote}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                  Gross profit uses the <strong className="font-medium text-gray-400">Finance / receipt gross</strong> revenue
                  base, not the deduplicated Net Sales card — so it can differ from Net Sales when Clip and Loyverse overlap.
                </p>
              </section>
            </>
          )}

          {breakdown?.type === "generic" && (
            <section>
              <div className="rounded-xl border border-yellow-500/10 bg-black/25 px-3">
                {breakdown.lines?.map((line, i) => (
                  <Row key={i} label={line.label} value={line.value} muted={line.muted} emphasize={line.emphasize} />
                ))}
              </div>
              {breakdown.note ? <p className="mt-3 text-[11px] leading-relaxed text-gray-500">{breakdown.note}</p> : null}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
