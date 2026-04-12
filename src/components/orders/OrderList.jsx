import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Package, Truck, CheckCircle, Clock } from "lucide-react";
import { formatMexicoOrderList } from "@/lib/mexicoTime";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusConfig = {
  pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-300", icon: Clock },
  preparing: { color: "bg-blue-100 text-blue-800 border-blue-300", icon: Package },
  ready: { color: "bg-green-100 text-green-800 border-green-300", icon: CheckCircle },
  delivered: { color: "bg-gray-100 text-gray-800 border-gray-300", icon: Truck },
  cancelled: { color: "bg-red-100 text-red-800 border-red-300", icon: Clock },
};

export default function OrderList({ orders, isLoading, onUpdateStatus }) {
  if (isLoading) {
    return <div className="text-center py-12">Loading orders...</div>;
  }

  if (orders.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-12">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500 text-lg">No orders yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl">All Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.map((order) => {
            const StatusIcon = statusConfig[order.status]?.icon || Clock;
            return (
              <div
                key={order.id}
                className="p-6 border rounded-xl hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-semibold">{order.customer_name}</h3>
                        <p className="text-sm text-gray-500">
                          {formatMexicoOrderList(order.created_date)}
                        </p>
                      </div>
                      <Badge className={`${statusConfig[order.status]?.color} border flex items-center gap-1`}>
                        <StatusIcon className="w-3 h-3" />
                        {order.status}
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Badge variant="outline">{order.order_type}</Badge>
                        {order.table_number && <span>Table: {order.table_number}</span>}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-3">
                      <h4 className="font-semibold mb-2">Order Items:</h4>
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex justify-between py-1">
                          <span>{item.item_name} x {item.quantity}</span>
                          <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                        <span>Total:</span>
                        <span className="text-red-600">${order.total_amount?.toFixed(2)}</span>
                      </div>
                    </div>

                    {order.special_instructions && (
                      <div className="p-3 bg-amber-50 rounded-lg">
                        <p className="text-sm text-amber-900">
                          <strong>Note:</strong> {order.special_instructions}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="md:w-48">
                    <Select
                      value={order.status}
                      onValueChange={(value) => onUpdateStatus(order.id, value)}
                    >
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
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}