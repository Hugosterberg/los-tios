import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Plus, Trash2, Edit, Check, AlertTriangle, Calendar, ArrowRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";

export default function ShoppingList() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("pending");
  const queryClient = useQueryClient();

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchasingItem, setPurchasingItem] = useState(null);
  const [purchaseActualCost, setPurchaseActualCost] = useState("");
  const [purchasePaymentSource, setPurchasePaymentSource] = useState("");

  const [formData, setFormData] = useState({
    item_name: "",
    quantity: 1,
    unit: "units",
    category: "ingredients",
    priority: "medium",
    status: "pending",
    estimated_cost: 0,
    actual_cost: 0, // Added actual_cost
    supplier: "",
    notes: "",
    purchased_date: "",
    converted_to_expense: false, // Added converted_to_expense
    expense_id: "", // Added expense_id
  });

  const { data: shoppingItems = [], isLoading } = useQuery({
    queryKey: ['shoppingList'],
    queryFn: () => base44.entities.ShoppingList.list('-created_date'),
  });

  const createItem = useMutation({
    mutationFn: (data) => base44.entities.ShoppingList.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      resetForm();
    },
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ShoppingList.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
      resetForm();
    },
  });

  const deleteItem = useMutation({
    mutationFn: (id) => base44.entities.ShoppingList.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shoppingList'] });
    },
  });

  const createExpense = useMutation({
    mutationFn: (data) => base44.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const categories = [
    { id: "all", name: "Todos / All", color: "bg-gray-100 text-gray-800", icon: "📋" },
    { id: "ingredients", name: "Ingredientes / Ingredients", color: "bg-yellow-400/20 text-yellow-400", icon: "🥗" },
    { id: "supplies", name: "Suministros / Supplies", color: "bg-yellow-400/20 text-yellow-400", icon: "📦" },
    { id: "equipment", name: "Equipo / Equipment", color: "bg-yellow-400/20 text-yellow-400", icon: "🔧" },
    { id: "cleaning", name: "Limpieza / Cleaning", color: "bg-yellow-400/20 text-yellow-400", icon: "🧹" },
    { id: "other", name: "Otros / Other", color: "bg-yellow-400/10 text-yellow-400/70", icon: "📌" },
  ];

  const priorityColors = {
    low: "bg-yellow-400/10 text-yellow-400/60",
    medium: "bg-yellow-400/15 text-yellow-400/80",
    high: "bg-yellow-400/20 text-yellow-400",
    urgent: "bg-yellow-400/30 text-yellow-300",
  };

  const units = [
    { value: "kg", label: "Kilogramos / Kg" },
    { value: "g", label: "Gramos / g" },
    { value: "l", label: "Litros / L" },
    { value: "ml", label: "Mililitros / ml" },
    { value: "units", label: "Unidades / Units" },
    { value: "pieces", label: "Piezas / Pieces" },
    { value: "other", label: "Otro / Other" },
  ];

  const filteredItems = shoppingItems.filter(item => {
    const categoryMatch = selectedCategory === "all" || item.category === selectedCategory;
    const statusMatch = filterStatus === "all" || item.status === filterStatus;
    return categoryMatch && statusMatch;
  });

  const pendingItems = shoppingItems.filter(i => i.status === 'pending');
  const urgentItems = pendingItems.filter(i => i.priority === 'urgent');
  const totalEstimatedCost = pendingItems.reduce((sum, i) => sum + (i.estimated_cost || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingItem) {
      updateItem.mutate({ id: editingItem.id, data: formData });
    } else {
      createItem.mutate(formData);
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm('¿Estás seguro de eliminar este producto? / Are you sure you want to delete this item?')) {
      deleteItem.mutate(id);
    }
  };

  const openPurchaseDialog = (item) => {
    setPurchasingItem(item);
    setPurchaseActualCost(item.estimated_cost?.toString() || "");
    setPurchasePaymentSource("");
    setPurchaseDialogOpen(true);
  };

  const confirmPurchase = async () => {
    if (!purchasePaymentSource) {
      alert('Selecciona un método de pago / Select a payment method');
      return;
    }

    const item = purchasingItem;
    const actualCost = purchaseActualCost !== '' ? parseFloat(purchaseActualCost) : 0;

    let updateData = {
      ...item,
      status: 'purchased',
      purchased_date: new Date().toISOString().split('T')[0],
      actual_cost: actualCost
    };

    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: updateData
      });

      const categoryMap = {
        'ingredients': 'ingredients',
        'supplies': 'other',
        'equipment': 'equipment',
        'cleaning': 'other',
        'other': 'other'
      };

      const expenseData = {
        name: item.item_name,
        category: categoryMap[item.category] || 'other',
        amount: actualCost || item.estimated_cost || 0,
        quantity: item.quantity,
        unit: item.unit,
        date: new Date().toISOString().split('T')[0],
        supplier: item.supplier || '',
        notes: item.notes || '',
        payment_source: purchasePaymentSource,
        paid_by_company: purchasePaymentSource === 'company_cash' || purchasePaymentSource === 'company_account',
        from_shopping_list: true,
        shopping_list_id: item.id,
      };

      const createdExpense = await createExpense.mutateAsync(expenseData);

      updateData = { ...updateData, converted_to_expense: true, expense_id: createdExpense.id };
      await updateItem.mutateAsync({
        id: item.id,
        data: updateData
      });

      setPurchaseDialogOpen(false);
      setPurchasingItem(null);
    } catch (error) {
      console.error("Error:", error);
      alert('Error al procesar / Error processing');
    }
  };

  const convertToExpense = async (item) => {
    if (confirm('¿Convertir este producto a gasto? / Convert this item to expense?')) {
      // Map shopping list category to expense category
      const categoryMap = {
        'ingredients': 'ingredients',
        'supplies': 'other', // Mapping supplies to other assuming general 'other' expense category
        'equipment': 'equipment',
        'cleaning': 'other', // Mapping cleaning to other assuming general 'other' expense category
        'other': 'other'
      };

      const expenseData = {
        name: item.item_name,
        category: categoryMap[item.category] || 'other',
        amount: item.actual_cost || item.estimated_cost || 0,
        quantity: item.quantity,
        unit: item.unit,
        date: item.purchased_date || new Date().toISOString().split('T')[0],
        supplier: item.supplier || '',
        notes: item.notes || '',
        payment_source: 'company_cash', // Added payment_source
        paid_by_company: true,
        from_shopping_list: true,
        shopping_list_id: item.id,
      };

      try {
        const createdExpense = await createExpense.mutateAsync(expenseData);
        
        // Update shopping list item to mark as converted
        await updateItem.mutateAsync({
          id: item.id,
          data: { ...item, converted_to_expense: true, expense_id: createdExpense.id }
        });

        // Manually invalidate queries to ensure refresh
        queryClient.invalidateQueries({ queryKey: ['expenses'] });
        queryClient.invalidateQueries({ queryKey: ['shoppingList'] });

        alert('✓ Producto convertido a gasto exitosamente / Item converted to expense successfully');
      } catch (error) {
        console.error("Error converting to expense:", error);
        alert('Error al convertir a gasto / Error converting to expense');
      }
    }
  };

  const markAsPending = (item) => {
    updateItem.mutate({
      id: item.id,
      data: { ...item, status: 'pending', purchased_date: '', actual_cost: 0, converted_to_expense: false, expense_id: '' }
    });
  };

  const resetForm = () => {
    setFormData({
      item_name: "",
      quantity: 1,
      unit: "units",
      category: "ingredients",
      priority: "medium",
      status: "pending",
      estimated_cost: 0,
      actual_cost: 0,
      supplier: "",
      notes: "",
      purchased_date: "",
      converted_to_expense: false,
      expense_id: "",
    });
    setEditingItem(null);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="bg-[#1a1a1a] border-b border-yellow-500/20 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-6 h-6 text-yellow-400" />
              <div>
                <h1 className="text-xl font-bold text-yellow-400">Lista de Compras</h1>
                <p className="text-xs text-gray-500">Gestión de compras</p>
              </div>
            </div>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-yellow-400 hover:bg-yellow-300 text-black gap-2"
            >
              <Plus className="w-4 h-4" />
              Agregar Producto / Add Item
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Productos Pendientes / Pending Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400">{pendingItems.length}</div>
              <p className="text-xs text-gray-500 mt-1">por comprar / to buy</p>
            </CardContent>
          </Card>

          <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Productos Urgentes / Urgent Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400">{urgentItems.length}</div>
              <p className="text-xs text-gray-500 mt-1">prioridad urgente</p>
            </CardContent>
          </Card>

          <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Costo Estimado / Estimated Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400">${totalEstimatedCost.toFixed(2)}</div>
              <p className="text-xs text-gray-500 mt-1">MXN (pendientes)</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex gap-2 overflow-x-auto pb-2 flex-1">
            {categories.map((cat) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 whitespace-nowrap ${
                  selectedCategory === cat.id ? 'bg-yellow-400 hover:bg-yellow-300 text-black' : 'border-yellow-500/20 text-gray-400'
                }`}
              >
                <span>{cat.icon}</span>
                {cat.name}
              </Button>
            ))}
          </div>
          
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos / All</SelectItem>
              <SelectItem value="pending">Pendientes / Pending</SelectItem>
              <SelectItem value="purchased">Comprados / Purchased</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Form */}
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl">
                  {editingItem ? 'Editar Producto / Edit Item' : 'Agregar Producto / Add Item'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="item_name">Nombre del Producto / Item Name *</Label>
                      <Input
                        id="item_name"
                        required
                        value={formData.item_name}
                        onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                        placeholder="Harina, Aceite, Servilletas..."
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
                      <Label htmlFor="quantity">Cantidad / Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unit">Unidad / Unit *</Label>
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
                      <Label htmlFor="priority">Prioridad / Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baja / Low</SelectItem>
                          <SelectItem value="medium">Media / Medium</SelectItem>
                          <SelectItem value="high">Alta / High</SelectItem>
                          <SelectItem value="urgent">Urgente / Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estimated_cost">Costo Estimado / Estimated Cost (MXN)</Label>
                      <Input
                        id="estimated_cost"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.estimated_cost}
                        onChange={(e) => setFormData({ ...formData, estimated_cost: parseFloat(e.target.value) })}
                        placeholder="0.00"
                      />
                    </div>

                    {editingItem && editingItem.status === 'purchased' && (
                      <div className="space-y-2">
                        <Label htmlFor="actual_cost">Costo Real / Actual Cost (MXN)</Label>
                        <Input
                          id="actual_cost"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.actual_cost || ''}
                          onChange={(e) => setFormData({ ...formData, actual_cost: parseFloat(e.target.value) })}
                          placeholder="0.00"
                        />
                      </div>
                    )}

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
                      <Label htmlFor="status">Estado / Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pendiente / Pending</SelectItem>
                          <SelectItem value="purchased">Comprado / Purchased</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

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
                      disabled={createItem.isPending || updateItem.isPending}
                      className="bg-yellow-400 hover:bg-yellow-300 text-black"
                      >
                      {editingItem ? 'Actualizar / Update' : 'Guardar / Save'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Shopping List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-400 mx-auto"></div>
              <p className="mt-4 text-gray-600">Cargando lista... / Loading list...</p>
            </div>
          ) : filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const category = categories.find(c => c.id === item.category) || categories[categories.length - 1];
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={`bg-[#242424] border border-yellow-500/15 shadow-none transition-all ${
                    item.status === 'purchased' ? 'opacity-60' : ''
                  }`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-3 mb-3">
                            <span className="text-2xl">{category.icon}</span>
                            <div className="flex-1">
                              <h3 className={`font-bold text-lg ${item.status === 'purchased' ? 'line-through text-gray-500' : ''}`}>
                                {item.item_name}
                              </h3>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <Badge className={category.color}>
                                  {category.name.split('/')[0].trim()}
                                </Badge>
                                <Badge className={priorityColors[item.priority]}>
                                  {item.priority === 'urgent' && '⚠️ '}
                                  {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                                </Badge>
                                {item.status === 'purchased' && (
                                  <Badge className="bg-yellow-400/20 text-yellow-400">
                                    ✓ Comprado / Purchased
                                  </Badge>
                                )}
                                {item.converted_to_expense && (
                                  <Badge className="bg-yellow-400/10 text-yellow-400/80">
                                     💰 Convertido a Gasto / Converted to Expense
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                            <div>
                              <p className="text-gray-600">Cantidad:</p>
                              <p className="font-semibold">{item.quantity} {item.unit}</p>
                            </div>
                            {item.estimated_cost > 0 && (
                              <div>
                                <p className="text-gray-600">Costo Estimado:</p>
                                <p className="font-semibold">${item.estimated_cost?.toFixed(2)} MXN</p>
                              </div>
                            )}
                            {item.actual_cost > 0 && (
                              <div>
                                <p className="text-gray-600">Costo Real:</p>
                                <p className="font-semibold text-yellow-400">${item.actual_cost?.toFixed(2)} MXN</p>
                              </div>
                            )}
                            {item.supplier && (
                              <div>
                                <p className="text-gray-600">Proveedor:</p>
                                <p className="font-semibold">{item.supplier}</p>
                              </div>
                            )}
                            {item.purchased_date && (
                              <div>
                                <p className="text-gray-600">Fecha Compra:</p>
                                <p className="font-semibold">{format(new Date(item.purchased_date), 'dd MMM yyyy', { locale: es })}</p>
                              </div>
                            )}
                          </div>

                          {item.notes && (
                            <div className="mt-3 p-3 bg-[#1a1a1a] rounded-lg">
                              <p className="text-sm text-gray-700">{item.notes}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          <div className="flex gap-2 flex-wrap justify-end">
                            {item.status === 'pending' ? (
                              <Button
                                size="sm"
                                onClick={() => openPurchaseDialog(item)}
                                className="bg-yellow-400 hover:bg-yellow-300 text-black gap-2"
                              >
                                <Check className="w-4 h-4" />
                                Marcar Comprado / Mark Purchased
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markAsPending(item)}
                                >
                                  Marcar Pendiente / Mark Pending
                                </Button>
                                {!item.converted_to_expense && (
                                  <Button
                                    size="sm"
                                    onClick={() => convertToExpense(item)}
                                    className="bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-400 border border-yellow-500/30 gap-2"
                                  >
                                    <ArrowRight className="w-4 h-4" />
                                    Convertir a Gasto / Convert to Expense
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => handleEdit(item)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(item.id)}
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
            <Card className="bg-[#242424] border border-yellow-500/15 shadow-none">
              <CardContent className="text-center py-20">
                <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg">No hay productos en la lista</p>
                <p className="text-gray-400 text-sm">No items in the shopping list</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como Comprado / Mark as Purchased</DialogTitle>
          </DialogHeader>
          
          {purchasingItem && (
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-bold text-lg">{purchasingItem.item_name}</h3>
                <p className="text-sm text-gray-600">
                  {purchasingItem.quantity} {purchasingItem.unit} • 
                  Estimado: ${(purchasingItem.estimated_cost || 0).toFixed(2)} MXN
                </p>
              </div>

              <div className="space-y-2">
                <Label>Costo Real Pagado / Actual Cost Paid (MXN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseActualCost}
                  onChange={(e) => setPurchaseActualCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-3">
                <Label>¿Cómo se pagó? / How was it paid? *</Label>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => setPurchasePaymentSource('company_cash')}
                    className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all text-left ${
                      purchasePaymentSource === 'company_cash'
                        ? 'border-yellow-400 bg-yellow-400/10 text-white'
                        : 'border-yellow-500/20 text-gray-400 hover:border-yellow-500/40'
                    }`}
                  >
                    <span className="text-2xl">💵</span>
                    <div>
                      <p className="font-semibold">Efectivo Empresa</p>
                      <p className="text-xs text-gray-600">Company Cash</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPurchasePaymentSource('company_account')}
                    className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all text-left ${
                      purchasePaymentSource === 'company_account'
                        ? 'border-yellow-400 bg-yellow-400/10 text-white'
                        : 'border-yellow-500/20 text-gray-400 hover:border-yellow-500/40'
                    }`}
                  >
                    <span className="text-2xl">🏦</span>
                    <div>
                      <p className="font-semibold">Cuenta Empresa</p>
                      <p className="text-xs text-gray-600">Company Account</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPurchasePaymentSource('individual')}
                    className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all text-left ${
                      purchasePaymentSource === 'individual'
                        ? 'border-yellow-400 bg-yellow-400/10 text-white'
                        : 'border-yellow-500/20 text-gray-400 hover:border-yellow-500/40'
                    }`}
                  >
                    <span className="text-2xl">👤</span>
                    <div>
                      <p className="font-semibold">Persona Individual</p>
                      <p className="text-xs text-gray-600">Individual Person</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPurchaseDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmPurchase}
                  disabled={!purchasePaymentSource || updateItem.isPending || createExpense.isPending}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Confirmar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}