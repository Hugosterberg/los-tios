export const CUSTOMER_EVENTS_SETTINGS_KEY = "customer_events_json";
export const LOS_TIOS_DEFAULT_EVENT_LOCATION =
  "Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. (PLAZA MONTE ALBAN)";

const LOCAL_CUSTOMER_EVENTS_STORAGE_KEY = "los_tios_customer_events_v1";
const isBrowser = typeof window !== "undefined";

export const DEFAULT_EVENT_BUTTONS = [
  { emoji: "🍺", es: "Chela fria", en: "Cold beer" },
  { emoji: "🍕", es: "Pizza", en: "Pizza" },
  { emoji: "✨", es: "Buena vibra", en: "Good vibe" },
  { emoji: "🎉", es: "Fiesta", en: "Party" },
];

export const SEEDED_CUSTOMER_EVENTS = [
  {
    id: "beerfestcondido",
    source: "seed",
    startDate: "2026-04-04",
    endDate: "2026-04-05",
    badgeEs: "BEERFESTCONDIDO · NODO BREWERY · ZICATELA",
    badgeEn: "BEERFESTCONDIDO · NODO BREWERY · ZICATELA",
    titleEs: "Bolas del Tio en Beerfestcondido",
    titleEn: "Bolas del Tio at Beerfestcondido",
    descriptionEs:
      "El 4 y 5 de abril estuvimos en Beerfestcondido en Nodo Brewery, Zicatela, sirviendo nuestras Bolas del Tio: bolitas fritas hechas con nuestra propia masa de pizza real, doradas y crujientes por fuera, suavecitas por dentro.",
    descriptionEn:
      "On April 4-5 we were at Beerfestcondido at Nodo Brewery in Zicatela, serving our Bolas del Tio: deep-fried pizza balls made from our real pizza dough, golden and crispy outside and soft inside.",
    location: "Beerfestcondido at Nodo Brewery, Zicatela, Puerto Escondido, Oax.",
    buttonsEs: [
      { emoji: "🍺", text: "Cerveza artesanal" },
      { emoji: "🍕", text: "Bolas del Tio" },
      { emoji: "✨", text: "Buena vibra" },
      { emoji: "🎉", text: "Nodo Brewery" },
    ],
    buttonsEn: [
      { emoji: "🍺", text: "Craft beer" },
      { emoji: "🍕", text: "Bolas del Tio" },
      { emoji: "✨", text: "Great vibe" },
      { emoji: "🎉", text: "Nodo Brewery" },
    ],
  },
  {
    id: "football-night",
    source: "seed",
    startDate: "2026-03-28",
    endDate: "2026-03-28",
    badgeEs: "4 PM HASTA TARDE",
    badgeEn: "4 PM TILL LATE",
    titleEs: "Football Night at Los Tios",
    titleEn: "Football Night at Los Tios",
    descriptionEs:
      "Vive el partido con nosotros en una noche de futbol, buena vibra y pura fiesta. Tendremos pizzas recien hechas, cervezas bien frias y shots de mezcal.",
    descriptionEn:
      "Game night hits different at Los Tios. Come watch the match with us, fresh pizza, ice-cold beers, mezcal shots and good vibes.",
    location: "Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. (PLAZA MONTE ALBAN)",
    buttonsEs: [
      { emoji: "🍺", text: "Chela fria" },
      { emoji: "🍕", text: "Pizza recien hecha" },
      { emoji: "🥃", text: "Shots de mezcal" },
      { emoji: "⚽", text: "Futbol en vivo" },
    ],
    buttonsEn: [
      { emoji: "🍺", text: "Cold beer" },
      { emoji: "🍕", text: "Fresh pizza" },
      { emoji: "🥃", text: "Mezcal shots" },
      { emoji: "⚽", text: "Live football" },
    ],
  },
  {
    id: "opening-night",
    source: "seed",
    startDate: "2026-03-20",
    endDate: "2026-03-20",
    badgeEs: "4 PM HASTA TARDE",
    badgeEn: "4 PM TILL LATE",
    titleEs: "Cumpleanos del Chef & Apertura del Restaurante",
    titleEn: "Chef's Birthday & Restaurant Opening",
    descriptionEs:
      "El evento mas importante de Los Tios. Celebramos el cumpleanos del chef y la apertura oficial del restaurante con bebida de bienvenida, musica, pizzas y cerveza.",
    descriptionEn:
      "The biggest night in Los Tios history. We celebrated the chef's birthday and the official restaurant opening with welcome drinks, music, pizza and cold beers.",
    location: "Av. Oaxaca 305, Centro, 71980 Puerto Escondido, Oax. (PLAZA MONTE ALBAN)",
    buttonsEs: [
      { emoji: "🥂", text: "Welcome drink" },
      { emoji: "🍕", text: "Pizza deals" },
      { emoji: "🍺", text: "Cerveza deals" },
      { emoji: "🎵", text: "Buena musica" },
    ],
    buttonsEn: [
      { emoji: "🥂", text: "Welcome drink" },
      { emoji: "🍕", text: "Pizza deals" },
      { emoji: "🍺", text: "Beer deals" },
      { emoji: "🎵", text: "Great music" },
    ],
  },
];

export function parseCustomerEvents(settings = {}) {
  const raw = settings?.[CUSTOMER_EVENTS_SETTINGS_KEY];
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed.filter((event) => event && !event.deleted) : [];
  } catch {
    return [];
  }
}

export function serializeCustomerEvents(events) {
  return JSON.stringify(Array.isArray(events) ? events : []);
}

export function listLocalCustomerEvents() {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_CUSTOMER_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((event) => event && !event.deleted) : [];
  } catch {
    return [];
  }
}

export function saveLocalCustomerEvents(events) {
  if (!isBrowser) return;
  window.localStorage.setItem(LOCAL_CUSTOMER_EVENTS_STORAGE_KEY, serializeCustomerEvents(events));
}

export function eventEndDate(event) {
  return event?.endDate || event?.startDate || "";
}

export function isCustomerEventPast(event, now = new Date()) {
  const end = eventEndDate(event);
  if (!end) return false;
  const eventDate = new Date(`${end}T23:59:59`);
  return now.getTime() > eventDate.getTime();
}

export function eventDateLabel(event, lang = "es") {
  const start = event?.startDate || "";
  const end = event?.endDate || start;
  if (!start) return "";
  const startDate = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const month = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-MX", { month: "long" }).format(startDate);
  const startDay = startDate.getDate();
  const endDay = endDate.getDate();
  if (start !== end && startDate.getMonth() === endDate.getMonth()) {
    return `${startDay}-${endDay} ${month}`;
  }
  if (start !== end) {
    const endMonth = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-MX", { month: "long" }).format(endDate);
    return `${startDay} ${month} - ${endDay} ${endMonth}`;
  }
  return `${startDay} ${month}`;
}

export function normalizeEventButtons(buttons, fallbackLang = "es") {
  const source = Array.isArray(buttons) ? buttons : [];
  return Array.from({ length: 4 }, (_, index) => {
    const item = source[index] || DEFAULT_EVENT_BUTTONS[index];
    return {
      emoji: item?.emoji || DEFAULT_EVENT_BUTTONS[index].emoji,
      text: item?.text || item?.[fallbackLang] || DEFAULT_EVENT_BUTTONS[index][fallbackLang],
    };
  });
}
