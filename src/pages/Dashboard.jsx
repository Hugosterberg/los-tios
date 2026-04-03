import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // Added import for Button
import { DollarSign, ShoppingBag, Calendar, TrendingUp, Package, Clock, CheckCircle, Globe, Plus, Users } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { es } from 'date-fns/locale'; // Import Spanish locale
import { listMenuItems } from "@/lib/local-dev-menu";
import { listOrders } from "@/lib/local-dev-orders";

// Helper function to create page URLs.
// This assumes a simple routing structure where CustomerOrder page is at /customer-order
// In a real application, this might use Next.js `useRouter` or a more complex routing setup.
const createPageUrl = (pageName) => {
  switch (pageName) {
    case "CustomerOrder":
      return "/customer-order"; // Assuming the customer order page is routed at /customer-order
    default:
      return "/";
  }
};

import ReservationList from "../components/reservations/ReservationList";
import ReservationForm from "../components/reservations/ReservationForm";

export default function Dashboard() {
  const [showReservationForm, setShowReservationForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => listOrders((orderBy) => base44.entities.Order.list(orderBy), '-created_date'),
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => base44.entities.Reservation.list('-created_date'),
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: () => listMenuItems(() => base44.entities.MenuItem.list()),
  });

  const createReservation = useMutation({
    mutationFn: (data) => base44.entities.Reservation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      setShowReservationForm(false);
    },
  });

  const updateReservation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Reservation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const todayReservations = reservations.filter(r => r.date === new Date().toISOString().split('T')[0]);

  // Calculate statistics
  const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const todayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_date);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });
  const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing').length;
  const completedOrders = orders.filter(o => o.status === 'delivered' || o.status === 'ready').length;
  
  // Revenue by day (last 7 days)
  const revenueByDay = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayOrders = orders.filter(o => {
      const orderDate = new Date(o.created_date);
      return orderDate.toDateString() === date.toDateString();
    });
    return {
      name: format(date, 'MMM dd', { locale: es }), // Format day name in Spanish
      revenue: dayOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
      orders: dayOrders.length
    };
  });

  // Orders by type
  const ordersByType = [
    { name: 'Dine-in', value: orders.filter(o => o.order_type === 'dine-in').length, color: '#DC2626' },
    { name: 'Takeout', value: orders.filter(o => o.order_type === 'takeout').length, color: '#F59E0B' },
    { name: 'Delivery', value: orders.filter(o => o.order_type === 'delivery').length, color: '#10B981' },
  ];

  // Popular menu items (from orders)
  const itemCounts = {};
  orders.forEach(order => {
    order.items?.forEach(item => {
      itemCounts[item.item_name] = (itemCounts[item.item_name] || 0) + item.quantity;
    });
  });
  const popularItems = Object.entries(itemCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const customerOrderUrl = `${window.location.origin}${createPageUrl("CustomerOrder")}`;

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <div className="border-b border-yellow-500/20 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-xl font-bold text-yellow-400">Panel de Gestión</h1>
            <p className="text-gray-500 text-sm">
              {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-6">
        {/* Customer Order Link Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-3 sm:p-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-yellow-400">Página de Pedidos para Clientes</p>
                  <code className="text-xs text-gray-400 font-mono">{customerOrderUrl}</code>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button
                  onClick={() => { navigator.clipboard.writeText(customerOrderUrl); alert('¡Enlace copiado!'); }}
                  variant="outline"
                  className="h-7 text-xs px-3 border-yellow-500/30 text-gray-300 hover:text-yellow-400 bg-transparent"
                >
                  Copiar
                </Button>
                <Button
                  onClick={() => window.open(createPageUrl("CustomerOrder"), '_blank')}
                  className="h-7 text-xs px-3 bg-yellow-400 hover:bg-yellow-300 text-black"
                >
                  Ver Página
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Ingresos Hoy", value: `$${todayRevenue.toFixed(0)} MXN`, sub: `${todayOrders.length} pedidos`, icon: DollarSign, color: "text-yellow-400" },
            { label: "Pedidos Activos", value: activeOrders, sub: "Pendientes y en prep.", icon: Clock, color: "text-yellow-400" },
            { label: "Total Pedidos", value: orders.length, sub: `${completedOrders} completados`, icon: ShoppingBag, color: "text-yellow-400" },
            { label: "Reservas Hoy", value: reservations.filter(r => r.date === new Date().toISOString().split('T')[0]).length, sub: `${reservations.length} totales`, icon: Calendar, color: "text-yellow-400" },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-600 mt-1">{stat.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-3 sm:p-4">
            <p className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-yellow-400" />
              Ingresos (Últimos 7 Días)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" fontSize={11} stroke="#666" />
                <YAxis fontSize={11} stroke="#666" />
                <Tooltip
                  contentStyle={{ background: '#242424', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', color: '#fff' }}
                  formatter={(value) => `$${value.toFixed(0)} MXN`}
                />
                <Line type="monotone" dataKey="revenue" stroke="#F5C400" strokeWidth={2} dot={{ fill: '#F5C400', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-3 sm:p-4">
            <p className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Package className="w-4 h-4 text-yellow-400" />
              Pedidos por Tipo
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={ordersByType} cx="50%" cy="50%" labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={75} dataKey="value">
                  {ordersByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#242424', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-3 sm:p-4">
            <p className="text-sm font-semibold text-gray-300 mb-4">Productos Más Vendidos</p>
            {popularItems.length > 0 ? (
              <div className="space-y-3">
                {popularItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-yellow-400/10 text-yellow-400 text-xs font-bold flex items-center justify-center">{index + 1}</span>
                      <span className="text-sm text-gray-300">{item.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{item.count} vendidos</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm text-center py-6">No hay datos de ventas aún</p>
            )}
          </div>

          <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-3 sm:p-4">
            <p className="text-sm font-semibold text-gray-300 mb-4">Estadísticas Rápidas</p>
            <div className="space-y-3">
              {[
                { label: "Ingresos Totales", value: `$${totalRevenue.toFixed(0)} MXN`, accent: true },
                { label: "Promedio por Pedido", value: `$${(totalRevenue / (orders.length || 1)).toFixed(0)} MXN` },
                { label: "Productos en Menú", value: menuItems.length },
                { label: "Productos Disponibles", value: menuItems.filter(i => i.is_available).length, accent: true },
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-yellow-500/10 last:border-0">
                  <span className="text-xs text-gray-500">{stat.label}</span>
                  <span className={`text-sm font-bold ${stat.accent ? 'text-yellow-400' : 'text-gray-300'}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Reservations Section */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-bold text-gray-300">Reservaciones</h2>
              <span className="text-xs text-gray-600">({todayReservations.length} hoy)</span>
            </div>
            <Button
              onClick={() => setShowReservationForm(!showReservationForm)}
              className="h-7 text-xs px-3 bg-yellow-400 hover:bg-yellow-300 text-black gap-1"
            >
              <Plus className="w-3 h-3" />
              Nueva Reservación
            </Button>
          </div>

          {showReservationForm && (
            <ReservationForm
              onSubmit={(data) => createReservation.mutate(data)}
              onCancel={() => setShowReservationForm(false)}
              isLoading={createReservation.isPending}
            />
          )}

          <ReservationList
            reservations={reservations}
            isLoading={false}
            onUpdateStatus={(id, status) => updateReservation.mutate({ id, data: { status } })}
          />
        </div>
      </div>
    </div>
  );
}
