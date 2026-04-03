import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";

export default function IncomeTracker() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list('-created_date'),
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['companyTransactions'],
    queryFn: () => base44.entities.CompanyTransaction.list('-date'),
  });

  // Filter data by selected date
  const getDateRange = (dateStr) => {
    const date = new Date(dateStr);
    return {
      start: startOfDay(date),
      end: endOfDay(date),
    };
  };

  const dateRange = getDateRange(selectedDate);

  // Loyverse data (Orders with payment_method 'card' or 'cash')
  const loyverseIncome = orders.filter(o => {
    const orderDate = new Date(o.created_date);
    return orderDate >= dateRange.start && orderDate <= dateRange.end && o.status === 'delivered';
  });

  const loyverseCash = loyverseIncome
    .filter(o => o.payment_method === 'cash')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const loyverseCard = loyverseIncome
    .filter(o => o.payment_method === 'card')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Manual Cash (CompanyTransaction contributions in cash)
  const manualCash = transactions
    .filter(t => {
      const txDate = new Date(t.date);
      return txDate >= dateRange.start && txDate <= dateRange.end && 
             t.type === 'contribution' && t.payment_method === 'cash';
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Revolut/Bank (CompanyTransaction contributions via transfer)
  const revolut = transactions
    .filter(t => {
      const txDate = new Date(t.date);
      return txDate >= dateRange.start && txDate <= dateRange.end && 
             t.type === 'contribution' && t.payment_method === 'transfer';
    })
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalIncome = loyverseCash + loyverseCard + manualCash + revolut;

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-yellow-500/20 py-5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold text-yellow-400">Ingresos Diarios</h1>
              <p className="text-xs text-gray-500">Resumen de ingresos por fuente</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Date Picker */}
        <div className="flex gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="date">Seleccionar Fecha</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-yellow-500/20 bg-[#242424]"
            />
          </div>
          <div className="text-sm text-gray-400">
            {format(new Date(selectedDate), 'EEEE, d MMMM yyyy', { locale: es })}
          </div>
        </div>

        {/* Total Card */}
        <Card className="bg-gradient-to-r from-yellow-400/10 to-yellow-400/5 border border-yellow-500/30 shadow-none">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">Total Ingresos del Día</p>
                <div className="text-5xl font-bold text-yellow-400">${totalIncome.toFixed(2)}</div>
              </div>
              <div className="text-right text-sm text-gray-500">
                {loyverseIncome.length} órdenes
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Income Sources Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 bg-[#242424] border border-yellow-500/20">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Todo</TabsTrigger>
            <TabsTrigger value="clip" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Clip</TabsTrigger>
            <TabsTrigger value="loyverse" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Loyverse</TabsTrigger>
            <TabsTrigger value="cash" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Efectivo</TabsTrigger>
            <TabsTrigger value="revolut" className="text-xs data-[state=active]:bg-yellow-400 data-[state=active]:text-black text-gray-400">Revolut</TabsTrigger>
          </TabsList>

          {/* All Sources */}
          <TabsContent value="all" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Clip Card */}
              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    💳 Clip (Tarjetas)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-400">
                    ${loyverseCard.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {loyverseIncome.filter(o => o.payment_method === 'card').length} órdenes
                  </p>
                </CardContent>
              </Card>

              {/* Loyverse Cash Card */}
              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    💵 Loyverse (Efectivo)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-400">
                    ${loyverseCash.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {loyverseIncome.filter(o => o.payment_method === 'cash').length} órdenes
                  </p>
                </CardContent>
              </Card>

              {/* Manual Cash Card */}
              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    🏷️ Efectivo Manual
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-400">
                    ${manualCash.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Registros manuales</p>
                </CardContent>
              </Card>

              {/* Revolut Card */}
              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-400 flex items-center gap-2">
                    🏦 Revolut/Banco
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-400">
                    ${revolut.toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Transferencias</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Clip Tab */}
          <TabsContent value="clip" className="space-y-4">
            <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
              <CardHeader>
                <CardTitle>Clip - Pagos con Tarjeta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-400 mb-4">
                  ${loyverseCard.toFixed(2)}
                </div>
                <div className="text-sm text-gray-400">
                  {loyverseIncome.filter(o => o.payment_method === 'card').length} órdenes completadas
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loyverse Tab */}
          <TabsContent value="loyverse" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardHeader>
                  <CardTitle>Loyverse - Efectivo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-400 mb-2">
                    ${loyverseCash.toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-400">
                    {loyverseIncome.filter(o => o.payment_method === 'cash').length} órdenes
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
                <CardHeader>
                  <CardTitle>Loyverse - Tarjeta</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-400 mb-2">
                    ${loyverseCard.toFixed(2)}
                  </div>
                  <p className="text-sm text-gray-400">
                    {loyverseIncome.filter(o => o.payment_method === 'card').length} órdenes
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Cash Tab */}
          <TabsContent value="cash" className="space-y-4">
            <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
              <CardHeader>
                <CardTitle>Efectivo Manual Registrado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-400 mb-4">
                  ${manualCash.toFixed(2)}
                </div>
                {transactions.filter(t => {
                  const txDate = new Date(t.date);
                  return txDate >= dateRange.start && txDate <= dateRange.end && 
                         t.type === 'contribution' && t.payment_method === 'cash';
                }).length > 0 ? (
                  <div className="space-y-2">
                    {transactions.filter(t => {
                      const txDate = new Date(t.date);
                      return txDate >= dateRange.start && txDate <= dateRange.end && 
                             t.type === 'contribution' && t.payment_method === 'cash';
                    }).map(t => (
                      <div key={t.id} className="flex justify-between p-2 bg-[#1a1a1a] rounded text-sm">
                        <span>{t.contributor_name}</span>
                        <span className="text-yellow-400">${t.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No hay registros de efectivo para esta fecha</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revolut Tab */}
          <TabsContent value="revolut" className="space-y-4">
            <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
              <CardHeader>
                <CardTitle>Revolut / Transferencias Bancarias</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-400 mb-4">
                  ${revolut.toFixed(2)}
                </div>
                {transactions.filter(t => {
                  const txDate = new Date(t.date);
                  return txDate >= dateRange.start && txDate <= dateRange.end && 
                         t.type === 'contribution' && t.payment_method === 'transfer';
                }).length > 0 ? (
                  <div className="space-y-2">
                    {transactions.filter(t => {
                      const txDate = new Date(t.date);
                      return txDate >= dateRange.start && txDate <= dateRange.end && 
                             t.type === 'contribution' && t.payment_method === 'transfer';
                    }).map(t => (
                      <div key={t.id} className="flex justify-between p-2 bg-[#1a1a1a] rounded text-sm">
                        <span>{t.contributor_name}</span>
                        <span className="text-yellow-400">${t.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No hay transferencias para esta fecha</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}