const db = require('../config/db');
const { connectedSockets } = require('./socketManager');
const { broadcastToNearbySenders } = require('./geoFilter');

/**
 * Periodically simulate driver movement for demo purposes.
 * In production this would be removed — real GPS comes from mobile devices via sockets.
 */
const startLocationSimulation = (io) => {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_LOCATION_SIMULATION !== 'true') {
    return;
  }

  const INTERVAL_MS = 3000;

  setInterval(async () => {
    try {
      // Get all active drivers
      const result = await db.query(
        `SELECT dl.driver_id, dl.lat, dl.lng, dl.heading, u.name
         FROM driver_locations dl
         JOIN users u ON dl.driver_id = u.id
         WHERE dl.is_active = true`
      );

      if (result.rows.length === 0) return;

      for (const driver of result.rows) {
        // Simulate small random movement (~0.001 degree ≈ 100m)
        const newLat = driver.lat + (Math.random() - 0.5) * 0.002;
        const newLng = driver.lng + (Math.random() - 0.5) * 0.002;
        const newHeading = Math.random() * 360;
        const speed = Math.floor(Math.random() * 80) + 20; // 20–100 km/h

        await db.query(
          `UPDATE driver_locations
           SET lat = $1, lng = $2, heading = $3, speed = $4, updated_at = NOW()
           WHERE driver_id = $5`,
          [newLat, newLng, newHeading, speed, driver.driver_id]
        );

        broadcastToNearbySenders(io, connectedSockets, 'driver:locationUpdate', {
          driverId: driver.driver_id,
          name: driver.name,
          lat: newLat,
          lng: newLng,
          heading: newHeading,
          speed,
          isActive: true,
        }, newLat, newLng);
      }
    } catch (err) {
      // Silently ignore — DB might not be ready yet
    }
  }, INTERVAL_MS);

  console.log('🚛 Driver location simulation started (every 3s)');
};

module.exports = { startLocationSimulation };
