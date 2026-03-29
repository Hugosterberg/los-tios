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

  const handleCompleteOrder = async (order) => {
    const paymentMethod = prompt(
      '¿Cómo pagó el cliente? / How did the customer pay?\n\n1 = Efectivo / Cash\n2 = Tarjeta / Card\n\nIngrese 1 o 2:',
      order.payment_method === 'card' ? '2' : '1'
    );
    
    if (!paymentMethod) return;
    
    const method = paymentMethod === '2' ? 'card' : 'cash';
    
    updateOrder.mutate({
      id: order.id,
      data: {
        status: 'delivered',
        payment_method: method,
        payment_status: 'paid'
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="border-b border-yellow-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-yellow-400" />
              <div>
                <h1 className="text-lg font-bold text-yellow-400">Gestión de Pedidos</h1>
                <p className="text-gray-500 text-xs">Crear y gestionar pedidos</p>
              </div>
            </div>
            <Button
              onClick={() => setShowNewOrderForm(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-black text-sm gap-2 h-8 px-3"
            >
              <Plus className="w-3 h-3" />
              Nuevo Pedido
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Pedidos Activos</p>
            <p className="text-2xl font-bold text-yellow-400">{activeOrders.length}</p>
          </div>
          <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Listos para Entregar</p>
            <p className="text-2xl font-bold text-yellow-400">{readyOrders.length}</p>
          </div>
          <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Total Pedidos</p>
            <p className="text-2xl font-bold text-gray-300">{orders.length}</p>
          </div>
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
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-[#242424] border border-yellow-500/20">
            <TabsTrigger value="active" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Activos ({activeOrders.length})</TabsTrigger>
            <TabsTrigger value="ready" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Listos ({readyOrders.length})</TabsTrigger>
            <TabsTrigger value="completed" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Completados ({completedOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-3">
            {activeOrders.length > 0 ? activeOrders.map((order) => (
              <OrderCard key={order.id} order={order}
                onUpdateStatus={(status) => updateOrder.mutate({ id: order.id, data: { status } })}
                onPrintReceipt={handlePrintReceipt} onDelete={handleDeleteOrder} onCompleteOrder={handleCompleteOrder} />
            )) : (
              <div className="bg-[#242424] border border-yellow-500/10 rounded-xl text-center py-10">
                <p className="text-gray-600 text-sm">No hay pedidos activos</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ready" className="space-y-3">
            {readyOrders.length > 0 ? readyOrders.map((order) => (
              <OrderCard key={order.id} order={order}
                onUpdateStatus={(status) => updateOrder.mutate({ id: order.id, data: { status } })}
                onPrintReceipt={handlePrintReceipt} onDelete={handleDeleteOrder} onCompleteOrder={handleCompleteOrder} />
            )) : (
              <div className="bg-[#242424] border border-yellow-500/10 rounded-xl text-center py-10">
                <p className="text-gray-600 text-sm">No hay pedidos listos</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-3">
            {completedOrders.length > 0 ? completedOrders.map((order) => (
              <OrderCard key={order.id} order={order}
                onUpdateStatus={(status) => updateOrder.mutate({ id: order.id, data: { status } })}
                onPrintReceipt={handlePrintReceipt} onDelete={handleDeleteOrder} onCompleteOrder={handleCompleteOrder} />
            )) : (
              <div className="bg-[#242424] border border-yellow-500/10 rounded-xl text-center py-10">
                <p className="text-gray-600 text-sm">No hay pedidos completados</p>
              </div>
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