import { createPageUrl } from "@/utils";

const detailHref = (view) => `${createPageUrl("ManagementInsight")}?view=${view}`;

export const filterOptions = {
  dateRanges: ["1 day", "7 days", "1 month", "All history"],
  branches: ["All branches", "Centro"],
  salesChannels: ["All channels", "Dine-in", "Pickup", "Delivery app", "Direct web"],
  paymentSources: ["All sources", "Cash", "Card", "Clip", "Online", "Bank transfer"],
  shifts: ["All shifts", "Lunch", "Dinner", "Closing"],
};

export const executiveKpis = [
  { id: "gross-sales", label: "Gross Sales", value: "MXN 0", delta: "+0.0%", trend: "up", comparisonLabel: "vs same day last week", sparkTone: "positive", sparkline: [0, 0, 0, 0, 0, 0, 0], href: detailHref("gross-sales") },
  { id: "net-sales", label: "Net Sales", value: "MXN 0", delta: "+0.0%", trend: "up", comparisonLabel: "after discounts, refunds, taxes", sparkTone: "positive", sparkline: [0, 0, 0, 0, 0, 0, 0], href: detailHref("net-sales") },
  { id: "orders-count", label: "Orders Count", value: "1,246", delta: "+11.2%", trend: "up", comparisonLabel: "growth led by direct pickup", sparkTone: "positive", sparkline: [820, 860, 910, 998, 1084, 1174, 1246], href: detailHref("orders-count") },
  { id: "average-order-value", label: "Average Order Value", value: "MXN 0", delta: "0.0%", trend: "down", comparisonLabel: "mix shift toward lunch combos", sparkTone: "negative", sparkline: [0, 0, 0, 0, 0, 0, 0], href: detailHref("average-order-value") },
  { id: "gross-profit", label: "Gross Profit", value: "MXN 0", delta: "+0.0%", trend: "up", comparisonLabel: "better margin on direct channels", sparkTone: "positive", sparkline: [0, 0, 0, 0, 0, 0, 0], href: detailHref("gross-profit") },
  { id: "net-profit", label: "Net Profit", value: "MXN 0", delta: "0.0%", trend: "down", comparisonLabel: "pressured by labor and fee load", sparkTone: "negative", sparkline: [0, 0, 0, 0, 0, 0, 0], href: detailHref("net-profit") },
  { id: "food-cost", label: "Food Cost %", value: "28.4%", delta: "+1.1 pts", trend: "down", comparisonLabel: "above target by 1.4 pts", sparkTone: "negative", sparkline: [25.2, 25.8, 26.1, 26.9, 27.5, 28.1, 28.4], href: detailHref("food-cost") },
  { id: "labor-cost", label: "Labor Cost %", value: "18.7%", delta: "+0.8 pts", trend: "down", comparisonLabel: "overtime on dinner close", sparkTone: "negative", sparkline: [16.8, 17.0, 17.3, 17.8, 18.0, 18.4, 18.7], href: detailHref("labor-cost") },
  { id: "open-anomalies", label: "Open Anomalies", value: "12", delta: "+3", trend: "down", comparisonLabel: "6 need owner action today", sparkTone: "negative", sparkline: [4, 5, 6, 7, 8, 9, 12], href: detailHref("alerts-exceptions") },
];

export const liveOperations = [
  { id: "active-orders", label: "Active Orders", value: "37", tone: "text-white", subtext: "12 dine-in, 15 pickup, 10 delivery", href: detailHref("live-operations") },
  { id: "delayed-orders", label: "Delayed Orders", value: "6", tone: "text-amber-300", subtext: "4 over SLA by 10+ min", href: detailHref("live-operations") },
  { id: "avg-prep-time", label: "Average Prep Time", value: "17 min", tone: "text-white", subtext: "Target 14 min", href: detailHref("live-operations") },
  { id: "orders-in-kitchen", label: "Orders In Kitchen", value: "19", tone: "text-white", subtext: "5 in pizza oven queue", href: detailHref("live-operations") },
  { id: "out-for-delivery", label: "Out For Delivery", value: "10", tone: "text-yellow-300", subtext: "Median ETA 21 min", href: detailHref("live-operations") },
  { id: "reservations", label: "Reservations Today", value: "42", tone: "text-white", subtext: "9 VIP tables tonight", href: detailHref("live-operations") },
  { id: "refunds", label: "Refund Count Today", value: "8", tone: "text-rose-300", subtext: "2 tied to duplicate charges", href: detailHref("payments-reconciliation") },
  { id: "cancelled", label: "Cancelled Orders", value: "14", tone: "text-amber-300", subtext: "Spike on marketplace channel", href: detailHref("alerts-exceptions") },
];

export const revenue7Days = [
  { day: "Wed", revenue: 22800, orders: 154 },
  { day: "Thu", revenue: 23620, orders: 168 },
  { day: "Fri", revenue: 28110, orders: 194 },
  { day: "Sat", revenue: 32640, orders: 236 },
  { day: "Sun", revenue: 30410, orders: 216 },
  { day: "Mon", revenue: 19860, orders: 142 },
  { day: "Tue", revenue: 24820, orders: 176 },
];

export const revenue30Days = [
  { window: "Week 1", revenue: 146200, target: 140000 },
  { window: "Week 2", revenue: 151860, target: 145000 },
  { window: "Week 3", revenue: 155420, target: 148000 },
  { window: "Week 4", revenue: 162900, target: 152000 },
];

export const ordersByHourToday = [
  { hour: "10", orders: 6 },
  { hour: "11", orders: 14 },
  { hour: "12", orders: 21 },
  { hour: "13", orders: 28 },
  { hour: "14", orders: 24 },
  { hour: "15", orders: 17 },
  { hour: "16", orders: 12 },
  { hour: "17", orders: 18 },
  { hour: "18", orders: 27 },
  { hour: "19", orders: 34 },
  { hour: "20", orders: 31 },
  { hour: "21", orders: 25 },
];

export const salesByChannel = [
  { name: "Direct web", value: 48200, fill: "#fbbf24" },
  { name: "Dine-in", value: 44600, fill: "#fb7185" },
  { name: "Pickup", value: 38140, fill: "#38bdf8" },
  { name: "Delivery app", value: 53320, fill: "#4ade80" },
];

export const averageOrderValueTrend = [
  { period: "Week 1", aov: 146 },
  { period: "Week 2", aov: 143 },
  { period: "Week 3", aov: 141 },
  { period: "Week 4", aov: 138 },
];

export const productPerformance = {
  bestSelling: [
    { id: "prod-1", product: "Pepperoni Suprema", units: 0, revenue: "MXN 0", margin: "42%", href: detailHref("products") },
    { id: "prod-2", product: "4 Quesos Familiar", units: 0, revenue: "MXN 0", margin: "46%", href: detailHref("products") },
    { id: "prod-3", product: "Calzone Tios", units: 0, revenue: "MXN 0", margin: "39%", href: detailHref("products") },
  ],
  highestMargin: [
    { id: "prod-4", product: "Limonada de la Casa", units: 0, revenue: "MXN 0", margin: "74%", href: detailHref("products") },
    { id: "prod-5", product: "Brownie con Helado", units: 0, revenue: "MXN 0", margin: "71%", href: detailHref("products") },
    { id: "prod-6", product: "Pan de Ajo Premium", units: 0, revenue: "MXN 0", margin: "69%", href: detailHref("products") },
  ],
  worstPerforming: [
    { id: "prod-7", product: "Pasta Alfredo", units: 0, revenue: "MXN 0", margin: "18%", href: detailHref("products") },
    { id: "prod-8", product: "Pizza Veggie XL", units: 0, revenue: "MXN 0", margin: "16%", href: detailHref("products") },
    { id: "prod-9", product: "Tiramisu Slice", units: 0, revenue: "MXN 0", margin: "12%", href: detailHref("products") },
  ],
};

export const paymentSummary = [
  { label: "Total Received Today", value: "MXN 0", subtext: "Across Clip, cash, bank, online" },
  { label: "Pending Settlements", value: "MXN 0", subtext: "Clip + marketplace remittances" },
  { label: "Settled Amounts", value: "MXN 0", subtext: "Reconciled to bank deposits" },
  { label: "Refunds", value: "MXN 0", subtext: "3.0% of paid volume" },
  { label: "Payment Fees", value: "MXN 0", subtext: "1.9% blended fee load" },
];

export const cashVsCard = [
  { source: "Cash", amount: 14220 },
  { source: "Card", amount: 27110 },
  { source: "Online", amount: 11540 },
  { source: "Bank transfer", amount: 9560 },
];

export const reconciliationRows = [
  { id: "recon-1", source_system: "Loyverse POS", expected_amount: "MXN 0", actual_amount: "MXN 0", difference: "MXN 0", status: "Mismatch", last_sync_time: "16:12" },
  { id: "recon-2", source_system: "Clip processor", expected_amount: "MXN 0", actual_amount: "MXN 0", difference: "MXN 0", status: "Matched", last_sync_time: "16:15" },
  { id: "recon-3", source_system: "Revolut bank", expected_amount: "MXN 0", actual_amount: "MXN 0", difference: "MXN 0", status: "Review", last_sync_time: "16:08" },
  { id: "recon-4", source_system: "Marketplace payouts", expected_amount: "MXN 0", actual_amount: "MXN 0", difference: "MXN 0", status: "Pending", last_sync_time: "15:50" },
];

export const costsSummary = [
  { label: "Ingredient Cost Today", value: "MXN 0", delta: "+0.0% vs budget" },
  { label: "Ingredient Cost This Week", value: "MXN 0", delta: "+0.0% vs budget" },
  { label: "Ingredient Cost This Month", value: "MXN 0", delta: "+0.0% vs budget" },
  { label: "Food Cost %", value: "28.4%", delta: "Target 27.0%" },
  { label: "Labor Cost Today", value: "MXN 0", delta: "+0.0% vs budget" },
  { label: "Labor Cost This Week", value: "MXN 0", delta: "+0.0% vs budget" },
  { label: "Labor Cost This Month", value: "MXN 0", delta: "+0.0% vs budget" },
  { label: "Labor Cost %", value: "18.7%", delta: "Target 18.0%" },
  { label: "Payment Processing Fees", value: "MXN 0", delta: "0.0% blended" },
  { label: "Delivery Platform Fees", value: "MXN 0", delta: "0.0% of app sales" },
  { label: "Fixed Costs", value: "MXN 0", delta: "Rent, utilities, software" },
  { label: "Other Operating Expenses", value: "MXN 0", delta: "Repairs + packaging" },
  { label: "Cost Per Order", value: "MXN 0", delta: "+MXN 0 vs target" },
];

export const costTrendVsBudget = [
  { month: "Jan", actual: 62, budget: 58 },
  { month: "Feb", actual: 61, budget: 59 },
  { month: "Mar", actual: 65, budget: 60 },
  { month: "Apr", actual: 67, budget: 61 },
];

export const inventoryInsights = {
  lowStock: [
    { id: "inv-1", ingredient: "Mozzarella premium", branch: "Zona 10", level: "18 kg", days_remaining: "2.1 days", status: "Low" },
    { id: "inv-2", ingredient: "Pepperoni", branch: "Cayala", level: "9 kg", days_remaining: "1.4 days", status: "Critical" },
    { id: "inv-3", ingredient: "Tomato sauce base", branch: "Roosevelt", level: "24 L", days_remaining: "3.8 days", status: "Low" },
  ],
  purchases: [
    { id: "pur-1", supplier: "Quesos del Norte", item: "Mozzarella premium", cost: "MXN 0", received: "Today 10:15" },
    { id: "pur-2", supplier: "Carnes Roma", item: "Pepperoni", cost: "MXN 0", received: "Today 09:20" },
    { id: "pur-3", supplier: "Agro Verde", item: "Basil + vegetables", cost: "MXN 0", received: "Yesterday 18:40" },
  ],
  forecast: [
    { id: "for-1", ingredient: "Mozzarella premium", risk: "Shortage Friday dinner", action: "Advance PO by 1 day" },
    { id: "for-2", ingredient: "Pepperoni", risk: "Shortage within 34 hours", action: "Transfer 4 kg from Zona 10" },
    { id: "for-3", ingredient: "Cardboard pizza boxes", risk: "Packaging stockout Sunday", action: "Confirm supplier backup" },
  ],
};

export const staffMetrics = [
  { label: "Total Worked Hours", value: "412 h", detail: "Across all branches this week" },
  { label: "Sales Per Labor Hour", value: "MXN 0", detail: "Target MXN 0" },
  { label: "Labor Cost Per Shift", value: "MXN 0", detail: "Dinner shift is highest" },
  { label: "Current Shift Staffing", value: "26 staff", detail: "2 absences, 1 open role" },
  { label: "Overtime Alerts", value: "5", detail: "3 kitchen, 2 delivery" },
];

export const laborEfficiencyTrend = [
  { period: "Lunch", efficiency: 468 },
  { period: "Afternoon", efficiency: 402 },
  { period: "Dinner", efficiency: 389 },
  { period: "Late", efficiency: 346 },
];

export const alerts = [
  { id: "alert-1", severity: "critical", summary: "Payment mismatch between Loyverse sales and Revolut deposits.", suggestedAction: "Review three unlinked transactions and verify settlement cutoff mapping before close.", timestamp: "Today, 16:14", status: "new", owner: "Finance manager", href: detailHref("payments-reconciliation") },
  { id: "alert-2", severity: "high", summary: "Food cost % is 1.4 points above target at Zona 10.", suggestedAction: "Audit mozzarella usage variance and compare waste log against production volume.", timestamp: "Today, 15:36", status: "acknowledged", owner: "Operations", href: detailHref("costs") },
  { id: "alert-3", severity: "high", summary: "Pepperoni inventory will breach safety stock before Friday dinner.", suggestedAction: "Transfer stock from Zona 10 or place an emergency supplier order today.", timestamp: "Today, 14:58", status: "new", owner: "Supply chain", href: detailHref("inventory") },
  { id: "alert-4", severity: "medium", summary: "Refund rate on delivery app orders is trending 42% above baseline.", suggestedAction: "Review delay reason codes and driver handoff times for the last 24 hours.", timestamp: "Today, 13:22", status: "new", owner: "Customer success", href: detailHref("alerts-exceptions") },
];

export const suggestedPages = [
  { page: "Dashboard", purpose: "Executive control center with real-time KPIs, alerts, and cross-domain visibility." },
  { page: "ManagementInsight", purpose: "Drill-down page for finance, ops, products, labor, and reconciliation detail." },
  { page: "Orders", purpose: "Operational order queue and customer-level order review." },
  { page: "Finance", purpose: "Expense ledger, budgets, fees, and margin reporting." },
  { page: "Integrations", purpose: "Provider health, sync state, credentials, and audit logs." },
  { page: "EmployeeCalendar", purpose: "Scheduling, shifts, attendance, and labor planning." },
];

export const suggestedComponents = [
  "FilterBar",
  "KpiCard",
  "DashboardPanel",
  "TrendChartCard",
  "AlertFeed",
  "InsightTable",
  "ReconciliationStatusBadge",
  "EmptyState",
  "ErrorState",
  "LoadingSkeleton",
];

export const domainModels = [
  { entity: "Order", fields: ["id", "source", "branchId", "channel", "status", "grossSales", "netSales", "tax", "discounts", "refundAmount", "createdAt", "closedAt"] },
  { entity: "Payment", fields: ["id", "orderId", "source", "providerReference", "method", "status", "grossAmount", "feeAmount", "netAmount", "processedAt", "settlementBatchId"] },
  { entity: "Settlement", fields: ["id", "source", "currency", "expectedAmount", "actualAmount", "differenceAmount", "status", "bankTransactionId", "settledAt", "lastSyncedAt"] },
  { entity: "Refund", fields: ["id", "orderId", "paymentId", "source", "reasonCode", "amount", "status", "createdAt", "resolvedAt"] },
  { entity: "Product", fields: ["id", "sourceProductId", "name", "categoryId", "listPrice", "standardCost", "marginPct", "isActive", "updatedAt"] },
  { entity: "Expense", fields: ["id", "source", "expenseType", "vendor", "branchId", "amount", "postedAt", "glCode", "notes"] },
  { entity: "InventoryMovement", fields: ["id", "ingredientId", "branchId", "movementType", "quantity", "unitCost", "sourceDocumentId", "occurredAt"] },
  { entity: "StaffShift", fields: ["id", "employeeId", "branchId", "role", "scheduledStart", "scheduledEnd", "actualStart", "actualEnd", "hoursWorked", "laborCost"] },
  { entity: "Alert", fields: ["id", "type", "severity", "summary", "status", "owner", "detectedAt", "suggestedAction", "contextRef"] },
];

export const apiContracts = [
  {
    endpoint: "GET /api/dashboard/overview",
    purpose: "Returns KPI summaries, live widgets, alert counts, and high-level trend cards.",
    sample: `{
  "filters": { "branchId": "all", "dateRange": "last_30_days", "comparisonMode": "last_week" },
  "kpis": [{ "id": "gross-sales", "value": 184260, "deltaPct": 8.4, "trend": "up" }],
  "liveOperations": [{ "id": "active-orders", "value": 37 }],
  "alerts": [{ "id": "alert-1", "severity": "critical", "status": "new" }],
  "lastUpdatedAt": "2026-04-07T22:14:00Z"
}`,
  },
  {
    endpoint: "GET /api/reconciliation/status",
    purpose: "Returns source-by-source expected vs actual payment, settlement, and bank totals.",
    sample: `{
  "rows": [{
    "sourceSystem": "clip",
    "expectedAmount": 27110,
    "actualAmount": 27110,
    "differenceAmount": 0,
    "status": "matched",
    "lastSyncTime": "2026-04-07T22:15:00Z"
  }]
}`,
  },
  {
    endpoint: "POST /api/integrations/:provider/sync",
    purpose: "Triggers a sync job for Loyverse, Clip, or Revolut and records a sync log entry.",
    sample: `{
  "provider": "clip",
  "mode": "incremental",
  "requestedBy": "owner@lostios.com"
}`,
  },
  {
    endpoint: "GET /api/alerts",
    purpose: "Returns active and historical anomalies with severity, ownership, and resolution metadata.",
    sample: `{
  "items": [{
    "id": "alert-3",
    "type": "inventory_shortage",
    "severity": "high",
    "status": "acknowledged",
    "suggestedAction": "Transfer stock from alternate branch"
  }]
}`,
  },
];

export const integrationBlueprint = [
  { provider: "Loyverse", ingest: ["orders", "order_items", "discounts", "refunds", "products", "categories", "employees", "inventory"], mapTo: ["orders", "refunds", "products", "inventory movements", "staff shifts"], todo: "Add incremental cursor sync per location and preserve source line-item ids for audit trails." },
  { provider: "Clip", ingest: ["payments", "payment_status", "fees", "refunds", "settlements"], mapTo: ["payments", "refunds", "settlements", "alerts"], todo: "Normalize settlement windows and separate processor fees from refund fees." },
  { provider: "Revolut", ingest: ["bank_transactions", "payouts", "incoming_transfers", "outgoing_payments", "balances"], mapTo: ["settlements", "expenses", "payments", "alerts"], todo: "Implement payout matching and balance snapshot history for daily close reporting." },
];

export const syncArchitectureNotes = [
  "Use modular clients per provider under src/api or server-side functions with a shared mapping layer.",
  "Persist sync logs with provider, startedAt, finishedAt, cursor, row counts, warnings, and error payloads.",
  "Retry transient provider failures with exponential backoff and mark partial syncs for reconciliation follow-up.",
  "Store lastSyncedAt at provider and entity-granularity so live widgets can declare data freshness clearly.",
  "Keep immutable finance event records for payments, settlements, refunds, and bank transactions to support audits.",
];

export const detailViews = {
  "gross-sales": { title: "Gross Sales Detail", summary: "Gross sales are running ahead of the prior comparable period, with delivery apps and direct web carrying most of the lift.", focusMetrics: [{ label: "Today", value: "MXN 0" }, { label: "Yesterday", value: "MXN 0" }, { label: "Same Day Last Week", value: "MXN 0" }] },
  "net-sales": { title: "Net Sales Detail", summary: "Net sales stayed positive after discount pressure, but refunds and channel fees are narrowing realized revenue.", focusMetrics: [{ label: "Net Sales", value: "MXN 0" }, { label: "Discount Load", value: "MXN 0" }, { label: "Refund Load", value: "MXN 0" }] },
  "payments-reconciliation": { title: "Payments & Reconciliation", summary: "One unmatched difference is currently open between POS close and bank-recorded deposits.", focusMetrics: [{ label: "Open Mismatches", value: "2" }, { label: "Pending Settlements", value: "MXN 0" }, { label: "Unlinked Txns", value: "3" }] },
  costs: { title: "Cost Control", summary: "Food and labor are both above target, with dinner staffing and cheese variance as the main sources of pressure.", focusMetrics: [{ label: "Food Cost %", value: "28.4%" }, { label: "Labor Cost %", value: "18.7%" }, { label: "Cost / Order", value: "MXN 0" }] },
  inventory: { title: "Inventory Risk", summary: "Two ingredients are below safety stock and one packaging item is forecast to run short before the weekend peak.", focusMetrics: [{ label: "Critical Items", value: "2" }, { label: "Low Stock Items", value: "7" }, { label: "Forecasted Shortages", value: "3" }] },
  "alerts-exceptions": { title: "Alerts & Exceptions", summary: "The management queue contains payment, food cost, inventory, and refund-rate anomalies needing action.", focusMetrics: [{ label: "Critical", value: "1" }, { label: "High", value: "2" }, { label: "Medium", value: "1" }] },
  "live-operations": { title: "Live Operations", summary: "Operational flow is healthy overall, but prep-time slippage is starting to affect refunds and cancellation risk.", focusMetrics: [{ label: "Active Orders", value: "37" }, { label: "Delayed Orders", value: "6" }, { label: "Avg Prep", value: "17 min" }] },
  products: { title: "Product Mix", summary: "High-volume pizzas still lead sales, while beverage and dessert items carry the strongest margins.", focusMetrics: [{ label: "Best Seller", value: "Pepperoni Suprema" }, { label: "Best Margin", value: "Limonada de la Casa" }, { label: "Weakest Item", value: "Tiramisu Slice" }] },
};
