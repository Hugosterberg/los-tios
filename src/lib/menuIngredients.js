/**
 * Build shopping / finance ingredient picklists from menu items.
 * Loyverse (and some imports) store copy in `description` HTML with comma-separated
 * ingredients while `ingredients` may be empty — we parse both.
 * Labels are normalized to consistent English (Title Case) where we can map them.
 */

const MIN_LEN = 2;
const MAX_LEN = 72;
const MAX_WORDS = 12;

/** Broken UTF-8 / copy-paste fragments → lowercase English-ish token before lexicon */
const MALFORMED_EXACT = {
  "calabac n": "zucchini",
  "carne a la bolo esa": "meat bolognese",
  "jalape o": "jalapeño",
  "jam n": "ham",
  "pi a": "pineapple",
  "ralladura de lim n": "lemon zest",
};

/**
 * Spanish / mixed menu phrases → canonical English display (Title Case).
 * Keys must be lowercase.
 */
const EN_CANONICAL = {
  albahaca: "Basil",
  basil: "Basil",
  cebolla: "Onion",
  onion: "Onion",
  onions: "Onion",
  miel: "Honey",
  honey: "Honey",
  nuez: "Walnut",
  walnut: "Walnut",
  walnuts: "Walnut",
  chorizo: "Chorizo",
  ham: "Ham",
  "queso de cabra": "Goat cheese",
  "goat cheese": "Goat cheese",
  "fresh goat cheese": "Fresh goat cheese",
  "queso de cabra fresco": "Fresh goat cheese",
  manchego: "Manchego",
  mozzarella: "Mozzarella",
  mozzarela: "Mozzarella",
  parmesan: "Parmesan",
  parmesano: "Parmesan",
  pepperoni: "Pepperoni",
  pineapple: "Pineapple",
  "pimiento rojo": "Red pepper",
  "red pepper": "Red pepper",
  "salsa de tomate": "Tomato sauce",
  "tomato sauce": "Tomato sauce",
  "crema de queso azul": "Blue cheese cream",
  "blue cheese cream": "Blue cheese cream",
  "carne a la bolonesa": "Meat bolognese",
  "meat bolognese": "Meat bolognese",
  "ralladura de limón": "Lemon zest",
  "lemon zest": "Lemon zest",
  jalapeño: "Jalapeño",
  jalapeno: "Jalapeño",
  zucchini: "Zucchini",
  calabacín: "Zucchini",
  calabacin: "Zucchini",
  piña: "Pineapple",
  jamón: "Ham",
  jamon: "Ham",
  tomate: "Tomato",
  tomato: "Tomato",
  ajo: "Garlic",
  garlic: "Garlic",
  perejil: "Parsley",
  parsley: "Parsley",
  cilantro: "Cilantro",
  limón: "Lemon",
  limon: "Lemon",
  lemon: "Lemon",
  aceite: "Olive oil",
  "olive oil": "Olive oil",
  sal: "Salt",
  salt: "Salt",
  pimienta: "Black pepper",
  "black pepper": "Black pepper",
  harina: "Flour",
  flour: "Flour",
  azúcar: "Sugar",
  azucar: "Sugar",
  sugar: "Sugar",
  leche: "Milk",
  milk: "Milk",
  mantequilla: "Butter",
  butter: "Butter",
  huevo: "Egg",
  eggs: "Egg",
  egg: "Egg",
  huevos: "Egg",
};

export function stripHtmlToPlainText(html) {
  if (html == null || html === "") return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanArtifactSegment(str) {
  let t = String(str || "").trim();
  if (!t) return "";
  t = t.replace(/[)\]]+$/g, "");
  t = t.replace(/^[([{]+/, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function normalizeIngredientChunk(raw) {
  let t = cleanArtifactSegment(raw);
  if (!t) return null;
  const paren = t.indexOf("(");
  if (paren > 0) {
    t = t.slice(0, paren).trim();
  } else {
    t = t.replace(/\([^)]*\)/g, "").trim();
  }
  t = t.replace(/^[\d.,\s]+/, "").replace(/\.{3}\s*$/u, "").trim();
  if (t.length < MIN_LEN || t.length > MAX_LEN) return null;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > MAX_WORDS) return null;
  if (!/[a-zA-Z\u00C0-\u017F]/.test(t)) return null;
  return t;
}

export function extractIngredientStringsFromDescription(description) {
  const text = stripHtmlToPlainText(description);
  if (!text) return [];
  const parts = text.split(/[,;•·\n]+/);
  const out = [];
  for (const part of parts) {
    const n = normalizeIngredientChunk(part);
    if (n) out.push(n);
  }
  return out;
}

function toTitleCaseWords(s) {
  return String(s)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Map a raw ingredient string to a consistent English label for UI + matching.
 */
export function toEnglishIngredientLabel(raw) {
  const cleaned = cleanArtifactSegment(raw);
  if (!cleaned) return "";
  let key = cleaned.toLowerCase().replace(/\s+/g, " ").trim();
  if (MALFORMED_EXACT[key]) {
    key = MALFORMED_EXACT[key].toLowerCase().replace(/\s+/g, " ").trim();
  }
  if (EN_CANONICAL[key]) {
    return EN_CANONICAL[key];
  }
  const compact = key.replace(/\s+/g, " ");
  if (EN_CANONICAL[compact]) {
    return EN_CANONICAL[compact];
  }
  return toTitleCaseWords(cleaned);
}

/** Stable lowercase key for deduping and filter matching */
export function ingredientMatchKey(raw) {
  const label = toEnglishIngredientLabel(raw);
  return label ? label.toLowerCase() : "";
}

const IRREGULAR_PLURAL = {
  onions: "onion",
  tomatoes: "tomato",
  potatoes: "potato",
  eggs: "egg",
  walnuts: "walnut",
  olives: "olive",
  anchovies: "anchovy",
  cherries: "cherry",
  blueberries: "blueberry",
  strawberries: "strawberry",
  peppers: "pepper",
};

/** Lowercase singular token (last word of phrases) for merging Onion / Onions, etc. */
function singularizeLastToken(w) {
  const lower = w.toLowerCase();
  if (IRREGULAR_PLURAL[lower]) return IRREGULAR_PLURAL[lower];
  if (lower.length > 4 && lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.length > 4 && lower.endsWith("oes")) return `${lower.slice(0, -3)}o`;
  if (lower.length > 3 && lower.endsWith("ses") && !lower.endsWith("sses")) return lower.slice(0, -2);
  if (lower.length > 2 && lower.endsWith("s") && !lower.endsWith("ss") && !/(us|is)$/i.test(lower)) {
    return lower.slice(0, -1);
  }
  return lower;
}

/** Normalized key so "Onion" and "Onions" map to the same stem. */
function phraseSingularStemKey(phrase) {
  const words = String(phrase || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const last = singularizeLastToken(words[words.length - 1]);
  return [...words.slice(0, -1), last].join(" ");
}

function lastTokenLooksPlural(label) {
  const parts = String(label).trim().split(/\s+/);
  const last = parts[parts.length - 1] || "";
  const low = last.toLowerCase();
  const sing = singularizeLastToken(last);
  return sing !== low;
}

function betterSingularLabel(a, b) {
  const pa = lastTokenLooksPlural(a);
  const pb = lastTokenLooksPlural(b);
  if (pa !== pb) return pa ? b : a;
  if (a.length !== b.length) return a.length <= b.length ? a : b;
  return a.localeCompare(b, "en") <= 0 ? a : b;
}

/**
 * One label per stem; prefer singular-looking display (e.g. Onion over Onions).
 * @param {string[]} labels
 */
function dedupePreferSingular(labels) {
  /** @type {Map<string, string>} */
  const stemToLabel = new Map();
  for (const label of labels) {
    const stem = phraseSingularStemKey(label);
    if (!stem) continue;
    const prev = stemToLabel.get(stem);
    if (!prev) {
      stemToLabel.set(stem, label);
      continue;
    }
    stemToLabel.set(stem, betterSingularLabel(prev, label));
  }
  return Array.from(stemToLabel.values());
}

/**
 * @param {Array<{ ingredients?: unknown, description?: string, description_en?: string }>} items
 * @returns {string[]} Unique English ingredient labels, sorted for display.
 */
export function collectMenuIngredientOptionsFromItems(items) {
  const byKey = new Map();

  const add = (raw) => {
    if (typeof raw !== "string") return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const n = normalizeIngredientChunk(trimmed);
    if (!n) return;
    const label = toEnglishIngredientLabel(n);
    if (!label) return;
    const key = label.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, label);
    }
  };

  (items || []).forEach((m) => {
    const structured = m?.ingredients;
    if (Array.isArray(structured)) {
      structured.forEach((ing) => add(ing));
    }
    extractIngredientStringsFromDescription(m?.description || "").forEach(add);
    extractIngredientStringsFromDescription(m?.description_en || "").forEach(add);
  });

  const merged = dedupePreferSingular(Array.from(byKey.values()));
  return merged.sort((a, b) => a.localeCompare(b, "en"));
}
