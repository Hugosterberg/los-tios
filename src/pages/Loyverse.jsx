import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { AlertTriangle, BadgePercent, CircleDollarSign, Cpu, ExternalLink, Layers3, Link2, Package, PencilLine, Receipt, RefreshCw, ScanLine, ShoppingBag, Store, Table2, Tag, Users, UtensilsCrossed } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { getLoyverseOverview, hasLoyverseApiConfig, LOYVERSE_API_BASE_URL, saveLoyverseItemModifierAssignments } from "@/api/loyverse";
import { appParams } from "@/lib/app-params";
import { getResolvedIntegrationSettings } from "@/lib/integrationSettings";
import { listOrders } from "@/lib/local-dev-orders";

const formatCurrency = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value || 0);
const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value || 0);
const formatRelativeDate = (value) => value ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: enUS }) : "Unknown time";
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "N/A";
const getReceiptId = (receipt) => receipt.receipt_number || receipt.receipt_no || receipt.id || "Unknown";
const getReceiptStatus = (receipt) => (receipt.status || receipt.receipt_status || (receipt.canceled_at ? "cancelled" : "completed")).toLowerCase();
const statusBadgeClass = (active) => active ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15" : "bg-gray-500/15 text-gray-300 hover:bg-gray-500/15";
const ACTIVE_ORDER_STATUSES = ["pending", "preparing", "ready", "out_for_delivery"];
const TABLE_NUMBERS = new Set(["1", "2", "3", "4", "5", "6"]);

function normalizeTableNumber(value) {
  if (value === null || value === undefined) return "";
  const match = String(value).match(/\d+/);
  return match ? match[0] : String(value).trim();
}

function getReceiptTotal(receipt) {
  const candidate = receipt.total_money ?? receipt.total_payment_money ?? receipt.total;
  if (typeof candidate === "number") return candidate;
  if (typeof candidate === "string") return Number(candidate) || 0;
  if (candidate && typeof candidate === "object") return Number(candidate.amount ?? candidate.value) || 0;
  return 0;
}

function getPlainTextFromHtml(value) {
  if (!value) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const parsed = new DOMParser().parseFromString(String(value), "text/html");
  return parsed.body.textContent?.replace(/\s+/g, " ").trim() || "";
}

function MetricCard({ label, value, icon: Icon, hint }) {
  return <Card className="border-yellow-500/20 bg-[#242424] text-white"><CardContent className="p-4"><div className="mb-2 flex items-center justify-between"><p className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</p><Icon className="h-4 w-4 text-yellow-400" /></div><p className="text-2xl font-bold text-yellow-400">{value}</p>{hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}</CardContent></Card>;
}

function InfoTile({ label, value, subvalue }) {
  return <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-xl font-bold text-yellow-400">{value}</p>{subvalue ? <p className="mt-1 text-xs text-gray-400">{subvalue}</p> : null}</div>;
}

function ListShell({ title, icon: Icon, children, description }) {
  return <Card className="flex h-full flex-col border-yellow-500/20 bg-[#242424] text-white"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base text-yellow-400"><Icon className="h-4 w-4" />{title}</CardTitle>{description ? <p className="text-sm text-gray-400">{description}</p> : null}</CardHeader><CardContent className="flex-1 space-y-3 p-4">{children}</CardContent></Card>;
}

function EmptyState({ children }) {
  return <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-5 text-sm text-gray-400">{children}</div>;
}

function ItemModifierDialog({ item, modifiers, selectedModifierIds, onModifierToggle, onSave, saving, onOpenChange }) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={onOpenChange}>
      <DialogContent className="border-yellow-500/20 bg-[#242424] text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-yellow-400">Manage modifiers for {item?.item_name || item?.name || "item"}</DialogTitle>
          <DialogDescription className="text-gray-400">The Loyverse API is read-only for item updates here, so assignments are stored locally in this admin app.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {modifiers.length === 0 ? <EmptyState>No modifiers are available in Loyverse yet.</EmptyState> : modifiers.map((modifier) => (
            <label key={modifier.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 transition-colors hover:border-yellow-500/30">
              <Checkbox checked={selectedModifierIds.includes(modifier.id)} onCheckedChange={() => onModifierToggle(modifier.id)} className="mt-0.5 border-yellow-500/40 data-[state=checked]:border-yellow-400 data-[state=checked]:bg-yellow-400 data-[state=checked]:text-black" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">{modifier.name || "Unnamed modifier"}</p>
                  <Badge className="bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15">{formatNumber(modifier.optionsCount)} options</Badge>
                </div>
                {modifier.modifier_options?.length ? <div className="mt-2 flex flex-wrap gap-2">{modifier.modifier_options.map((option) => <Badge key={option.id} className="bg-black/30 text-gray-200 hover:bg-black/30">{option.name}</Badge>)}</div> : <p className="mt-2 text-xs text-gray-500">No options in this modifier group.</p>}
              </div>
            </label>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <p className="text-sm text-gray-400">{selectedModifierIds.length} modifier groups selected</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-yellow-500/30 bg-transparent text-yellow-300 hover:bg-yellow-400/10 hover:text-yellow-200">Cancel</Button>
            <Button type="button" onClick={onSave} disabled={saving} className="bg-yellow-400 text-black hover:bg-yellow-300">{saving ? "Saving..." : "Save modifiers"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Loyverse() {
  const isLocalOnlyMode =
    import.meta.env.DEV &&
    (import.meta.env.VITE_LOCAL_DEV_BYPASS_AUTH === "true" || !appParams.appId || !appParams.serverUrl);
  const { data: settings = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !isLocalOnlyMode,
  });
  const appSettings = React.useMemo(() => getResolvedIntegrationSettings(settings[0] || {}), [settings]);
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = React.useState(null);
  const [selectedModifierIds, setSelectedModifierIds] = React.useState([]);
  const overviewQuery = useQuery({ queryKey: ["loyverseOverview", settings[0]?.id || "none"], queryFn: () => getLoyverseOverview(appSettings), enabled: hasLoyverseApiConfig(appSettings), staleTime: 60_000 });
  const appOrdersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), "-created_date"),
  });
  const saveModifierAssignments = useMutation({
    mutationFn: ({ itemId, modifierIds }) => saveLoyverseItemModifierAssignments(itemId, modifierIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyverseOverview"] });
      toast({ title: "Modifiers updated", description: "The modifier links were saved locally and merged into the Loyverse item list." });
      setSelectedItem(null);
      setSelectedModifierIds([]);
    },
  });

  const overview = overviewQuery.data;
  const latestReceipts = overview?.receipts?.slice(0, 8) || [];
  const latestItems = overview?.items?.slice(0, 8) || [];
  const latestCustomers = overview?.customers?.slice(0, 6) || [];
  const topCategories = overview?.categories?.slice(0, 6) || [];
  const topModifiers = overview?.modifiers?.slice(0, 6) || [];
  const topDiscounts = overview?.discounts?.slice(0, 6) || [];
  const allModifiers = overview?.modifiers || [];
  const allItems = overview?.items || [];
  const appOrders = appOrdersQuery.data || [];
  const activeTableOrders = appOrders.filter((order) => {
    const normalizedTable = normalizeTableNumber(order.table_number);
    return order.order_type === "dine-in" && TABLE_NUMBERS.has(normalizedTable) && ACTIVE_ORDER_STATUSES.includes(order.status);
  });
  const tableHistory = appOrders
    .filter((order) => {
      const normalizedTable = normalizeTableNumber(order.table_number);
      return order.order_type === "dine-in" && TABLE_NUMBERS.has(normalizedTable) && order.status === "delivered";
    })
    .sort((a, b) => new Date(b.updated_date || b.created_date).getTime() - new Date(a.updated_date || a.created_date).getTime())
    .slice(0, 8);
  const incomingOrders = appOrders.slice(0, 10);

  const openModifierDialog = React.useCallback((item) => { setSelectedItem(item); setSelectedModifierIds(item.modifier_ids || []); }, []);
  const handleModifierToggle = React.useCallback((modifierId) => setSelectedModifierIds((current) => current.includes(modifierId) ? current.filter((id) => id !== modifierId) : [...current, modifierId]), []);
  const handleSaveModifierAssignments = React.useCallback(() => {
    if (!selectedItem) return;
    saveModifierAssignments.mutate({ itemId: selectedItem.id, modifierIds: selectedModifierIds });
  }, [saveModifierAssignments, selectedItem, selectedModifierIds]);

  if (!hasLoyverseApiConfig(appSettings)) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <div className="border-b border-yellow-500/20 py-5"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex items-center gap-3"><Store className="h-6 w-6 text-yellow-400" /><div><h1 className="text-xl font-bold text-yellow-400">Loyverse Overview</h1><p className="text-xs text-gray-500">Official API connection</p></div></div></div></div>
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          <Card className="border-yellow-500/20 bg-[#242424] text-white">
            <CardHeader><CardTitle className="flex items-center gap-2 text-yellow-400"><AlertTriangle className="h-5 w-5" />Missing Loyverse token</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-300">
              <p>This page reads directly from the official Loyverse API. You can register the token in Settings or add it to<code className="ml-1 rounded bg-black/30 px-2 py-1 text-yellow-300">.env.local</code>.</p>
              <pre className="overflow-x-auto rounded-xl bg-[#111111] p-4 text-xs text-yellow-300">{`loyverse_api_token=your_loyverse_token\nloyverse_api_base_url=https://api.loyverse.com/v1.0\nor\nVITE_LOYVERSE_API_TOKEN=your_loyverse_token`}</pre>
              <p>The token is created in Loyverse Back Office under access tokens.</p>
              <div className="flex flex-wrap gap-3">
                <a href="https://help.loyverse.com/help/loyverse-api" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md bg-yellow-400 px-3 py-2 text-sm font-medium text-black hover:bg-yellow-300">Token setup<ExternalLink className="h-4 w-4" /></a>
                <a href="https://developer.loyverse.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md border border-yellow-500/30 px-3 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-400/10">API docs<ExternalLink className="h-4 w-4" /></a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="border-b border-yellow-500/20 py-5"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3"><Store className="h-6 w-6 text-yellow-400" /><div><h1 className="text-xl font-bold text-yellow-400">Loyverse Overview</h1><p className="text-xs text-gray-500">Live data from {overviewQuery.data?.config?.baseUrl || LOYVERSE_API_BASE_URL}</p></div></div><Button onClick={() => overviewQuery.refetch()} disabled={overviewQuery.isFetching} className="h-8 w-fit gap-2 bg-yellow-400 text-black hover:bg-yellow-300"><RefreshCw className={`h-4 w-4 ${overviewQuery.isFetching ? "animate-spin" : ""}`} />Refresh</Button></div></div></div>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {overviewQuery.isError ? <Card className="border-red-500/30 bg-[#242424] text-white"><CardContent className="flex items-start gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" /><div className="space-y-1"><p className="font-semibold text-red-400">Could not load Loyverse data</p><p className="text-sm text-gray-300">{overviewQuery.error.message}</p></div></CardContent></Card> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <MetricCard label="Stores" value={formatNumber(overview?.metrics?.storesCount)} icon={Store} hint={`${formatNumber(overview?.metrics?.posDevicesCount)} POS devices`} />
          <MetricCard label="Items" value={formatNumber(overview?.metrics?.itemsCount)} icon={Package} hint={`${formatNumber(overview?.metrics?.variantsCount)} total variants`} />
          <MetricCard label="Categories" value={formatNumber(overview?.metrics?.categoriesCount)} icon={Layers3} hint={`${formatNumber(overview?.metrics?.itemsWithoutCategoryCount)} uncategorized`} />
          <MetricCard label="Modifiers" value={formatNumber(overview?.metrics?.modifiersCount)} icon={UtensilsCrossed} hint={`${formatNumber(overview?.metrics?.modifierOptionsCount)} options`} />
          <MetricCard label="Discounts" value={formatNumber(overview?.metrics?.discountsCount)} icon={BadgePercent} hint={`${formatNumber(overview?.metrics?.taxesCount)} taxes`} />
          <MetricCard label="Customers" value={formatNumber(overview?.metrics?.customersCount)} icon={Users} hint={`${formatNumber(overview?.metrics?.activeCustomersCount)} with activity`} />
          <MetricCard label="Receipts" value={formatNumber(overview?.metrics?.receiptsCount)} icon={Receipt} hint={`${formatNumber(overview?.metrics?.completedReceiptsCount)} completed`} />
          <MetricCard label="Staff" value={formatNumber(overview?.metrics?.employeesCount)} icon={Cpu} hint={`${formatNumber(overview?.metrics?.ownerEmployeesCount)} owner account`} />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.25fr_1fr_1fr]">
          <ListShell title="Sales Snapshot" icon={CircleDollarSign} description="Receipt, customer, and revenue totals from the current API sync."><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><InfoTile label="Gross sales" value={formatCurrency(overview?.metrics?.grossSales)} subvalue={`${formatNumber(overview?.metrics?.completedReceiptsCount)} completed receipts`} /><InfoTile label="Customer lifetime spend" value={formatCurrency(overview?.metrics?.customerLifetimeValue)} subvalue={`${formatNumber(overview?.metrics?.customersCount)} synced customers`} /><InfoTile label="Cancelled receipts" value={formatNumber(overview?.metrics?.cancelledReceiptsCount)} subvalue={`${formatNumber(overview?.metrics?.receiptsCount)} total receipts`} /><InfoTile label="Open shifts" value={formatNumber(overview?.metrics?.shiftsCount)} subvalue="Returned by the shifts endpoint" /></div></ListShell>
          <ListShell title="Catalog Snapshot" icon={Tag} description="What the item catalog currently looks like in Loyverse."><div className="grid grid-cols-1 gap-4"><InfoTile label="Tracked stock items" value={formatNumber(overview?.metrics?.trackedStockItemsCount)} subvalue={`${formatNumber(overview?.metrics?.inventoryLevelsCount)} inventory level records`} /><InfoTile label="Items with variants" value={formatNumber(overview?.metrics?.itemsWithVariantsCount)} subvalue={`${formatNumber(overview?.metrics?.variantsCount)} variants across the catalog`} /><InfoTile label="Composite / production items" value={`${formatNumber(overview?.metrics?.compositeItemsCount)} / ${formatNumber(overview?.metrics?.productionItemsCount)}`} subvalue={`${formatNumber(overview?.metrics?.soldByWeightItemsCount)} sold by weight`} /></div></ListShell>
          <ListShell title="Sync Status" icon={ScanLine} description="Current connection state and what this dashboard can see."><div className="space-y-3 text-sm text-gray-300"><div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"><p className="text-xs text-gray-500">Last sync</p><p className="mt-1 font-medium">{overview?.metrics?.latestSyncAt ? formatRelativeDate(overview.metrics.latestSyncAt) : "Not synced yet"}</p><p className="mt-1 text-xs text-gray-500">{overview?.metrics?.latestSyncAt ? formatDateTime(overview.metrics.latestSyncAt) : null}</p></div><div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"><p className="text-xs text-gray-500">API coverage</p><p className="mt-1 font-medium">Stores, items, customers, receipts, categories, modifiers, discounts, taxes, employees, devices, shifts, and inventory levels</p></div><div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"><p className="text-xs text-gray-500">API mode</p><p className="mt-1 font-medium">Direct browser call with bearer token</p><p className="mt-1 text-xs text-gray-500">For production, move Loyverse calls behind a server-side proxy so the token stays private.</p></div></div></ListShell>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ListShell title="Categories" icon={Layers3} description="Click a category to see all items currently linked to it.">
            {overviewQuery.isLoading ? <EmptyState>Loading category data...</EmptyState> : null}
            {!overviewQuery.isLoading && topCategories.length === 0 ? <EmptyState>No categories returned by the API.</EmptyState> : null}
            {!overviewQuery.isLoading && topCategories.length > 0 ? (
              <Accordion type="single" collapsible className="space-y-3">
                {topCategories.map((category) => {
                  const categoryItems = allItems.filter((item) => item.category_id === category.id);

                  return (
                    <AccordionItem
                      key={category.id}
                      value={category.id}
                      className="overflow-hidden rounded-xl border border-yellow-500/10 bg-[#1a1a1a] px-0"
                    >
                      <AccordionTrigger className="px-4 py-4 hover:no-underline">
                        <div className="flex w-full flex-col gap-3 text-left md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white">{category.name || "Unnamed category"}</p>
                              {category.color ? (
                                <Badge className="bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15">{category.color}</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-gray-400">Created {formatDateTime(category.created_at)}</p>
                          </div>
                          <div className="mr-6 grid grid-cols-3 gap-6 text-left md:text-right">
                            <div>
                              <p className="text-xs text-gray-500">Items</p>
                              <p className="font-bold text-yellow-400">{formatNumber(category.itemsCount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Variants</p>
                              <p className="font-bold text-yellow-400">{formatNumber(category.variantsCount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Tracked</p>
                              <p className="font-bold text-yellow-400">{formatNumber(category.trackedStockItemsCount)}</p>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="border-t border-yellow-500/10 px-4 pb-4 pt-4">
                        {categoryItems.length === 0 ? (
                          <EmptyState>No items found in this category.</EmptyState>
                        ) : (
                          <div className="space-y-3">
                            {categoryItems.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-xl border border-yellow-500/10 bg-black/20 p-4"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-semibold text-white">{item.item_name || item.name || "Unnamed item"}</p>
                                      {item.track_stock ? (
                                        <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">track stock</Badge>
                                      ) : null}
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-gray-300">
                                      {getPlainTextFromHtml(item.description) || "No description yet."}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 text-left md:text-right">
                                    <div>
                                      <p className="text-xs text-gray-500">Variants</p>
                                      <p className="font-bold text-yellow-400">{formatNumber(item.variantsCount)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-500">Modifiers</p>
                                      <p className="font-bold text-yellow-400">{formatNumber(item.modifierLinksCount)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            ) : null}
          </ListShell>
          <ListShell title="Modifiers" icon={UtensilsCrossed} description="Modifier groups and how many options each one exposes.">{overviewQuery.isLoading ? <EmptyState>Loading modifier data...</EmptyState> : null}{!overviewQuery.isLoading && topModifiers.length === 0 ? <EmptyState>No modifiers returned by the API.</EmptyState> : null}{topModifiers.map((modifier) => <div key={modifier.id} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-white">{modifier.name || "Unnamed modifier"}</p><p className="mt-1 text-xs text-gray-400">{formatNumber(modifier.storesCount)} stores | updated {formatRelativeDate(modifier.updated_at || modifier.created_at)}</p></div><div className="text-left md:text-right"><p className="text-xs text-gray-500">Options</p><p className="text-lg font-bold text-yellow-400">{formatNumber(modifier.optionsCount)}</p></div></div>{modifier.modifier_options?.length ? <div className="mt-3 flex flex-wrap gap-2">{modifier.modifier_options.slice(0, 6).map((option) => <Badge key={option.id} className="bg-black/30 text-gray-200 hover:bg-black/30">{option.name}</Badge>)}</div> : null}</div>)}</ListShell>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <ListShell title="Discounts, Taxes & Devices" icon={BadgePercent} description="Promotions and hardware linked to the synced stores."><div className="space-y-3">{overviewQuery.isLoading ? <EmptyState>Loading discount and device data...</EmptyState> : null}{!overviewQuery.isLoading && topDiscounts.length === 0 ? <EmptyState>No discounts returned by the API.</EmptyState> : null}{topDiscounts.map((discount) => <div key={discount.id} className="flex flex-col gap-3 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold text-white">{discount.name || "Unnamed discount"}</p><Badge className="bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15">{discount.type || "unknown"}</Badge></div><p className="mt-1 text-xs text-gray-400">{formatNumber(discount.storesCount)} stores | created {formatDateTime(discount.created_at)}</p></div><div className="text-left md:text-right"><p className="text-xs text-gray-500">Value</p><p className="text-lg font-bold text-yellow-400">{discount.discount_percent != null ? `${discount.discount_percent}%` : formatCurrency(discount.amount)}</p></div></div>)}<div className="grid grid-cols-1 gap-3 md:grid-cols-2"><div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"><p className="text-xs text-gray-500">Taxes configured</p><p className="mt-1 text-xl font-bold text-yellow-400">{formatNumber(overview?.metrics?.taxesCount)}</p></div><div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"><p className="text-xs text-gray-500">Active POS devices</p><p className="mt-1 text-xl font-bold text-yellow-400">{formatNumber(overview?.metrics?.activePosDevicesCount)}</p></div></div>{overview?.posDevices?.map((device) => <div key={device.id} className="flex items-center justify-between rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"><div><p className="font-semibold text-white">{device.name || "Unnamed device"}</p><p className="mt-1 text-xs text-gray-400">{device.store?.name || device.store_id || "Unknown store"}</p></div><Badge className={statusBadgeClass(device.activated)}>{device.activated ? "active" : "inactive"}</Badge></div>)}</div></ListShell>
          <ListShell title="Stores & Team" icon={Store} description="Store records and employee assignments currently visible through the API."><div className="space-y-3">{overview?.stores?.map((store) => <div key={store.id} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-white">{store.name || "Unnamed store"}</p><p className="mt-1 text-xs text-gray-400">{[store.city, store.region, store.country_code].filter(Boolean).join(", ") || "No location data"}</p></div><p className="text-xs text-gray-500">Created {formatDateTime(store.created_at)}</p></div></div>)}{overview?.employees?.map((employee) => <div key={employee.id} className="flex flex-col gap-3 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold text-white">{employee.name || "Unnamed employee"}</p>{employee.is_owner ? <Badge className="bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15">owner</Badge> : null}</div><p className="mt-1 text-xs text-gray-400">{employee.email || "No email"} | {employee.storeDetails?.map((store) => store.name).join(", ") || "No store assignments"}</p></div><p className="text-xs text-gray-500">Updated {formatRelativeDate(employee.updated_at || employee.created_at)}</p></div>)}</div></ListShell>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <ListShell title="App Tables" icon={Table2} description="Current dine-in tables and closed table history from your web app order flow.">
            {appOrdersQuery.isLoading ? <EmptyState>Loading app table orders...</EmptyState> : null}
            {!appOrdersQuery.isLoading ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                  <p className="text-xs text-gray-500">Active tables</p>
                  <p className="mt-1 text-2xl font-bold text-yellow-400">{formatNumber(activeTableOrders.length)}</p>
                  <p className="mt-1 text-xs text-gray-400">Tables 1-6 with an open dine-in order</p>
                </div>
                <div className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                  <p className="text-xs text-gray-500">Closed tables</p>
                  <p className="mt-1 text-2xl font-bold text-yellow-400">{formatNumber(tableHistory.length)}</p>
                  <p className="mt-1 text-xs text-gray-400">Most recent delivered dine-in orders</p>
                </div>
              </div>
            ) : null}
            {activeTableOrders.length ? activeTableOrders.map((order) => (
              <div key={order.id} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">Table {normalizeTableNumber(order.table_number) || "?"}</p>
                      <Badge className="bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15">{order.status || "pending"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {order.customer_name || "No customer name"} | {formatRelativeDate(order.updated_date || order.created_date)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-left md:text-right">
                    <div>
                      <p className="text-xs text-gray-500">Items</p>
                      <p className="font-bold text-yellow-400">{formatNumber((order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="font-bold text-yellow-400">{formatCurrency(order.total_amount)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )) : !appOrdersQuery.isLoading ? <EmptyState>No active table orders in the web app right now.</EmptyState> : null}
            {tableHistory.length ? (
              <div className="rounded-xl border border-yellow-500/10 bg-black/20 p-4">
                <p className="mb-3 text-sm font-semibold text-yellow-300">Recent closed tables</p>
                <div className="space-y-2">
                  {tableHistory.map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-lg border border-yellow-500/10 bg-[#1a1a1a] px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-white">Table {normalizeTableNumber(order.table_number)}</p>
                        <p className="text-xs text-gray-400">{formatDateTime(order.updated_date || order.created_date)}</p>
                      </div>
                      <p className="font-bold text-yellow-400">{formatCurrency(order.total_amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </ListShell>
          <ListShell title="Incoming Orders" icon={ShoppingBag} description="All recent orders entering the web app, regardless of whether Loyverse has receipts yet.">
            {appOrdersQuery.isLoading ? <EmptyState>Loading incoming orders...</EmptyState> : null}
            {!appOrdersQuery.isLoading && incomingOrders.length === 0 ? <EmptyState>No web app orders found yet.</EmptyState> : null}
            {incomingOrders.map((order) => (
              <div key={order.id} className="rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">{order.customer_name || "Unnamed order"}</p>
                      <Badge className="bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15">{order.order_type || "unknown"}</Badge>
                      <Badge className={order.payment_status === "paid" || order.payment_status === "confirmed" ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15" : "bg-gray-500/15 text-gray-300 hover:bg-gray-500/15"}>{order.payment_status || "pending"}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {order.id} | {formatDateTime(order.created_date)}{order.table_number ? ` | Table ${normalizeTableNumber(order.table_number)}` : ""}
                    </p>
                    {(order.items || []).length ? (
                      <p className="mt-2 text-sm text-gray-300">
                        {(order.items || []).map((item) => `${item.quantity || 0}x ${item.item_name}`).join(", ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-left md:text-right">
                    <div>
                      <p className="text-xs text-gray-500">Status</p>
                      <p className="font-bold text-yellow-400">{order.status || "pending"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="font-bold text-yellow-400">{formatCurrency(order.total_amount)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </ListShell>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ListShell title="Latest Items" icon={Package} description="Recently updated catalog entries with cleaner descriptions and editable local modifier links.">{overviewQuery.isLoading ? <EmptyState>Loading item data...</EmptyState> : null}{!overviewQuery.isLoading && latestItems.length === 0 ? <EmptyState>No items returned by the API.</EmptyState> : null}{latestItems.map((item) => <div key={item.id} className="rounded-2xl border border-yellow-500/10 bg-[#1a1a1a] p-5"><div className="flex flex-col gap-4"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-2xl font-semibold leading-tight text-white">{item.item_name || item.name || "Unnamed item"}</p>{item.category?.name ? <Badge className="bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15">{item.category.name}</Badge> : null}{item.track_stock ? <Badge className="bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/15">track stock</Badge> : null}{item.hasLocalModifierOverride ? <Badge className="bg-sky-500/15 text-sky-300 hover:bg-sky-500/15">local override</Badge> : null}</div><p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300">{getPlainTextFromHtml(item.description) || "No description yet."}</p><p className="mt-3 text-xs uppercase tracking-[0.2em] text-gray-500">Updated {formatRelativeDate(item.updated_at || item.created_at)}</p></div><div className="grid grid-cols-2 gap-3 sm:w-[220px]"><div className="rounded-xl border border-yellow-500/10 bg-black/20 p-3 text-center"><p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Variants</p><p className="mt-2 text-3xl font-bold text-yellow-400">{formatNumber(item.variantsCount)}</p></div><div className="rounded-xl border border-yellow-500/10 bg-black/20 p-3 text-center"><p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Modifiers</p><p className="mt-2 text-3xl font-bold text-yellow-400">{formatNumber(item.modifierLinksCount)}</p></div></div></div><div className="rounded-xl border border-yellow-500/10 bg-black/20 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><div className="flex items-center gap-2 text-yellow-300"><Link2 className="h-4 w-4" /><p className="text-sm font-semibold">Assigned modifier groups</p></div>{item.modifierDetails?.length ? <div className="mt-3 flex flex-wrap gap-2">{item.modifierDetails.map((modifier) => <Badge key={modifier.id} className="bg-yellow-400/15 text-yellow-200 hover:bg-yellow-400/15">{modifier.name}</Badge>)}</div> : <p className="mt-3 text-sm text-gray-500">No modifier groups linked to this item yet.</p>}</div><Button type="button" onClick={() => openModifierDialog(item)} className="gap-2 bg-yellow-400 text-black hover:bg-yellow-300"><PencilLine className="h-4 w-4" />Manage modifiers</Button></div></div></div></div>)}</ListShell>
          <ListShell title="Latest Customers" icon={Users} description="Most recently updated customer profiles with loyalty and spend data.">{overviewQuery.isLoading ? <EmptyState>Loading customer data...</EmptyState> : null}{!overviewQuery.isLoading && latestCustomers.length === 0 ? <EmptyState>No customers returned by the API.</EmptyState> : null}{latestCustomers.map((customer) => <div key={customer.id} className="flex flex-col gap-3 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold text-white">{customer.name || "Unnamed customer"}</p><p className="mt-1 text-xs text-gray-400">{customer.email || customer.phone_number || "No contact info"} | updated {formatRelativeDate(customer.updated_at || customer.created_at)}</p></div><div className="grid grid-cols-3 gap-3 text-left md:text-right"><div><p className="text-xs text-gray-500">Visits</p><p className="font-bold text-yellow-400">{formatNumber(customer.total_visits)}</p></div><div><p className="text-xs text-gray-500">Points</p><p className="font-bold text-yellow-400">{formatNumber(customer.total_points)}</p></div><div><p className="text-xs text-gray-500">Spent</p><p className="font-bold text-yellow-400">{formatCurrency(customer.totalSpentAmount)}</p></div></div></div>)}</ListShell>
        </div>
        <ListShell title="Latest Receipts" icon={Receipt} description="Recent receipt activity from the Loyverse receipts endpoint.">{overviewQuery.isLoading ? <EmptyState>Loading Loyverse receipts...</EmptyState> : null}{!overviewQuery.isLoading && latestReceipts.length === 0 ? <EmptyState>No receipts returned by the API for this account yet.</EmptyState> : null}{latestReceipts.map((receipt) => { const status = getReceiptStatus(receipt); return <div key={receipt.id || `${getReceiptId(receipt)}-${receipt.created_at || ""}`} className="flex flex-col gap-3 rounded-xl border border-yellow-500/10 bg-[#1a1a1a] p-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold text-white">{getReceiptId(receipt)}</p><Badge className={status.includes("cancel") ? "bg-red-500/15 text-red-300 hover:bg-red-500/15" : "bg-yellow-400/15 text-yellow-300 hover:bg-yellow-400/15"}>{status}</Badge></div><p className="mt-1 text-xs text-gray-400">{(receipt.store_name || receipt.store_id || "Unknown store") + " | " + formatRelativeDate(receipt.created_at)}</p></div><div className="text-left md:text-right"><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold text-yellow-400">{formatCurrency(getReceiptTotal(receipt))}</p></div></div>; })}</ListShell>
        <ItemModifierDialog item={selectedItem} modifiers={allModifiers} selectedModifierIds={selectedModifierIds} onModifierToggle={handleModifierToggle} onSave={handleSaveModifierAssignments} saving={saveModifierAssignments.isPending} onOpenChange={(open) => { if (!open) { setSelectedItem(null); setSelectedModifierIds([]); } }} />
      </div>
    </div>
  );
}
