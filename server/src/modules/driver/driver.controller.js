const db = require('../../config/db');
const { connectedSockets } = require('../../sockets/socketManager');
const { broadcastToNearbySenders } = require('../../sockets/geoFilter');

// Get drivers near a location (for senders)
const getNearby = async (req, res) => {
  try {
    const { lat, lng, radius = 50 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const latF = Number(lat);
    const lngF = Number(lng);
    const radiusKm = Number(radius);
    if (!Number.isFinite(latF) || latF < -90 || latF > 90 ||
        !Number.isFinite(lngF) || lngF < -180 || lngF > 180 ||
        !Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 500) {
      return res.status(400).json({ error: 'Coordinates or radius are out of range' });
    }

    const result = await db.query(
      `SELECT 
         dl.lat, dl.lng, dl.heading, dl.speed, dl.updated_at,
         u.id, u.name, u.rating_avg, u.rating_count,
         t.truck_type, t.capacity_tons, t.truck_model,
         (
           6371 * acos(
             cos(radians($1)) * cos(radians(dl.lat)) *
             cos(radians(dl.lng) - radians($2)) +
             sin(radians($1)) * sin(radians(dl.lat))
           )
         ) AS distance_km
       FROM driver_locations dl
       JOIN users u ON dl.driver_id = u.id
       LEFT JOIN trucks t ON t.driver_id = u.id AND t.is_primary = true
       WHERE dl.is_active = true
         AND u.is_active = true
         AND u.verification_status = 'VERIFIED'
         AND (u.is_blacklisted = false OR u.is_blacklisted IS NULL)
         AND (
           6371 * acos(
             cos(radians($1)) * cos(radians(dl.lat)) *
             cos(radians(dl.lng) - radians($2)) +
             sin(radians($1)) * sin(radians(dl.lat))
           )
         ) <= $3
       ORDER BY distance_km ASC
       LIMIT 50`,
      [latF, lngF, radiusKm]
    );

    res.json({ drivers: result.rows });
  } catch (err) {
    console.error('getNearby drivers error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby drivers' });
  }
};

const updateLocation = async (req, res) => {
  try {
    if (req.user.is_blacklisted) {
      return res.status(403).json({
        error: 'You are barred from using the service',
        is_blacklisted: true,
        blacklist_reason: req.user.blacklist_reason || 'You are barred from using the service',
      });
    }

    const { lat, lng, heading = 0, speed = 0, is_active } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    const direction = Number(heading);
    const speedKph = Number(speed);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
        !Number.isFinite(direction) || direction < 0 || direction >= 360 ||
        !Number.isFinite(speedKph) || speedKph < 0 || speedKph > 300 ||
        (is_active !== undefined && typeof is_active !== 'boolean')) {
      return res.status(400).json({ error: 'Location data is invalid' });
    }

    const result = await db.query(
      `UPDATE driver_locations
       SET lat = $1, lng = $2, heading = $3, speed = $4,
           is_active = COALESCE($5, is_active), updated_at = NOW()
       WHERE driver_id = $6
       RETURNING *`,
      [
        latitude, longitude, direction, speedKph,
        is_active,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver location record not found' });
    }

    // Broadcast location update to senders only (not other drivers)
    if (req.io) {
      broadcastToNearbySenders(req.io, connectedSockets, 'driver:locationUpdate', {
        driverId: req.user.id,
        name: req.user.name,
        lat: latitude,
        lng: longitude,
        heading: direction,
        isActive: result.rows[0].is_active,
      }, latitude, longitude);
    }

    res.json({ location: result.rows[0] });
  } catch (err) {
    console.error('updateLocation error:', err);
    res.status(500).json({ error: 'Failed to update location' });
  }
};

// Get driver's current location
const getMyLocation = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM driver_locations WHERE driver_id = $1',
      [req.user.id]
    );
    res.json({ location: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch location' });
  }
};

// Set driver online/offline
const setStatus = async (req, res) => {
  try {
    if (req.user.is_blacklisted) {
      return res.status(403).json({
        error: 'You are barred from using the service',
        is_blacklisted: true,
        blacklist_reason: req.user.blacklist_reason || 'You are barred from using the service',
      });
    }

    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be a boolean' });
    }

    const result = await db.query(
      'UPDATE driver_locations SET is_active = $1, updated_at = NOW() WHERE driver_id = $2 RETURNING driver_id',
      [is_active, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver location record not found' });
    }

    if (req.io) {
      const session = [...connectedSockets.values()].find((item) => item.userId === req.user.id);
      if (session && Number.isFinite(session.lat) && Number.isFinite(session.lng)) {
        broadcastToNearbySenders(req.io, connectedSockets, 'driver:statusChange', {
        driverId: req.user.id,
        isActive: is_active,
        }, session.lat, session.lng);
      }
    }

    res.json({ message: `Driver is now ${is_active ? 'online' : 'offline'}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// Complete driver profile verification
const completeProfile = async (req, res) => {
  try {
    const {
      legal_name,
      cnic_number,
      vehicle_number,
      license_number,
      license_expiry,
    } = req.body;

    // Validation
    if (!legal_name || !legal_name.trim()) {
      return res.status(400).json({ error: 'Legal name is required' });
    }
    if (!cnic_number || !cnic_number.trim()) {
      return res.status(400).json({ error: 'CNIC number is required' });
    }
    if (!vehicle_number || !vehicle_number.trim()) {
      return res.status(400).json({ error: 'Vehicle number is required' });
    }
    if (!license_number || !license_number.trim()) {
      return res.status(400).json({ error: 'License number is required' });
    }
    if (typeof license_expiry !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(license_expiry)) {
      return res.status(400).json({ error: 'License expiry date is required' });
    }

    const requiredFields = [legal_name, cnic_number, vehicle_number, license_number];
    const fieldLimits = [150, 20, 20, 50];
    if (requiredFields.some((value, index) => typeof value !== 'string' ||
        !value.trim() || value.length > fieldLimits[index])) {
      return res.status(400).json({ error: 'Verification fields are invalid or too long' });
    }

    const expiryDate = new Date(`${license_expiry}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (!Number.isFinite(expiryDate.getTime()) || expiryDate < today) {
      return res.status(400).json({ error: 'License has expired' });
    }

    // Update user with verification information
    const result = await db.query(
      `UPDATE users
       SET legal_name = $1,
           cnic_number = $2,
           vehicle_number = $3,
           license_number = $4,
           license_expiry = $5,
           profile_completed = true,
           verification_status = 'PENDING',
           updated_at = NOW()
       WHERE id = $6
      RETURNING id, name, email, role, phone, vehicle_number,
          profile_completed, verification_status,
                rating_avg, rating_count, is_blacklisted, blacklist_reason`,
      [
        legal_name.trim(),
        cnic_number.trim(),
        vehicle_number.trim(),
        license_number.trim(),
        license_expiry,
        req.user.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = result.rows[0];

    res.json({
      message: 'Profile completed successfully',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        vehicle_number: updatedUser.vehicle_number,
        profile_completed: updatedUser.profile_completed,
        verification_status: updatedUser.verification_status,
        rating_avg: updatedUser.rating_avg ? parseFloat(updatedUser.rating_avg) : 5.0,
        rating_count: updatedUser.rating_count || 0,
        is_blacklisted: updatedUser.is_blacklisted || false,
        blacklist_reason: updatedUser.blacklist_reason || null,
      },
    });
  } catch (err) {
    console.error('completeProfile error:', err);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
};

module.exports = { getNearby, updateLocation, getMyLocation, setStatus, completeProfile };
