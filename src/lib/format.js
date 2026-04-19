/**
 * Centralized money / number formatters.
 *
 * Every admin-facing money value in this app is MXN (Mexican pesos). Using a single
 * helper prevents pages from accidentally picking USD or a different locale — a bug
 * we had on the Finance and Loyverse pages.
 */

const mxnFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  currencyDisplay: "code",
  maximumFractionDigits: 0,
});

const mxnFormatterDetailed = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  currencyDisplay: "code",
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("es-MX");

/** "MXN 1,234" — default admin money format. Rounds to whole pesos. */
export function formatMxn(value) {
  const n = Number(value || 0);
  return mxnFormatter.format(Number.isFinite(n) ? n : 0);
}

/** "MXN 1,234.56" — use when cents matter (reconciliation, Clip payments). */
export function formatMxnDetailed(value) {
  const n = Number(value || 0);
  return mxnFormatterDetailed.format(Number.isFinite(n) ? n : 0);
}

/** "$1,234" compact form for inline badges/tables. No currency code. */
export function formatMxnCompact(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "$0";
  return `$${integerFormatter.format(Math.round(n))}`;
}

/** Plain integer count with Mexico locale separators. */
export function formatCount(value) {
  const n = Number(value || 0);
  return integerFormatter.format(Number.isFinite(n) ? n : 0);
}

/** Signed delta like "+MXN 50" / "-MXN 50". Sign follows the numeric value, not the magnitude. */
export function formatMxnSigned(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n === 0) return formatMxn(0);
  const sign = n > 0 ? "+" : "-";
  return `${sign}${formatMxn(Math.abs(n))}`;
}
