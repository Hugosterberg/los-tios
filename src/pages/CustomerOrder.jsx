import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pizza, ShoppingCart, Trash2, Plus, Minus, Check, CreditCard, Banknote, AlertCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CustomerOrder() {
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState("menu"); // menu, checkout, payment, success
  const [customerInfo, setCustomerInfo] = useState({
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    special_instructions: "",
    payment_method: "cash",
    card_payment_type: "on_delivery", // 'on_delivery' or 'online'
    order_type: "delivery", // 'pickup' or 'delivery'
  });
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showIngredientDialog, setShowIngredientDialog] = useState(false);
  const [removedIngredients, setRemovedIngredients] = useState([]);
  const [selectedExtras, setSelectedExtras] = useState([]);

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menuItems'],
    queryFn: () => base44.entities.MenuItem.list(),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const appSettings = settings[0] || {
    restaurant_name: "Los Tios",
    accept_cash: true,
    accept_card: true,
  };

  const createOrder = useMutation({
    mutationFn: (data) => base44.entities.Order.create(data),
    onSuccess: (order) => {
      setCreatedOrder(order);
      setStep("success");
      setCart([]);
    },
  });

  const availableItems = menuItems.filter(item => item.is_available);

  const categories = [
    { id: "specials", name: "Especiales del Día", emoji: "⭐" },
    { id: "appetizers", name: "Entradas", emoji: "🥗" },
    { id: "mains", name: "Pizzas y Platos Fuertes", emoji: "🍕" },
    { id: "desserts", name: "Postres", emoji: "🍰" },
    { id: "beverages", name: "Bebidas", emoji: "🥤" },
  ];

  const openIngredientDialog = (item) => {
    setSelectedItem(item);
    setRemovedIngredients([]); // Reset for new selection
    setSelectedExtras([]); // Reset for new selection
    setShowIngredientDialog(true);
  };

  const toggleIngredient = (ingredient) => {
    if (removedIngredients.includes(ingredient)) {
      setRemovedIngredients(removedIngredients.filter(i => i !== ingredient));
    } else {
      setRemovedIngredients([...removedIngredients, ingredient]);
    }
  };

  const toggleExtra = (extra) => {
    const existingExtra = selectedExtras.find(e => e.name === extra.name);
    if (existingExtra) {
      setSelectedExtras(selectedExtras.filter(e => e.name !== extra.name));
    } else {
      setSelectedExtras([...selectedExtras, extra]);
    }
  };

  const confirmAddToCart = () => {
    // Stringify array to compare contents for existing items, as order matters.
    const removedIngredientsString = JSON.stringify(removedIngredients.sort()); 
    const selectedExtrasString = JSON.stringify(selectedExtras.sort((a, b) => a.name.localeCompare(b.name)));
    
    const existingItem = cart.find(
      cartItem => cartItem.id === selectedItem.id && 
      JSON.stringify(cartItem.removed_ingredients?.sort() || []) === removedIngredientsString &&
      JSON.stringify((cartItem.extras || []).sort((a, b) => a.name.localeCompare(b.name))) === selectedExtrasString
    );
    
    if (existingItem) {
      setCart(cart.map(cartItem =>
        cartItem.id === selectedItem.id && 
        JSON.stringify(cartItem.removed_ingredients?.sort() || []) === removedIngredientsString &&
        JSON.stringify((cartItem.extras || []).sort((a, b) => a.name.localeCompare(b.name))) === selectedExtrasString
          ? { ...cartItem, quantity: cartItem.quantity + 1 }
          : cartItem
      ));
    } else {
      setCart([...cart, { 
        ...selectedItem, 
        quantity: 1, 
        removed_ingredients: removedIngredients,
        extras: selectedExtras
      }]);
    }
    
    setShowIngredientDialog(false);
    setSelectedItem(null);
    setRemovedIngredients([]);
    setSelectedExtras([]);
  };

  const addToCart = (item) => {
    if ((item.ingredients && item.ingredients.length > 0) || (item.available_extras && item.available_extras.length > 0)) {
      openIngredientDialog(item);
    } else {
      // If no ingredients or extras to customize, add directly. Ensure removed_ingredients and extras are empty arrays.
      const existingItem = cart.find(cartItem => 
        cartItem.id === item.id && 
        (!cartItem.removed_ingredients || cartItem.removed_ingredients.length === 0) &&
        (!cartItem.extras || cartItem.extras.length === 0)
      );
      if (existingItem) {
        setCart(cart.map(cartItem =>
          cartItem.id === item.id && 
          (!cartItem.removed_ingredients || cartItem.removed_ingredients.length === 0) &&
          (!cartItem.extras || cartItem.extras.length === 0)
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        ));
      } else {
        setCart([...cart, { ...item, quantity: 1, removed_ingredients: [], extras: [] }]);
      }
    }
  };



  const updateQuantity = (index, change) => {
    setCart(cart.map((item, i) =>
      i === index
        ? { ...item, quantity: Math.max(0, item.quantity + change) }
        : item
    ).filter(item => item.quantity > 0));
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const DELIVERY_FEE = 50;

  const getSubtotal = () => {
    return cart.reduce((sum, item) => {
      const basePrice = item.price * item.quantity;
      const extrasPrice = (item.extras || []).reduce((extraSum, extra) => extraSum + (extra.price * item.quantity), 0);
      return sum + basePrice + extrasPrice;
    }, 0);
  };

  const getTotal = () => {
    const subtotal = getSubtotal();
    const deliveryFee = customerInfo.order_type === 'delivery' ? DELIVERY_FEE : 0;
    return subtotal + deliveryFee;
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    
    if (customerInfo.payment_method === 'card' && customerInfo.card_payment_type === 'online') {
      // If paying with card online, go to payment screen
      setStep("payment");
    } else {
      // If cash or card on delivery, create order immediately
      createOrderNow();
    }
  };

  const createOrderNow = () => {
    const paymentStatus = customerInfo.payment_method === 'card' && customerInfo.card_payment_type === 'online' 
      ? 'confirmed' 
      : 'pending';

    const orderData = {
      customer_name: customerInfo.customer_name,
      customer_phone: customerInfo.customer_phone,
      delivery_address: customerInfo.order_type === 'delivery' ? customerInfo.delivery_address : '',
      special_instructions: customerInfo.special_instructions,
      payment_method: customerInfo.payment_method,
      payment_status: paymentStatus,
      order_type: customerInfo.order_type === 'delivery' ? 'delivery' : 'takeout',
      items: cart.map(item => ({
        menu_item_id: item.is_custom ? null : item.id, // Only send menu_item_id if it's not a custom item
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
        removed_ingredients: item.removed_ingredients || [],
        extras: item.extras || [], // Include selected extras
        is_custom: item.is_custom || false, // Mark if it's a custom item
      })),
      total_amount: getTotal(),
      status: "pending",
    };

    createOrder.mutate(orderData);
  };

  const handlePaymentConfirmation = () => {
    if (!paymentConfirmed) {
      alert('Por favor confirma que has realizado el pago / Please confirm you have made the payment');
      return;
    }
    createOrderNow();
  };

  const startNewOrder = () => {
    setStep("menu");
    setCustomerInfo({
      customer_name: "",
      customer_phone: "",
      delivery_address: "",
      special_instructions: "",
      payment_method: "cash",
      card_payment_type: "on_delivery",
      order_type: "delivery", // Reset order type
    });
    setPaymentConfirmed(false);
    setCreatedOrder(null);
  };

  // Success Screen
  if (step === "success" && createdOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-8"
          >
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">¡Pedido Confirmado!</h1>
              <p className="text-gray-600 mb-2">Gracias por tu pedido / Thank you for your order</p>
              <p className="text-sm text-gray-500">Pedido #{createdOrder.id.slice(0, 8)}</p>
            </div>

            {/* Order Summary on Success Screen */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="font-bold text-lg mb-4">Resumen del Pedido / Order Summary</h3>
              
              <div className="space-y-2 mb-4 text-sm">
                {createdOrder.customer_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cliente:</span>
                    <span className="font-medium">{createdOrder.customer_name}</span>
                  </div>
                )}
                {createdOrder.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Teléfono:</span>
                    <span className="font-medium">{createdOrder.customer_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Tipo de Pedido:</span>
                  <span className="font-medium">
                    {createdOrder.order_type === 'delivery' ? '🚚 Entrega a Domicilio / Delivery' : '🏃 Recoger / Pickup'}
                  </span>
                </div>
                {createdOrder.delivery_address && createdOrder.order_type === 'delivery' && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dirección:</span>
                    <span className="font-medium text-right">{createdOrder.delivery_address}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Método de Pago:</span>
                  <span className="font-medium capitalize">
                    {createdOrder.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}
                    {createdOrder.payment_method === 'card' && createdOrder.payment_status === 'confirmed' && ' (Pago Online)'}
                    {createdOrder.payment_method === 'card' && createdOrder.payment_status === 'pending' && ' (Pago al Recibir)'}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                {createdOrder.items?.map((item, idx) => {
                  const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + extra.price, 0);
                  const itemTotal = (item.price + extrasTotal) * item.quantity;
                  return (
                    <div key={idx} className="text-sm">
                      <div className="flex justify-between">
                        <span>{item.quantity}x {item.item_name} {item.is_custom && <Badge className="bg-purple-100 text-purple-800 text-xs">Personalizado</Badge>}</span>
                        <span className="font-semibold">${itemTotal.toFixed(2)}</span>
                      </div>
                      {item.extras && item.extras.length > 0 && (
                        <p className="text-xs text-green-600 ml-4">
                          Con / With: {item.extras.map(e => e.name).join(', ')} (+${extrasTotal.toFixed(2)})
                        </p>
                      )}
                      {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                        <p className="text-xs text-gray-600 ml-4">
                          Sin / Without: {item.removed_ingredients.join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
                
                {createdOrder.order_type === 'delivery' && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-gray-600">Cargo por Entrega / Delivery Fee:</span>
                    <span className="font-semibold">${DELIVERY_FEE.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="border-t-2 mt-4 pt-4 flex justify-between font-bold text-xl">
                <span>Total:</span>
                <span className="text-red-600">${createdOrder.total_amount?.toFixed(2)} MXN</span>
              </div>
            </div>

            {/* Important notice block */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Importante / Important:</p>
                  {createdOrder.order_type === 'delivery' ? (
                    <>
                      <p>Tu pedido ha sido enviado al restaurante. Prepararemos tu orden pronto.</p>
                      <p className="text-blue-700">Tu pedido será entregado en la dirección proporcionada.</p>
                    </>
                  ) : (
                    <>
                      <p>Tu pedido ha sido enviado al restaurante. Prepararemos tu orden pronto.</p>
                      <p className="text-blue-700">Tu pedido estará listo para recoger en el restaurante.</p>
                    </>
                  )}
                  {createdOrder.payment_method === 'cash' && (
                    <p className="mt-2 font-semibold">💵 Paga en efectivo al {createdOrder.order_type === 'delivery' ? 'recibir' : 'recoger'} / Pay cash on {createdOrder.order_type === 'delivery' ? 'delivery' : 'pickup'}</p>
                  )}
                  {createdOrder.payment_method === 'card' && createdOrder.payment_status === 'pending' && (
                    <p className="mt-2 font-semibold">💳 Paga con tarjeta al {createdOrder.order_type === 'delivery' ? 'recibir' : 'recoger'} / Pay with card on {createdOrder.order_type === 'delivery' ? 'delivery' : 'pickup'}</p>
                  )}
                  {createdOrder.payment_method === 'card' && createdOrder.payment_status === 'confirmed' && (
                    <p className="mt-2 font-semibold">✅ Pago confirmado / Payment confirmed</p>
                  )}
                </div>
              </div>
            </div>

            <Button onClick={startNewOrder} className="w-full bg-red-600 hover:bg-red-700">
              Hacer Nuevo Pedido / Make New Order
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Payment Screen (Card Payment Online)
  if (step === "payment") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-2xl">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-xl">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <CreditCard className="w-6 h-6" />
                  Pago con Tarjeta / Card Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  {/* Payment Info */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                    <h3 className="font-bold text-lg mb-4 text-blue-900">Información de Transferencia / Transfer Information</h3>
                    
                    {appSettings.bank_name && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600">Banco / Bank:</p>
                        <p className="font-semibold text-lg">{appSettings.bank_name}</p>
                      </div>
                    )}

                    {appSettings.bank_account_holder && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600">Titular / Account Holder:</p>
                        <p className="font-semibold">{appSettings.bank_account_holder}</p>
                      </div>
                    )}

                    {appSettings.bank_account_number && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600">Número de Cuenta / Account Number:</p>
                        <p className="font-semibold text-lg font-mono">{appSettings.bank_account_number}</p>
                      </div>
                    )}

                    {appSettings.clabe && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600">CLABE Interbancaria:</p>
                        <p className="font-semibold text-lg font-mono">{appSettings.clabe}</p>
                      </div>
                    )}

                    <div className="mt-6 pt-6 border-t-2 border-blue-300">
                      <div className="flex justify-between items-center">
                        <p className="text-gray-600">Monto a Transferir / Amount to Transfer:</p>
                        <p className="text-3xl font-bold text-red-600">${getTotal().toFixed(2)} MXN</p>
                      </div>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-yellow-900">
                        <p className="font-semibold mb-2">Instrucciones / Instructions:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Realiza la transferencia bancaria con los datos arriba / Make the bank transfer with the details above</li>
                          <li>Guarda tu comprobante de pago / Save your payment receipt</li>
                          <li>Confirma abajo que realizaste el pago / Confirm below that you made the payment</li>
                          <li>El restaurante verificará tu pago / The restaurant will verify your payment</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Checkbox */}
                  <div className="border-2 border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="payment_confirm"
                        checked={paymentConfirmed}
                        onChange={(e) => setPaymentConfirmed(e.target.checked)}
                        className="w-5 h-5 mt-1"
                      />
                      <Label htmlFor="payment_confirm" className="cursor-pointer text-sm">
                        <span className="font-semibold">Confirmo que he realizado la transferencia bancaria por ${getTotal().toFixed(2)} MXN</span>
                        <br />
                        <span className="text-gray-600">I confirm that I have made the bank transfer for ${getTotal().toFixed(2)} MXN</span>
                      </Label>
                    </div>
                  </div>

                  {/* Order Summary for confirmation */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold mb-3">Resumen de tu Pedido / Your Order Summary:</h4>
                    <div className="space-y-2 text-sm">
                      {cart.map((item, idx) => {
                        const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + extra.price, 0);
                        const itemTotal = (item.price + extrasTotal) * item.quantity;
                        return (
                          <div key={idx}>
                            <div className="flex justify-between">
                              <span>{item.quantity}x {item.name} {item.is_custom && <Badge className="bg-purple-100 text-purple-800 text-xs">Personalizado</Badge>}</span>
                              <span className="font-semibold">${itemTotal.toFixed(2)}</span>
                            </div>
                            {item.extras && item.extras.length > 0 && (
                              <p className="text-xs text-green-600 ml-4">
                                Con / With: {item.extras.map(e => e.name).join(', ')} (+${extrasTotal.toFixed(2)})
                              </p>
                            )}
                            {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                              <p className="text-xs text-gray-600 ml-4">
                                Sin / Without: {item.removed_ingredients.join(', ')}
                              </p>
                            )}
                          </div>
                        );
                      })}
                      
                      {customerInfo.order_type === 'delivery' && (
                        <div className="flex justify-between pt-2 border-t">
                          <span className="text-gray-600">Cargo por Entrega / Delivery Fee:</span>
                          <span className="font-semibold">${DELIVERY_FEE.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between pt-2 border-t-2 font-bold">
                        <span>Total:</span>
                        <span className="text-red-600">${getTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("checkout")}
                      className="flex-1"
                    >
                      Volver / Back
                    </Button>
                    <Button
                      onClick={handlePaymentConfirmation}
                      disabled={!paymentConfirmed || createOrder.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {createOrder.isPending ? "Procesando... / Processing..." : "Confirmar Pedido / Confirm Order"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // Checkout Screen
  if (step === "checkout") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-2xl">
              <CardHeader className="bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-t-xl">
                <CardTitle className="text-2xl">Completa tu Pedido / Complete Your Order</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                  {/* Order Type Selection */}
                  <div className="space-y-3">
                    <Label>Tipo de Pedido / Order Type *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setCustomerInfo({ ...customerInfo, order_type: 'delivery' })}
                        className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                          customerInfo.order_type === 'delivery'
                            ? 'border-red-600 bg-red-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-3xl">🚚</div>
                        <div className="text-left flex-1">
                          <p className="font-semibold">Entrega a Domicilio / Delivery</p>
                          <p className="text-xs text-gray-600">+ ${DELIVERY_FEE.toFixed(2)} cargo por entrega</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCustomerInfo({ ...customerInfo, order_type: 'pickup' })}
                        className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                          customerInfo.order_type === 'pickup'
                            ? 'border-red-600 bg-red-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-3xl">🏃</div>
                        <div className="text-left flex-1">
                          <p className="font-semibold">Recoger / Pickup</p>
                          <p className="text-xs text-gray-600">Sin cargo adicional / No extra fee</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo / Full Name *</Label>
                      <Input
                        id="name"
                        required
                        value={customerInfo.customer_name}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, customer_name: e.target.value })}
                        placeholder="Juan Pérez"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono / Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        required
                        value={customerInfo.customer_phone}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, customer_phone: e.target.value })}
                        placeholder="+52 55 1234 5678"
                      />
                    </div>

                    {customerInfo.order_type === 'delivery' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address">Dirección de Entrega / Delivery Address *</Label>
                        <Input
                          id="address"
                          required
                          value={customerInfo.delivery_address}
                          onChange={(e) => setCustomerInfo({ ...customerInfo, delivery_address: e.target.value })}
                          placeholder="Calle Principal 123, Col. Centro"
                        />
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="instructions">Instrucciones Especiales / Special Instructions</Label>
                      <Textarea
                        id="instructions"
                        value={customerInfo.special_instructions}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, special_instructions: e.target.value })}
                        placeholder="Queso extra, sin cebolla... / Extra cheese, no onions..."
                        rows={3}
                      />
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-3 md:col-span-2">
                      <Label>Método de Pago / Payment Method *</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {appSettings.accept_cash && (
                          <button
                            type="button"
                            onClick={() => setCustomerInfo({ ...customerInfo, payment_method: 'cash' })}
                            className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                              customerInfo.payment_method === 'cash'
                                ? 'border-red-600 bg-red-50'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <Banknote className={`w-6 h-6 ${customerInfo.payment_method === 'cash' ? 'text-red-600' : 'text-gray-600'}`} />
                            <div className="text-left">
                              <p className="font-semibold">Efectivo / Cash</p>
                              <p className="text-xs text-gray-600">Pagar al {customerInfo.order_type === 'delivery' ? 'recibir' : 'recoger'} / Pay on {customerInfo.order_type === 'delivery' ? 'delivery' : 'pickup'}</p>
                            </div>
                          </button>
                        )}

                        {appSettings.accept_card && (
                          <button
                            type="button"
                            onClick={() => setCustomerInfo({ ...customerInfo, payment_method: 'card' })}
                            className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                              customerInfo.payment_method === 'card'
                                ? 'border-red-600 bg-red-50'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <CreditCard className={`w-6 h-6 ${customerInfo.payment_method === 'card' ? 'text-red-600' : 'text-gray-600'}`} />
                            <div className="text-left">
                              <p className="font-semibold">Tarjeta / Card</p>
                              <p className="text-xs text-gray-600">Ver opciones / See options</p>
                            </div>
                          </button>
                        )}
                      </div>

                      {/* Card Payment Options */}
                      {customerInfo.payment_method === 'card' && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                          <p className="font-semibold text-sm text-blue-900">Opciones de Pago con Tarjeta / Card Payment Options:</p>
                          <div className="space-y-2">
                            <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white transition-colors"
                              style={{ borderColor: customerInfo.card_payment_type === 'on_delivery' ? '#DC2626' : '#E5E7EB' }}
                            >
                              <input
                                type="radio"
                                name="card_payment_type"
                                value="on_delivery"
                                checked={customerInfo.card_payment_type === 'on_delivery'}
                                onChange={(e) => setCustomerInfo({ ...customerInfo, card_payment_type: e.target.value })}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <p className="font-semibold">Pagar al {customerInfo.order_type === 'delivery' ? 'Recibir' : 'Recoger'} / Pay on {customerInfo.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</p>
                                <p className="text-xs text-gray-600">Pagarás con tarjeta cuando {customerInfo.order_type === 'delivery' ? 'recibas tu pedido' : 'recogas tu pedido'}</p>
                                <p className="text-xs text-gray-500">You'll pay with card when you {customerInfo.order_type === 'delivery' ? 'receive your order' : 'pickup your order'}</p>
                              </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white transition-colors"
                              style={{ borderColor: customerInfo.card_payment_type === 'online' ? '#DC2626' : '#E5E7EB' }}
                            >
                              <input
                                type="radio"
                                name="card_payment_type"
                                value="online"
                                checked={customerInfo.card_payment_type === 'online'}
                                onChange={(e) => setCustomerInfo({ ...customerInfo, card_payment_type: e.target.value })}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <p className="font-semibold">Pagar Ahora (Transferencia) / Pay Now (Transfer)</p>
                                <p className="text-xs text-gray-600">Realiza una transferencia bancaria ahora</p>
                                <p className="text-xs text-gray-500">Make a bank transfer now</p>
                              </div>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="bg-gray-50 rounded-xl p-6 space-y-3">
                    <h3 className="font-bold text-lg mb-4">Resumen del Pedido / Order Summary</h3>
                    {cart.map((item, idx) => {
                      const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + extra.price, 0);
                      const itemTotal = (item.price + extrasTotal) * item.quantity;
                      return (
                        <div key={idx} className="text-sm">
                          <div className="flex justify-between">
                            <span>{item.name} x {item.quantity} {item.is_custom && <Badge className="bg-purple-100 text-purple-800 text-xs">Personalizado</Badge>}</span>
                            <span className="font-semibold">${itemTotal.toFixed(2)} MXN</span>
                          </div>
                          {item.extras && item.extras.length > 0 && (
                            <p className="text-xs text-green-600 ml-4">
                              Con / With: {item.extras.map(e => e.name).join(', ')} (+${extrasTotal.toFixed(2)})
                            </p>
                          )}
                          {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                            <p className="text-xs text-gray-600 ml-4">
                              Sin / Without: {item.removed_ingredients.join(', ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal:</span>
                        <span className="font-semibold">${getSubtotal().toFixed(2)} MXN</span>
                      </div>
                      
                      {customerInfo.order_type === 'delivery' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Cargo por Entrega / Delivery Fee:</span>
                          <span className="font-semibold">${DELIVERY_FEE.toFixed(2)} MXN</span>
                        </div>
                      )}
                      
                      <div className="border-t-2 pt-3 flex justify-between font-bold text-xl">
                        <span>Total:</span>
                        <span className="text-red-600">${getTotal().toFixed(2)} MXN</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("menu")}
                      className="flex-1"
                    >
                      Volver al Menú / Back to Menu
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      {customerInfo.payment_method === 'card' && customerInfo.card_payment_type === 'online' 
                        ? 'Continuar al Pago / Continue to Payment' 
                        : 'Confirmar Pedido / Confirm Order'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // Menu Screen (Main)
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 pb-24">
      {/* Header */}
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 text-gray-900 py-6 sticky top-0 z-40 shadow-lg border-b-4 border-orange-700">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f44a82bc5054123405c7af/f68a8ed25_WhatsAppImage2025-11-24at173910_c8e4a4d0.jpg" 
                    alt="Los Tíos"
                    className="w-16 h-16 rounded-xl object-cover shadow-md"
                  />
                  <div>
                    <h1 className="text-3xl font-bold text-orange-800">{appSettings.restaurant_name}</h1>
                    <p className="text-orange-600">Ordena en Línea / Order Online</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Menu */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando menú... / Loading menu...</p>
          </div>
        ) : (
          <div className="space-y-12">
            {categories.map((category) => {
              const items = availableItems.filter(item => item.category === category.id);
              if (items.length === 0) return null;

              return (
                <div key={category.id}>
                  <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <span>{category.emoji}</span>
                    {category.name}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.03 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-shadow">
                          <div className="relative h-48">
                            <img
                              src={item.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600'}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                            {item.is_vegetarian && (
                              <Badge className="absolute top-3 right-3 bg-green-500">
                                🌱 Vegetariano / Vegetarian
                              </Badge>
                            )}
                          </div>
                          <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h3 className="font-bold text-xl">{item.name}</h3>
                                {item.name_en && (
                                  <p className="text-sm text-gray-600 italic">{item.name_en}</p>
                                )}
                              </div>
                              <span className="text-2xl font-bold text-red-600 ml-2">${item.price?.toFixed(2)}</span>
                            </div>
                            
                            {item.description && (
                              <p className="text-gray-600 text-sm mb-2 line-clamp-2">{item.description}</p>
                            )}
                            {item.description_en && (
                              <p className="text-gray-500 text-xs mb-4 line-clamp-2 italic">{item.description_en}</p>
                            )}
                            
                            {item.available_extras && item.available_extras.length > 0 && (
                              <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-700 font-semibold">✨ Extras disponibles / Extras available</p>
                              </div>
                            )}
                            
                            {item.preparation_time && (
                              <p className="text-xs text-gray-500 mb-4">🕐 {item.preparation_time} min</p>
                            )}
                            <Button
                              onClick={() => addToCart(item)}
                              className="w-full bg-orange-700 hover:bg-orange-800 gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              Agregar al Carrito / Add to Cart
                            </Button>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ingredient & Extras Selection Dialog */}
      <Dialog open={showIngredientDialog} onOpenChange={(open) => {
        if (!open) {
          setShowIngredientDialog(false);
          setSelectedItem(null);
          setRemovedIngredients([]);
          setSelectedExtras([]);
        }
      }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personaliza tu Pedido / Customize Your Order</DialogTitle>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 pb-4 border-b">
                <img
                  src={selectedItem.image_url || 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200'}
                  alt={selectedItem.name}
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{selectedItem.name}</h3>
                  <p className="text-red-600 font-bold">${selectedItem.price?.toFixed(2)}</p>
                </div>
              </div>

              {/* Extras Section */}
              {selectedItem.available_extras && selectedItem.available_extras.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-green-700">
                    ✨ Agregar Extras / Add Extras:
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
                    {selectedItem.available_extras.map((extra, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center justify-between gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedExtras.find(e => e.name === extra.name)
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedExtras.find(e => e.name === extra.name) !== undefined}
                            onChange={() => toggleExtra(extra)}
                            className="w-4 h-4"
                          />
                          <span className="font-medium">{extra.name}</span>
                        </div>
                        <span className="text-green-600 font-bold">+${extra.price?.toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                  {selectedExtras.length > 0 && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-green-900">Total Extras:</span>
                        <span className="font-bold text-green-700">
                          +${selectedExtras.reduce((sum, e) => sum + e.price, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Ingredients Section */}
              {selectedItem.ingredients && selectedItem.ingredients.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">
                    Selecciona los ingredientes que NO quieres / Select ingredients to remove:
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedItem.ingredients.map((ingredient, idx) => (
                      <label
                        key={idx}
                        className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          removedIngredients.includes(ingredient)
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={removedIngredients.includes(ingredient)}
                          onChange={() => toggleIngredient(ingredient)}
                          className="w-4 h-4"
                        />
                        <span className={removedIngredients.includes(ingredient) ? 'line-through text-gray-500' : ''}>
                          {ingredient}
                        </span>
                        {removedIngredients.includes(ingredient) && (
                          <X className="w-4 h-4 text-red-500 ml-auto" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowIngredientDialog(false);
                    setSelectedItem(null);
                    setRemovedIngredients([]);
                    setSelectedExtras([]);
                  }}
                  className="flex-1"
                >
                  Cancelar / Cancel
                </Button>
                <Button
                  onClick={confirmAddToCart}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  Agregar / Add to Cart
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating Cart */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50"
          >
            <div className="bg-white border-t-4 border-orange-700 shadow-2xl">
              <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <ShoppingCart className="w-6 h-6 text-orange-700" />
                    <div>
                      <p className="font-bold text-lg">{cart.length} productos / items</p>
                      <p className="text-sm text-gray-600">Total: <span className="font-bold text-orange-700">${getTotal().toFixed(2)} MXN</span></p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => setCart([])}
                      className="flex-1 md:flex-initial"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Limpiar / Clear
                    </Button>
                    <Button
                      onClick={() => setStep("checkout")}
                      className="flex-1 md:flex-initial bg-orange-700 hover:bg-orange-800 gap-2"
                    >
                      Proceder al Pago / Checkout
                      <span className="font-bold">${getTotal().toFixed(2)}</span>
                    </Button>
                  </div>
                </div>

                {/* Mini Cart Items */}
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
                  {cart.map((item, idx) => {
                    const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + extra.price, 0);
                    const itemTotal = (item.price + extrasTotal) * item.quantity;
                    
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{item.name}</p>
                            {item.is_custom && (
                              <Badge className="bg-purple-100 text-purple-800 text-xs">Personalizado</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">${item.price?.toFixed(2)} MXN</p>
                          {item.extras && item.extras.length > 0 && (
                            <p className="text-xs text-green-600">
                              + {item.extras.map(e => e.name).join(', ')} (+${extrasTotal.toFixed(2)})
                            </p>
                          )}
                          {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                            <p className="text-xs text-red-600">
                              Sin: {item.removed_ingredients.join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => updateQuantity(idx, -1)}
                            className="h-8 w-8"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-bold w-8 text-center">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => updateQuantity(idx, 1)}
                            className="h-8 w-8"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <span className="font-bold w-20 text-right">${itemTotal.toFixed(2)}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeFromCart(idx)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="bg-gradient-to-r from-orange-900 to-amber-900 text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <img 
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f44a82bc5054123405c7af/f68a8ed25_WhatsAppImage2025-11-24at173910_c8e4a4d0.jpg" 
            alt="Los Tíos"
            className="w-20 h-20 mx-auto mb-4 rounded-xl object-cover"
          />
          <h3 className="text-2xl font-bold mb-2">{appSettings.restaurant_name}</h3>
          <p className="text-amber-200">Pizzas auténticas hechas con amor / Authentic pizzas made with love</p>
        </div>
      </div>
    </div>
  );
}