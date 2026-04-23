// @ts-nocheck
/**
 * Loads Google Maps JS (Places) and reads aggregate rating + total review count for a Place ID.
 * Uses the official Maps JavaScript API so the browser is not blocked by CORS (unlike the Places REST endpoint).
 *
 * Requires: Maps JavaScript API + Places API enabled; API key restricted by HTTP referrer in Google Cloud.
 */

const CACHE_PREFIX = "lostios-google-place-stats";
const TTL_MS = 60 * 60 * 1000;

let loadPromise;

function loadGoogleMapsPlacesScript(apiKey) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.places) return Promise.resolve();

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.dataset.lostiosGoogleMaps = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });

  return loadPromise;
}

/**
 * @param {string} apiKey
 * @param {string} placeId
 * @returns {Promise<{ rating: number | null; userRatingsTotal: number | null } | null>}
 */
export async function fetchGooglePlaceReviewStats(apiKey, placeId) {
  if (!apiKey || !placeId || typeof window === "undefined") return null;

  const cacheKey = `${CACHE_PREFIX}:${placeId}`;
  try {
    const raw = sessionStorage.getItem(cacheKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.ts && Date.now() - parsed.ts < TTL_MS && parsed.data) {
        return parsed.data;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    await loadGoogleMapsPlacesScript(apiKey);
  } catch {
    return null;
  }

  const places = window.google?.maps?.places;
  if (!places?.PlacesService) return null;

  return new Promise((resolve) => {
    const service = new places.PlacesService(document.createElement("div"));
    service.getDetails({ placeId, fields: ["rating", "user_ratings_total"] }, (place, status) => {
      if (status !== places.PlacesServiceStatus.OK || !place) {
        resolve(null);
        return;
      }

      const data = {
        rating: typeof place.rating === "number" ? place.rating : null,
        userRatingsTotal: typeof place.user_ratings_total === "number" ? place.user_ratings_total : null,
      };

      try {
        sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data }));
      } catch {
        /* ignore */
      }

      resolve(data);
    });
  });
}
