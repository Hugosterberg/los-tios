import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { listMenuItems } from "@/lib/local-dev-menu";
import { createOrderEntity, deleteOrderEntity, listOrders, updateOrderEntity } from "@/lib/local-dev-orders";
import { syncCompletedOrderToLoyverse } from "@/lib/orderLoyverseSync";
import OrderCard from "../components/orders/OrderCard";
import ReceiptDialog from "../components/orders/ReceiptDialog";
import NewOrderForm from "../components/orders/NewOrderForm";
import TableServiceManager from "../components/orders/TableServiceManager";

const ACTIVE_ORDER_STATUSES = ["pending", "preparing", "ready", "out_for_delivery"];
const TABLE_NUMBERS = new Set(["1", "2", "3", "4", "5", "6"]);

const normalizeTableNumber = (value) => {
  if (value === null || value === undefined) return "";
  const match = String(value).match(/\d+/);
  return match ? match[0] : String(value).trim();
};

const calculateOrderTotal = (items = []) => items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);

export default function Orders() {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [selectedView, setSelectedView] = useState("active");
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["orders"],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), "-created_date"),
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["menuItems"],
    queryFn: () => listMenuItems(() => base44.entities.MenuItem.list()),
  });

  const { data: appSettingsRows = [] } = useQuery({
    queryKey: ["appSettings"],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, data }) => updateOrderEntity(id, data, (orderId, payload) => base44.entities.Order.update(orderId, payload)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const deleteOrder = useMutation({
    mutationFn: (id) => deleteOrderEntity(id, (orderId) => base44.entities.Order.delete(orderId)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  const createOrder = useMutation({
    mutationFn: (data) => createOrderEntity(data, (payload) => base44.entities.Order.create(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowNewOrderForm(false);
    },
  });

  const activeOrders = orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled");
  const completedOrders = orders.filter((order) => order.status === "delivered" || order.status === "cancelled");
  const displayedOrders = selectedView === "active" ? activeOrders : selectedView === "completed" ? completedOrders : orders;
  const activeTableOrders = orders.filter((order) => {
    const normalizedTable = normalizeTableNumber(order.table_number);
    return order.order_type === "dine-in" && TABLE_NUMBERS.has(normalizedTable) && ACTIVE_ORDER_STATUSES.includes(order.status);
  });

  const tableHistory = orders
    .filter((order) => {
      const normalizedTable = normalizeTableNumber(order.table_number);
      return order.order_type === "dine-in" && TABLE_NUMBERS.has(normalizedTable) && order.status === "delivered";
    })
    .sort((left, right) => new Date(right.updated_date || right.created_date).getTime() - new Date(left.updated_date || left.created_date).getTime())
    .slice(0, 12);

  const handlePrintReceipt = (order) => {
    setSelectedOrder(order);
    setShowReceipt(true);
  };

  const handleDeleteOrder = (id) => {
    if (confirm("Are you sure you want to delete this order? This cannot be undone.")) {
      deleteOrder.mutate(id);
    }
  };

  const pushOrderToLoyverseIfNeeded = async (orderSnapshot) => {
    const settingsRow = appSettingsRows[0] || {};
    const result = await syncCompletedOrderToLoyverse(orderSnapshot, menuItems, settingsRow);
    if (result.skipped && result.reason === "no_loyverse_token") {
      return;
    }
    if (result.skipped && result.reason === "not_completed") {
      return;
    }
    if (result.skipped && result.reason === "already_synced") {
      return;
    }
    if (result.skipped && result.reason === "no_loyverse_item_ids") {
      toast({
        title: "Loyverse",
        description: result.message || "No menu lines have a Loyverse item ID.",
      });
      return;
    }
    if (result.ok && result.receiptId) {
      try {
        await updateOrder.mutateAsync({
          id: orderSnapshot.id,
          data: { loyverse_receipt_id: result.receiptId },
        });
        toast({
          title: "Loyverse",
          description: `Sale recorded in Loyverse (receipt ${String(result.receiptId).slice(0, 8)}…).`,
        });
      } catch (err) {
        toast({
          title: "Loyverse receipt created",
          description: `Could not save loyverse_receipt_id on the order: ${err?.message || err}`,
        });
      }
    } else if (!result.ok && !result.skipped) {
      toast({
        title: "Loyverse sync failed",
        description: result.message || "Unknown error.",
      });
    }
  };

  const handleCompleteOrder = async (order) => {
    const paymentMethod = prompt(
      "How did the customer pay?\n\n1 = Cash\n2 = Card\n\nEnter 1 or 2:",
      order.payment_method === "card" ? "2" : "1",
    );

    if (!paymentMethod) return;

    const updated = await updateOrder.mutateAsync({
      id: order.id,
      data: {
        status: "delivered",
        payment_method: paymentMethod === "2" ? "card" : "cash",
        payment_status: "paid",
      },
    });
    const merged = { ...order, ...(updated || {}), status: "delivered", payment_status: "paid", payment_method: paymentMethod === "2" ? "card" : "cash" };
    await pushOrderToLoyverseIfNeeded(merged);
  };

  const handleAddItemToTable = async (tableNumber, menuItem) => {
    const normalizedTable = String(tableNumber);
    const existingOrder = activeTableOrders.find((order) => normalizeTableNumber(order.table_number) === normalizedTable);

    if (existingOrder) {
      const existingIndex = existingOrder.items?.findIndex((item) => !item.is_custom && item.menu_item_id === menuItem.id) ?? -1;
      const nextItems = existingIndex >= 0
        ? existingOrder.items.map((item, index) => (index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item))
        : [
            ...(existingOrder.items || []),
            { menu_item_id: menuItem.id, item_name: menuItem.name, quantity: 1, price: menuItem.price, is_custom: false },
          ];

      await updateOrder.mutateAsync({
        id: existingOrder.id,
        data: { items: nextItems, total_amount: calculateOrderTotal(nextItems) },
      });
      return;
    }

    await createOrder.mutateAsync({
      customer_name: `Table ${normalizedTable}`,
      customer_phone: "",
      delivery_address: "",
      special_instructions: "",
      payment_method: "cash",
      payment_status: "pending",
      order_type: "dine-in",
      table_number: normalizedTable,
      items: [{ menu_item_id: menuItem.id, item_name: menuItem.name, quantity: 1, price: menuItem.price, is_custom: false }],
      total_amount: menuItem.price || 0,
      status: "pending",
    });
  };

  const handleChangeTableItemQuantity = async (order, itemIndex, delta) => {
    const nextItems = (order.items || [])
      .map((item, index) => (index === itemIndex ? { ...item, quantity: item.quantity + delta } : item))
      .filter((item) => item.quantity > 0);

    if (!nextItems.length) {
      await deleteOrder.mutateAsync(order.id);
      return;
    }

    await updateOrder.mutateAsync({
      id: order.id,
      data: { items: nextItems, total_amount: calculateOrderTotal(nextItems) },
    });
  };

  const handleSaveTableOrderDetails = async (order, details) => {
    await updateOrder.mutateAsync({
      id: order.id,
      data: { customer_name: details.customer_name, special_instructions: details.special_instructions },
    });
  };

  const handleClearPaidTable = async (order, details) => {
    const updated = await updateOrder.mutateAsync({
      id: order.id,
      data: {
        customer_name: details.customer_name,
        special_instructions: details.special_instructions,
        payment_method: details.payment_method,
        payment_status: "paid",
        status: "delivered",
      },
    });
    const merged = {
      ...order,
      ...(updated || {}),
      customer_name: details.customer_name,
      special_instructions: details.special_instructions,
      payment_method: details.payment_method,
      payment_status: "paid",
      status: "delivered",
    };
    await pushOrderToLoyverseIfNeeded(merged);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="border-b border-yellow-500/20">
        <div className="max-w-[1360px] mx-auto px-3 sm:px-5 lg:px-6 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">Order Management</h1>
                <p className="text-gray-500 text-xs max-w-3xl">
                  Orders here are stored in this app (web checkout and admin).{" "}
                  <span className="text-gray-400">
                    Open delivery or dine-in tickets that exist only in Loyverse POS are not available through Loyverse’s public API, so they do not show in this list. After you close the sale in Loyverse, it appears in the receipts feed (e.g. Loyverse / Loyverse Orders), and this app can record a receipt when you complete a web order with Loyverse sync.
                  </span>
                </p>
              </div>
            </div>
            <Button onClick={() => setShowNewOrderForm(true)} className="bg-yellow-400 hover:bg-yellow-300 text-black text-sm gap-2 h-8 px-3">
              <Plus className="w-3 h-3" />
              New Order
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1360px] mx-auto px-3 sm:px-5 lg:px-6 py-5">
        <TableServiceManager
          menuItems={menuItems}
          activeTableOrders={activeTableOrders}
          tableHistory={tableHistory}
          onAddItem={handleAddItemToTable}
          onChangeItemQuantity={handleChangeTableItemQuantity}
          onSaveOrderDetails={handleSaveTableOrderDetails}
          onClearPaidTable={handleClearPaidTable}
          onPrintReceipt={handlePrintReceipt}
          isSaving={createOrder.isPending || updateOrder.isPending}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <button type="button" onClick={() => setSelectedView("active")} className={`rounded-xl p-3 text-left border transition-colors ${selectedView === "active" ? "bg-yellow-400 text-black border-yellow-300" : "bg-[#242424] border-yellow-500/20"}`}>
            <p className="text-xs text-gray-500 mb-1">Active Orders</p>
            <p className={`text-xl font-bold ${selectedView === "active" ? "text-black" : "text-yellow-400"}`}>{activeOrders.length}</p>
          </button>
          <button type="button" onClick={() => setSelectedView("completed")} className={`rounded-xl p-3 text-left border transition-colors ${selectedView === "completed" ? "bg-yellow-400 text-black border-yellow-300" : "bg-[#242424] border-yellow-500/20"}`}>
            <p className="text-xs text-gray-500 mb-1">Completed</p>
            <p className={`text-xl font-bold ${selectedView === "completed" ? "text-black" : "text-yellow-400"}`}>{completedOrders.length}</p>
          </button>
          <button type="button" onClick={() => setSelectedView("all")} className={`rounded-xl p-3 text-left border transition-colors ${selectedView === "all" ? "bg-yellow-400 text-black border-yellow-300" : "bg-[#242424] border-yellow-500/20"}`}>
            <p className="text-xs text-gray-500 mb-1">Total Orders</p>
            <p className={`text-xl font-bold ${selectedView === "all" ? "text-black" : "text-gray-300"}`}>{orders.length}</p>
          </button>
        </div>

        {showNewOrderForm && (
          <NewOrderForm menuItems={menuItems} onSubmit={(data) => createOrder.mutate(data)} onCancel={() => setShowNewOrderForm(false)} isLoading={createOrder.isPending} />
        )}

        <div className="space-y-3">
          {displayedOrders.length ? (
            displayedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={(status) => updateOrder.mutate({ id: order.id, data: { status } })}
                onPrintReceipt={handlePrintReceipt}
                onDelete={handleDeleteOrder}
                onCompleteOrder={handleCompleteOrder}
              />
            ))
          ) : (
            <div className="bg-[#242424] border border-yellow-500/10 rounded-xl text-center py-10">
              <p className="text-gray-600 text-sm">
                {selectedView === "active" ? "No active orders" : selectedView === "completed" ? "No completed orders" : "No orders"}
              </p>
            </div>
          )}
        </div>
      </div>

      <ReceiptDialog order={selectedOrder} open={showReceipt} onClose={() => setShowReceipt(false)} />
    </div>
  );
}
