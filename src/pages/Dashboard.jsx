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
    queryFn: () => base44.entities.Order.list('-created_date'),
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations'],
    queryFn: () => base44.entities.Reservation.list('-created_date'),
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: () => base44.entities.MenuItem.list(),
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-bold mb-2">Panel de Gestión</h1>
            <p className="text-gray-300">
              {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Customer Order Link Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="border-0 shadow-lg bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Globe className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Página de Pedidos para Clientes</h3>
                    <p className="text-sm text-gray-600 mb-2">Comparte este enlace con tus clientes para que puedan ordenar en línea</p>
                    <code className="text-xs bg-white px-3 py-1 rounded border text-green-700 font-mono">
                      {customerOrderUrl}
                    </code>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(customerOrderUrl);
                      alert('¡Enlace copiado al portapapeles!');
                    }}
                    variant="outline"
                    className="bg-white"
                  >
                    Copiar Enlace
                  </Button>
                  <Button
                    onClick={() => window.open(createPageUrl("CustomerOrder"), '_blank')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Ver Página
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Ingresos de Hoy</CardTitle>
                <DollarSign className="w-5 h-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">${todayRevenue.toFixed(2)} MXN</div>
                <p className="text-xs text-gray-500 mt-1">{todayOrders.length} pedidos hoy</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Pedidos Activos</CardTitle>
                <Clock className="w-5 h-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{activeOrders}</div>
                <p className="text-xs text-gray-500 mt-1">Pendientes y en preparación</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total de Pedidos</CardTitle>
                <ShoppingBag className="w-5 h-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{orders.length}</div>
                <p className="text-xs text-gray-500 mt-1">{completedOrders} completados</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-0 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Reservaciones de Hoy</CardTitle>
                <Calendar className="w-5 h-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{reservations.filter(r => r.date === new Date().toISOString().split('T')[0]).length}</div>
                <p className="text-xs text-gray-500 mt-1">{reservations.length} reservaciones totales</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Trend */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Tendencia de Ingresos (Últimos 7 Días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    formatter={(value) => `$${value.toFixed(2)} MXN`}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#DC2626" strokeWidth={3} dot={{ fill: '#DC2626', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Orders by Type */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Pedidos por Tipo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={ordersByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {ordersByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Popular Items */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Productos Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              {popularItems.length > 0 ? (
                <div className="space-y-4">
                  {popularItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          ['bg-red-100 text-red-600', 'bg-orange-100 text-orange-600', 'bg-yellow-100 text-yellow-600', 'bg-green-100 text-green-600', 'bg-blue-100 text-blue-600'][index]
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <span className="text-gray-600 font-semibold">{item.count} vendidos</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No hay datos de ventas aún</p>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Estadísticas Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Ingresos Totales</span>
                  <span className="font-bold text-xl text-green-600">${totalRevenue.toFixed(2)} MXN</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Valor Promedio del Pedido</span>
                  <span className="font-bold text-xl">${(totalRevenue / (orders.length || 1)).toFixed(2)} MXN</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Productos en Menú</span>
                  <span className="font-bold text-xl">{menuItems.length}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">Productos Disponibles</span>
                  <span className="font-bold text-xl text-green-600">{menuItems.filter(i => i.is_available).length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reservations Section */}
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold">Reservaciones</h2>
              <span className="text-sm text-gray-500">({todayReservations.length} hoy)</span>
            </div>
            <Button
              onClick={() => setShowReservationForm(!showReservationForm)}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              <Plus className="w-4 h-4" />
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