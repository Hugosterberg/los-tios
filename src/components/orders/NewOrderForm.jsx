import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ShoppingBag, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function NewOrderForm({ menuItems, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    customer_name: "",
    customer_phone: "",
    order_type: "dine-in",
    table_number: "",
    delivery_address: "",
    special_instructions: "",
    items: [],
    total_amount: 0,
  });

  const [showCustomItemDialog, setShowCustomItemDialog] = useState(false);
  const [customItem, setCustomItem] = useState({ name: "", price: 0 });

  const availableItems = menuItems.filter(item => item.is_available);

  const addItem = (menuItem) => {
    const existingItem = formData.items.find(item => item.menu_item_id === menuItem.id && !item.is_custom);
    
    if (existingItem) {
      setFormData({
        ...formData,
        items: formData.items.map(item =>
          item.menu_item_id === menuItem.id && !item.is_custom
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      });
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, {
          menu_item_id: menuItem.id,
          item_name: menuItem.name,
          quantity: 1,
          price: menuItem.price,
          is_custom: false,
        }]
      });
    }
  };

  const addCustomItem = () => {
    if (!customItem.name || customItem.price <= 0) {
      alert('Por favor ingrese nombre y precio del producto / Please enter item name and price');
      return;
    }

    setFormData({
      ...formData,
      items: [...formData.items, {
        menu_item_id: null,
        item_name: customItem.name,
        quantity: 1,
        price: customItem.price,
        is_custom: true,
      }]
    });

    setCustomItem({ name: "", price: 0 });
    setShowCustomItemDialog(false);
  };

  const updateQuantity = (index, quantity) => {
    const newItems = [...formData.items];
    newItems[index].quantity = Math.max(1, quantity);
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      total_amount: calculateTotal()
    });
  };

  return (
    <Card className="mb-8 border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ShoppingBag className="w-6 h-6" />
          Nuevo Pedido / New Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Cliente / Customer Name</Label>
              <Input
                id="name"
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="Juan Pérez (opcional / optional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">
                Teléfono / Phone Number {formData.order_type === 'takeout' && '*'}
              </Label>
              <Input
                id="phone"
                type="tel"
                required={formData.order_type === 'takeout'}
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                placeholder="+52 55 1234 5678"
              />
              {formData.order_type === 'takeout' && (
                <p className="text-xs text-gray-500">Requerido para pedidos para llevar / Required for takeout orders</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Order Type *</Label>
              <Select
                value={formData.order_type}
                onValueChange={(value) => setFormData({ ...formData, order_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dine-in">Dine-in</SelectItem>
                  <SelectItem value="takeout">Takeout</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.order_type === "dine-in" && (
              <div className="space-y-2">
                <Label htmlFor="table">Table Number</Label>
                <Input
                  id="table"
                  value={formData.table_number}
                  onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                  placeholder="Table 5"
                />
              </div>
            )}

            {formData.order_type === "delivery" && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Delivery Address *</Label>
                <Input
                  id="address"
                  required={formData.order_type === "delivery"}
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                  placeholder="123 Main St, Apt 4B"
                />
              </div>
            )}
          </div>

          {/* Menu Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Select Items from Menu:</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCustomItemDialog(true)}
                className="gap-2 border-2 border-purple-600 text-purple-600 hover:bg-purple-50"
              >
                <PlusCircle className="w-4 h-4" />
                Producto Personalizado / Custom Item
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-4 bg-gray-50 rounded-lg">
              {availableItems.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant="outline"
                  onClick={() => addItem(item)}
                  className="h-auto flex-col items-start p-3 hover:bg-red-50 hover:border-red-300"
                >
                  <span className="font-semibold text-sm">{item.name}</span>
                  <span className="text-red-600 font-bold">${item.price?.toFixed(2)}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Order Items */}
          {formData.items.length > 0 && (
            <div className="space-y-4">
              <Label>Order Items:</Label>
              <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-4 p-3 bg-white rounded border">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.item_name}</p>
                        {item.is_custom && (
                          <Badge className="bg-purple-100 text-purple-800 text-xs">Personalizado</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">${item.price?.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(index, parseInt(e.target.value))}
                        className="w-20"
                      />
                      <span className="font-bold w-20 text-right">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="flex justify-between items-center pt-3 border-t-2 font-bold text-lg">
                  <span>Total:</span>
                  <span className="text-red-600 text-2xl">${calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="instructions">Special Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.special_instructions}
              onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
              placeholder="Extra cheese, no onions, etc..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || formData.items.length === 0} 
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? "Creating Order..." : "Create Order"}
            </Button>
          </div>
        </form>

        {/* Custom Item Dialog */}
        <Dialog open={showCustomItemDialog} onOpenChange={setShowCustomItemDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Agregar Producto Personalizado / Add Custom Item</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom_name">Nombre del Producto / Item Name *</Label>
                <Input
                  id="custom_name"
                  value={customItem.name}
                  onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                  placeholder="Ej: Pizza Especial / e.g: Special Pizza"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom_price">Precio / Price (MXN) *</Label>
                <Input
                  id="custom_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={customItem.price}
                  onChange={(e) => setCustomItem({ ...customItem, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCustomItemDialog(false);
                    setCustomItem({ name: "", price: 0 });
                  }}
                  className="flex-1"
                >
                  Cancelar / Cancel
                </Button>
                <Button
                  type="button"
                  onClick={addCustomItem}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  Agregar / Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}