const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_REQUEST_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 500;

const cache = new Map();
let lastRequestAt = 0;
let requestQueue = Promise.resolve();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const lookupAddress = async (address) => {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'RoadLifter/1.0 (shipment pickup address geocoding)',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const error = new Error(`Nominatim returned HTTP ${response.status}`);
    error.code = 'GEOCODER_UNAVAILABLE';
    throw error;
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    const error = new Error('Pickup address could not be located');
    error.code = 'ADDRESS_NOT_FOUND';
    throw error;
  }

  const lat = Number(results[0].lat);
  const lng = Number(results[0].lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lng) || lng < -180 || lng > 180) {
    const error = new Error('Geocoder returned invalid coordinates');
    error.code = 'GEOCODER_UNAVAILABLE';
    throw error;
  }

  return { lat, lng };
};

const geocodePickupAddress = (address) => {
  const normalizedAddress = address.trim().replace(/\s+/g, ' ').toLowerCase();
  const cached = cache.get(normalizedAddress);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.coordinates);
  }
  if (cached) cache.delete(normalizedAddress);

  const request = requestQueue.then(async () => {
    const queuedCache = cache.get(normalizedAddress);
    if (queuedCache && queuedCache.expiresAt > Date.now()) {
      return queuedCache.coordinates;
    }

    const delay = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (delay > 0) await wait(delay);
    lastRequestAt = Date.now();

    const coordinates = await lookupAddress(address.trim());
    if (cache.size >= CACHE_LIMIT) {
      cache.delete(cache.keys().next().value);
    }
    cache.set(normalizedAddress, {
      coordinates,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return coordinates;
  });

  requestQueue = request.then(() => undefined, () => undefined);
  return request;
};

module.exports = { geocodePickupAddress };
