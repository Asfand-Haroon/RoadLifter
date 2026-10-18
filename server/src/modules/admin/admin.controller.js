const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const env = require('../../config/env');

const loginAdmin = async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Admin email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail !== env.ADMIN_EMAIL.toLowerCase() || password !== env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  const token = jwt.sign(
    { id: 'admin', email: env.ADMIN_EMAIL, role: 'ADMIN' },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );

  res.json({
    message: 'Admin login successful',
    token,
    user: {
      id: 'admin',
      name: 'RoadLifter Admin',
      email: env.ADMIN_EMAIL,
      role: 'ADMIN',
      verification_status: 'VERIFIED',
      email_verified: true,
    },
  });
};

const getPendingDrivers = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, phone, legal_name, cnic_number, vehicle_number,
              license_number, license_expiry, created_at
       FROM users
       WHERE role = 'DRIVER'
         AND profile_completed = true
         AND verification_status IN ('PENDING', 'REJECTED')
       ORDER BY created_at ASC
       LIMIT 100`
    );
    res.json({ drivers: result.rows });
  } catch (err) {
    console.error('getPendingDrivers error:', err);
    res.status(500).json({ error: 'Failed to fetch pending driver reviews' });
  }
};

const getDashboardSummary = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'SENDER') AS shippers_total,
         (SELECT COUNT(*) FROM users WHERE role = 'DRIVER') AS drivers_total,
         (SELECT COUNT(*) FROM users WHERE role = 'DRIVER' AND verification_status = 'VERIFIED') AS drivers_verified,
         (SELECT COUNT(*) FROM users WHERE role = 'DRIVER' AND profile_completed = true AND verification_status = 'PENDING') AS drivers_pending,
         (SELECT COUNT(*) FROM users WHERE is_active = true AND role IN ('DRIVER', 'SENDER')) AS users_active,
         (SELECT COUNT(*) FROM users WHERE is_blacklisted = true) AS users_blacklisted,
         (SELECT COUNT(*) FROM driver_locations WHERE is_active = true) AS drivers_online,
         (SELECT COUNT(*) FROM trucks) AS trucks_total,
         (SELECT COUNT(*) FROM cargo) AS shipments_total,
         (SELECT COUNT(*) FROM cargo WHERE status = 'OPEN') AS shipments_open,
         (SELECT COUNT(*) FROM cargo WHERE status = 'ACCEPTED') AS shipments_accepted,
         (SELECT COUNT(*) FROM cargo WHERE status = 'IN_TRANSIT') AS shipments_in_transit,
         (SELECT COUNT(*) FROM cargo WHERE status = 'DELIVERED') AS shipments_delivered,
         (SELECT COUNT(*) FROM cargo WHERE status = 'CANCELLED') AS shipments_cancelled,
         (SELECT COUNT(*) FROM ratings) AS ratings_total,
         (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) FROM ratings) AS rating_average`
    );

    res.json({ summary: result.rows[0] });
  } catch (err) {
    console.error('getDashboardSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch operator dashboard summary' });
  }
};

const getDashboardUsers = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 25;
    const role = ['DRIVER', 'SENDER'].includes(req.query.role) ? req.query.role : 'ALL';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'page must be positive and limit must be between 1 and 100' });
    }
    const offset = (page - 1) * limit;

    const [countResult, usersResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS total
         FROM users
         WHERE role IN ('DRIVER', 'SENDER')
           AND ($1 = 'ALL' OR role = $1)
           AND ($2 = '' OR name ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%' OR phone ILIKE '%' || $2 || '%')`,
        [role, search]
      ),
      db.query(
        `SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url,
                u.is_active, u.rating_avg, u.rating_count, u.consecutive_low_ratings,
                u.is_blacklisted, u.blacklist_reason, u.blacklisted_at,
                u.created_at, u.updated_at, u.email_verified, u.email_verified_at,
                u.legal_name, u.cnic_number, u.vehicle_number, u.license_number,
                u.license_expiry, u.profile_completed, u.verification_status, u.verified_at,
                CASE WHEN dl.driver_id IS NULL THEN NULL ELSE
                  json_build_object(
                    'lat', dl.lat, 'lng', dl.lng, 'heading', dl.heading,
                    'speed', dl.speed, 'is_active', dl.is_active, 'updated_at', dl.updated_at
                  )
                END AS location,
                COALESCE((
                  SELECT json_agg(json_build_object(
                    'id', t.id, 'plate_number', t.plate_number, 'truck_type', t.truck_type,
                    'truck_model', t.truck_model, 'capacity_tons', t.capacity_tons,
                    'year', t.year, 'is_primary', t.is_primary,
                    'created_at', t.created_at, 'updated_at', t.updated_at
                  ) ORDER BY t.is_primary DESC, t.created_at DESC)
                  FROM trucks t WHERE t.driver_id = u.id
                ), '[]'::json) AS trucks
         FROM users u
         LEFT JOIN driver_locations dl ON dl.driver_id = u.id
         WHERE u.role IN ('DRIVER', 'SENDER')
           AND ($1 = 'ALL' OR u.role = $1)
           AND ($2 = '' OR u.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%' OR u.phone ILIKE '%' || $2 || '%')
         ORDER BY u.created_at DESC
         LIMIT $3 OFFSET $4`,
        [role, search, limit, offset]
      ),
    ]);

    res.json({
      users: usersResult.rows,
      pagination: { page, limit, total: Number(countResult.rows[0].total) },
    });
  } catch (err) {
    console.error('getDashboardUsers error:', err);
    res.status(500).json({ error: 'Failed to fetch operator user directory' });
  }
};

const getDashboardShipments = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 25;
    const status = typeof req.query.status === 'string' &&
      ['OPEN', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'].includes(req.query.status)
      ? req.query.status : 'ALL';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({ error: 'page must be positive and limit must be between 1 and 100' });
    }
    const offset = (page - 1) * limit;

    const [countResult, shipmentsResult] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS total
         FROM cargo c
         WHERE ($1 = 'ALL' OR c.status = $1)
           AND ($2 = '' OR c.title ILIKE '%' || $2 || '%' OR c.pickup_address ILIKE '%' || $2 || '%'
             OR c.delivery_address ILIKE '%' || $2 || '%' OR EXISTS (
               SELECT 1 FROM users su
               WHERE su.id = c.sender_id AND (su.name ILIKE '%' || $2 || '%' OR su.email ILIKE '%' || $2 || '%')
             ) OR EXISTS (
               SELECT 1 FROM users du
               WHERE du.id = c.driver_id AND (du.name ILIKE '%' || $2 || '%' OR du.email ILIKE '%' || $2 || '%')
             ))`,
        [status, search]
      ),
      db.query(
        `SELECT c.id, c.sender_id, c.driver_id, c.title, c.description, c.cargo_type,
                c.pickup_address, c.pickup_lat, c.pickup_lng,
                c.delivery_address, c.delivery_lat, c.delivery_lng,
                c.weight_kg, c.budget, c.status, c.accepted_at,
                (c.pod_image IS NOT NULL) AS has_pod_image, c.created_at, c.updated_at,
                sender.name AS sender_name, sender.email AS sender_email, sender.phone AS sender_phone,
                driver.name AS driver_name, driver.email AS driver_email, driver.phone AS driver_phone,
                COALESCE((
                  SELECT json_agg(json_build_object(
                    'id', r.id, 'rater_id', r.rater_id, 'ratee_id', r.ratee_id,
                    'rating', r.rating, 'on_time', r.on_time, 'items_intact', r.items_intact,
                    'paid_agreed', r.paid_agreed, 'accurate_description', r.accurate_description,
                    'comment', r.comment, 'created_at', r.created_at
                  ) ORDER BY r.created_at DESC)
                  FROM ratings r WHERE r.cargo_id = c.id
                ), '[]'::json) AS ratings
         FROM cargo c
         JOIN users sender ON sender.id = c.sender_id
         LEFT JOIN users driver ON driver.id = c.driver_id
         WHERE ($1 = 'ALL' OR c.status = $1)
           AND ($2 = '' OR c.title ILIKE '%' || $2 || '%' OR c.pickup_address ILIKE '%' || $2 || '%'
             OR c.delivery_address ILIKE '%' || $2 || '%' OR sender.name ILIKE '%' || $2 || '%'
             OR sender.email ILIKE '%' || $2 || '%' OR driver.name ILIKE '%' || $2 || '%'
             OR driver.email ILIKE '%' || $2 || '%')
         ORDER BY c.created_at DESC
         LIMIT $3 OFFSET $4`,
        [status, search, limit, offset]
      ),
    ]);

    res.json({
      shipments: shipmentsResult.rows,
      pagination: { page, limit, total: Number(countResult.rows[0].total) },
    });
  } catch (err) {
    console.error('getDashboardShipments error:', err);
    res.status(500).json({ error: 'Failed to fetch operator shipment directory' });
  }
};

const reviewDriver = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['VERIFIED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'status must be VERIFIED or REJECTED' });
    }

    const result = await db.query(
      `UPDATE users
       SET verification_status = $1,
           verified_at = CASE WHEN $1::varchar = 'VERIFIED' THEN NOW() ELSE NULL END,
           updated_at = NOW()
       WHERE id = $2 AND role = 'DRIVER' AND profile_completed = true
       RETURNING id, verification_status, verified_at`,
      [status, req.params.driverId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver application not found' });
    }

    if (status === 'REJECTED') {
      await db.query(
        'UPDATE driver_locations SET is_active = false, updated_at = NOW() WHERE driver_id = $1',
        [req.params.driverId]
      );
    }

    res.json({ driver: result.rows[0] });
  } catch (err) {
    console.error('reviewDriver error:', err);
    res.status(500).json({ error: 'Failed to review driver application' });
  }
};

module.exports = {
  loginAdmin,
  getPendingDrivers,
  getDashboardSummary,
  getDashboardUsers,
  getDashboardShipments,
  reviewDriver,
};
