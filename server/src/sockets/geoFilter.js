/**
 * Haversine formula — returns distance in km between two lat/lng points
 */
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Filter a list of items by proximity to a given point
 * @param {Array} items - array of objects with lat/lng fields
 * @param {number} centerLat
 * @param {number} centerLng
 * @param {number} radiusKm
 * @returns {Array} filtered items with distance_km added
 */
const filterByRadius = (items, centerLat, centerLng, radiusKm = 50) => {
  return items
    .map((item) => ({
      ...item,
      distance_km: haversineDistance(centerLat, centerLng, item.lat, item.lng),
    }))
    .filter((item) => item.distance_km <= radiusKm)
    .sort((a, b) => a.distance_km - b.distance_km);
};

const broadcastToNearbyRole = (io, sessions, role, event, payload, lat, lng) => {
  for (const [socketId, session] of sessions) {
    if (session.role !== role || !Number.isFinite(session.lat) || !Number.isFinite(session.lng)) {
      continue;
    }

    const radius = Number.isFinite(session.radius) ? session.radius : 50;
    if (haversineDistance(session.lat, session.lng, lat, lng) <= radius) {
      io.to(socketId).emit(event, payload);
    }
  }
};

const broadcastToNearbySenders = (io, sessions, event, payload, lat, lng) =>
  broadcastToNearbyRole(io, sessions, 'SENDER', event, payload, lat, lng);

const broadcastToNearbyDrivers = (io, sessions, event, payload, lat, lng) =>
  broadcastToNearbyRole(io, sessions, 'DRIVER', event, payload, lat, lng);

module.exports = {
  haversineDistance,
  filterByRadius,
  broadcastToNearbySenders,
  broadcastToNearbyDrivers,
};
