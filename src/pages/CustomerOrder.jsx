import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pizza, ShoppingCart, Trash2, Plus, Minus, Check, CreditCard, Banknote, AlertCircle, X, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EventShareButtons from "@/components/EventShareButtons";

export default function CustomerOrder() {
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState("menu"); // menu, orderType, checkout, payment, success
  const [customerInfo, setCustomerInfo] = useState({
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    special_instructions: "",
    payment_method: "cash",
    card_payment_type: "on_delivery", // 'on_delivery' or 'online'
    order_type: "delivery", // 'dine-in', 'pickup' or 'delivery'
  });
  const [dineInName, setDineInName] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showIngredientDialog, setShowIngredientDialog] = useState(false);
  const [removedIngredients, setRemovedIngredients] = useState([]);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    { id: "specials", name: "ESPECIALES DEL DÍA" },
    { id: "appetizers", name: "ENTRADAS" },
    { id: "pizzas", name: "PIZZAS" },
    { id: "paninis", name: "PANINIS" },
    { id: "mains", name: "PLATOS FUERTES" },
    { id: "desserts", name: "POSTRES" },
    { id: "beverages", name: "BEBIDAS" },
    { id: "salsas", name: "SALSAS" },
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
      order_type: "delivery",
    });
    setDineInName("");
    setPaymentConfirmed(false);
    setCreatedOrder(null);
  };

  const handleDineInSubmit = (e) => {
    e.preventDefault();
    const orderData = {
      customer_name: dineInName || "Cliente en sitio",
      customer_phone: "",
      delivery_address: "",
      special_instructions: customerInfo.special_instructions,
      payment_method: "cash",
      payment_status: "pending",
      order_type: "dine-in",
      items: cart.map(item => ({
        menu_item_id: item.is_custom ? null : item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
        removed_ingredients: item.removed_ingredients || [],
        extras: item.extras || [],
        is_custom: item.is_custom || false,
      })),
      total_amount: getSubtotal(),
      status: "pending",
    };
    createOrder.mutate(orderData);
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

  // Order Type Selection Screen
  if (step === "orderType") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-0 shadow-2xl">
              <CardHeader className="bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-t-xl">
                <CardTitle className="text-2xl">¿Dónde comerás? / Where will you eat?</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Dine-in Option */}
                <button
                  onClick={() => {
                    setCustomerInfo({ ...customerInfo, order_type: 'dine-in' });
                  }}
                  className={`w-full p-6 border-2 rounded-xl flex items-center gap-4 transition-all ${
                    customerInfo.order_type === 'dine-in'
                      ? 'border-orange-600 bg-orange-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-4xl">🍽️</div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-xl">Comer Aquí / Dine-In</p>
                    <p className="text-gray-600">Comer en el restaurante / Eat at the restaurant</p>
                  </div>
                </button>

                {/* Takeout/Delivery Option */}
                <button
                  onClick={() => {
                    setCustomerInfo({ ...customerInfo, order_type: 'delivery' });
                    setStep("checkout");
                  }}
                  className="w-full p-6 border-2 border-gray-300 hover:border-gray-400 rounded-xl flex items-center gap-4 transition-all"
                >
                  <div className="text-4xl">🚚</div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-xl">Para Llevar o Domicilio</p>
                    <p className="text-gray-600">Takeout or Delivery</p>
                  </div>
                </button>

                {/* Dine-in Form */}
                {customerInfo.order_type === 'dine-in' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 pt-4 border-t"
                  >
                    <form onSubmit={handleDineInSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="dine_name">Tu Nombre (opcional) / Your Name (optional)</Label>
                        <Input
                          id="dine_name"
                          value={dineInName}
                          onChange={(e) => setDineInName(e.target.value)}
                          placeholder="Juan"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="dine_instructions">Instrucciones Especiales / Special Instructions</Label>
                        <Textarea
                          id="dine_instructions"
                          value={customerInfo.special_instructions}
                          onChange={(e) => setCustomerInfo({ ...customerInfo, special_instructions: e.target.value })}
                          placeholder="Sin cebolla, extra queso... / No onions, extra cheese..."
                          rows={2}
                        />
                      </div>

                      {/* Order Summary */}
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <h3 className="font-bold mb-2">Tu Pedido / Your Order</h3>
                        {cart.map((item, idx) => {
                          const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + extra.price, 0);
                          const itemTotal = (item.price + extrasTotal) * item.quantity;
                          return (
                            <div key={idx} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.name}</span>
                              <span className="font-semibold">${itemTotal.toFixed(2)}</span>
                            </div>
                          );
                        })}
                        <div className="border-t pt-2 flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span className="text-orange-600">${getSubtotal().toFixed(2)} MXN</span>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={createOrder.isPending}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-lg py-6"
                      >
                        {createOrder.isPending ? "Enviando... / Sending..." : "✓ Confirmar Pedido / Confirm Order"}
                      </Button>
                    </form>
                  </motion.div>
                )}

                <Button
                  variant="outline"
                  onClick={() => setStep("menu")}
                  className="w-full"
                >
                  ← Volver al Menú / Back to Menu
                </Button>
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
    <div id="top" className="min-h-screen bg-[#1a1a1a] pb-24">
      {/* Header */}
          <div className="bg-yellow-400 py-4 sticky top-0 z-40 shadow-lg">
            <div className="max-w-7xl mx-auto px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <a href="#top">
                    <img 
                      src="https://media.base44.com/images/public/69b1d01a96680d8f83115050/0982a0490_los_tios_logo_8k.png" 
                      alt="Los Tíos"
                      className="w-20 h-20 object-contain rounded-2xl"
                    />
                  </a>
                </div>
                {/* Desktop nav */}
                <div className="hidden md:flex items-center gap-4">
                  <a href="#menu" className="text-[#1a1a1a] text-sm font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-full transition-colors">Menú</a>
                  <a href="#eventos" className="text-[#1a1a1a] text-sm font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-full transition-colors">Eventos</a>
                  <a href="#about" className="text-[#1a1a1a] text-sm font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-full transition-colors">Sobre nosotros</a>
                  <a href="https://wa.me/529541307386" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[#1a1a1a] text-sm font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    +52 954 130 7386
                  </a>
                </div>

                {/* Mobile hamburger */}
                <div className="md:hidden relative">
                  <button
                    onClick={() => setMobileNavOpen(prev => !prev)}
                    className="flex flex-col justify-center items-center w-10 h-10 gap-1.5 bg-black/10 hover:bg-black/20 rounded-xl transition-colors focus:outline-none"
                  >
                    <span className={`block w-5 h-0.5 bg-[#1a1a1a] transition-all duration-300 ${mobileNavOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
                    <span className={`block w-5 h-0.5 bg-[#1a1a1a] transition-all duration-300 ${mobileNavOpen ? 'opacity-0' : ''}`}></span>
                    <span className={`block w-5 h-0.5 bg-[#1a1a1a] transition-all duration-300 ${mobileNavOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
                  </button>
                  {mobileNavOpen && (
                    <div className="absolute right-0 top-14 bg-yellow-400 rounded-2xl shadow-xl p-4 flex flex-col gap-2 min-w-[180px] z-50">
                      <a href="#menu" onClick={() => setMobileNavOpen(false)} className="text-[#1a1a1a] text-sm font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-full transition-colors text-center">Menú</a>
                      <a href="#eventos" onClick={() => setMobileNavOpen(false)} className="text-[#1a1a1a] text-sm font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-full transition-colors text-center">Eventos</a>
                      <a href="#about" onClick={() => setMobileNavOpen(false)} className="text-[#1a1a1a] text-sm font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-full transition-colors text-center">Sobre nosotros</a>
                      <a href="https://wa.me/529541307386" target="_blank" rel="noopener noreferrer" onClick={() => setMobileNavOpen(false)}
                        className="flex items-center justify-center gap-1.5 text-[#1a1a1a] text-sm font-bold bg-black/10 hover:bg-black/20 px-4 py-2 rounded-full transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

      {/* Hero Banner */}
      <div className="bg-[#111111] py-12 px-4 text-center border-b border-yellow-500/20">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Spanish */}
          <div>
            <p className="text-yellow-400 text-xs font-bold tracking-widest uppercase mb-2">🇲🇽 ES</p>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
              ¿HAMBRE? PRUEBA LA MEJOR PIZZA DE PUERTO ESCONDIDO
            </h2>
            <p className="text-gray-400 mt-2 text-lg">Hecha por 4 tios que se conocieron viajando · Servida con muy buena vibra</p>
            <p className="text-yellow-400/60 mt-1 text-xs font-bold tracking-widest uppercase">4 TIOS CON RAÍCES EN MÉXICO, FRANCIA, SUECIA E ITALIA.</p>
          </div>

          <div className="border-t border-yellow-500/30 pt-6">
            <p className="text-yellow-400 text-xs font-bold tracking-widest uppercase mb-2">🇺🇸 EN</p>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight">
              HUNGRY? TRY THE BEST PIZZA IN PUERTO ESCONDIDO
            </h2>
            <p className="text-gray-400 mt-2 text-lg">Made by 4 uncles who met while traveling · Served with great vibes</p>
            <p className="text-yellow-400/60 mt-1 text-xs font-bold tracking-widest uppercase">4 UNCLES WITH ROOTS IN MEXICO, FRANCE, SWEDEN & ITALY.</p>
          </div>
        </div>
      </div>

      <div id="menu" className="max-w-7xl mx-auto px-4 py-8 scroll-mt-20">
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
                  <h2 className="text-3xl font-bold mb-6 text-yellow-400 text-center">
                        {category.name}
                      </h2>
                      <div className="flex flex-wrap justify-center gap-6">
                        {items.map((item) => (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.03 }}
                            transition={{ duration: 0.2 }}
                            className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] flex flex-col"
                          >
                             <Card className="overflow-hidden border border-yellow-500/20 shadow-lg hover:shadow-2xl transition-shadow bg-[#242424] flex flex-col h-full">
                                             <div className="relative h-56 flex-shrink-0">
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
                          <CardContent className="p-6 flex flex-col flex-1">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h3 className="font-bold text-xl text-white">{item.name}</h3>
                                {item.name_en && (
                                  <p className="text-sm text-gray-400 italic">{item.name_en}</p>
                                )}
                              </div>
                              <span className="text-2xl font-bold text-yellow-400 ml-2">${item.price?.toFixed(2)}</span>
                            </div>

                            <div className="flex-1">
                              {item.description && (
                                <p className="text-gray-400 text-sm mb-2 line-clamp-3">{item.description}</p>
                              )}
                              {item.description_en && (
                                <p className="text-gray-500 text-xs mb-4 line-clamp-3 italic">{item.description_en}</p>
                              )}
                            </div>
                            
                            {item.available_extras && item.available_extras.length > 0 && (
                              <div className="mt-auto pt-3">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                  <p className="text-xs text-blue-700 font-semibold">✨ Extras disponibles / Extras available</p>
                                </div>
                              </div>
                            )}
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
            <div className="bg-[#111111] border-t-4 border-yellow-500 shadow-2xl">
              <div className="max-w-7xl mx-auto px-4 py-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <ShoppingCart className="w-6 h-6 text-yellow-400" />
                    <div>
                      <p className="font-bold text-lg text-white">{cart.length} productos / items</p>
                      <p className="text-sm text-gray-400">Total: <span className="font-bold text-yellow-400">${getSubtotal().toFixed(2)} MXN</span></p>
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
                      onClick={() => setStep("orderType")}
                      className="flex-1 md:flex-initial bg-yellow-500 hover:bg-yellow-400 text-black font-bold gap-2"
                    >
                      Proceder al Pago / Checkout
                      <span className="font-bold">${getSubtotal().toFixed(2)}</span>
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

      {/* Eventos */}
      {(() => {
        const eventDate = new Date('2026-03-20');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isPast = today > eventDate;
        const attendees = 50;

        return (
          <div id="eventos" className="bg-[#1a1a1a] border-t border-yellow-500/20 py-16 px-4 scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-col items-center mb-10">
                <h2 className="text-3xl font-black text-[#1a1a1a] bg-yellow-400 px-6 py-2 rounded-xl inline-block tracking-wide">Eventos</h2>
                <p className="text-center text-gray-500 text-sm mt-3 tracking-widest uppercase">Lo que viene 🔥</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Football Night - Spanish */}
                <div className="rounded-2xl p-6 border relative overflow-hidden transition-all bg-[#242424] border-yellow-500/30">
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-5xl leading-none">28</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARZO</span>
                  </div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1 text-yellow-400">🇲🇽 Español</p>
                  <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">4 PM HASTA TARDE</p>
                  <h3 className="text-xl font-black mb-3 pr-20 text-white">⚽ Noche de Fútbol en Los Tios</h3>
                  <p className="leading-relaxed text-sm text-gray-300">
                    ¡Se arma el ambiente en Los Tios! Ven a disfrutar el partido con nosotros en una noche llena de fútbol, buena vibra y pura fiesta. Tendremos pizzas recién hechas, cervezas bien frías y <span className="text-yellow-400 font-semibold">shots de mezcal</span> para subir el ánimo. Cada jugada se vive mejor aquí, con música, energía y toda la banda apoyando. Perfecto para venir con amigos, echar chela, gritar los goles y quedarte después del partido. No es solo ver el juego… es vivirlo. 🔥
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🍺", line1: "Chela", line2: "fría" },
                      { emoji: "🍕", line1: "Pizza", line2: "recién hecha" },
                      { emoji: "🥃", line1: "Shots de", line2: "mezcal" },
                      { emoji: "⚽", line1: "Fútbol", line2: "en vivo" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className="text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 bg-yellow-400/10 text-yellow-400 h-16">
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">📍 Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBÁN)</span></p>
                  <EventShareButtons title="⚽ Noche de Fútbol en Los Tios – 28 Marzo" text="¡Ven a ver el partido, pizza, chela y mezcal!" url={`${window.location.origin}/#eventos`} />
                </div>

                {/* Football Night - English */}
                <div className="rounded-2xl p-6 border relative overflow-hidden transition-all bg-[#242424] border-yellow-500/30">
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-5xl leading-none">28</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARCH</span>
                  </div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-1 text-yellow-400">🇺🇸 English</p>
                  <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">4 PM TILL LATE</p>
                  <h3 className="text-xl font-black mb-3 pr-20 text-white">⚽ Football Night at Los Tios</h3>
                  <p className="leading-relaxed text-sm text-gray-300">
                    Game night hits different at Los Tios. Come watch the match with us in a high-energy atmosphere full of good vibes and great people. Expect fresh pizza, ice-cold beers, and <span className="text-yellow-400 font-semibold">mezcal shots</span> to keep the energy going. Every moment of the game feels bigger here, with music, crowd hype, and nonstop action. Bring your crew, grab a drink, cheer loud, and stay after the match to keep the party going. This isn't just watching the game… it's experiencing it. 🔥
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🍺", line1: "Cold", line2: "beer" },
                      { emoji: "🍕", line1: "Fresh", line2: "pizza" },
                      { emoji: "🥃", line1: "Mezcal", line2: "shots" },
                      { emoji: "⚽", line1: "Live", line2: "football" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className="text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 bg-yellow-400/10 text-yellow-400 h-16">
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">📍 Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBÁN)</span></p>
                  <EventShareButtons title="⚽ Football Night at Los Tios – March 28" text="Come watch the match, fresh pizza, cold beers & mezcal shots!" lang="en" url={`${window.location.origin}/#eventos`} />
                </div>
              </div>

              {/* Event suggestion CTA */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                <div id="event-contact" className="bg-[#242424] border border-yellow-500/20 rounded-2xl p-5 flex flex-col justify-between gap-3">
                  <p className="text-gray-300 text-sm leading-relaxed flex-1">
                    🎉 <span className="text-yellow-400 font-bold">¿Tienes una idea para un evento con nosotros?</span><br/><br/>
                    En nuestro restaurante en Centro, Puerto Escondido, contamos con nuestro horno híbrido de gas y leña, una inversión seria para una pizza seria.<br/><br/>
                    Bajo nuestra marca <span className="text-yellow-400 font-semibold">Los Tios Express</span> también podemos llevar hornos de pizza portátiles a casi cualquier lugar, con un resultado casi igual de increíble. ¡La masa es tan importante como el horno!
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                   <a
                     href="mailto:info@lostios.mx?subject=Propuesta de evento&body=Hola equipo de Los Tios, me gustaría proponer un evento..."
                     className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-transparent hover:bg-yellow-400/10 text-yellow-400 text-xs font-semibold transition-colors border border-yellow-400"
                   >
                     ✉️ Contáctanos
                   </a>
                  </div>
                </div>
                <div className="bg-[#242424] border border-yellow-500/20 rounded-2xl p-5 flex flex-col justify-between gap-3">
                  <p className="text-gray-300 text-sm leading-relaxed flex-1">
                    🎉 <span className="text-yellow-400 font-bold">Do you have an idea for an event with us?</span><br/><br/>
                    At our restaurant in Centro, Puerto Escondido, we have our well-invested hybrid wood and gas oven, a serious investment for serious pizza.<br/><br/>
                    Under our brand <span className="text-yellow-400 font-semibold">Los Tios Express</span> we can also bring portable pizza ovens almost anywhere, delivering results that are nearly just as incredible. The dough matters just as much as the oven!
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                   <a
                     href="mailto:info@lostios.mx?subject=Event proposal&body=Hi Los Tios team, I would like to propose an event..."
                     className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-transparent hover:bg-yellow-400/10 text-yellow-400 text-xs font-semibold transition-colors border border-yellow-400"
                   >
                     ✉️ Contact us
                   </a>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-yellow-500/10 my-8"></div>
              <p className="text-center text-gray-500 text-sm mb-8 tracking-widest uppercase">Evento pasado · Past event 📸</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Spanish */}
                <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isPast ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-5xl leading-none">20</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARZO</span>
                  </div>
                  <p className={`text-xs font-bold tracking-widest uppercase mb-1 ${isPast ? 'text-gray-500' : 'text-yellow-400'}`}>🇲🇽 Español</p>
                  <p className={`text-xs font-bold tracking-widest uppercase mb-4 ${isPast ? 'text-gray-600' : 'text-yellow-400/60'}`}>4 PM HASTA TARDE
                    {isPast && <span className="ml-3 inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full text-gray-400 normal-case tracking-normal font-semibold">👥 +{attendees} asistieron</span>}
                  </p>
                  <h3 className={`text-xl font-black mb-3 pr-16 ${isPast ? 'text-gray-400' : 'text-white'}`}>🎂 Cumpleaños del Chef<br/>& Apertura del Restaurante</h3>
                  <p className={`leading-relaxed text-sm ${isPast ? 'text-gray-600' : 'text-gray-300'}`}>
                    ¡El evento más importante de Los Tios! Celebramos el cumpleaños de nuestro chef y la apertura oficial del restaurante. Habrá <span className={isPast ? 'font-semibold' : 'text-yellow-400 font-semibold'}>bebida de bienvenida</span> para todos, música de primer nivel toda la noche, pizzas increíbles y cerveza a precios de amigo. No te lo puedes perder, ven, come, baila y brinda con nosotros. ¡Nos vemos ahí, familia! 🍕🍺🎶
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🥂", line1: "Welcome", line2: "drink" },
                      { emoji: "🍕", line1: "Pizza", line2: "deals" },
                      { emoji: "🍺", line1: "Cerveza", line2: "deals" },
                      { emoji: "🎶", line1: "Buena", line2: "música" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isPast ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">📍 Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBÁN)</span></p>
                  <EventShareButtons title="🎂 Cumpleaños del Chef & Apertura – 20 Marzo" text="¡Bebida de bienvenida, pizza, música y mucha fiesta!" url={`${window.location.origin}/#eventos`} />
                </div>

                {/* English */}
                <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isPast ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-5xl leading-none">20</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARCH</span>
                  </div>
                  <p className={`text-xs font-bold tracking-widest uppercase mb-1 ${isPast ? 'text-gray-500' : 'text-yellow-400'}`}>🇺🇸 English</p>
                  <p className={`text-xs font-bold tracking-widest uppercase mb-4 ${isPast ? 'text-gray-600' : 'text-yellow-400/60'}`}>4 PM TILL LATE
                    {isPast && <span className="ml-3 inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full text-gray-400 normal-case tracking-normal font-semibold">👥 +{attendees} attended</span>}
                  </p>
                  <h3 className={`text-xl font-black mb-3 pr-16 ${isPast ? 'text-gray-400' : 'text-white'}`}>🎂 Chef's Birthday<br/>& Restaurant Opening</h3>
                  <p className={`leading-relaxed text-sm ${isPast ? 'text-gray-600' : 'text-gray-300'}`}>
                    The biggest night in Los Tios history! We're celebrating our chef's birthday AND the official opening of the restaurant. Expect a <span className={isPast ? 'font-semibold' : 'text-yellow-400 font-semibold'}>welcome drink on the house</span>, killer music all night long, insane pizza and cold beers at seriously good prices. Come through, eat good, dance, and toast with us. See you there, familia! 🍕🍺🎶
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🥂", line1: "Welcome", line2: "drink" },
                      { emoji: "🍕", line1: "Pizza", line2: "deals" },
                      { emoji: "🍺", line1: "Beer", line2: "deals" },
                      { emoji: "🎶", line1: "Great", line2: "music" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isPast ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">📍 Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBÁN)</span></p>
                  <EventShareButtons title="🎂 Chef's Birthday & Restaurant Opening – March 20" text="Welcome drink on the house, killer music, pizza & cold beers!" lang="en" url={`${window.location.origin}/#eventos`} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sobre nosotros */}
      <div id="about" className="bg-[#111111] border-t border-yellow-500/20 py-16 px-4 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col items-center mb-10">
            <h2 className="text-3xl font-black text-[#1a1a1a] bg-yellow-400 px-6 py-2 rounded-xl inline-block tracking-wide">Sobre nosotros</h2>
            <h2 className="text-3xl font-black text-[#1a1a1a] bg-yellow-400 px-6 py-2 rounded-xl inline-block tracking-wide mt-2">About us</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Spanish */}
            <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-yellow-500/20">
              <p className="text-yellow-400 text-xs font-bold tracking-widest uppercase mb-3">🇲🇽 Español</p>
              <p className="text-gray-300 leading-relaxed">
                Los Tios es un vibrante restaurante de pizza en Puerto Escondido que sirve deliciosas pizzas estilo napolitano en un relajado ambiente playero. Fundado por cuatro amigos con raíces en México, Francia, Italia y Suecia que se conocieron en México, Los Tios reúne inspiración internacional y la energía tranquila de Puerto Escondido. Si buscas una pizza deliciosa, buenas vibras y un lugar acogedor para pasar el rato, Los Tios es el lugar.
              </p>
            </div>
            {/* English */}
            <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-yellow-500/20">
              <p className="text-yellow-400 text-xs font-bold tracking-widest uppercase mb-3">🇺🇸 English</p>
              <p className="text-gray-300 leading-relaxed">
                Los Tios is a vibrant pizza spot in Puerto Escondido serving delicious Neapolitan-style pizza in a relaxed beach atmosphere. Founded by four friends with roots in Mexico, France, Italy and Sweden who met in Mexico, Los Tios brings together international inspiration and the laid-back energy of Puerto Escondido. If you're looking for great pizza, good vibes and a welcoming place to hang out, Los Tios is the spot.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-yellow-400 text-[#1a1a1a] py-8 mt-0">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <img 
            src="https://media.base44.com/images/public/69b1d01a96680d8f83115050/0982a0490_los_tios_logo_8k.png" 
            alt="Los Tíos"
            className="w-28 h-28 mx-auto mb-4 object-contain rounded-2xl"
          />
          <p className="font-semibold mb-3">Pizzas auténticas hechas con amor / Authentic pizzas made with love</p>
          <p className="text-sm font-medium mb-1">📍 Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax.</p>
          <p className="text-sm font-bold mb-6">PLAZA MONTE ALBÁN</p>

          {/* Google Maps */}
          <div className="mb-6 rounded-2xl overflow-hidden w-full max-w-lg mx-auto shadow-lg border-[3px] border-black">
            <a href="https://www.google.com/maps/search/los+tios+puerto+escondido" target="_blank" rel="noopener noreferrer">
              <iframe
                title="Los Tios location"
                width="100%"
                height="220"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src="https://maps.google.com/maps?q=Av.+Oaxaca+305,+Centro,+71980+Puerto+Escondido,+Oax.&z=16&output=embed"
              />
            </a>
            <a
              href="https://www.google.com/maps/search/los+tios+puerto+escondido"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[#1a1a1a] text-yellow-400 text-xs font-bold py-2 text-center hover:bg-black/80 transition-colors"
            >
              📍 Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. →
            </a>
          </div>
          
          {/* Social Media Links */}
          <div className="flex justify-center items-center gap-4">
            {/* Instagram */}
            <a href="https://www.instagram.com/lostios.pxm" target="_blank" rel="noopener noreferrer"
              className="bg-[#1a1a1a] rounded-full p-2.5 hover:scale-110 transition-transform"
              title="Instagram">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
            {/* Facebook */}
            <a href="https://www.facebook.com/lostios.pxm" target="_blank" rel="noopener noreferrer"
              className="bg-[#1a1a1a] rounded-full p-2.5 hover:scale-110 transition-transform"
              title="Facebook">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            {/* WhatsApp */}
            <a href="https://wa.me/529541307386" target="_blank" rel="noopener noreferrer"
              className="bg-[#1a1a1a] rounded-full p-2.5 hover:scale-110 transition-transform"
              title="WhatsApp">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>
            {/* TikTok */}
            <a href="https://www.tiktok.com/@lostios.mx" target="_blank" rel="noopener noreferrer"
              className="bg-[#1a1a1a] rounded-full p-2.5 hover:scale-110 transition-transform"
              title="TikTok">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}