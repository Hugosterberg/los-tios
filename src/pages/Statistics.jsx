import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, DollarSign, TrendingUp, Package, Calendar, TrendingDown, Printer } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, startOfDay, endOfDay } from "date-fns";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { es } from "date-fns/locale";

export default function Statistics() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedDay, setSelectedDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [printMode, setPrintMode] = useState(null); // 'daily' or 'monthly'

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date'),
  });

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: es })
    };
  });

  // Filter orders by selected month
  const monthOrders = orders.filter(o => {
    const orderDate = new Date(o.created_date);
    return format(orderDate, 'yyyy-MM') === selectedMonth;
  });

  // Filter expenses by selected month
  const monthExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    return format(expenseDate, 'yyyy-MM') === selectedMonth;
  });

  // Filter orders by selected day
  const dayOrders = orders.filter(o => {
    const orderDate = new Date(o.created_date);
    return format(orderDate, 'yyyy-MM-dd') === selectedDay;
  });

  // Filter expenses by selected day
  const dayExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.date);
    return format(expenseDate, 'yyyy-MM-dd') === selectedDay;
  });

  // Calculate statistics
  const calculateStats = (orderList, expenseList) => {
    const totalRevenue = orderList.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalExpenses = expenseList.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalProfit = totalRevenue - totalExpenses;
    const totalOrders = orderList.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const completedOrders = orderList.filter(o => o.status === 'delivered').length;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    return { totalRevenue, totalExpenses, totalProfit, totalOrders, avgOrderValue, completedOrders, profitMargin };
  };

  const monthStats = calculateStats(monthOrders, monthExpenses);
  const dayStats = calculateStats(dayOrders, dayExpenses);

  // Revenue, Expenses, and Profit by day for selected month
  const monthStart = new Date(selectedMonth + '-01');
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const dailyRevenue = daysInMonth.map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayOrders = orders.filter(o => format(new Date(o.created_date), 'yyyy-MM-dd') === dayStr);
    const dayExpenses = expenses.filter(e => format(new Date(e.date), 'yyyy-MM-dd') === dayStr);
    const revenue = dayOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const expense = dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const profit = revenue - expense;

    return {
      date: format(day, 'MMM dd'),
      revenue,
      expenses: expense,
      profit,
      orders: dayOrders.length
    };
  });

  // Orders by type for selected month
  const ordersByType = [
    { 
      name: 'Dine-in', 
      value: monthOrders.filter(o => o.order_type === 'dine-in').length,
      revenue: monthOrders.filter(o => o.order_type === 'dine-in').reduce((sum, o) => sum + (o.total_amount || 0), 0),
      color: '#DC2626' 
    },
    { 
      name: 'Takeout', 
      value: monthOrders.filter(o => o.order_type === 'takeout').length,
      revenue: monthOrders.filter(o => o.order_type === 'takeout').reduce((sum, o) => sum + (o.total_amount || 0), 0),
      color: '#F59E0B' 
    },
    { 
      name: 'Delivery', 
      value: monthOrders.filter(o => o.order_type === 'delivery').length,
      revenue: monthOrders.filter(o => o.order_type === 'delivery').reduce((sum, o) => sum + (o.total_amount || 0), 0),
      color: '#10B981' 
    },
  ];

  // Top selling items
  const itemCounts = {};
  const itemRevenue = {};
  monthOrders.forEach(order => {
    order.items?.forEach(item => {
      itemCounts[item.item_name] = (itemCounts[item.item_name] || 0) + item.quantity;
      itemRevenue[item.item_name] = (itemRevenue[item.item_name] || 0) + (item.price * item.quantity);
    });
  });

  const topItems = Object.entries(itemCounts)
    .map(([name, count]) => ({ name, count, revenue: itemRevenue[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const handlePrintDaily = () => {
    setPrintMode('daily');
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  const handlePrintMonthly = () => {
    setPrintMode('monthly');
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-after: always;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>

      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-12 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-10 h-10" />
            <div>
              <h1 className="text-4xl font-bold">Estadísticas de Ventas</h1>
              <p className="text-gray-300 mt-1">Sales Statistics & Profitability</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Date Filters */}
        <Card className="border-0 shadow-lg no-print">
          <CardHeader>
            <CardTitle>Seleccionar Período / Select Time Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ver por Mes / View by Month:</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Ver Día Específico / View Specific Day:</label>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Print Buttons */}
        <div className="flex gap-4 no-print">
          <Button onClick={handlePrintDaily} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Printer className="w-4 h-4" />
            Imprimir Reporte Diario / Print Daily Report
          </Button>
          <Button onClick={handlePrintMonthly} className="bg-purple-600 hover:bg-purple-700 gap-2">
            <Printer className="w-4 h-4" />
            Imprimir Reporte Mensual / Print Monthly Report
          </Button>
        </div>

        {/* Print Area */}
        <div className={printMode ? 'print-area' : ''}>
          {/* Header for Print */}
          {printMode && (
            <div className="mb-8 pb-6 border-b-2">
              <div className="text-center">
                <h1 className="text-3xl font-bold mb-2">Los Tios Pizzeria</h1>
                <h2 className="text-xl text-gray-700">
                  {printMode === 'daily' 
                    ? `Reporte Diario / Daily Report - ${format(new Date(selectedDay), 'dd MMMM yyyy', { locale: es })}`
                    : `Reporte Mensual / Monthly Report - ${monthOptions.find(m => m.value === selectedMonth)?.label}`
                  }
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Generado el / Generated on: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}
                </p>
              </div>
            </div>
          )}

          {/* Daily Statistics */}
          {(!printMode || printMode === 'daily') && (
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-4">
                Estadísticas Diarias / Daily Statistics - {format(new Date(selectedDay), 'MMMM d, yyyy', { locale: es })}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Ingresos del Día / Daily Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">${dayStats.totalRevenue.toFixed(2)}</div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Gastos del Día / Daily Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">${dayStats.totalExpenses.toFixed(2)}</div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg border-t-4 border-t-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Ganancia del Día / Daily Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${dayStats.totalProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                      ${dayStats.totalProfit.toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Margen: {dayStats.profitMargin.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Pedidos / Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{dayStats.totalOrders}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Orders Details */}
              {printMode === 'daily' && dayOrders.length > 0 && (
                <Card className="mt-6 border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Detalle de Pedidos / Orders Detail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dayOrders.map((order, idx) => (
                        <div key={order.id} className="p-4 border rounded-lg">
                          <div className="flex justify-between mb-2">
                            <div>
                              <p className="font-semibold">{order.customer_name}</p>
                              <p className="text-sm text-gray-600">{order.customer_phone}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg text-green-600">${order.total_amount?.toFixed(2)} MXN</p>
                              <p className="text-xs text-gray-500">{format(new Date(order.created_date), 'HH:mm')}</p>
                            </div>
                          </div>
                          <div className="text-sm space-y-1">
                            {order.items?.map((item, i) => (
                              <div key={i} className="flex justify-between">
                                <span>{item.quantity}x {item.item_name}</span>
                                <span>${(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Daily Expenses Details */}
              {printMode === 'daily' && dayExpenses.length > 0 && (
                <Card className="mt-6 border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Detalle de Gastos / Expenses Detail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Concepto / Item</th>
                          <th className="text-left py-2">Categoría / Category</th>
                          <th className="text-right py-2">Monto / Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayExpenses.map((expense) => (
                          <tr key={expense.id} className="border-b">
                            <td className="py-2">{expense.name}</td>
                            <td className="py-2 capitalize">{expense.category}</td>
                            <td className="text-right py-2 font-semibold">${expense.amount?.toFixed(2)} MXN</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {printMode === 'daily' && <div className="print-break"></div>}

          {/* Monthly Statistics */}
          {(!printMode || printMode === 'monthly') && (
            <div>
              <h2 className="text-2xl font-bold mb-4">
                Estadísticas Mensuales / Monthly Statistics - {monthOptions.find(m => m.value === selectedMonth)?.label}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Ingresos Mensuales / Monthly Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600">${monthStats.totalRevenue.toFixed(2)}</div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <TrendingDown className="w-4 h-4" />
                      Gastos Mensuales / Monthly Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-red-600">${monthStats.totalExpenses.toFixed(2)}</div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg border-t-4 border-t-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Ganancia Mensual / Monthly Profit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${monthStats.totalProfit >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                      ${monthStats.totalProfit.toFixed(2)}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Margen: {monthStats.profitMargin.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Total Pedidos / Total Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{monthStats.totalOrders}</div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Valor Promedio / Avg Order
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600">${monthStats.avgOrderValue.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Charts - Hide in print mode */}
              {!printMode && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                  {/* Revenue vs Expenses vs Profit Chart */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Ingresos, Gastos y Ganancias Diarias</CardTitle>
                      <p className="text-sm text-gray-500">Daily Revenue, Expenses & Profit</p>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={dailyRevenue}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" fontSize={11} />
                          <YAxis fontSize={12} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                            formatter={(value) => `$${value.toFixed(2)}`}
                          />
                          <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} name="Ingresos" dot={{ fill: '#10B981', r: 4 }} />
                          <Line type="monotone" dataKey="expenses" stroke="#DC2626" strokeWidth={3} name="Gastos" dot={{ fill: '#DC2626', r: 4 }} />
                          <Line type="monotone" dataKey="profit" stroke="#8B5CF6" strokeWidth={3} name="Ganancias" dot={{ fill: '#8B5CF6', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Orders by Type */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Orders by Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={ordersByType}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name}: ${value}`}
                            outerRadius={100}
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
              )}

              {/* Summary Tables for Print */}
              {printMode === 'monthly' && (
                <div className="space-y-6 mt-6">
                  {/* Revenue Breakdown by Type */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Ingresos por Tipo de Pedido / Revenue by Order Type</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Tipo / Type</th>
                            <th className="text-center py-2">Pedidos / Orders</th>
                            <th className="text-right py-2">Ingresos / Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ordersByType.map((type) => (
                            <tr key={type.name} className="border-b">
                              <td className="py-2">{type.name}</td>
                              <td className="text-center py-2">{type.value}</td>
                              <td className="text-right py-2 font-semibold">${type.revenue.toFixed(2)} MXN</td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2">Total</td>
                            <td className="text-center py-2">{monthStats.totalOrders}</td>
                            <td className="text-right py-2">${monthStats.totalRevenue.toFixed(2)} MXN</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  {/* Expenses Summary by Category */}
                  <Card className="border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle>Resumen de Gastos por Categoría / Expenses Summary by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Categoría / Category</th>
                            <th className="text-center py-2">Cantidad / Count</th>
                            <th className="text-right py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['ingredients', 'rent', 'utilities', 'salaries', 'equipment', 'marketing', 'other'].map(cat => {
                            const catExpenses = monthExpenses.filter(e => e.category === cat);
                            const total = catExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
                            if (catExpenses.length === 0) return null;
                            return (
                              <tr key={cat} className="border-b">
                                <td className="py-2 capitalize">{cat}</td>
                                <td className="text-center py-2">{catExpenses.length}</td>
                                <td className="text-right py-2 font-semibold">${total.toFixed(2)} MXN</td>
                              </tr>
                            );
                          })}
                          <tr className="font-bold">
                            <td className="py-2">Total</td>
                            <td className="text-center py-2">{monthExpenses.length}</td>
                            <td className="text-right py-2">${monthStats.totalExpenses.toFixed(2)} MXN</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Top Items */}
              <Card className="border-0 shadow-lg mt-6">
                <CardHeader>
                  <CardTitle>Top 10 Productos Más Vendidos / Top Selling Items</CardTitle>
                </CardHeader>
                <CardContent>
                  {topItems.length > 0 ? (
                    <div className="space-y-4">
                      {topItems.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                              ['bg-red-100 text-red-600', 'bg-orange-100 text-orange-600', 'bg-yellow-100 text-yellow-600', 'bg-green-100 text-green-600', 'bg-blue-100 text-blue-600'][index % 5]
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-semibold">{item.name}</p>
                              <p className="text-sm text-gray-600">{item.count} vendidos</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg text-green-600">${item.revenue.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">revenue</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No hay datos de ventas para este período</p>
                  )}
                </CardContent>
              </Card>

              {/* Revenue Breakdown by Type - Not in print */}
              {!printMode && (
                <Card className="border-0 shadow-lg mt-6">
                  <CardHeader>
                    <CardTitle>Ingresos por Tipo de Pedido / Revenue by Order Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {ordersByType.map((type) => (
                        <div key={type.name} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold">{type.name}</span>
                            <span className="text-sm text-gray-600">{type.value} pedidos</span>
                          </div>
                          <div className="text-2xl font-bold" style={{ color: type.color }}>
                            ${type.revenue.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}