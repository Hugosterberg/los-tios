
import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { format } from "date-fns";

export default function ReceiptDialog({ order, open, onClose }) {
  const receiptRef = useRef(null);

  if (!order) return null;

  const handlePrint = () => {
    const printContents = receiptRef.current.innerHTML;
    const originalContents = document.body.innerHTML;
    document.body.innerHTML = printContents;
    window.print();
    document.body.innerHTML = originalContents;
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recibo del Pedido / Order Receipt</DialogTitle>
        </DialogHeader>

        <div ref={receiptRef} className="p-6 bg-white">
          {/* Receipt Header */}
          <div className="text-center mb-6 border-b-2 border-dashed pb-4">
            <h2 className="text-2xl font-bold">Los Tios</h2>
            <p className="text-sm text-gray-600">Pizzeria</p>
            <p className="text-xs text-gray-500 mt-1">Pedido #{order.id.slice(0, 8)}</p>
            <p className="text-xs text-gray-500">{format(new Date(order.created_date), "dd/MM/yyyy HH:mm")}</p>
          </div>

          {/* Order Details */}
          <div className="mb-4 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Cliente / Customer:</span>
              <span className="font-medium">{order.customer_name}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Teléfono / Phone:</span>
              <span className="font-medium">{order.customer_phone}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Tipo / Type:</span>
              <span className="font-medium capitalize">{order.order_type === 'delivery' ? 'A Domicilio' : order.order_type}</span>
            </div>
            {order.table_number && (
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Mesa / Table:</span>
                <span className="font-medium">{order.table_number}</span>
              </div>
            )}
            {order.delivery_address && (
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Dirección / Address:</span>
                <span className="font-medium text-right max-w-[200px]">{order.delivery_address}</span>
              </div>
            )}
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Pago / Payment:</span>
              <span className="font-medium capitalize">{order.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}</span>
            </div>
          </div>

          {/* Items */}
          <div className="border-t-2 border-dashed pt-4 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Item</th>
                  <th className="text-center py-2">Cant</th>
                  <th className="text-right py-2">Precio</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, idx) => {
                  const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + (extra.price || 0), 0);
                  const itemSubtotal = item.price * item.quantity;
                  const extrasSubtotal = extrasTotal * item.quantity;
                  const itemTotal = itemSubtotal + extrasSubtotal;
                  
                  return (
                    <React.Fragment key={idx}>
                      <tr className="border-b">
                        <td className="py-2">
                          {item.item_name}
                          {item.is_custom && <span className="text-xs text-purple-600"> (Custom)</span>}
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-right">${item.price?.toFixed(2)}</td>
                        <td className="text-right font-medium">${itemSubtotal.toFixed(2)}</td>
                      </tr>
                      {item.extras && item.extras.length > 0 && (
                        <tr>
                          <td colSpan="4" className="py-1 text-xs text-green-600 pl-4">
                            + Extras: {item.extras.map(e => `${e.name} ($${e.price?.toFixed(2)})`).join(', ')}
                            <span className="float-right font-semibold">+${extrasSubtotal.toFixed(2)}</span>
                          </td>
                        </tr>
                      )}
                      {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                        <tr>
                          <td colSpan="4" className="py-1 text-xs text-red-600 pl-4">
                            Sin / Without: {item.removed_ingredients.join(', ')}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className="border-t-2 border-double pt-4 mb-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-red-600">${order.total_amount?.toFixed(2)} MXN</span>
            </div>
          </div>

          {order.special_instructions && (
            <div className="border-t border-dashed pt-4 mb-4">
              <p className="text-xs text-gray-600">
                <strong>Notas / Notes:</strong> {order.special_instructions}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center border-t-2 border-dashed pt-4">
            <p className="text-sm font-medium mb-1">¡Gracias por su compra!</p>
            <p className="text-xs text-gray-500">Thank you for your order</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handlePrint} className="flex-1 gap-2 bg-red-600 hover:bg-red-700">
            <Printer className="w-4 h-4" />
            Imprimir Recibo / Print Receipt
          </Button>
          <Button onClick={onClose} variant="outline">
            Cerrar / Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
