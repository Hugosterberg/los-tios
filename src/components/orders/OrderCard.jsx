import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Clock, Package, Truck, User, Phone, MapPin, Printer, Trash2, Banknote, CreditCard } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const statusConfig = {
  pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "Pending" },
  preparing: { color: "bg-blue-100 text-blue-800 border-blue-300", label: "Preparing" },
  ready: { color: "bg-green-100 text-green-800 border-green-300", label: "Ready" },
  delivered: { color: "bg-gray-100 text-gray-800 border-gray-300", label: "Delivered" },
  cancelled: { color: "bg-red-100 text-red-800 border-red-300", label: "Cancelled" },
};

const orderTypeIcons = {
  "dine-in": Package,
  "takeout": Package,
  "delivery": Truck,
};

export default function OrderCard({ order, onUpdateStatus, onPrintReceipt, onDelete, onCompleteOrder }) {
  const Icon = orderTypeIcons[order.order_type] || Package;
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const handleCompleteWithPayment = (paymentMethod) => {
    onCompleteOrder(order, paymentMethod);
    setShowPaymentDialog(false);
  };

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Order Info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold">{order.customer_name}</h3>
                  <Badge className={`${statusConfig[order.status]?.color} border`}>
                    {statusConfig[order.status]?.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  {format(new Date(order.created_date), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
              
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">
                  ${order.total_amount?.toFixed(2)}
                </div>
                <Badge variant="outline" className="mt-1">
                  <Icon className="w-3 h-3 mr-1" />
                  {order.order_type}
                </Badge>
              </div>
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4" />
                {order.customer_phone}
              </div>
              {order.table_number && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Package className="w-4 h-4" />
                  Table {order.table_number}
                </div>
              )}
              {order.delivery_address && (
                <div className="flex items-center gap-2 text-gray-600 md:col-span-2">
                  <MapPin className="w-4 h-4" />
                  {order.delivery_address}
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-semibold mb-3">Order Items:</h4>
              <div className="space-y-3">
                {order.items?.map((item, idx) => {
                  const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + (extra.price || 0), 0);
                  const itemTotal = (item.price + extrasTotal) * item.quantity;
                  
                  return (
                    <div key={idx} className="border-b last:border-0 pb-2 last:pb-0">
                      <div className="flex justify-between text-sm">
                        <span>
                          <span className="font-medium">{item.quantity}x</span> {item.item_name}
                          {item.is_custom && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                              Personalizado
                            </span>
                          )}
                        </span>
                        <span className="font-medium">${itemTotal.toFixed(2)}</span>
                      </div>
                      {item.extras && item.extras.length > 0 && (
                        <p className="text-xs text-green-600 ml-6 mt-1">
                          + Extras: {item.extras.map(e => `${e.name} (+$${e.price?.toFixed(2)})`).join(', ')}
                        </p>
                      )}
                      {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                        <p className="text-xs text-red-600 ml-6 mt-1">
                          Without: {item.removed_ingredients.join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {order.special_instructions && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-900">
                  <strong>Special Instructions:</strong> {order.special_instructions}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="lg:w-64 space-y-3">
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <Button
                onClick={() => setShowPaymentDialog(true)}
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
              >
                ✓ Completar Pedido / Complete Order
              </Button>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Update Status:</label>
              <Select value={order.status} onValueChange={onUpdateStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => onPrintReceipt(order)}
              variant="outline"
              className="w-full gap-2"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </Button>

            <Button
              onClick={() => onDelete(order.id)}
              variant="outline"
              className="w-full gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
            >
              <Trash2 className="w-4 h-4" />
              Delete Order
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Payment Method Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Cómo pagó el cliente? / How did the customer pay?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button
              onClick={() => handleCompleteWithPayment('cash')}
              className="w-full h-16 text-lg gap-3 bg-green-600 hover:bg-green-700"
            >
              <Banknote className="w-6 h-6" />
              💵 Efectivo / Cash
            </Button>
            <Button
              onClick={() => handleCompleteWithPayment('card')}
              className="w-full h-16 text-lg gap-3 bg-blue-600 hover:bg-blue-700"
            >
              <CreditCard className="w-6 h-6" />
              💳 Tarjeta / Card
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPaymentDialog(false)}
              className="w-full"
            >
              Cancelar / Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}