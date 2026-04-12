import React from "react";
import { formatMexicoTableService } from "@/lib/mexicoTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Receipt, ShoppingBag, Table2, Wallet, Banknote, CreditCard, ChevronDown, ChevronUp } from "lucide-react";

const formatMoney = (amount) => `$${(amount || 0).toFixed(2)}`;

function PaidTableCard({ order }) {
  const [expanded, setExpanded] = React.useState(false);
  const isCard = order.payment_method === "card";
  const PayIcon = isCard ? CreditCard : Banknote;

  return (
    <div className="rounded-xl border border-yellow-500/10 bg-[#242424] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">Mesa {order.table_number}</p>
          <p className="text-sm text-gray-500">{formatMexicoTableService(order.updated_date || order.created_date)}</p>
        </div>
        <Badge className="bg-green-500/15 text-green-400 border-transparent">Pagado</Badge>
      </div>

      {order.customer_name && order.customer_name !== `Table ${order.table_number}` && (
        <p className="text-sm text-gray-300 mt-2">{order.customer_name}</p>
      )}

      <div className="flex items-center gap-2 mt-2">
        <PayIcon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-400">{isCard ? "Tarjeta / Card" : "Efectivo / Cash"}</span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <p className="text-yellow-400 font-bold text-lg">{formatMoney(order.total_amount)}</p>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-yellow-400 transition-colors"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Ocultar" : "Ver detalle"}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-yellow-500/10 pt-3 space-y-1.5">
          {order.items?.map((item, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span className="text-gray-300">
                <span className="font-semibold text-white">{item.quantity}×</span> {item.item_name}
              </span>
              <span className="text-yellow-400 font-medium">{formatMoney((item.price || 0) * item.quantity)}</span>
            </div>
          ))}
          {order.special_instructions && (
            <p className="text-xs text-gray-500 italic mt-2">Nota: {order.special_instructions}</p>
          )}
          <div className="pt-2 border-t border-yellow-500/10 flex justify-between font-bold">
            <span className="text-gray-300">Total</span>
            <span className="text-yellow-400">{formatMoney(order.total_amount)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TableServiceManager({
  menuItems,
  activeTableOrders,
  tableHistory,
  onAddItem,
  onChangeItemQuantity,
  onSaveOrderDetails,
  onClearPaidTable,
  onPrintReceipt,
  isSaving,
}) {
  const [selectedTable, setSelectedTable] = React.useState(1);
  const [customerName, setCustomerName] = React.useState("");
  const [specialInstructions, setSpecialInstructions] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState("cash");

  const activeOrder = activeTableOrders.find((order) => Number.parseInt(order.table_number, 10) === selectedTable);

  React.useEffect(() => {
    if (!activeOrder) {
      setCustomerName("");
      setSpecialInstructions("");
      setPaymentMethod("cash");
      return;
    }

    setCustomerName(activeOrder.customer_name || `Table ${selectedTable}`);
    setSpecialInstructions(activeOrder.special_instructions || "");
    setPaymentMethod(activeOrder.payment_method || "cash");
  }, [activeOrder, selectedTable]);

  const availableItems = menuItems.filter((item) => item.is_available);
  const occupiedTables = activeTableOrders.length;

  return (
    <Card className="bg-[#242424] border border-yellow-500/20 shadow-none mb-5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-yellow-400">
              <Table2 className="w-5 h-5" />
              Table Service
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">Six active tables with tabs, payment flow, and closeout history</p>
            <p className="mt-2 rounded-lg border border-yellow-500/15 bg-yellow-500/5 px-3 py-2 text-[11px] leading-snug text-yellow-100/85">
              Loyverse does not expose a public API for open tabs or tables — changes here are not synced to Loyverse until you{" "}
              <span className="font-semibold text-yellow-300">mark the bill as paid</span> (then a sales receipt is created via the API
              when the menu is linked).
            </p>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="rounded-xl border border-yellow-500/20 bg-[#1a1a1a] px-4 py-2">
              <p className="text-gray-500">Occupied</p>
              <p className="font-bold text-yellow-400">{occupiedTables}</p>
            </div>
            <div className="rounded-xl border border-yellow-500/20 bg-[#1a1a1a] px-4 py-2">
              <p className="text-gray-500">Available</p>
              <p className="font-bold text-gray-200">{6 - occupiedTables}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => {
            const tableNumber = index + 1;
            const tableOrder = activeTableOrders.find((order) => Number.parseInt(order.table_number, 10) === tableNumber);

            return (
              <button
                key={tableNumber}
                type="button"
                onClick={() => setSelectedTable(tableNumber)}
                className={`rounded-2xl border p-4 text-left transition-all ${selectedTable === tableNumber ? "border-yellow-300 bg-yellow-400 text-black shadow-lg" : tableOrder ? "border-yellow-500/30 bg-yellow-400/10 text-white" : "border-yellow-500/20 bg-[#1a1a1a] text-gray-200 hover:border-yellow-400/50"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black">Table {tableNumber}</span>
                  <Badge className={tableOrder ? "bg-black/15 text-current border-transparent" : "bg-transparent text-gray-400 border border-yellow-500/20"}>
                    {tableOrder ? "Occupied" : "Available"}
                  </Badge>
                </div>
                <p className={`mt-3 text-sm ${selectedTable === tableNumber ? "text-black/75" : "text-gray-500"}`}>
                  {tableOrder ? `${tableOrder.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} items` : "No open tab"}
                </p>
                <p className={`text-xl font-bold mt-1 ${selectedTable === tableNumber ? "text-black" : "text-yellow-400"}`}>{tableOrder ? formatMoney(tableOrder.total_amount) : "$0.00"}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-yellow-500/20 bg-[#1a1a1a] p-4">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Table {selectedTable}</h3>
                  <p className="text-sm text-gray-500">{activeOrder ? `Order #${activeOrder.id.slice(0, 8)}` : "Select items to open a table tab"}</p>
                </div>
                {activeOrder && (
                  <Button type="button" variant="outline" onClick={() => onPrintReceipt(activeOrder)} className="gap-2 border-yellow-500/30 bg-transparent text-gray-200 hover:bg-yellow-400/10">
                    <Receipt className="w-4 h-4" />
                    Receipt
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2 mb-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Name on tab</label>
                  <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={`Table ${selectedTable}`} className="bg-[#242424] border-yellow-500/20 text-white" />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Payment method at checkout</label>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => setPaymentMethod("cash")} className={`flex-1 ${paymentMethod === "cash" ? "bg-yellow-400 text-black hover:bg-yellow-300" : "bg-[#242424] text-gray-200 border border-yellow-500/20 hover:bg-yellow-400/10"}`}>
                      Cash
                    </Button>
                    <Button type="button" onClick={() => setPaymentMethod("card")} className={`flex-1 ${paymentMethod === "card" ? "bg-yellow-400 text-black hover:bg-yellow-300" : "bg-[#242424] text-gray-200 border border-yellow-500/20 hover:bg-yellow-400/10"}`}>
                      Card
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-400 block mb-2">Notes</label>
                <Textarea value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} placeholder="Birthday, allergies, split bill, etc." rows={3} className="bg-[#242424] border-yellow-500/20 text-white" />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={!activeOrder || isSaving}
                  onClick={() => activeOrder && onSaveOrderDetails(activeOrder, { customer_name: customerName.trim() || `Table ${selectedTable}`, special_instructions: specialInstructions.trim() })}
                  className="bg-yellow-400 hover:bg-yellow-300 text-black"
                >
                  Save tab
                </Button>

                <Button
                  type="button"
                  disabled={!activeOrder || !activeOrder.items?.length || isSaving}
                  onClick={() => activeOrder && onClearPaidTable(activeOrder, { payment_method: paymentMethod, customer_name: customerName.trim() || `Table ${selectedTable}`, special_instructions: specialInstructions.trim() })}
                  className="bg-green-600 hover:bg-green-500 text-white gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  Mark paid and close table
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-yellow-500/20 bg-[#1a1a1a] p-4">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="w-4 h-4 text-yellow-400" />
                <h4 className="font-semibold text-white">Menu to add to the tab</h4>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 max-h-[420px] overflow-y-auto pr-1">
                {availableItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => onAddItem(selectedTable, item)} disabled={isSaving} className="rounded-xl border border-yellow-500/20 bg-[#242424] p-3 text-left transition-colors hover:border-yellow-400 hover:bg-yellow-400/10">
                    <p className="font-semibold text-white text-sm">{item.name}</p>
                    <p className="text-yellow-400 font-bold mt-1">{formatMoney(item.price)}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-[#1a1a1a] p-4">
            <h4 className="font-semibold text-white mb-4">Current tab</h4>

            {activeOrder ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-[#242424] p-3 border border-yellow-500/10">
                  <p className="text-sm text-gray-400">Customer</p>
                  <p className="font-semibold text-white">{customerName || `Table ${selectedTable}`}</p>
                </div>

                <div className="space-y-2">
                  {activeOrder.items?.map((item, index) => (
                    <div key={`${item.menu_item_id || item.item_name}-${index}`} className="rounded-xl bg-[#242424] p-3 border border-yellow-500/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-white">{item.item_name}</p>
                          <p className="text-sm text-gray-500">{formatMoney(item.price)} each</p>
                        </div>
                        <p className="font-bold text-yellow-400">{formatMoney((item.price || 0) * (item.quantity || 0))}</p>
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <Button type="button" size="sm" variant="outline" onClick={() => onChangeItemQuantity(activeOrder, index, -1)} className="border-yellow-500/20 bg-transparent text-gray-200 hover:bg-yellow-400/10">
                          -
                        </Button>
                        <span className="min-w-8 text-center font-semibold text-white">{item.quantity}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => onChangeItemQuantity(activeOrder, index, 1)} className="border-yellow-500/20 bg-transparent text-gray-200 hover:bg-yellow-400/10">
                          +
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => onChangeItemQuantity(activeOrder, index, -item.quantity)} className="ml-auto border-red-500/30 bg-transparent text-red-400 hover:bg-red-500/10">
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-yellow-500/20 bg-yellow-400/10 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">Table total</span>
                    <span className="text-2xl font-black text-yellow-400">{formatMoney(activeOrder.total_amount)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-yellow-500/20 bg-[#242424] p-8 text-center">
                <p className="text-gray-400">Table is free.</p>
                <p className="text-sm text-gray-500 mt-2">Add items from the menu to open the tab for table {selectedTable}.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-yellow-500/20 bg-[#1a1a1a] p-4">
          <h4 className="font-semibold text-white mb-4">Paid table history</h4>
          {tableHistory.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tableHistory.map((order) => (
                <PaidTableCard key={order.id} order={order} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No tables have been closed today yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}