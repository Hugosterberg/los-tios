/** Google Maps short link → Los Tíos business profile (reviews, hours, photos). */
export const GOOGLE_MAPS_PLACE_URL = "https://maps.app.goo.gl/L2BSM4MaUvnUF6TK9";

/**
 * Place ID for Places Details (aggregate rating + total reviews). Set `VITE_GOOGLE_PLACE_ID` in `.env`.
 * Find it: Google Maps → business → Share → the link may contain `1s0x...` or use a Place ID finder.
 */
export const GOOGLE_PLACE_ID = import.meta.env.VITE_GOOGLE_PLACE_ID ?? "";

/**
 * Browser key (restrict by HTTP referrer). Enable Maps JavaScript API + Places API in Google Cloud.
 */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
