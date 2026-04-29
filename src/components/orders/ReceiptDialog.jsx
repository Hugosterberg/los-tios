// @ts-nocheck
import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatMexicoDateTimeSlashed } from "@/lib/mexicoTime";

export default function ReceiptDialog({ order, open, onClose }) {
  const receiptRef = useRef(null);

  if (!order) return null;

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=640,height=900");
    if (!printWindow) return;
    const css = `*{box-sizing:border-box}body{font-family:sans-serif;padding:24px;background:#fff;color:#000}.text-center{text-align:center}.text-right{text-align:right}.flex{display:flex}.justify-between{justify-content:space-between}.w-full{width:100%}.font-bold{font-weight:700}.font-semibold{font-weight:600}.font-medium{font-weight:500}.text-2xl{font-size:1.5rem;line-height:2rem}.text-xl{font-size:1.25rem}.text-lg{font-size:1.125rem}.text-sm{font-size:.875rem}.text-xs{font-size:.75rem}.text-gray-500{color:#6b7280}.text-gray-600{color:#4b5563}.text-red-600{color:#dc2626}.text-green-600{color:#16a34a}.text-purple-600{color:#9333ea}.border-b{border-bottom:1px solid #e5e7eb}.border-b-2{border-bottom:2px solid #e5e7eb}.border-t{border-top:1px solid #e5e7eb}.border-t-2{border-top:2px solid #e5e7eb}.border-double{border-style:double}.border-dashed{border-style:dashed}.mb-1{margin-bottom:.25rem}.mb-4{margin-bottom:1rem}.mb-6{margin-bottom:1.5rem}.mt-1{margin-top:.25rem}.pb-4{padding-bottom:1rem}.pt-4{padding-top:1rem}.p-6{padding:1.5rem}.py-2{padding:.5rem 0}.pl-4{padding-left:1rem}.ml-2{margin-left:.5rem}.ml-6{margin-left:1.5rem}.float-right{float:right}.max-w-\\[200px\\]{max-width:200px}table{width:100%;border-collapse:collapse}th,td{padding:.5rem}th{font-weight:600}@media print{@page{margin:10mm}}`;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Receipt - Los Tios</title><style>${css}</style></head><body>${receiptRef.current.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Order Receipt</DialogTitle>
        </DialogHeader>

        <div ref={receiptRef} className="p-6 bg-white">
          <div className="text-center mb-6 border-b-2 border-dashed pb-4">
            <h2 className="text-2xl font-bold">Los Tios</h2>
            <p className="text-sm text-gray-600">Pizzeria</p>
            <p className="text-xs text-gray-500 mt-1">Order #{order.id.slice(0, 8)}</p>
            <p className="text-xs text-gray-500">{formatMexicoDateTimeSlashed(order.created_date)}</p>
          </div>

          <div className="mb-4 text-sm">
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Customer:</span>
              <span className="font-medium">{order.customer_name}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Phone:</span>
              <span className="font-medium">{order.customer_phone}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Type:</span>
              <span className="font-medium capitalize">{order.order_type === "delivery" ? "Delivery" : order.order_type}</span>
            </div>
            {order.table_number && (
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Table:</span>
                <span className="font-medium">{order.table_number}</span>
              </div>
            )}
            {order.delivery_address && (
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">Address:</span>
                <span className="font-medium text-right max-w-[200px]">{order.delivery_address}</span>
              </div>
            )}
            <div className="flex justify-between mb-1">
              <span className="text-gray-600">Payment:</span>
              <span className="font-medium capitalize">{order.payment_method === "cash" ? "Cash" : "Card"}</span>
            </div>
          </div>

          <div className="border-t-2 border-dashed pt-4 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Item</th>
                  <th className="text-center py-2">Qty</th>
                  <th className="text-right py-2">Price</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, index) => {
                  const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + (extra.price || 0), 0);
                  const itemSubtotal = item.price * item.quantity;
                  const extrasSubtotal = extrasTotal * item.quantity;
                  return (
                    <React.Fragment key={index}>
                      <tr className="border-b">
                        <td className="py-2">
                          {item.item_name}
                          {item.is_custom && <span className="text-xs text-purple-600"> (Custom)</span>}
                        </td>
                        <td className="text-center">{item.quantity}</td>
                        <td className="text-right">${item.price?.toFixed(2)}</td>
                        <td className="text-right font-medium">${itemSubtotal.toFixed(2)}</td>
                      </tr>
                      {item.extras?.length > 0 && (
                        <tr>
                          <td colSpan="4" className="py-1 text-xs text-green-600 pl-4">
                            + Extras: {item.extras.map((extra) => `${extra.name} ($${extra.price?.toFixed(2)})`).join(", ")}
                            <span className="float-right font-semibold">+${extrasSubtotal.toFixed(2)}</span>
                          </td>
                        </tr>
                      )}
                      {item.removed_ingredients?.length > 0 && (
                        <tr>
                          <td colSpan="4" className="py-1 text-xs text-red-600 pl-4">
                            Without: {item.removed_ingredients.join(", ")}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t-2 border-double pt-4 mb-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-red-600">${order.total_amount?.toFixed(2)} MXN</span>
            </div>
          </div>

          {order.special_instructions && (
            <div className="border-t border-dashed pt-4 mb-4">
              <p className="text-xs text-gray-600">
                <strong>Notes:</strong> {order.special_instructions}
              </p>
            </div>
          )}

          <div className="text-center border-t-2 border-dashed pt-4">
            <p className="text-sm font-medium mb-1">Thank you for your order</p>
            <p className="text-xs text-gray-500">We appreciate your business</p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handlePrint} className="flex-1 gap-2 bg-red-600 hover:bg-red-700">
            <Printer className="w-4 h-4" />
            Print Receipt
          </Button>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
