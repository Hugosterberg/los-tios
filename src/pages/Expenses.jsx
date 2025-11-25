
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Plus, Trash2, Edit, TrendingDown, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";

export default function Expenses() {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    category: "ingredients",
    amount: 0,
    quantity: 1,
    unit: "units",
    is_recurring: false,
    recurring_frequency: "monthly",
    date: new Date().toISOString().split('T')[0],
    notes: "",
    supplier: "",
    payment_source: "company_cash", // New field for payment source
    paid_by_company: false, // This will be derived from payment_source
    from_shopping_list: false,
    contributors: [],
  });

  const [contributorInput, setContributorInput] = useState({ name: "", amount: 0 });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date'),
  });

  const { data: companyContributors = [] } = useQuery({
    queryKey: ['contributors'],
    queryFn: () => base44.entities.Contributor.list('name'),
  });

  const createExpense = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      resetForm();
    },
  });

  const updateExpense = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expense.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      resetForm();
    },
  });

  const deleteExpense = useMutation({
    mutationFn: (id) => base44.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const categories = [
    { id: "all", name: "Todos / All", color: "bg-gray-100 text-gray-800", icon: "📋" },
    { id: "ingredients", name: "Ingredientes / Ingredients", color: "bg-green-100 text-green-800", icon: "🥗" },
    { id: "rent", name: "Renta / Rent", color: "bg-blue-100 text-blue-800", icon: "🏠" },
    { id: "utilities", name: "Servicios / Utilities", color: "bg-yellow-100 text-yellow-800", icon: "💡" },
    { id: "salaries", name: "Salarios / Salaries", color: "bg-purple-100 text-purple-800", icon: "👥" },
    { id: "equipment", name: "Equipo / Equipment", color: "bg-orange-100 text-orange-800", icon: "🔧" },
    { id: "marketing", name: "Marketing", color: "bg-pink-100 text-pink-800", icon: "📢" },
    { id: "other", name: "Otros / Other", color: "bg-gray-100 text-gray-800", icon: "📦" },
  ];

  const units = [
    { value: "kg", label: "Kilogramos / Kg" },
    { value: "g", label: "Gramos / g" },
    { value: "l", label: "Litros / L" },
    { value: "ml", label: "Mililitros / ml" },
    { value: "units", label: "Unidades / Units" },
    { value: "pieces", label: "Piezas / Pieces" },
    { value: "months", label: "Meses / Months" },
    { value: "other", label: "Otro / Other" },
  ];

  const filteredExpenses = selectedCategory === "all"
    ? expenses
    : expenses.filter(e => e.category === selectedCategory);

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const recurringExpenses = filteredExpenses.filter(e => e.is_recurring);
  const monthlyRecurring = recurringExpenses
    .filter(e => e.recurring_frequency === "monthly")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Auto-set paid_by_company based on payment_source
    const submitData = {
      ...formData,
      paid_by_company: formData.payment_source === 'company_cash' || formData.payment_source === 'company_account'
    };
    
    if (editingExpense) {
      updateExpense.mutate({ id: editingExpense.id, data: submitData });
    } else {
      createExpense.mutate(submitData);
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      ...expense,
      contributors: expense.contributors || [],
      paid_by_company: expense.paid_by_company || false,
      from_shopping_list: expense.from_shopping_list || false,
      payment_source: expense.payment_source || 'company_cash', // Load existing or default
    });
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('¿Estás seguro de eliminar este gasto? / Are you sure you want to delete this expense?')) {
      deleteExpense.mutate(id);
    }
  };

  const addContributor = () => {
    if (contributorInput.name && contributorInput.amount > 0) {
      setFormData({
        ...formData,
        contributors: [...(formData.contributors || []), { ...contributorInput }]
      });
      setContributorInput({ name: "", amount: 0 });
    }
  };

  const removeContributor = (index) => {
    setFormData({
      ...formData,
      contributors: formData.contributors.filter((_, i) => i !== index)
    });
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "ingredients",
      amount: 0,
      quantity: 1,
      unit: "units",
      is_recurring: false,
      recurring_frequency: "monthly",
      date: new Date().toISOString().split('T')[0],
      notes: "",
      supplier: "",
      payment_source: "company_cash", // Reset payment_source
      paid_by_company: false, // Reset paid_by_company (will be derived)
      from_shopping_list: false,
      contributors: [],
    });
    setContributorInput({ name: "", amount: 0 });
    setEditingExpense(null);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <Receipt className="w-10 h-10" />
              <div>
                <h1 className="text-4xl font-bold">Gastos del Restaurante</h1>
                <p className="text-gray-300 mt-1">Restaurant Expenses</p>
              </div>
            </div>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-red-600 hover:bg-red-700 gap-2"
            >
              <Plus className="w-4 h-4" />
              Nuevo Gasto / New Expense
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Total de Gastos / Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">${totalExpenses.toFixed(2)} MXN</div>
              <p className="text-xs text-gray-500 mt-1">{filteredExpenses.length} gastos registrados</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Gastos Recurrentes Mensuales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">${monthlyRecurring.toFixed(2)} MXN</div>
              <p className="text-xs text-gray-500 mt-1">{recurringExpenses.filter(e => e.recurring_frequency === "monthly").length} gastos mensuales</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Recurrentes / Total Recurring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{recurringExpenses.length}</div>
              <p className="text-xs text-gray-500 mt-1">gastos recurrentes activos</p>
            </CardContent>
          </Card>
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 whitespace-nowrap ${
                selectedCategory === cat.id ? 'bg-red-600 hover:bg-red-700' : ''
              }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-2xl">
                  {editingExpense ? 'Editar Gasto / Edit Expense' : 'Nuevo Gasto / New Expense'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre del Gasto / Expense Name *</Label>
                      <Input
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Harina, Renta, Electricidad..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Categoría / Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.filter(c => c.id !== "all").map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="amount">Monto / Amount (MXN) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date">Fecha / Date *</Label>
                      <Input
                        id="date"
                        type="date"
                        required
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity">Cantidad / Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unit">Unidad / Unit</Label>
                      <Select
                        value={formData.unit}
                        onValueChange={(value) => setFormData({ ...formData, unit: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map(unit => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplier">Proveedor / Supplier</Label>
                      <Input
                        id="supplier"
                        value={formData.supplier}
                        onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                        placeholder="Nombre del proveedor..."
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="recurring"
                          checked={formData.is_recurring}
                          onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="recurring" className="cursor-pointer">
                          Gasto Recurrente / Recurring Expense
                        </Label>
                      </div>
                      {formData.is_recurring && (
                        <Select
                          value={formData.recurring_frequency}
                          onValueChange={(value) => setFormData({ ...formData, recurring_frequency: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Diario / Daily</SelectItem>
                            <SelectItem value="weekly">Semanal / Weekly</SelectItem>
                            <SelectItem value="monthly">Mensual / Monthly</SelectItem>
                            <SelectItem value="yearly">Anual / Yearly</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* New checkbox for from_shopping_list */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="from_shopping_list"
                          checked={formData.from_shopping_list}
                          onChange={(e) => setFormData({ ...formData, from_shopping_list: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="from_shopping_list" className="cursor-pointer">
                          🛒 Desde Lista de Compras / From Shopping List
                        </Label>
                      </div>
                    </div>

                    {/* Payment Source Selection */}
                    <div className="space-y-2 md:col-span-2">
                      <Label>Fuente de Pago / Payment Source *</Label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, payment_source: 'company_cash', contributors: [] })}
                          className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${
                            formData.payment_source === 'company_cash'
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="text-3xl">💵</div>
                          <div className="text-center">
                            <p className="font-semibold">Efectivo Empresa</p>
                            <p className="text-xs text-gray-600">Company Cash</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, payment_source: 'company_account', contributors: [] })}
                          className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${
                            formData.payment_source === 'company_account'
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="text-3xl">🏦</div>
                          <div className="text-center">
                            <p className="font-semibold">Cuenta Empresa</p>
                            <p className="text-xs text-gray-600">Company Account</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, payment_source: 'individual' })}
                          className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${
                            formData.payment_source === 'individual'
                              ? 'border-red-600 bg-red-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          <div className="text-3xl">👤</div>
                          <div className="text-center">
                            <p className="font-semibold">Persona Individual</p>
                            <p className="text-xs text-gray-600">Individual Person</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Show contributors section only if payment source is individual */}
                    {formData.payment_source === 'individual' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>Contribuyentes Individuales / Individual Contributors</Label>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                          {/* Add Contributor */}
                          <div className="flex gap-2">
                            <Select
                              value={contributorInput.name}
                              onValueChange={(value) => setContributorInput({ ...contributorInput, name: value })}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Seleccionar contribuyente..." />
                              </SelectTrigger>
                              <SelectContent>
                                {companyContributors.map(c => (
                                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Monto"
                              value={contributorInput.amount}
                              onChange={(e) => setContributorInput({ ...contributorInput, amount: parseFloat(e.target.value) })}
                              className="w-32"
                            />
                            <Button
                              type="button"
                              onClick={addContributor}
                              variant="outline"
                              className="whitespace-nowrap"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Agregar
                            </Button>
                          </div>

                          {/* Contributors List */}
                          {formData.contributors && formData.contributors.length > 0 && (
                            <div className="space-y-2">
                              {formData.contributors.map((contributor, index) => (
                                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                      <span className="text-sm font-semibold text-purple-600">
                                        {contributor.name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-semibold">{contributor.name}</p>
                                      <p className="text-sm text-gray-600">${contributor.amount.toFixed(2)} MXN</p>
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removeContributor(index)}
                                    className="text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                              <div className="flex justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                                <span className="font-semibold">Total Contribuido / Total Contributed:</span>
                                <span className="font-bold text-purple-600">
                                  ${formData.contributors.reduce((sum, c) => sum + (c.amount || 0), 0).toFixed(2)} MXN
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="notes">Notas / Notes</Label>
                      <Textarea
                        id="notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Información adicional..."
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancelar / Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createExpense.isPending || updateExpense.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {editingExpense ? 'Actualizar / Update' : 'Guardar / Save'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Expenses List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando gastos... / Loading expenses...</p>
            </div>
          ) : filteredExpenses.length > 0 ? (
            filteredExpenses.map((expense) => {
              const category = categories.find(c => c.id === expense.category) || categories[categories.length - 1];
              const totalContributed = expense.contributors?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0;
              const remaining = expense.amount - totalContributed;
              
              const paymentSourceLabels = {
                'company_cash': '💵 Efectivo Empresa / Company Cash',
                'company_account': '🏦 Cuenta Empresa / Company Account',
                'individual': '👤 Persona Individual / Individual'
              };
              
              return (
                <motion.div
                  key={expense.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="border-0 shadow hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="text-2xl">{category.icon}</span>
                            <div className="flex-1">
                              <h3 className="font-bold text-lg">{expense.name}</h3>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge className={category.color}>
                                  {category.name.split('/')[0].trim()}
                                </Badge>
                                {expense.is_recurring && (
                                  <Badge className="bg-purple-100 text-purple-800">
                                    🔄 Recurrente / Recurring
                                  </Badge>
                                )}
                                {expense.payment_source && (
                                  <Badge className={
                                    expense.payment_source === 'company_cash' ? 'bg-green-100 text-green-800' :
                                    expense.payment_source === 'company_account' ? 'bg-blue-100 text-blue-800' :
                                    'bg-orange-100 text-orange-800'
                                  }>
                                    {paymentSourceLabels[expense.payment_source]}
                                  </Badge>
                                )}
                                {expense.from_shopping_list && (
                                  <Badge className="bg-teal-100 text-teal-800">
                                    🛒 Desde Lista de Compras / From Shopping List
                                  </Badge>
                                )}
                                <Badge variant="outline">
                                  {format(new Date(expense.date), 'dd MMM yyyy', { locale: es })}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                            <div>
                              <p className="text-gray-600">Cantidad:</p>
                              <p className="font-semibold">{expense.quantity} {expense.unit}</p>
                            </div>
                            {expense.supplier && (
                              <div>
                                <p className="text-gray-600">Proveedor:</p>
                                <p className="font-semibold">{expense.supplier}</p>
                              </div>
                            )}
                            {expense.is_recurring && (
                              <div>
                                <p className="text-gray-600">Frecuencia:</p>
                                <p className="font-semibold capitalize">{expense.recurring_frequency}</p>
                              </div>
                            )}
                          </div>

                          {/* Contributors Section - only show if payment source is individual */}
                          {expense.payment_source === 'individual' && expense.contributors && expense.contributors.length > 0 && (
                            <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                              <h4 className="font-semibold text-sm mb-3 text-purple-900">Contribuyentes / Contributors:</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                {expense.contributors.map((contributor, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm p-2 bg-white rounded">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                                        <span className="text-xs font-semibold text-purple-600">
                                          {contributor.name.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                      <span className="font-medium">{contributor.name}</span>
                                    </div>
                                    <span className="font-semibold text-purple-600">${contributor.amount?.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between items-center pt-3 border-t border-purple-200">
                                <div>
                                  <p className="text-xs text-purple-700">Total Contribuido:</p>
                                  <p className="font-bold text-purple-900">${totalContributed.toFixed(2)} MXN</p>
                                </div>
                                {remaining > 0 && (
                                  <div className="text-right">
                                    <p className="text-xs text-orange-700">Pendiente:</p>
                                    <p className="font-bold text-orange-600">${remaining.toFixed(2)} MXN</p>
                                  </div>
                                )}
                                {remaining < 0 && (
                                  <div className="text-right">
                                    <p className="text-xs text-red-700">Excedente:</p>
                                    <p className="font-bold text-red-600">${Math.abs(remaining).toFixed(2)} MXN</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {expense.notes && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-700">{expense.notes}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          <div className="text-right">
                            <div className="text-3xl font-bold text-red-600">
                              ${expense.amount?.toFixed(2)}
                            </div>
                            <p className="text-xs text-gray-500">MXN Total</p>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleEdit(expense)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(expense.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            <Card className="border-0 shadow">
              <CardContent className="text-center py-20">
                <Receipt className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg">No hay gastos registrados</p>
                <p className="text-gray-400 text-sm">No expenses recorded</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
