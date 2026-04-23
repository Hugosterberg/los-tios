export const DASHBOARD_SOURCE_META = {
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
    label: "Limited data",
    tone: "border-yellow-400/20 bg-yellow-400/10 text-yellow-200",
  },
  live: {
    label: "Live data",
    tone: "border-yellow-400/25 bg-yellow-400/10 text-yellow-100",
  },
};

export function getDashboardSourceMeta(source = "mock") {
  return DASHBOARD_SOURCE_META[source] || DASHBOARD_SOURCE_META.mock;
}
