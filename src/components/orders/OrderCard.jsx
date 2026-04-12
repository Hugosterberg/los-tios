import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMexicoOrderList } from "@/lib/mexicoTime";
import {
  Package,
  Truck,
  Phone,
  MapPin,
  Printer,
  Trash2,
  CreditCard,
  Banknote,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const statusConfig = {
  pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-300", label: "Pending" },
  preparing: { color: "bg-blue-100 text-blue-800 border-blue-300", label: "Preparing" },
  ready: { color: "bg-green-100 text-green-800 border-green-300", label: "Ready" },
  out_for_delivery: { color: "bg-indigo-100 text-indigo-800 border-indigo-300", label: "Out for delivery" },
  delivered: { color: "bg-gray-100 text-gray-800 border-gray-300", label: "Delivered" },
  cancelled: { color: "bg-red-100 text-red-800 border-red-300", label: "Cancelled" },
};

const statusFlow = ["pending", "preparing", "ready", "out_for_delivery", "delivered"];

const orderTypeIcons = {
  "dine-in": Package,
  "takeout": Package,
  delivery: Truck,
};

export default function OrderCard({ order, onUpdateStatus, onPrintReceipt, onDelete }) {
  const Icon = orderTypeIcons[order.order_type] || Package;
  const paymentIsCard = order.payment_method === "card";
  const paymentLabel = paymentIsCard ? "Clip / Card" : "Cash";
  const paymentStatusLabel =
    order.payment_status === "confirmed" || order.payment_status === "paid" ? "Paid" : "Pending";
  const statusIndex = statusFlow.indexOf(order.status);
  const previousStatus = statusIndex > 0 ? statusFlow[statusIndex - 1] : null;
  const nextStatus =
    statusIndex >= 0 && statusIndex < statusFlow.length - 1 ? statusFlow[statusIndex + 1] : null;

  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="p-5">
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold">{order.customer_name}</h3>
                  <Badge className={`${statusConfig[order.status]?.color} border`}>
                    {statusConfig[order.status]?.label || order.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-500">
                  {formatMexicoOrderList(order.created_date)}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xl font-bold text-red-600">${order.total_amount?.toFixed(2)}</div>
                <Badge variant="outline" className="mt-1">
                  <Icon className="w-3 h-3 mr-1" />
                  {order.order_type}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-4 h-4" />
                {order.customer_phone || "No phone"}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                {paymentIsCard ? <CreditCard className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                {paymentLabel} - {paymentStatusLabel}
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

            <div className="bg-gray-50 rounded-lg p-3.5">
              <h4 className="font-semibold mb-3">Order Items:</h4>
              <div className="space-y-3">
                {order.items?.map((item, idx) => {
                  const itemTotal = (item.price || 0) * item.quantity;

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
                      {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                        <p className="text-xs text-red-600 ml-6 mt-1">
                          Without: {item.removed_ingredients.join(", ")}
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

          <div className="lg:w-56 space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Order Status:</label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!previousStatus}
                  onClick={() => previousStatus && onUpdateStatus(previousStatus)}
                  className="h-9 w-9"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Current</p>
                  <p className="font-semibold">{statusConfig[order.status]?.label || order.status}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={!nextStatus}
                  onClick={() => nextStatus && onUpdateStatus(nextStatus)}
                  className="h-9 w-9"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Button onClick={() => onPrintReceipt(order)} variant="outline" className="w-full gap-2">
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
    </Card>
  );
}
