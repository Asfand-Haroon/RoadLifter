const db = require('../../config/db');
const { randomUUID } = require('crypto');
const { broadcastToNearbyDrivers } = require('../../sockets/geoFilter');
const { connectedSockets } = require('../../sockets/socketManager');
const { geocodePickupAddress } = require('../../lib/geocodePickupAddress');

// Get shipments near a driver's location
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

    // Haversine formula in SQL to find nearby open shipments
    const result = await db.query(
      `SELECT 
         c.*,
         u.name AS sender_name,
         u.rating_avg AS sender_rating_avg,
         u.rating_count AS sender_rating_count,
         u.is_blacklisted AS sender_is_blacklisted,
         (
           6371 * acos(
             cos(radians($1)) * cos(radians(c.pickup_lat)) *
             cos(radians(c.pickup_lng) - radians($2)) +
             sin(radians($1)) * sin(radians(c.pickup_lat))
           )
         ) AS distance_km
       FROM cargo c
       JOIN users u ON c.sender_id = u.id
       WHERE c.status = 'OPEN'
         AND (u.is_blacklisted = false OR u.is_blacklisted IS NULL)
         AND (
           6371 * acos(
             cos(radians($1)) * cos(radians(c.pickup_lat)) *
             cos(radians(c.pickup_lng) - radians($2)) +
             sin(radians($1)) * sin(radians(c.pickup_lat))
           )
         ) <= $3
       ORDER BY distance_km ASC
       LIMIT 50`,
      [latF, lngF, radiusKm]
    );

    res.json({ shipments: result.rows });
  } catch (err) {
    console.error('getNearby error:', err);
    res.status(500).json({ error: 'Failed to fetch nearby shipments' });
  }
};

// Get all shipments for a sender
const getMySender = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*,
              u.email AS driver_email,
              u.name AS driver_name,
              u.phone AS driver_phone,
              u.rating_avg AS driver_rating_avg,
              u.rating_count AS driver_rating_count,
              u.is_blacklisted AS driver_is_blacklisted,
              r.id AS my_rating_id,
              r.rating AS my_rating,
              r.comment AS my_rating_comment
       FROM cargo c
       LEFT JOIN users u ON c.driver_id = u.id
       LEFT JOIN ratings r ON r.cargo_id = c.id AND r.rater_id = $1
       WHERE c.sender_id = $1 AND c.status <> 'CANCELLED'
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ shipments: result.rows });
  } catch (err) {
    console.error('getMySender error:', err);
    res.status(500).json({ error: 'Failed to fetch shipments' });
  }
};

// Get accepted shipments for a driver
const getMyDriver = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*,
              u.email AS sender_email,
              u.name AS sender_name,
              u.phone AS sender_phone,
              u.rating_avg AS sender_rating_avg,
              u.rating_count AS sender_rating_count,
              u.is_blacklisted AS sender_is_blacklisted,
              r.id AS my_rating_id,
              r.rating AS my_rating,
              r.comment AS my_rating_comment
       FROM cargo c
       LEFT JOIN users u ON c.sender_id = u.id
       LEFT JOIN ratings r ON r.cargo_id = c.id AND r.rater_id = $1
       WHERE c.driver_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ shipments: result.rows });
  } catch (err) {
    console.error('getMyDriver error:', err);
    res.status(500).json({ error: 'Failed to fetch shipments' });
  }
};

// Get single shipment
const getById = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.name AS sender_name, u.email AS sender_email, u.phone AS sender_phone
       FROM cargo c
       JOIN users u ON c.sender_id = u.id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    const shipment = result.rows[0];
    if (shipment.sender_id !== req.user.id && shipment.driver_id !== req.user.id) {
      if (shipment.status !== 'OPEN' || req.user.role !== 'DRIVER') {
        return res.status(403).json({ error: 'You are not authorized to view this shipment' });
      }
      shipment.sender_phone = null;
      shipment.sender_email = null;
    }
    res.json({ shipment });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch shipment' });
  }
};

// Create shipment (sender only)
const create = async (req, res) => {
  try {
    if (req.user.is_blacklisted) {
      return res.status(403).json({
        error: 'You are barred from using the service',
        is_blacklisted: true,
        blacklist_reason: req.user.blacklist_reason || 'You are barred from using the service',
      });
    }

    const {
      title, description, cargo_type,
      pickup_address,
      delivery_address, delivery_lat, delivery_lng,
      weight_kg, budget
    } = req.body;

    if (typeof title !== 'string' || !title.trim() || title.length > 200 ||
        typeof pickup_address !== 'string' || !pickup_address.trim() || pickup_address.length > 1000 ||
        typeof delivery_address !== 'string' || !delivery_address.trim() || delivery_address.length > 1000) {
      return res.status(400).json({ error: 'Title, pickup and delivery details are required' });
    }

    const hasDeliveryLat = delivery_lat !== undefined && delivery_lat !== null && delivery_lat !== '';
    const hasDeliveryLng = delivery_lng !== undefined && delivery_lng !== null && delivery_lng !== '';
    const deliveryLat = hasDeliveryLat ? Number(delivery_lat) : null;
    const deliveryLng = hasDeliveryLng ? Number(delivery_lng) : null;
    if (hasDeliveryLat !== hasDeliveryLng ||
        (hasDeliveryLat && (!Number.isFinite(deliveryLat) || deliveryLat < -90 || deliveryLat > 90 ||
          !Number.isFinite(deliveryLng) || deliveryLng < -180 || deliveryLng > 180))) {
      return res.status(400).json({ error: 'Delivery coordinates are invalid' });
    }

    const weightKg = weight_kg === undefined || weight_kg === null || weight_kg === '' ? null : Number(weight_kg);
    const budgetAmount = budget === undefined || budget === null || budget === '' ? null : Number(budget);
    if ((weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0)) ||
        (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount <= 0))) {
      return res.status(400).json({ error: 'Weight and budget must be positive numbers' });
    }
    if (description !== undefined && description !== null &&
        (typeof description !== 'string' || description.length > 5000)) {
      return res.status(400).json({ error: 'Description must be 5000 characters or fewer' });
    }

    let pickupLat;
    let pickupLng;
    try {
      ({ lat: pickupLat, lng: pickupLng } = await geocodePickupAddress(pickup_address));
    } catch (err) {
      if (err.code === 'ADDRESS_NOT_FOUND') {
        return res.status(422).json({
          error: 'Could not find that pickup address. Include the street, city, and region, then try again.',
        });
      }
      console.error('Pickup address geocoding unavailable:', err);
      return res.status(503).json({ error: 'Pickup address lookup is temporarily unavailable. Please try again.' });
    }

    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO cargo (
         id, sender_id, title, description, cargo_type,
         pickup_address, pickup_lat, pickup_lng,
         delivery_address, delivery_lat, delivery_lng,
         weight_kg, budget, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'OPEN')
       RETURNING *`,
      [
        id, req.user.id, title.trim(), description?.trim() || null, cargo_type || 'GENERAL',
        pickup_address.trim(), pickupLat, pickupLng,
        delivery_address.trim(), deliveryLat, deliveryLng,
        weightKg, budgetAmount
      ]
    );

    const shipment = result.rows[0];

    // Broadcast only to drivers currently searching near the pickup location.
    if (req.io) {
      broadcastToNearbyDrivers(
        req.io,
        connectedSockets,
        'shipment:new',
        shipment,
        pickupLat,
        pickupLng
      );
    }

    res.status(201).json({ shipment });
  } catch (err) {
    console.error('Create cargo error:', err);
    res.status(500).json({ error: 'Failed to create shipment' });
  }
};

// Cancel/remove a shipment posted by the sender
const cancel = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE cargo
       SET status = 'CANCELLED',
           driver_id = CASE
             WHEN status = 'OPEN' THEN NULL
             ELSE driver_id
           END,
           updated_at = NOW()
       WHERE id = $1 AND sender_id = $2 AND status IN ('OPEN', 'ACCEPTED')
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      const owned = await db.query(
        'SELECT id, status FROM cargo WHERE id = $1 AND sender_id = $2',
        [id, req.user.id]
      );

      if (owned.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      if (owned.rows[0].status === 'DELIVERED' || owned.rows[0].status === 'IN_TRANSIT') {
        return res.status(409).json({ error: 'Completed shipments cannot be cancelled' });
      }

      return res.status(409).json({ error: 'This shipment cannot be cancelled' });
    }

    const shipment = result.rows[0];

    if (req.io) {
      req.io.to('drivers').emit('shipment:cancelled', { shipmentId: id, senderId: req.user.id });
      if (shipment.driver_id) {
        req.io.to(`user:${shipment.driver_id}`).emit('shipment:cancelled', {
          shipmentId: id,
          senderId: req.user.id,
          message: 'The sender cancelled this load',
        });
      }
    }

    res.json({ shipment, message: 'Shipment removed successfully' });
  } catch (err) {
    console.error('Cancel cargo error:', err);
    res.status(500).json({ error: 'Failed to remove shipment' });
  }
};

// Driver accepts a shipment
const accept = async (req, res) => {
  try {
    if (req.user.is_blacklisted) {
      return res.status(403).json({
        error: 'You are barred from using the service',
        is_blacklisted: true,
        blacklist_reason: req.user.blacklist_reason || 'You are barred from using the service',
      });
    }

    const { id } = req.params;

    const checkResult = await db.query(
      'SELECT * FROM cargo WHERE id = $1 AND status = $2',
      [id, 'OPEN']
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found or already taken' });
    }

    const result = await db.query(
      `UPDATE cargo SET status = 'ACCEPTED', driver_id = $1, accepted_at = NOW()
       WHERE id = $2 AND status = 'OPEN'
       RETURNING *`,
      [req.user.id, id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Shipment was already accepted by another driver' });
    }

    const shipment = result.rows[0];

    // Notify drivers (remove from their lists) + the specific sender who owns the load
    if (req.io) {
      req.io.to('drivers').emit('shipment:accepted', { shipmentId: id, driverId: req.user.id });
      // Also notify the sender who posted this shipment
      const senderId = shipment.sender_id;
      if (senderId) {
        req.io.to(`user:${senderId}`).emit('shipment:accepted', {
          shipmentId: id,
          driverId: req.user.id,
          driverName: req.user.name,
        });
      }
    }

    res.json({ shipment, message: 'Shipment accepted successfully!' });
  } catch (err) {
    console.error('Accept shipment error:', err);
    res.status(500).json({ error: 'Failed to accept shipment' });
  }
};

// Update shipment status
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, pod_image } = req.body;

    const validStatuses = ['IN_TRANSIT', 'DELIVERED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      `UPDATE cargo SET status = $1, pod_image = COALESCE($2, pod_image), updated_at = NOW()
       WHERE id = $3 AND driver_id = $4
         AND ((status = 'ACCEPTED' AND $1 = 'IN_TRANSIT')
           OR (status = 'IN_TRANSIT' AND $1 = 'DELIVERED'))
       RETURNING *`,
      [status, pod_image || null, id, req.user.id]
    );

    if (result.rows.length === 0) {
      const assigned = await db.query(
        'SELECT id FROM cargo WHERE id = $1 AND driver_id = $2',
        [id, req.user.id]
      );
      if (assigned.rows.length === 0) {
        return res.status(404).json({ error: 'Shipment not found or not assigned to you' });
      }
      return res.status(409).json({ error: 'Shipment status does not allow this transition' });
    }

    if (req.io) {
      // Notify the specific sender who owns the shipment + the driver
      const cargo = result.rows[0];
      const senderId = cargo.sender_id;
      req.io.to(`user:${senderId}`).emit('shipment:statusUpdate', { shipmentId: id, status, pod_image: cargo.pod_image });
      req.io.to(`user:${req.user.id}`).emit('shipment:statusUpdate', { shipmentId: id, status, pod_image: cargo.pod_image });
    }

    res.json({ shipment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
};

module.exports = { getNearby, getMySender, getMyDriver, getById, create, cancel, accept, updateStatus };
