// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, Plus, Minus, Check, CreditCard, Banknote, AlertCircle, MapPin, Clock, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EventShareButtons from "@/components/EventShareButtons";
import { listMenuItems } from "@/lib/local-dev-menu";
import { createOrderEntity } from "@/lib/local-dev-orders";
import {
  eventDateLabel,
  isCustomerEventPast,
  listLocalCustomerEvents,
  normalizeEventButtons,
  parseCustomerEvents,
} from "@/lib/customerEvents";
import losTiosLogo from "@/assets/los-tios-logo.png";
import PublicRestaurantExperience from "@/components/restaurant/PublicRestaurantExperience.jsx";
import {
  getPublicRestaurantCopy,
  normalizeSiteLocale,
  persistLocale,
  readStoredLocale,
} from "@/lib/restaurantPublicLocale";
import { GOOGLE_MAPS_PLACE_URL, TRIPADVISOR_URL } from "@/lib/mapsPlace";

const MAP_EMBED =
  "https://maps.google.com/maps?q=Av.+Oaxaca+305,+Centro,+71980+Puerto+Escondido,+Oax.&z=16&output=embed";

export default function CustomerOrder() {
  const [cart, setCart] = useState([]);
  const [step, setStep] = useState("menu"); // menu, checkout, payment, success
  const [customerInfo, setCustomerInfo] = useState({
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    special_instructions: "",
    payment_method: "cash",
    order_type: "delivery", // 'dine-in', 'pickup' or 'delivery'
  });
  const [dineInName, setDineInName] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [siteLocale, setSiteLocale] = useState(() => normalizeSiteLocale(readStoredLocale()));

  const publicCopy = useMemo(() => getPublicRestaurantCopy(siteLocale), [siteLocale]);

  useEffect(() => {
    persistLocale(siteLocale);
    document.documentElement.lang = siteLocale === "en" ? "en" : "es-MX";
  }, [siteLocale]);

  const isEventPast = (year, month, day) => {
    const today = new Date();
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const eventDate = new Date(year, month - 1, day);

    return localToday > eventDate;
  };

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ["menuItems", "publicCustomer"],
    queryFn: () =>
      listMenuItems(() => base44.entities.MenuItem.list(), { publicCustomerMenu: true }),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const appSettings = settings[0] || {
    restaurant_name: "Los Tios",
    accept_cash: true,
    accept_card: true,
    clip_payment_link: "",
  };
  const adminCustomerEvents = [...parseCustomerEvents(appSettings), ...listLocalCustomerEvents()].filter(
    (event, index, events) => event?.id && events.findIndex((candidate) => candidate?.id === event.id) === index,
  );

  const createOrder = useMutation({
    mutationFn: (data) => createOrderEntity(data, (payload) => base44.entities.Order.create(payload)),
    onSuccess: (order) => {
      setCreatedOrder(order);
      setStep("success");
      setCart([]);
    },
    onError: () => {
      alert("Ordern kunde inte skapas. Kontrollera betalningslaget och forsok igen.");
    },
  });

  const availableItems = menuItems.filter(item => item.is_available);

  useEffect(() => {
    const name = (appSettings.restaurant_name && String(appSettings.restaurant_name).trim()) || "Los Tíos";
    document.title = `${name} · Pizza artesanal · Puerto Escondido, Oax.`;
    const desc = `${name}: Neapolitan-style pizza in downtown Puerto Escondido. Delivery, pickup, or dine-in. Av. Oaxaca 305, Plaza Monte Albán.`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    const ld = {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name,
      image: `${window.location.origin}/favicon.png`,
      url: window.location.origin,
      telephone: "+52-954-130-7386",
      servesCuisine: ["Pizza", "Italian", "Neapolitan pizza"],
      address: {
        "@type": "PostalAddress",
        streetAddress: "Av. Oaxaca 305, Plaza Monte Albán",
        addressLocality: "Puerto Escondido",
        addressRegion: "Oax.",
        postalCode: "71980",
        addressCountry: "MX",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 15.8719,
        longitude: -97.0673,
      },
      priceRange: "$$",
      sameAs: [
        "https://www.instagram.com/lostios.pxm",
        "https://www.facebook.com/lostios.pxm",
        "https://www.tiktok.com/@lostios.mx",
        TRIPADVISOR_URL,
      ],
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "https://schema.org/Tuesday",
            "https://schema.org/Wednesday",
            "https://schema.org/Thursday",
            "https://schema.org/Friday",
            "https://schema.org/Saturday",
            "https://schema.org/Sunday",
          ],
          opens: "16:00",
          closes: "23:00",
        },
      ],
    };
    const scriptId = "jsonld-restaurant";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(ld);
  }, [appSettings.restaurant_name]);

  const categories = [
    { id: "specials", name: "ESPECIALES DEL DIA" },
    { id: "appetizers", name: "ENTRADAS" },
    { id: "pizzas", name: "PIZZAS" },
    { id: "paninis", name: "PANINIS" },
    { id: "mains", name: "PLATOS FUERTES" },
    { id: "desserts", name: "POSTRES" },
    { id: "beverages", name: "BEBIDAS" },
    { id: "salsas", name: "SALSAS" },
  ];

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
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const getTotal = () => {
    const subtotal = getSubtotal();
    const deliveryFee = customerInfo.order_type === 'delivery' ? DELIVERY_FEE : 0;
    return subtotal + deliveryFee;
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    
    if (customerInfo.payment_method === 'card') {
      setStep("payment");
    } else {
      createOrderNow();
    }
  };

  const createOrderNow = () => {
    const paymentStatus = customerInfo.payment_method === 'card' ? 'confirmed' : 'pending';

    const orderData = {
      customer_name: customerInfo.order_type === 'dine-in' ? (dineInName || "Cliente en sitio") : customerInfo.customer_name,
      customer_phone: customerInfo.order_type === 'dine-in' ? "" : customerInfo.customer_phone,
      delivery_address: customerInfo.order_type === 'delivery' ? customerInfo.delivery_address : '',
      special_instructions: customerInfo.special_instructions,
      payment_method: customerInfo.payment_method,
      payment_status: paymentStatus,
      order_type: customerInfo.order_type === 'dine-in' ? 'dine-in' : customerInfo.order_type === 'delivery' ? 'delivery' : 'takeout',
      items: cart.map(item => ({
        menu_item_id: item.is_custom ? null : item.id, // Only send menu_item_id if it's not a custom item
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
        removed_ingredients: item.removed_ingredients || [],
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
      order_type: "delivery",
    });
    setDineInName("");
    setPaymentConfirmed(false);
    setCreatedOrder(null);
  };

  const handleOpenClipCheckout = () => {
    if (!appSettings.clip_payment_link) {
      alert("Clip-lank saknas. Lagg till den i admin under betalningsinstallningar.");
      return;
    }

    window.open(appSettings.clip_payment_link, "_blank", "noopener,noreferrer");
  };

  const pizzaPatternStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='180' viewBox='0 0 320 180'%3E%3Cg stroke-linecap='round' stroke-linejoin='round'%3E%3Cg transform='translate(22 16) rotate(-14 40 40)' opacity='0.42'%3E%3Cpath d='M10 68 L39 16 Q43 10 49 16 L78 68 Q44 58 10 68 Z' fill='%23f2c94c' fill-opacity='0.18' stroke='%23996f00' stroke-opacity='0.58' stroke-width='4.8'/%3E%3Cpath d='M33 22 Q43 13 55 22' fill='none' stroke='%23815d00' stroke-opacity='0.7' stroke-width='7.4'/%3E%3Cpath d='M17 63 Q24 56 31 62' fill='none' stroke='%23996f00' stroke-opacity='0.42' stroke-width='2.2'/%3E%3Cpath d='M22 58 Q29 53 34 58' fill='none' stroke='%23996f00' stroke-opacity='0.4' stroke-width='2.5'/%3E%3Cpath d='M40 46 Q46 40 52 46' fill='none' stroke='%23996f00' stroke-opacity='0.4' stroke-width='2.5'/%3E%3Cpath d='M52 58 Q58 53 64 58' fill='none' stroke='%23996f00' stroke-opacity='0.4' stroke-width='2.5'/%3E%3Cpath d='M42 28 L36 36' fill='none' stroke='%23996f00' stroke-opacity='0.34' stroke-width='1.8'/%3E%3Cpath d='M50 36 L44 44' fill='none' stroke='%23996f00' stroke-opacity='0.34' stroke-width='1.8'/%3E%3Ccircle cx='35' cy='40' r='4.4' fill='%23c99900' fill-opacity='0.32' stroke='%23755400' stroke-opacity='0.34' stroke-width='1.4'/%3E%3Ccircle cx='54' cy='49' r='4.4' fill='%23c99900' fill-opacity='0.32' stroke='%23755400' stroke-opacity='0.34' stroke-width='1.4'/%3E%3Ccircle cx='47' cy='31' r='3.8' fill='%23c99900' fill-opacity='0.28' stroke='%23755400' stroke-opacity='0.3' stroke-width='1.2'/%3E%3C/g%3E%3Cg transform='translate(128 22) rotate(12 36 36)' opacity='0.38'%3E%3Cpath d='M8 64 L35 15 Q39 9 45 15 L72 64 Q40 55 8 64 Z' fill='%23f2c94c' fill-opacity='0.16' stroke='%23996f00' stroke-opacity='0.54' stroke-width='4.5'/%3E%3Cpath d='M30 21 Q39 12 50 20' fill='none' stroke='%23815d00' stroke-opacity='0.64' stroke-width='7'/%3E%3Cpath d='M24 54 Q30 48 36 54' fill='none' stroke='%23996f00' stroke-opacity='0.36' stroke-width='2.3'/%3E%3Cpath d='M42 42 Q48 37 54 42' fill='none' stroke='%23996f00' stroke-opacity='0.36' stroke-width='2.3'/%3E%3Cpath d='M46 27 L40 35' fill='none' stroke='%23996f00' stroke-opacity='0.3' stroke-width='1.7'/%3E%3Ccircle cx='35' cy='36' r='4.1' fill='%23c99900' fill-opacity='0.28' stroke='%23755400' stroke-opacity='0.28' stroke-width='1.2'/%3E%3Ccircle cx='52' cy='47' r='4.1' fill='%23c99900' fill-opacity='0.28' stroke='%23755400' stroke-opacity='0.28' stroke-width='1.2'/%3E%3Ccircle cx='45' cy='28' r='3.3' fill='%23c99900' fill-opacity='0.24' stroke='%23755400' stroke-opacity='0.24' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(226 10) rotate(-8 34 34)' opacity='0.34'%3E%3Cpath d='M9 60 L33 14 Q37 8 43 14 L68 60 Q39 52 9 60 Z' fill='%23f2c94c' fill-opacity='0.14' stroke='%23996f00' stroke-opacity='0.5' stroke-width='4.2'/%3E%3Cpath d='M28 20 Q37 12 48 19' fill='none' stroke='%23815d00' stroke-opacity='0.58' stroke-width='6.7'/%3E%3Cpath d='M24 50 Q29 45 34 50' fill='none' stroke='%23996f00' stroke-opacity='0.34' stroke-width='2.1'/%3E%3Cpath d='M40 39 Q46 34 51 39' fill='none' stroke='%23996f00' stroke-opacity='0.34' stroke-width='2.1'/%3E%3Cpath d='M37 27 L32 34' fill='none' stroke='%23996f00' stroke-opacity='0.28' stroke-width='1.6'/%3E%3Ccircle cx='39' cy='34' r='3.6' fill='%23c99900' fill-opacity='0.26' stroke='%23755400' stroke-opacity='0.24' stroke-width='1.1'/%3E%3Ccircle cx='50' cy='44' r='3.1' fill='%23c99900' fill-opacity='0.22' stroke='%23755400' stroke-opacity='0.2' stroke-width='0.9'/%3E%3C/g%3E%3Cg transform='translate(70 98) rotate(18 34 34)' opacity='0.4'%3E%3Cpath d='M8 63 L35 13 Q39 7 45 13 L73 63 Q40 54 8 63 Z' fill='%23f2c94c' fill-opacity='0.17' stroke='%23996f00' stroke-opacity='0.56' stroke-width='4.6'/%3E%3Cpath d='M30 19 Q39 10 51 18' fill='none' stroke='%23815d00' stroke-opacity='0.66' stroke-width='7.1'/%3E%3Cpath d='M18 58 Q25 51 32 58' fill='none' stroke='%23996f00' stroke-opacity='0.38' stroke-width='2.2'/%3E%3Cpath d='M22 54 Q28 48 34 54' fill='none' stroke='%23996f00' stroke-opacity='0.38' stroke-width='2.3'/%3E%3Cpath d='M40 42 Q46 36 52 42' fill='none' stroke='%23996f00' stroke-opacity='0.38' stroke-width='2.3'/%3E%3Cpath d='M44 25 L38 33' fill='none' stroke='%23996f00' stroke-opacity='0.3' stroke-width='1.7'/%3E%3Ccircle cx='32' cy='39' r='4' fill='%23c99900' fill-opacity='0.3' stroke='%23755400' stroke-opacity='0.3' stroke-width='1.2'/%3E%3Ccircle cx='50' cy='49' r='4' fill='%23c99900' fill-opacity='0.3' stroke='%23755400' stroke-opacity='0.3' stroke-width='1.2'/%3E%3Ccircle cx='42' cy='29' r='3.2' fill='%23c99900' fill-opacity='0.24' stroke='%23755400' stroke-opacity='0.24' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(186 92) rotate(-19 38 38)' opacity='0.42'%3E%3Cpath d='M10 68 L39 16 Q43 10 49 16 L78 68 Q44 58 10 68 Z' fill='%23f2c94c' fill-opacity='0.18' stroke='%23996f00' stroke-opacity='0.58' stroke-width='4.8'/%3E%3Cpath d='M33 22 Q43 13 55 22' fill='none' stroke='%23815d00' stroke-opacity='0.7' stroke-width='7.4'/%3E%3Cpath d='M19 62 Q26 55 33 62' fill='none' stroke='%23996f00' stroke-opacity='0.42' stroke-width='2.2'/%3E%3Cpath d='M24 58 Q30 52 36 58' fill='none' stroke='%23996f00' stroke-opacity='0.4' stroke-width='2.4'/%3E%3Cpath d='M42 45 Q48 39 54 45' fill='none' stroke='%23996f00' stroke-opacity='0.4' stroke-width='2.4'/%3E%3Cpath d='M53 57 Q59 52 65 57' fill='none' stroke='%23996f00' stroke-opacity='0.4' stroke-width='2.4'/%3E%3Cpath d='M43 28 L37 36' fill='none' stroke='%23996f00' stroke-opacity='0.34' stroke-width='1.8'/%3E%3Cpath d='M53 36 L47 44' fill='none' stroke='%23996f00' stroke-opacity='0.34' stroke-width='1.8'/%3E%3Ccircle cx='38' cy='40' r='4.3' fill='%23c99900' fill-opacity='0.32' stroke='%23755400' stroke-opacity='0.34' stroke-width='1.3'/%3E%3Ccircle cx='56' cy='50' r='4.3' fill='%23c99900' fill-opacity='0.32' stroke='%23755400' stroke-opacity='0.34' stroke-width='1.3'/%3E%3Ccircle cx='49' cy='31' r='3.7' fill='%23c99900' fill-opacity='0.28' stroke='%23755400' stroke-opacity='0.3' stroke-width='1.1'/%3E%3C/g%3E%3Cg transform='translate(268 108) rotate(13 28 28)' opacity='0.34'%3E%3Cpath d='M8 50 L27 12 Q31 7 36 12 L57 50 Q33 44 8 50 Z' fill='%23f2c94c' fill-opacity='0.14' stroke='%23996f00' stroke-opacity='0.5' stroke-width='4'/%3E%3Cpath d='M22 17 Q29 10 38 16' fill='none' stroke='%23815d00' stroke-opacity='0.58' stroke-width='6.2'/%3E%3Cpath d='M19 42 Q24 37 29 42' fill='none' stroke='%23996f00' stroke-opacity='0.34' stroke-width='2'/%3E%3Cpath d='M29 22 L24 29' fill='none' stroke='%23996f00' stroke-opacity='0.28' stroke-width='1.5'/%3E%3Ccircle cx='31' cy='32' r='3.3' fill='%23c99900' fill-opacity='0.26' stroke='%23755400' stroke-opacity='0.22' stroke-width='1'/%3E%3Ccircle cx='39' cy='40' r='2.7' fill='%23c99900' fill-opacity='0.2' stroke='%23755400' stroke-opacity='0.18' stroke-width='0.8'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
    backgroundSize: "320px 180px",
    backgroundPosition: "center",
    backgroundRepeat: "repeat",
  };

  // Success Screen
  if (step === "success" && createdOrder) {
    return (
      <div className="min-h-screen bg-[#111111] p-3 sm:p-4 text-white">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a1a] border border-yellow-500/20 rounded-2xl shadow-2xl p-8"
          >
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-yellow-400/15 border border-yellow-400/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-yellow-400" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Pedido Confirmado!</h1>
              <p className="text-gray-300 mb-2">Gracias por tu pedido / Thank you for your order</p>
              <p className="text-sm text-gray-500">Pedido #{createdOrder.id.slice(0, 8)}</p>
            </div>

            {/* Order Summary on Success Screen */}
            <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-5 sm:p-6 mb-6">
              <h3 className="font-bold text-lg mb-4 text-yellow-400">Resumen del Pedido / Order Summary</h3>
              
              <div className="space-y-2 mb-4 text-sm">
                {createdOrder.customer_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Cliente:</span>
                    <span className="font-medium">{createdOrder.customer_name}</span>
                  </div>
                )}
                {createdOrder.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Telefono:</span>
                    <span className="font-medium">{createdOrder.customer_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Tipo de Pedido:</span>
                  <span className="font-medium">
                    {createdOrder.order_type === 'delivery'
                      ? 'Delivery to address / Delivery'
                      : createdOrder.order_type === 'dine-in'
                        ? 'Comer aqui / Dine-in'
                        : 'Pickup / Pickup'}
                  </span>
                </div>
                {createdOrder.delivery_address && createdOrder.order_type === 'delivery' && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Direccion:</span>
                    <span className="font-medium text-right">{createdOrder.delivery_address}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Metodo de Pago:</span>
                  <span className="font-medium capitalize">
                    {createdOrder.payment_method === 'cash' ? 'Efectivo / Cash' : 'Clip / Card'}
                    {createdOrder.payment_method === 'card' && createdOrder.payment_status === 'confirmed' && ' (Pago confirmado)'}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                {createdOrder.items?.map((item, idx) => {
                  const itemTotal = item.price * item.quantity;
                  return (
                    <div key={idx} className="text-sm">
                      <div className="flex justify-between">
                        <span>{item.quantity}x {item.item_name} {item.is_custom && <Badge className="bg-purple-100 text-purple-800 text-xs">Personalizado</Badge>}</span>
                        <span className="font-semibold">${itemTotal.toFixed(2)}</span>
                      </div>
                      {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                        <p className="text-xs text-gray-500 ml-4">
                          Sin / Without: {item.removed_ingredients.join(', ')}
                        </p>
                      )}
                    </div>
                  );
                })}
                
                {createdOrder.order_type === 'delivery' && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-gray-400">Cargo por Entrega / Delivery Fee:</span>
                    <span className="font-semibold">${DELIVERY_FEE.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="border-t-2 mt-4 pt-4 flex justify-between font-bold text-xl">
                <span>Total:</span>
                <span className="text-yellow-400">${createdOrder.total_amount?.toFixed(2)} MXN</span>
              </div>
            </div>

            {/* Important notice block */}
            <div className="bg-[#242424] border border-yellow-500/20 rounded-lg p-4 mb-6">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <p className="font-semibold mb-1 text-yellow-400">Importante / Important:</p>
                  {createdOrder.order_type === 'delivery' ? (
                    <>
                      <p>Tu pedido ha sido enviado al restaurante. Prepararemos tu orden pronto.</p>
                      <p className="text-gray-400">Tu pedido sera entregado en la direccion proporcionada.</p>
                    </>
                  ) : (
                    <>
                      <p>Tu pedido ha sido enviado al restaurante. Prepararemos tu orden pronto.</p>
                      <p className="text-gray-400">
                        {createdOrder.order_type === 'dine-in'
                          ? 'Tu pedido se preparara para servir en el restaurante.'
                          : 'Tu pedido estara listo para recoger en el restaurante.'}
                      </p>
                    </>
                  )}
                  {createdOrder.payment_method === 'cash' && (
                    <p className="mt-2 font-semibold text-white">
                      {createdOrder.order_type === 'dine-in'
                        ? 'Paga en efectivo en caja / Pay cash at the counter'
                        : `Paga en efectivo al ${createdOrder.order_type === 'delivery' ? 'recibir' : 'recoger'} / Pay cash on ${createdOrder.order_type === 'delivery' ? 'delivery' : 'pickup'}`}
                    </p>
                  )}
                  {createdOrder.payment_method === 'card' && createdOrder.payment_status === 'confirmed' && (
                    <p className="mt-2 font-semibold text-white">Pago confirmado con Clip / Payment confirmed with Clip</p>
                  )}
                </div>
              </div>
            </div>

            <Button onClick={startNewOrder} className="w-full bg-yellow-400 hover:bg-yellow-300 text-[#1a1a1a] font-bold">
              Hacer Nuevo Pedido / Make New Order
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Payment Screen (Clip)
  if (step === "payment") {
    return (
      <div className="min-h-screen bg-[#111111] p-3 sm:p-4 text-white">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border border-yellow-500/20 bg-[#1a1a1a] shadow-2xl overflow-hidden">
              <CardHeader className="bg-yellow-400 text-[#1a1a1a] rounded-t-xl">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <CreditCard className="w-6 h-6" />
                  Pagar con Clip / Pay with Clip
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="bg-[#242424] border border-yellow-500/20 rounded-xl p-6">
                    <h3 className="font-bold text-lg mb-4 text-yellow-400">Checkout con Clip / Clip Checkout</h3>
                    <p className="text-sm text-gray-300 mb-4">
                      Abre Clip en en ny flik, slutför kortbetalningen och kom sedan tillbaka hit för att bekräfta ordern.
                    </p>
                    <div className="mt-4 pt-4 border-t border-yellow-500/20">
                      <div className="flex justify-between items-center">
                        <p className="text-gray-400">Monto a pagar / Amount to pay:</p>
                        <p className="text-2xl sm:text-3xl font-bold text-yellow-400">${getTotal().toFixed(2)} MXN</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={handleOpenClipCheckout}
                      className="w-full mt-6 bg-yellow-400 hover:bg-yellow-300 text-[#1a1a1a] font-bold"
                    >
                      Abrir Clip / Open Clip
                    </Button>
                    {!appSettings.clip_payment_link && (
                      <p className="text-xs text-amber-400 mt-3">
                        Falta configurar la liga de pago de Clip en admin.
                      </p>
                    )}
                  </div>

                  <div className="bg-[#242424] border border-yellow-500/20 rounded-lg p-4">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-300">
                        <p className="font-semibold mb-2">Instrucciones / Instructions:</p>
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Abre Clip con el boton de arriba.</li>
                          <li>Completa tu pago con tarjeta en Clip.</li>
                          <li>Vuelve a esta pagina y confirma abajo.</li>
                          <li>El pedido se marcara como pagado cuando lo confirmes.</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="border border-yellow-500/20 rounded-lg p-4 bg-[#242424]">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="payment_confirm"
                        checked={paymentConfirmed}
                        onChange={(e) => setPaymentConfirmed(e.target.checked)}
                        className="w-5 h-5 mt-1"
                      />
                      <Label htmlFor="payment_confirm" className="cursor-pointer text-sm text-gray-300">
                        <span className="font-semibold">Confirmo que he realizado el pago en Clip por ${getTotal().toFixed(2)} MXN</span>
                        <br />
                        <span className="text-gray-500">I confirm that I completed the Clip payment for ${getTotal().toFixed(2)} MXN</span>
                      </Label>
                    </div>
                  </div>

                  <div className="bg-[#242424] rounded-lg p-4 border border-yellow-500/20">
                    <h4 className="font-semibold mb-3 text-yellow-400">Resumen de tu Pedido / Your Order Summary</h4>
                    <div className="space-y-2 text-sm">
                      {cart.map((item, idx) => {
                        const itemTotal = item.price * item.quantity;
                        return (
                          <div key={idx}>
                            <div className="flex justify-between">
                              <span>{item.quantity}x {item.name} {item.is_custom && <Badge className="bg-purple-100 text-purple-800 text-xs">Personalizado</Badge>}</span>
                              <span className="font-semibold">${itemTotal.toFixed(2)}</span>
                            </div>
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
                          <span className="text-gray-400">Cargo por Entrega / Delivery Fee:</span>
                          <span className="font-semibold">${DELIVERY_FEE.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between pt-2 border-t-2 font-bold">
                        <span>Total:</span>
                        <span className="text-yellow-400">${getTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("checkout")}
                      className="flex-1 border-yellow-500/30 bg-transparent text-gray-200 hover:bg-yellow-400/10"
                    >
                      Volver / Back
                    </Button>
                    <Button
                      onClick={handlePaymentConfirmation}
                      disabled={!paymentConfirmed || createOrder.isPending || !appSettings.clip_payment_link}
                      className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-[#1a1a1a] font-bold"
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
      <div className="min-h-screen bg-[#111111] p-3 sm:p-4 text-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border border-yellow-500/20 bg-[#1a1a1a] shadow-2xl overflow-hidden">
              <CardHeader className="bg-yellow-400 text-[#1a1a1a] rounded-t-xl">
                <CardTitle className="text-2xl">Completa tu Pedido / Complete Your Order</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleCheckoutSubmit} className="space-y-6">
                  <div className="space-y-3">
                    <Label>Tipo de Pedido / Order Type *</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        type="button"
                        onClick={() => setCustomerInfo({ ...customerInfo, order_type: 'dine-in' })}
                        className={`p-4 border rounded-2xl flex items-center gap-3 transition-all ${
                          customerInfo.order_type === 'dine-in'
                            ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                            : 'border-yellow-500/20 bg-[#242424] hover:border-yellow-400/60'
                        }`}
                      >
                        <div className="text-3xl font-black">DINE</div>
                        <div className="text-left flex-1">
                          <p className="font-semibold text-white">Comer aqui / Dine-in</p>
                          <p className="text-xs text-gray-400">En el restaurante / At the restaurant</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCustomerInfo({ ...customerInfo, order_type: 'delivery' })}
                        className={`p-4 border rounded-2xl flex items-center gap-3 transition-all ${
                          customerInfo.order_type === 'delivery'
                            ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                            : 'border-yellow-500/20 bg-[#242424] hover:border-yellow-400/60'
                        }`}
                      >
                        <div className="text-3xl font-black">DELI</div>
                        <div className="text-left flex-1">
                          <p className="font-semibold text-white">Entrega / Delivery</p>
                          <p className="text-xs text-gray-400">+ ${DELIVERY_FEE.toFixed(2)} cargo por entrega</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCustomerInfo({ ...customerInfo, order_type: 'pickup' })}
                        className={`p-4 border rounded-2xl flex items-center gap-3 transition-all ${
                          customerInfo.order_type === 'pickup'
                            ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                            : 'border-yellow-500/20 bg-[#242424] hover:border-yellow-400/60'
                        }`}
                      >
                        <div className="text-3xl font-black">PICK</div>
                        <div className="text-left flex-1">
                          <p className="font-semibold text-white">Takeaway / Pickup</p>
                          <p className="text-xs text-gray-400">Sin cargo adicional / No extra fee</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo / Full Name *</Label>
                      <Input
                        id="name"
                        required={customerInfo.order_type !== 'dine-in'}
                        value={customerInfo.order_type === 'dine-in' ? dineInName : customerInfo.customer_name}
                        onChange={(e) => {
                          if (customerInfo.order_type === 'dine-in') {
                            setDineInName(e.target.value);
                          } else {
                            setCustomerInfo({ ...customerInfo, customer_name: e.target.value });
                          }
                        }}
                        placeholder={customerInfo.order_type === 'dine-in' ? "Mesa / Nombre opcional" : "Juan Perez"}
                        className="bg-[#242424] border-yellow-500/20 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefono / Phone Number *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        required={customerInfo.order_type !== 'dine-in'}
                        value={customerInfo.customer_phone}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, customer_phone: e.target.value })}
                        placeholder="+52 55 1234 5678"
                        className="bg-[#242424] border-yellow-500/20 text-white placeholder:text-gray-500"
                      />
                    </div>

                    {customerInfo.order_type === 'delivery' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address">Direccion de Entrega / Delivery Address *</Label>
                        <Input
                          id="address"
                          required
                          value={customerInfo.delivery_address}
                          onChange={(e) => setCustomerInfo({ ...customerInfo, delivery_address: e.target.value })}
                          placeholder="Calle Principal 123, Col. Centro"
                          className="bg-[#242424] border-yellow-500/20 text-white placeholder:text-gray-500"
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
                        className="bg-[#242424] border-yellow-500/20 text-white placeholder:text-gray-500"
                      />
                    </div>

                    <div className="space-y-3 md:col-span-2">
                      <Label>Metodo de Pago / Payment Method *</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {appSettings.accept_cash && (
                          <button
                            type="button"
                            onClick={() => setCustomerInfo({ ...customerInfo, payment_method: 'cash' })}
                            className={`p-4 border rounded-2xl flex items-center gap-3 transition-all ${
                              customerInfo.payment_method === 'cash'
                                ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                                : 'border-yellow-500/20 bg-[#242424] hover:border-yellow-400/60'
                            }`}
                          >
                            <Banknote className={`w-6 h-6 ${customerInfo.payment_method === 'cash' ? 'text-yellow-400' : 'text-gray-500'}`} />
                            <div className="text-left">
                              <p className="font-semibold text-white">Efectivo / Cash</p>
                              <p className="text-xs text-gray-400">
                                {customerInfo.order_type === 'dine-in'
                                  ? 'Pagar en caja / Pay at counter'
                                  : `Pagar al ${customerInfo.order_type === 'delivery' ? 'recibir' : 'recoger'} / Pay on ${customerInfo.order_type === 'delivery' ? 'delivery' : 'pickup'}`}
                              </p>
                            </div>
                          </button>
                        )}

                        {appSettings.accept_card && (
                          <button
                            type="button"
                            onClick={() => setCustomerInfo({ ...customerInfo, payment_method: 'card' })}
                            className={`p-4 border rounded-2xl flex items-center gap-3 transition-all ${
                              customerInfo.payment_method === 'card'
                                ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                                : 'border-yellow-500/20 bg-[#242424] hover:border-yellow-400/60'
                            }`}
                          >
                            <CreditCard className={`w-6 h-6 ${customerInfo.payment_method === 'card' ? 'text-yellow-400' : 'text-gray-500'}`} />
                            <div className="text-left">
                              <p className="font-semibold text-white">Tarjeta / Card</p>
                              <p className="text-xs text-gray-400">Se procesa con Clip / Processed with Clip</p>
                            </div>
                          </button>
                        )}
                      </div>

                      {customerInfo.payment_method === 'card' && (
                        <div className="mt-4 p-4 bg-[#242424] border border-yellow-500/20 rounded-lg space-y-3">
                          <p className="font-semibold text-sm text-yellow-400">Pago con Clip / Clip payment</p>
                          <p className="text-sm text-gray-300">
                            Al confirmar, te llevaremos al siguiente paso para abrir Clip y completar el pago con tarjeta.
                          </p>
                          {!appSettings.clip_payment_link && (
                            <p className="text-xs text-amber-400">
                              Falta configurar la liga de pago de Clip en admin.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-[#242424] rounded-xl p-6 space-y-3 border border-yellow-500/20">
                    <h3 className="font-bold text-lg mb-4 text-yellow-400">Resumen del Pedido / Order Summary</h3>
                    {cart.map((item, idx) => {
                      const itemTotal = item.price * item.quantity;
                      return (
                        <div key={idx} className="text-sm">
                          <div className="flex justify-between">
                            <span>{item.name} x {item.quantity} {item.is_custom && <Badge className="bg-purple-100 text-purple-800 text-xs">Personalizado</Badge>}</span>
                            <span className="font-semibold">${itemTotal.toFixed(2)} MXN</span>
                          </div>
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
                        <span className="text-gray-400">Subtotal:</span>
                        <span className="font-semibold">${getSubtotal().toFixed(2)} MXN</span>
                      </div>
                      
                      {customerInfo.order_type === 'delivery' && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Cargo por Entrega / Delivery Fee:</span>
                          <span className="font-semibold">${DELIVERY_FEE.toFixed(2)} MXN</span>
                        </div>
                      )}
                      
                      <div className="border-t-2 pt-3 flex justify-between font-bold text-xl">
                        <span>Total:</span>
                        <span className="text-yellow-400">${getTotal().toFixed(2)} MXN</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep("menu")}
                      className="flex-1 border-yellow-500/30 bg-transparent text-gray-200 hover:bg-yellow-400/10"
                    >
                      Volver al Menu / Back to Menu
                    </Button>
                    <Button
                      type="submit"
                      disabled={customerInfo.payment_method === 'card' && !appSettings.clip_payment_link}
                      className="flex-1 bg-yellow-400 hover:bg-yellow-300 text-[#1a1a1a] font-bold"
                    >
                      {customerInfo.payment_method === 'card'
                        ? 'Continuar a Clip / Continue to Clip'
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
      <PublicRestaurantExperience
        logoSrc={losTiosLogo}
        restaurantName={appSettings.restaurant_name || "Los Tíos"}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        pizzaPatternStyle={pizzaPatternStyle}
        locale={siteLocale}
        onLocaleChange={(next) => setSiteLocale(normalizeSiteLocale(next))}
      />

      <div id="menu" className="max-w-7xl mx-auto px-4 py-6 lg:py-7 scroll-mt-20">
        {/* Menu */}
        {isLoading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-yellow-500 mx-auto"></div>
            <p className="mt-4 text-gray-400">{publicCopy.menuLoading}</p>
          </div>
        ) : (
          <section aria-labelledby="full-menu-heading" className="space-y-12">
            <div className="text-center">
              <h2 id="full-menu-heading" className="text-2xl font-bold text-white sm:text-3xl">
                {publicCopy.fullMenuSectionTitle}
              </h2>
              <p className="mt-2 text-sm text-gray-500">{publicCopy.fullMenuSectionSubtitle}</p>
            </div>
            {categories.map((category) => {
              const items = availableItems.filter(item => item.category === category.id);
              if (items.length === 0) return null;

              return (
                <div key={category.id}>
                  <div className="mb-7 flex items-center gap-4">
                    <h3 className="rounded-xl border border-yellow-500/40 bg-yellow-400/10 px-4 py-2 text-xl font-bold tracking-tight text-yellow-300 sm:text-2xl">
                      {category.name}
                    </h3>
                    <div className="h-px flex-1 bg-gradient-to-r from-yellow-500/35 to-transparent" />
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => {
                          const title = siteLocale === "en" ? item.name_en || item.name : item.name;
                          const subName =
                            siteLocale === "en" && item.name && item.name_en && item.name !== item.name_en
                              ? item.name
                              : siteLocale === "es" && item.name_en
                                ? item.name_en
                                : null;
                          const desc =
                            siteLocale === "en"
                              ? item.description_en || item.description
                              : item.description;
                          const imgAlt = siteLocale === "en" ? item.name_en || item.name : item.name;
                          return (
                          <motion.article
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ y: -3 }}
                            transition={{ duration: 0.2 }}
                            className="group h-full"
                          >
                            <Card className="flex h-full flex-col overflow-hidden border border-yellow-500/25 bg-[#0f0f0f] shadow-lg transition-all duration-300 group-hover:border-yellow-500/45 group-hover:shadow-2xl">
                              <div className="relative aspect-[4/3] overflow-hidden border-b border-yellow-500/15 bg-[#050505]">
                                <div
                                  aria-hidden
                                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.06)_0%,rgba(0,0,0,0)_62%)]"
                                />
                                <img
                                  src={item.image_url || "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80"}
                                  alt={imgAlt}
                                  className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.03]"
                                />
                                {item.is_vegetarian && (
                                  <Badge className="absolute right-3 top-3 bg-green-600 text-white">
                                    {publicCopy.vegetarian}
                                  </Badge>
                                )}
                              </div>
                              <CardContent className="flex flex-1 flex-col bg-[#121212] p-5">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <h4 className="text-xl font-bold leading-tight text-white">{title}</h4>
                                    {subName && <p className="mt-1 text-xs text-gray-400 italic">{subName}</p>}
                                  </div>
                                  <span className="shrink-0 rounded-full border border-yellow-500/30 bg-yellow-400/10 px-2.5 py-1 text-lg font-bold tabular-nums text-yellow-400">
                                    ${item.price?.toFixed(2)}
                                  </span>
                                </div>

                                {desc ? <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-gray-400">{desc}</p> : <div className="flex-1" />}
                              </CardContent>
                            </Card>
                          </motion.article>
                          );
                        })}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      <section
        id="about"
        aria-labelledby="about-heading"
        className="scroll-mt-24 border-t border-yellow-500/20 bg-[#1a1a1a] px-4 py-12 sm:px-6 sm:py-16"
      >
        <div className="mx-auto max-w-3xl">
          <h2 id="about-heading" className="text-2xl font-bold text-white sm:text-3xl">
            {publicCopy.aboutTitle}
          </h2>
          <p className="mt-2 text-sm text-yellow-400/80">{publicCopy.aboutSubtitle}</p>
          <p className="mt-8 leading-relaxed text-gray-300 sm:text-lg" lang={siteLocale === "es" ? "es-MX" : "en"}>
            {publicCopy.aboutBody}
          </p>
        </div>
      </section>

      <section
        id="visit"
        aria-labelledby="visit-heading"
        className="scroll-mt-24 border-t border-yellow-500/15 bg-[#0a0a0a] px-4 py-14 sm:px-6 sm:py-16"
      >
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <h2 id="visit-heading" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                {publicCopy.visitTitle}
              </h2>
              <p className="mt-2 text-base text-gray-400">{publicCopy.visitIntro}</p>
            </div>
            <div className="flex flex-col gap-2.5 sm:flex-row lg:justify-end">
              <a
                href="https://wa.me/529541307386"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-full border border-yellow-400/55 bg-yellow-400/10 px-4 text-sm font-semibold text-yellow-300 transition hover:border-yellow-300 hover:bg-yellow-400/15 hover:text-yellow-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400 sm:min-w-[194px]"
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                {publicCopy.ctaWhatsApp}
              </a>
              <a
                href={GOOGLE_MAPS_PLACE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/[0.03] px-4 text-sm font-semibold text-gray-100 transition hover:border-yellow-300/70 hover:bg-yellow-400/10 hover:text-yellow-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400 sm:min-w-[194px]"
              >
                <MapPin className="h-4 w-4 shrink-0 text-yellow-400" aria-hidden />
                {publicCopy.ctaMaps}
              </a>
            </div>
          </header>

          <div className="mt-8 grid gap-6 lg:grid-cols-12 lg:gap-6 lg:items-stretch">
            <div className="flex h-full flex-col gap-4 lg:col-span-5">
              <div className="flex flex-1 flex-col justify-center rounded-2xl border border-white/10 bg-[#141414] p-6 text-center sm:p-7">
                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400">{publicCopy.addressLabel}</h3>
                <address className="mt-5 not-italic">
                  <p className="text-2xl font-semibold tracking-tight text-white">{appSettings.restaurant_name || "Los Tíos"}</p>
                  <p className="mx-auto mt-4 max-w-xs text-[1.1rem] leading-relaxed text-gray-200 sm:max-w-sm">
                    Av. Oaxaca 305, Centro
                    <br />
                    71980 Puerto Escondido, Oax., México
                  </p>
                  <p className="mt-3 text-lg font-semibold text-yellow-400/95">Plaza Monte Albán</p>
                </address>
              </div>

              <div className="flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-[#161616] p-6 sm:p-7">
                <div className="flex max-w-sm flex-col items-center text-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-400/12 text-yellow-400">
                    <Clock className="h-4 w-4" aria-hidden />
                  </div>
                  <div className="mt-3 min-w-0">
                    <h3 className="text-[1.9rem] font-semibold tracking-tight text-white">{publicCopy.hoursLead}</h3>
                    <p className="mt-2 text-[1.1rem] font-medium leading-snug text-gray-100">{publicCopy.hoursSchedule}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col lg:col-span-7">
              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#1a1a1a]">
                <iframe
                  title={publicCopy.mapIframeTitle}
                  width="100%"
                  height="320"
                  className="h-full min-h-[260px] w-full flex-1 bg-[#1a1a1a] sm:min-h-[320px]"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={MAP_EMBED}
                />
                <a
                  href={GOOGLE_MAPS_PLACE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[46px] items-center justify-center gap-2 border-t border-white/10 bg-[#0f0f0f] px-4 py-3 text-center text-sm font-medium text-yellow-400 transition hover:bg-black hover:text-yellow-300"
                >
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                  {publicCopy.mapLarger}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

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
                      onClick={() => setStep("checkout")}
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
                    const itemTotal = item.price * item.quantity;
                    
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
        const eventStatuses = [
          { id: "beerfestcondido", isPast: isEventPast(2026, 4, 5) },
          { id: "football-night", isPast: isEventPast(2026, 3, 28) },
          { id: "opening-night", isPast: isEventPast(2026, 3, 20) },
        ];
        const isEventInPast = (eventId) =>
          eventStatuses.find((event) => event.id === eventId)?.isPast ?? false;
        const attendees = 50;

        return (
          <div id="eventos" className="bg-[#1a1a1a] border-t border-yellow-500/20 py-16 px-4 scroll-mt-20">
            <div className="max-w-5xl mx-auto">
              <div className="flex flex-col items-center mb-10">
                <h2 className="text-3xl font-black text-[#1a1a1a] bg-yellow-400 px-6 py-2 rounded-xl inline-block tracking-wide">
                  {publicCopy.eventsTitle}
                </h2>
                <p className="text-center text-gray-500 text-sm mt-3 tracking-widest uppercase">{publicCopy.eventsTagline}</p>
              </div>
              <div className="mb-10 max-w-2xl mx-auto">
                {siteLocale === "es" ? (
                  <div id="event-contact" className="bg-[#242424] border border-yellow-500/20 rounded-2xl p-5 flex flex-col justify-between gap-3">
                    <p className="text-gray-300 text-sm leading-relaxed flex-1">
                      &#127881; <span className="text-yellow-400 font-bold">&iquest;Tienes una idea para un evento con nosotros?</span><br/><br/>
                      En nuestro restaurante en Centro, Puerto Escondido, contamos con nuestro horno h&iacute;brido de gas y le&ntilde;a, una inversi&oacute;n seria para una pizza seria.<br/><br/>
                      Bajo nuestra marca <span className="text-yellow-400 font-semibold">Los Tios Express</span> tambi&eacute;n podemos llevar hornos de pizza port&aacute;tiles a casi cualquier lugar, con un resultado casi igual de incre&iacute;ble. &iexcl;La masa es tan importante como el horno!
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      <a
                        href="mailto:info@lostios.mx?subject=Propuesta de evento&body=Hola equipo de Los Tios, me gustaria proponer un evento..."
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-transparent hover:bg-yellow-400/10 text-yellow-400 text-xs font-semibold transition-colors border border-yellow-400"
                      >
                        Contactanos
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#242424] border border-yellow-500/20 rounded-2xl p-5 flex flex-col justify-between gap-3">
                    <p className="text-gray-300 text-sm leading-relaxed flex-1">
                      &#127881; <span className="text-yellow-400 font-bold">Do you have an idea for an event with us?</span><br/><br/>
                      At our restaurant in Centro, Puerto Escondido, we have our well-invested hybrid wood and gas oven, a serious investment for serious pizza.<br/><br/>
                      Under our brand <span className="text-yellow-400 font-semibold">Los Tios Express</span> we can also bring portable pizza ovens almost anywhere, delivering results that are nearly just as incredible. The dough matters just as much as the oven!
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      <a
                        href="mailto:info@lostios.mx?subject=Event proposal&body=Hi Los Tios team, I would like to propose an event..."
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-transparent hover:bg-yellow-400/10 text-yellow-400 text-xs font-semibold transition-colors border border-yellow-400"
                      >
                        Contact us
                      </a>
                    </div>
                  </div>
                )}
              </div>
              {adminCustomerEvents.length > 0 && (
                <>
                  {adminCustomerEvents
                    .slice()
                    .sort((a, b) => String(a.startDate || "").localeCompare(String(b.startDate || "")))
                    .map((event) => {
                      const isPast = isCustomerEventPast(event);
                      const esButtons = normalizeEventButtons(event.buttonsEs, "es");
                      const enButtons = normalizeEventButtons(event.buttonsEn, "en");
                      const cardClass = isPast
                        ? "bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale"
                        : "bg-[#242424] border-yellow-500/30";
                      const dateLabel = eventDateLabel(event, siteLocale === "en" ? "en" : "es");
                      const badge = siteLocale === "en" ? event.badgeEn || dateLabel : event.badgeEs || dateLabel;
                      const title = siteLocale === "en" ? event.titleEn : event.titleEs;
                      const description = siteLocale === "en" ? event.descriptionEn : event.descriptionEs;
                      const buttons = siteLocale === "en" ? enButtons : esButtons;
                      return (
                        <div key={event.id} className="mb-8 max-w-3xl mx-auto">
                          <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${cardClass}`}>
                            <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2 max-w-[8rem]">
                              <span className="font-black text-2xl leading-none uppercase text-center">{dateLabel.split(" ")[0]}</span>
                              <span className="font-bold text-[10px] tracking-widest uppercase leading-tight text-center">{dateLabel.split(" ").slice(1).join(" ")}</span>
                            </div>
                            <p className={`text-xs font-bold tracking-widest uppercase mb-4 pr-24 ${isPast ? "text-gray-600" : "text-yellow-400/60"}`}>{badge}</p>
                            <h3 className={`text-xl font-black mb-3 pr-20 ${isPast ? "text-gray-400" : "text-white"}`}>{title}</h3>
                            <p className={`leading-relaxed text-sm ${isPast ? "text-gray-600" : "text-gray-300"}`}>{description}</p>
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {buttons.map(({ emoji, text }) => (
                                <div key={`${event.id}-${text}`} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isPast ? "bg-gray-800/50 text-gray-500" : "bg-yellow-400/10 text-yellow-400"}`}>
                                  <span className="text-base leading-none">{emoji}</span>
                                  <span className="text-xs text-center leading-tight">{text}</span>
                                </div>
                              ))}
                            </div>
                            <p className="mt-4 text-xs text-gray-500">{event.location}</p>
                            <EventShareButtons
                              title={`${title} - ${dateLabel}`}
                              text={description}
                              lang={siteLocale === "en" ? "en" : undefined}
                              url={`${window.location.origin}/#eventos`}
                            />
                          </div>
                        </div>
                      );
                    })}
                </>
              )}
              {!isEventInPast("beerfestcondido") && (
              <div className="max-w-3xl mx-auto mb-8">
                {siteLocale === "es" ? (
                <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isEventInPast("beerfestcondido") ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-3xl leading-none">4-5</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">ABRIL</span>
                  </div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">BEERFESTCONDIDO · NODO BREWERY · ZICATELA</p>
                  <h3 className="text-xl font-black mb-3 pr-20 text-white">Bolas del Tio en Beerfestcondido</h3>
                  <p className="leading-relaxed text-sm text-gray-300">
                    El <span className="text-yellow-400 font-semibold">4 y 5 de abril</span> estuvimos en <span className="text-yellow-400 font-semibold">Beerfestcondido</span> en <span className="text-yellow-400 font-semibold">Nodo Brewery, Zicatela</span>, sirviendo nuestras <span className="text-yellow-400 font-semibold">Bolas del Tio</span>. Nuestra variante express: bolitas fritas hechas con nuestra propia masa de pizza real, doradas y crujientes por fuera, suavecitas por dentro. El festival estuvo cargado de chela artesanal, buena banda y esa vibra de playa que solo Puerto Escondido tiene. Una noche de esas que no se olvidan.
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🍺", line1: "Cerveza", line2: "artesanal" },
                      { emoji: "🍕", line1: "Bolas", line2: "del Tio" },
                      { emoji: "✨", line1: "Buena", line2: "vibra" },
                      { emoji: "🎉", line1: "Nodo", line2: "Brewery" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isEventInPast("beerfestcondido") ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">Beerfestcondido at Nodo Brewery, Zicatela, Puerto Escondido, Oax.</p>
                  <EventShareButtons title="Bolas del Tio en Beerfestcondido - 4 y 5 Abril" text="Nos vemos en Nodo Brewery con Bolas del Tio, cerveza artesanal y buena vibra!" url={`${window.location.origin}/#eventos`} />
                </div>
                ) : (
                <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isEventInPast("beerfestcondido") ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-3xl leading-none">4-5</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">APRIL</span>
                  </div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">BEERFESTCONDIDO · NODO BREWERY · ZICATELA</p>
                  <h3 className="text-xl font-black mb-3 pr-20 text-white">Bolas del Tio at Beerfestcondido</h3>
                  <p className="leading-relaxed text-sm text-gray-300">
                    On <span className="text-yellow-400 font-semibold">April 4-5</span> we were at <span className="text-yellow-400 font-semibold">Beerfestcondido</span> at <span className="text-yellow-400 font-semibold">Nodo Brewery in Zicatela</span>, serving our <span className="text-yellow-400 font-semibold">Bolas del Tio</span>. Our Los Tios Express creation: deep-fried pizza balls made from our real pizza dough, golden and crispy on the outside, pillowy soft on the inside. The festival was packed with craft beer, great people and that signature Puerto Escondido beach energy. Exactly the kind of night you don't forget.
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🍺", line1: "Craft", line2: "beer" },
                      { emoji: "🍕", line1: "Bolas", line2: "del Tio" },
                      { emoji: "✨", line1: "Great", line2: "vibe" },
                      { emoji: "🎉", line1: "Nodo", line2: "Brewery" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isEventInPast("beerfestcondido") ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">Beerfestcondido at Nodo Brewery, Zicatela, Puerto Escondido, Oax.</p>
                  <EventShareButtons title="Bolas del Tio at Beerfestcondido - April 4-5" text="Catch us at Nodo Brewery for Bolas del Tio, craft beer and great vibes!" lang="en" url={`${window.location.origin}/#eventos`} />
                </div>
                )}
              </div>
              )}

              {!isEventInPast("football-night") && (
              <div className="max-w-3xl mx-auto">
                {siteLocale === "es" ? (
                <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isEventInPast("football-night") ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-5xl leading-none">28</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARZO</span>
                  </div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">4 PM HASTA TARDE</p>
                  <h3 className="text-xl font-black mb-3 pr-20 text-white">Football Night at Los Tios</h3>
                  <p className="leading-relaxed text-sm text-gray-300">
                    Vive el partido con nosotros en una noche de futbol, buena vibra y pura fiesta. Tendremos pizzas recien hechas, cervezas bien frias y <span className="text-yellow-400 font-semibold">shots de mezcal</span> para subir el animo. Cada jugada se vive mejor aqui, con musica, energia y toda la banda apoyando. Perfecto para venir con los tíos, echar chela, gritar los goles y quedarte despues del partido. No es solo ver el juego... es vivirlo.
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🍺", line1: "Chela", line2: "fria" },
                      { emoji: "🍕", line1: "Pizza", line2: "recien hecha" },
                      { emoji: "🥃", line1: "Shots de", line2: "mezcal" },
                      { emoji: "⚽", line1: "Futbol", line2: "en vivo" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isEventInPast("football-night") ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBAN)</span></p>
                  <EventShareButtons title="Football Night at Los Tios - 28 Marzo" text="Ven a ver el partido, pizza, chela y mezcal!" url={`${window.location.origin}/#eventos`} />
                </div>
                ) : (
                <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isEventInPast("football-night") ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-5xl leading-none">28</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARCH</span>
                  </div>
                  <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">4 PM TILL LATE</p>
                  <h3 className="text-xl font-black mb-3 pr-20 text-white">Football Night at Los Tios</h3>
                  <p className="leading-relaxed text-sm text-gray-300">
                    Game night hits different at Los Tios. Come watch the match with us in a high-energy atmosphere full of good vibes and great people. Expect fresh pizza, ice-cold beers, and <span className="text-yellow-400 font-semibold">mezcal shots</span> to keep the energy going. Every moment of the game feels bigger here, with music, crowd hype, and nonstop action. Bring your crew, grab a drink, cheer loud, and stay after the match to keep the party going. This is not just watching the game... it is experiencing it.
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🍺", line1: "Cold", line2: "beer" },
                      { emoji: "🍕", line1: "Fresh", line2: "pizza" },
                      { emoji: "🥃", line1: "Mezcal", line2: "shots" },
                      { emoji: "⚽", line1: "Live", line2: "football" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isEventInPast("football-night") ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBAN)</span></p>
                  <EventShareButtons title="Football Night at Los Tios - March 28" text="Come watch the match, fresh pizza, cold beers and mezcal shots!" lang="en" url={`${window.location.origin}/#eventos`} />
                </div>
                )}
              </div>
              )}

              {/* Event suggestion CTA */}
              <div className="hidden mt-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                <div id="event-contact" className="bg-[#242424] border border-yellow-500/20 rounded-2xl p-5 flex flex-col justify-between gap-3">
                  <p className="text-gray-300 text-sm leading-relaxed flex-1">
                    Event idea? Reach out to us.
                    We can host or bring pizza events to many locations.
                    Contact us if you want to plan something together.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                   <a
                     href="mailto:info@lostios.mx?subject=Propuesta de evento"
                     className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-transparent hover:bg-yellow-400/10 text-yellow-400 text-xs font-semibold transition-colors border border-yellow-400"
                   >
                     Contactanos
                   </a>
                  </div>
                </div>
                <div className="bg-[#242424] border border-yellow-500/20 rounded-2xl p-5 flex flex-col justify-between gap-3">
                  <p className="text-gray-300 text-sm leading-relaxed flex-1">
                    Do you have an idea for an event with us?<br/><br/>
                    At our restaurant in Centro, Puerto Escondido, we have our well-invested hybrid wood and gas oven, a serious investment for serious pizza.<br/><br/>
                    Under our brand <span className="text-yellow-400 font-semibold">Los Tios Express</span> we can also bring portable pizza ovens almost anywhere, delivering results that are nearly just as incredible. The dough matters just as much as the oven!
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                   <a
                     href="mailto:info@lostios.mx?subject=Event proposal&body=Hi Los Tios team, I would like to propose an event..."
                     className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-transparent hover:bg-yellow-400/10 text-yellow-400 text-xs font-semibold transition-colors border border-yellow-400"
                   >
                     Contact us
                   </a>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-yellow-500/10 my-8"></div>
              <p className="text-center text-gray-500 text-sm mb-8 tracking-widest uppercase">{publicCopy.eventsPastSection}</p>
              {isEventInPast("beerfestcondido") && (
                <div className="max-w-3xl mx-auto mb-8">
                  {siteLocale === "es" ? (
                  <div className="rounded-2xl p-6 border relative overflow-hidden transition-all bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale">
                    <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                      <span className="font-black text-3xl leading-none">4-5</span>
                      <span className="font-bold text-xs tracking-widest uppercase leading-tight">ABRIL</span>
                    </div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">BEERFESTCONDIDO · NODO BREWERY · ZICATELA</p>
                    <h3 className="text-xl font-black mb-3 pr-20 text-white">Bolas del Tio en Beerfestcondido</h3>
                    <p className="leading-relaxed text-sm text-gray-300">
                      El <span className="text-yellow-400 font-semibold">4 y 5 de abril</span> estuvimos en <span className="text-yellow-400 font-semibold">Beerfestcondido</span> en <span className="text-yellow-400 font-semibold">Nodo Brewery, Zicatela</span>, sirviendo nuestras <span className="text-yellow-400 font-semibold">Bolas del Tio</span>. Nuestra variante express: bolitas fritas hechas con nuestra propia masa de pizza real, doradas y crujientes por fuera, suavecitas por dentro. El festival estuvo cargado de chela artesanal, buena banda y esa vibra de playa que solo Puerto Escondido tiene. Una noche de esas que no se olvidan.
                    </p>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { emoji: "🍺", line1: "Cerveza", line2: "artesanal" },
                        { emoji: "🍕", line1: "Bolas", line2: "del Tio" },
                        { emoji: "✨", line1: "Buena", line2: "vibra" },
                        { emoji: "🎉", line1: "Nodo", line2: "Brewery" },
                      ].map(({ emoji, line1, line2 }) => (
                        <div key={line1} className="text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 bg-gray-800/50 text-gray-500">
                          <span className="text-base leading-none">{emoji}</span>
                          <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-500">Beerfestcondido at Nodo Brewery, Zicatela, Puerto Escondido, Oax.</p>
                  </div>
                  ) : (
                  <div className="rounded-2xl p-6 border relative overflow-hidden transition-all bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale">
                    <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                      <span className="font-black text-3xl leading-none">4-5</span>
                      <span className="font-bold text-xs tracking-widest uppercase leading-tight">APRIL</span>
                    </div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">BEERFESTCONDIDO · NODO BREWERY · ZICATELA</p>
                    <h3 className="text-xl font-black mb-3 pr-20 text-white">Bolas del Tio at Beerfestcondido</h3>
                    <p className="leading-relaxed text-sm text-gray-300">
                      On <span className="text-yellow-400 font-semibold">April 4-5</span> we were at <span className="text-yellow-400 font-semibold">Beerfestcondido</span> at <span className="text-yellow-400 font-semibold">Nodo Brewery in Zicatela</span>, serving our <span className="text-yellow-400 font-semibold">Bolas del Tio</span>. Our Los Tios Express creation: deep-fried pizza balls made from our real pizza dough, golden and crispy on the outside, pillowy soft on the inside. The festival was packed with craft beer, great people and that signature Puerto Escondido beach energy. Exactly the kind of night you don't forget.
                    </p>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { emoji: "🍺", line1: "Craft", line2: "beer" },
                        { emoji: "🍕", line1: "Bolas", line2: "del Tio" },
                        { emoji: "✨", line1: "Great", line2: "vibe" },
                        { emoji: "🎉", line1: "Nodo", line2: "Brewery" },
                      ].map(({ emoji, line1, line2 }) => (
                        <div key={line1} className="text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 bg-gray-800/50 text-gray-500">
                          <span className="text-base leading-none">{emoji}</span>
                          <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-500">Beerfestcondido at Nodo Brewery, Zicatela, Puerto Escondido, Oax.</p>
                  </div>
                  )}
                </div>
              )}
              {isEventInPast("football-night") && (
                <div className="max-w-3xl mx-auto mb-8">
                  {siteLocale === "es" ? (
                  <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isEventInPast("football-night") ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                    <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                      <span className="font-black text-5xl leading-none">28</span>
                      <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARZO</span>
                    </div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">4 PM HASTA TARDE</p>
                    <h3 className="text-xl font-black mb-3 pr-20 text-white">Football Night at Los Tios</h3>
                    <p className="leading-relaxed text-sm text-gray-300">
                      Vive el partido con nosotros en una noche de futbol, buena vibra y pura fiesta. Tendremos pizzas recien hechas, cervezas bien frias y <span className="text-yellow-400 font-semibold">shots de mezcal</span> para subir el animo. Cada jugada se vive mejor aqui, con musica, energia y toda la banda apoyando. Perfecto para venir con los tíos, echar chela, gritar los goles y quedarte despues del partido. No es solo ver el juego... es vivirlo.
                    </p>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { emoji: "🍺", line1: "Chela", line2: "fria" },
                        { emoji: "🍕", line1: "Pizza", line2: "recien hecha" },
                        { emoji: "🥃", line1: "Shots de", line2: "mezcal" },
                        { emoji: "⚽", line1: "Futbol", line2: "en vivo" },
                      ].map(({ emoji, line1, line2 }) => (
                        <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isEventInPast("football-night") ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                          <span className="text-base leading-none">{emoji}</span>
                          <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-500">Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBAN)</span></p>
                    <EventShareButtons title="Football Night at Los Tios - 28 Marzo" text="Ven a ver el partido, pizza, chela y mezcal!" url={`${window.location.origin}/#eventos`} />
                  </div>
                  ) : (
                  <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isEventInPast("football-night") ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                    <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                      <span className="font-black text-5xl leading-none">28</span>
                      <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARCH</span>
                    </div>
                    <p className="text-xs font-bold tracking-widest uppercase mb-4 text-yellow-400/60">4 PM TILL LATE</p>
                    <h3 className="text-xl font-black mb-3 pr-20 text-white">Football Night at Los Tios</h3>
                    <p className="leading-relaxed text-sm text-gray-300">
                      Game night hits different at Los Tios. Come watch the match with us in a high-energy atmosphere full of good vibes and great people. Expect fresh pizza, ice-cold beers, and <span className="text-yellow-400 font-semibold">mezcal shots</span> to keep the energy going. Every moment of the game feels bigger here, with music, crowd hype, and nonstop action. Bring your crew, grab a drink, cheer loud, and stay after the match to keep the party going. This is not just watching the game... it is experiencing it.
                    </p>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { emoji: "🍺", line1: "Cold", line2: "beer" },
                        { emoji: "🍕", line1: "Fresh", line2: "pizza" },
                        { emoji: "🥃", line1: "Mezcal", line2: "shots" },
                        { emoji: "⚽", line1: "Live", line2: "football" },
                      ].map(({ emoji, line1, line2 }) => (
                        <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isEventInPast("football-night") ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                          <span className="text-base leading-none">{emoji}</span>
                          <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 text-xs text-gray-500">Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBAN)</span></p>
                    <EventShareButtons title="Football Night at Los Tios - March 28" text="Come watch the match, fresh pizza, cold beers and mezcal shots!" lang="en" url={`${window.location.origin}/#eventos`} />
                  </div>
                  )}
                </div>
              )}
              <div className="max-w-3xl mx-auto">
                {siteLocale === "es" ? (
                <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isEventInPast("opening-night") ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-5xl leading-none">20</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARZO</span>
                  </div>
                  <p className={`text-xs font-bold tracking-widest uppercase mb-4 ${isEventInPast("opening-night") ? 'text-gray-600' : 'text-yellow-400/60'}`}>4 PM HASTA TARDE
                    {isEventInPast("opening-night") && <span className="ml-3 inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full text-gray-400 normal-case tracking-normal font-semibold">+{attendees} asistieron</span>}
                  </p>
                  <h3 className={`text-xl font-black mb-3 pr-16 ${isEventInPast("opening-night") ? 'text-gray-400' : 'text-white'}`}>Cumpleanos del Chef<br/>& Apertura del Restaurante</h3>
                  <p className={`leading-relaxed text-sm ${isEventInPast("opening-night") ? 'text-gray-600' : 'text-gray-300'}`}>
                    El evento mas importante de Los Tios! Celebramos el cumpleanos de nuestro chef y la apertura oficial del restaurante. Habra <span className={isEventInPast("opening-night") ? 'font-semibold' : 'text-yellow-400 font-semibold'}>bebida de bienvenida</span> para todos, musica de primer nivel toda la noche, pizzas increibles y cerveza a precios de tío. No te lo puedes perder, ven, come, baila y brinda con nosotros. Nos vemos ahi, familia!
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🥂", line1: "Welcome", line2: "drink" },
                      { emoji: "🍕", line1: "Pizza", line2: "deals" },
                      { emoji: "🍺", line1: "Cerveza", line2: "deals" },
                      { emoji: "🎵", line1: "Buena", line2: "musica" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isEventInPast("opening-night") ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBAN)</span></p>
                  <EventShareButtons title="Cumpleanos del Chef & Apertura - 20 Marzo" text="Bebida de bienvenida, pizza, musica y mucha fiesta!" url={`${window.location.origin}/#eventos`} />
                </div>
                ) : (
                <div className={`rounded-2xl p-6 border relative overflow-hidden transition-all ${isEventInPast("opening-night") ? 'bg-[#1e1e1e] border-gray-700/40 opacity-70 grayscale' : 'bg-[#242424] border-yellow-500/30'}`}>
                  <div className="absolute top-0 right-0 bg-yellow-400 text-[#1a1a1a] rounded-bl-2xl flex flex-col items-center px-4 py-2">
                    <span className="font-black text-5xl leading-none">20</span>
                    <span className="font-bold text-xs tracking-widest uppercase leading-tight">MARCH</span>
                  </div>
                  <p className={`text-xs font-bold tracking-widest uppercase mb-4 ${isEventInPast("opening-night") ? 'text-gray-600' : 'text-yellow-400/60'}`}>4 PM TILL LATE
                    {isEventInPast("opening-night") && <span className="ml-3 inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full text-gray-400 normal-case tracking-normal font-semibold">+{attendees} attended</span>}
                  </p>
                  <h3 className={`text-xl font-black mb-3 pr-16 ${isEventInPast("opening-night") ? 'text-gray-400' : 'text-white'}`}>Chef's Birthday<br/>& Restaurant Opening</h3>
                  <p className={`leading-relaxed text-sm ${isEventInPast("opening-night") ? 'text-gray-600' : 'text-gray-300'}`}>
                    The biggest night in Los Tios history! We're celebrating our chef's birthday AND the official opening of the restaurant. Expect a <span className={isEventInPast("opening-night") ? 'font-semibold' : 'text-yellow-400 font-semibold'}>welcome drink on the house</span>, killer music all night long, insane pizza and cold beers at seriously good prices. Come through, eat good, dance, and toast with us. See you there, familia!
                  </p>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { emoji: "🥂", line1: "Welcome", line2: "drink" },
                      { emoji: "🍕", line1: "Pizza", line2: "deals" },
                      { emoji: "🍺", line1: "Beer", line2: "deals" },
                      { emoji: "🎵", line1: "Great", line2: "music" },
                    ].map(({ emoji, line1, line2 }) => (
                      <div key={line1} className={`text-xs font-bold px-3 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 h-16 ${isEventInPast("opening-night") ? 'bg-gray-800/50 text-gray-500' : 'bg-yellow-400/10 text-yellow-400'}`}>
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-xs text-center leading-tight">{line1}<br/>{line2}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-gray-500">Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. <span className="text-gray-600">(PLAZA MONTE ALBAN)</span></p>
                  <EventShareButtons title="Chef's Birthday & Restaurant Opening - March 20" text="Welcome drink on the house, killer music, pizza and cold beers!" lang="en" url={`${window.location.origin}/#eventos`} />
                </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Footer — map lives in #visit to avoid duplicate embeds */}
      <footer className="relative mt-0 overflow-hidden bg-yellow-400 py-10 text-[#1a1a1a]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/55 via-black/30 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#fde047]/60"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#fde047]/30 via-[#fde047]/10 to-transparent blur-[1px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-40"
          style={pizzaPatternStyle}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 via-black/30 to-transparent"
        />
        <div className="relative max-w-7xl mx-auto px-4 text-center">
          <img 
            src={losTiosLogo}
            alt="Los Tíos"
            className="w-40 h-40 mx-auto mb-4 rounded-full bg-[#f5c400] p-1 border-2 border-yellow-300/90 object-contain shadow-md"
          />
          <p className="mb-3 font-semibold">
            {siteLocale === "en" ? "Authentic pizzas made with love" : "Pizzas autenticas hechas con amor"}
          </p>
          <p className="text-sm font-medium mb-1">Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax.</p>
          <p className="text-sm font-bold mb-4">PLAZA MONTE ALBÁN</p>
          <div className="mb-6 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
            <a
              href="#visit"
              className="inline-flex items-center justify-center rounded-full bg-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-yellow-400 shadow-md transition hover:bg-black"
            >
              {publicCopy.ctaDirections}
            </a>
            <a
              href={GOOGLE_MAPS_PLACE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border-2 border-[#1a1a1a] px-5 py-2.5 text-sm font-bold text-[#1a1a1a] transition hover:bg-[#1a1a1a] hover:text-yellow-400"
            >
              {publicCopy.ctaMaps}
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
            {/* TripAdvisor */}
            <a href={TRIPADVISOR_URL} target="_blank" rel="noopener noreferrer"
              className="bg-[#1a1a1a] rounded-full p-2.5 hover:scale-110 transition-transform"
              title="TripAdvisor" aria-label="TripAdvisor">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M11.99 4.5c2.17 0 4.17.63 5.85 1.7l3.16.03-1.56 1.4c.53.79.9 1.69 1.04 2.66.97.56 1.62 1.61 1.62 2.82 0 1.79-1.46 3.25-3.25 3.25-.93 0-1.77-.39-2.36-1.02l-2.73 2.43-2.73-2.43c-.59.63-1.43 1.02-2.36 1.02-1.79 0-3.25-1.46-3.25-3.25 0-1.21.65-2.26 1.62-2.82.14-.97.51-1.87 1.04-2.66L3 6.23l3.16-.03A10.43 10.43 0 0 1 11.99 4.5Zm0 1.7c-1.62 0-3.11.47-4.37 1.28.27.4.5.83.67 1.29a3.23 3.23 0 0 1 3.69 1.12 3.23 3.23 0 0 1 3.69-1.12c.17-.46.4-.89.67-1.29A8.72 8.72 0 0 0 11.99 6.2ZM8.75 10.8c-1.08 0-1.95.87-1.95 1.95s.87 1.95 1.95 1.95 1.95-.87 1.95-1.95-.87-1.95-1.95-1.95Zm6.48 0c-1.08 0-1.95.87-1.95 1.95s.87 1.95 1.95 1.95 1.95-.87 1.95-1.95-.87-1.95-1.95-1.95Zm-6.48 1.02a.93.93 0 1 1 0 1.86.93.93 0 0 1 0-1.86Zm6.48 0a.93.93 0 1 1 0 1.86.93.93 0 0 1 0-1.86Z"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
