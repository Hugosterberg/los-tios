import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag } from "lucide-react";

export default function OrderForm({ cartItems, onSubmit, onCancel, isLoading }) {
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

  useEffect(() => {
    if (cartItems) {
      const items = cartItems.map(item => ({
        menu_item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));
      const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      setFormData(prev => ({ ...prev, items, total_amount: total }));
    }
  }, [cartItems]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="mb-8 border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          <ShoppingBag className="w-6 h-6" />
          New Order
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {cartItems && cartItems.length > 0 && (
            <div className="p-4 bg-gray-50 rounded-xl">
              <h4 className="font-semibold mb-3">Order Items:</h4>
              {cartItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                  <span>{item.name} x {item.quantity}</span>
                  <span className="font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 mt-3 border-t-2 font-bold text-lg">
                <span>Total:</span>
                <span className="text-red-600">${formData.total_amount.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Customer Name *</Label>
              <Input
                id="name"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                required
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
              />
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
                />
              </div>
            )}

            {formData.order_type === "delivery" && (
              <div className="space-y-2">
                <Label htmlFor="address">Delivery Address *</Label>
                <Input
                  id="address"
                  required={formData.order_type === "delivery"}
                  value={formData.delivery_address}
                  onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Special Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.special_instructions}
              onChange={(e) => setFormData({ ...formData, special_instructions: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700">
              {isLoading ? "Placing Order..." : "Place Order"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}