import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import OrderCard from "../components/orders/OrderCard";
import ReceiptDialog from "../components/orders/ReceiptDialog";
import NewOrderForm from "../components/orders/NewOrderForm";

export default function Orders() {
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: () => base44.entities.MenuItem.list(),
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Order.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: (id) => base44.entities.Order.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const createOrder = useMutation({
    mutationFn: (data) => base44.entities.Order.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowNewOrderForm(false);
    },
  });

  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');
  const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'cancelled');

  const handlePrintReceipt = (order) => {
    setSelectedOrder(order);
    setShowReceipt(true);
  };

  const handleDeleteOrder = (id) => {
    if (confirm('Are you sure you want to delete this order? This cannot be undone.')) {
      deleteOrder.mutate(id);
    }
  };

  const handleCompleteOrder = async (order, paymentMethod) => {
    updateOrder.mutate({
      id: order.id,
      data: {
        status: 'delivered',
        payment_method: paymentMethod,
        payment_status: 'paid'
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-8 h-8 text-red-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
                <p className="text-gray-600 mt-1">Create and track customer orders</p>
              </div>
            </div>
            <Button
              onClick={() => setShowNewOrderForm(true)}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              New Order
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Active Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">{activeOrders.length}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Ready for Pickup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{readyOrders.length}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{orders.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* New Order Form */}
        {showNewOrderForm && (
          <NewOrderForm
            menuItems={menuItems}
            onSubmit={(data) => createOrder.mutate(data)}
            onCancel={() => setShowNewOrderForm(false)}
            isLoading={createOrder.isPending}
          />
        )}

        {/* Orders Tabs */}
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Active ({activeOrders.length})</TabsTrigger>
            <TabsTrigger value="ready">Ready ({readyOrders.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeOrders.length > 0 ? (
              activeOrders.map((order) => (
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
              <Card className="border-0 shadow">
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">No active orders</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ready" className="space-y-4">
            {readyOrders.length > 0 ? (
              readyOrders.map((order) => (
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
              <Card className="border-0 shadow">
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">No orders ready</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedOrders.length > 0 ? (
              completedOrders.map((order) => (
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
              <Card className="border-0 shadow">
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">No completed orders</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ReceiptDialog
        order={selectedOrder}
        open={showReceipt}
        onClose={() => setShowReceipt(false)}
      />
    </div>
  );
}