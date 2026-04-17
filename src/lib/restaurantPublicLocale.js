/** Mexican Spanish (es) vs English (en) copy for the public restaurant shell only. */

const STORAGE_KEY = "lostios-locale";

/** @typedef {'es' | 'en'} SiteLocale */

/** @param {unknown} value */
export function normalizeSiteLocale(value) {
  return value === "en" ? "en" : "es";
}

export function readStoredLocale() {
  try {
    return normalizeSiteLocale(
      typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
    );
  } catch {
    return "es";
  }
}

/** @param {SiteLocale} locale */
export function persistLocale(locale) {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

/** @param {SiteLocale} locale */
export function getPublicRestaurantCopy(locale) {
  const es = {
    skipToMenu: "Saltar al menú",
    navPizzas: "Pizzas",
    navMenu: "Menú",
    navStory: "Nosotros",
    navVisit: "Visítanos",
    navEvents: "Eventos",
    navOrder: "Pedir",
    navWhatsApp: "WhatsApp",
    navOpen: "Abrir menú",
    mobileNav: [
      ["#menu", "Menú"],
      ["#about", "Nuestra historia"],
      ["#gallery", "Galería"],
      ["#reviews", "Reseñas"],
      ["#visit", "Ubicación y horario"],
      ["#eventos", "Eventos"],
    ],
    mobileWhatsApp: "WhatsApp, mesa o a domicilio",
    mobileMaps: "Abrir en Google Maps",
    heroTitle: "Pizza artesanal, Puerto Escondido",
    heroSubtitle: "Pizza estilo napolitano contemporáneo en la costa oaxaqueña",
    heroBodyParagraphs: [
      "Masa con prefermento de 48 horas, un horno híbrido de leña y gas, y cuatro tíos con raíces en México, Francia, Italia y Suecia.",
      "Hacemos una versión moderna de la pizza napolitana. La masa fermenta lento para sacar más sabor y se hornea a alta temperatura para lograr una base ligera y aireada, manteniendo todo simple.",
      "Le ponemos mucho cuidado a los ingredientes, preparando todo fresco y a mano, desde las salsas hasta los toppings.",
      "Vibra relajada de playa, donde cada noche tiene su propio ambiente en Puerto Escondido.",
    ],
    ctaOrder: "Pedir en línea",
    ctaWa: "WhatsApp",
    ctaDirections: "Cómo llegar y horario",
    heroFootnote:
      "Envío, recoger o comer aquí. Av. Oaxaca 305, Plaza Monte Albán, Puerto Escondido, Oax.",
    addToCart: "Agregar al carrito",
    vegetarian: "Vegetariana",
    aboutTitle: "Cuatro tíos, un horno, sin atajos",
    aboutSubtitle: "Los Tíos, Puerto Escondido",
    aboutBody:
      "Los Tíos es una pizzería con alma de playa en Puerto Escondido: pizza estilo napolitano, ambiente relajado y un horno híbrido de leña y gas. Cuatro tíos con raíces en México, Francia, Italia y Suecia; servimos masa trabajada con paciencia, ingredientes honestos y la energía tranquila de la costa oaxaqueña.",
    galleryTitle: "Ambiente",
    gallerySubtitle: "Síguenos en @lostios.pxm para mesas del día y promos.",
    galleryAlts: [
      "Pizza recién salida del horno en Los Tíos",
      "Pizza estilo napolitano con borde dorado",
      "Pizza recién horneada, primer plano",
      "Los tíos compartiendo pizza en el restaurante",
    ],
    reviewsTitle: "Lo que dice la gente",
    reviewsSubtitle: "Una selección de reseñas de Google y TripAdvisor.",
    reviewsGoogleStats: "★ {rating} en Google · {count} reseñas",
    reviewsPrev: "Reseñas anteriores",
    reviewsNext: "Siguientes reseñas",
    reviewsGoogleSource: "Google",
    reviewsTripadvisorSource: "TripAdvisor",
    reviewsFooterBefore: "Deja reseña en",
    reviewsFooterGoogle: "Google",
    reviewsFooterTripadvisor: "TripAdvisor",
    reviewsFooterOr: "o",
    reviewsFooterInsta: "etiquétanos en Instagram",
    reviewsFooterAfter: ".",
    visitTitle: "Visítanos",
    visitIntro: "Centro de Puerto Escondido, Plaza Monte Albán.",
    addressLabel: "Dirección",
    hoursLead: "Horario",
    hoursSchedule: "Martes a domingo, 4:00 p. m. a 11:00 p. m. Cerrado los lunes.",
    visitCtaHint: "Reserva o pregunta por el menú del día",
    ctaWhatsApp: "Escribir por WhatsApp",
    ctaMaps: "Abrir en Google Maps",
    mapIframeTitle: "Mapa, Los Tíos Puerto Escondido",
    mapSectionLabel: "Mapa",
    mapLarger: "Abrir mapa grande y ruta en Google Maps →",
    fullMenuSectionTitle: "Menú",
    fullMenuSectionSubtitle:
      "Toca un platillo para agregar. Puedes elegir envío, recoger o comer en el local.",
    langToggle: "Idioma del sitio",
    langEs: "Español (México)",
    langEn: "English",
    menuLoading: "Cargando menú…",
    eventsTitle: "Eventos",
    eventsTagline: "Lo que viene 🔥",
    eventsPastSection: "Evento pasado",
  };

  const en = {
    skipToMenu: "Skip to menu",
    navPizzas: "Pizzas",
    navMenu: "Menu",
    navStory: "Our story",
    navVisit: "Visit",
    navEvents: "Events",
    navOrder: "Order",
    navWhatsApp: "WhatsApp",
    navOpen: "Open menu",
    mobileNav: [
      ["#menu", "Menu"],
      ["#about", "Our story"],
      ["#gallery", "Gallery"],
      ["#reviews", "Reviews"],
      ["#visit", "Location & hours"],
      ["#eventos", "Events"],
    ],
    mobileWhatsApp: "WhatsApp, table or delivery",
    mobileMaps: "Open in Google Maps",
    heroTitle: "Artisan Pizza, Puerto Escondido",
    heroSubtitle: "Contemporary Neapolitan-style pizza on the Oaxacan coast",
    heroBodyParagraphs: [
      "Dough made with a 48-hour preferment, a hybrid wood and gas oven, and four uncles with roots in Mexico, France, Italy, and Sweden.",
      "We make a modern take on Neapolitan-style pizza. The dough is long-fermented for flavor and baked hot for a light, airy crust, while everything is kept simple.",
      "We put real care into our ingredients, preparing everything fresh and by hand, from sauces to toppings.",
      "Laid-back beach energy, where every evening brings its own vibe in Puerto Escondido.",
    ],
    ctaOrder: "Order online",
    ctaWa: "WhatsApp",
    ctaDirections: "Directions & hours",
    heroFootnote:
      "Delivery, pickup, or dine-in. Av. Oaxaca 305, Plaza Monte Albán, Puerto Escondido, Oax.",
    addToCart: "Add to cart",
    vegetarian: "Vegetarian",
    aboutTitle: "Four uncles, one oven, zero shortcuts",
    aboutSubtitle: "Los Tíos, Puerto Escondido",
    aboutBody:
      "Los Tíos is a beach town pizzeria in Puerto Escondido: Neapolitan inspired pies, relaxed room energy, and a hybrid wood and gas oven we invested in. Four uncles with roots across Mexico, France, Italy, and Sweden. We ferment with care and welcome you like family off Oaxaca’s coast.",
    galleryTitle: "The room",
    gallerySubtitle: "Follow @lostios.pxm for tables and specials.",
    galleryAlts: [
      "Fresh pizza from the oven at Los Tíos",
      "Neapolitan style pizza with a blistered crust",
      "Wood fired style pizza, close up",
      "Los Tíos sharing pizza in the restaurant",
    ],
    reviewsTitle: "What guests say",
    reviewsSubtitle: "A selection of reviews from Google and TripAdvisor.",
    reviewsGoogleStats: "★ {rating} on Google · {count} reviews",
    reviewsPrev: "Previous reviews",
    reviewsNext: "More reviews",
    reviewsGoogleSource: "Google",
    reviewsTripadvisorSource: "TripAdvisor",
    reviewsFooterBefore: "Leave a review on",
    reviewsFooterGoogle: "Google",
    reviewsFooterTripadvisor: "TripAdvisor",
    reviewsFooterOr: "or",
    reviewsFooterInsta: "tag us on Instagram",
    reviewsFooterAfter: ".",
    visitTitle: "Visit us",
    visitIntro: "Downtown Puerto Escondido, Plaza Monte Albán.",
    addressLabel: "Address",
    hoursLead: "Hours",
    hoursSchedule: "Tuesday to Sunday, 4:00 to 11:00 PM. Closed Mondays.",
    visitCtaHint: "Book a table or ask about today’s specials",
    ctaWhatsApp: "Message on WhatsApp",
    ctaMaps: "Open in Google Maps",
    mapIframeTitle: "Map, Los Tíos Puerto Escondido",
    mapSectionLabel: "Map",
    mapLarger: "Open full map & directions in Google Maps →",
    fullMenuSectionTitle: "Menu",
    fullMenuSectionSubtitle: "Tap items to add. Checkout supports delivery, pickup, and dine-in.",
    langToggle: "Site language",
    langEs: "Spanish (Mexico)",
    langEn: "English",
    menuLoading: "Loading menu…",
    eventsTitle: "Events",
    eventsTagline: "What's coming 🔥",
    eventsPastSection: "Past event",
  };

  return locale === "en" ? en : es;
}
