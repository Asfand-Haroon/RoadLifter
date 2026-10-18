const db = require('../../config/db');
const { randomUUID } = require('crypto');

const getMyTruck = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM trucks WHERE driver_id = $1 ORDER BY is_primary DESC',
      [req.user.id]
    );
    res.json({ trucks: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trucks' });
  }
};

const addTruck = async (req, res) => {
  try {
    const { plate_number, truck_type, truck_model, capacity_tons, year } = req.body;

    if (!plate_number || !truck_type) {
      return res.status(400).json({ error: 'Plate number and truck type are required' });
    }

    // Check if this driver already has a primary truck
    const existing = await db.query(
      'SELECT id FROM trucks WHERE driver_id = $1 AND is_primary = true',
      [req.user.id]
    );
    const isPrimary = existing.rows.length === 0;

    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO trucks (id, driver_id, plate_number, truck_type, truck_model, capacity_tons, year, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, req.user.id, plate_number, truck_type, truck_model || null,
       capacity_tons ? parseFloat(capacity_tons) : null, year || null, isPrimary]
    );

    res.status(201).json({ truck: result.rows[0] });
  } catch (err) {
    console.error('addTruck error:', err);
    res.status(500).json({ error: 'Failed to add truck' });
  }
};

const updateTruck = async (req, res) => {
  try {
    const { plate_number, truck_type, truck_model, capacity_tons, year } = req.body;

    const result = await db.query(
      `UPDATE trucks SET
         plate_number = COALESCE($1, plate_number),
         truck_type = COALESCE($2, truck_type),
         truck_model = COALESCE($3, truck_model),
         capacity_tons = COALESCE($4, capacity_tons),
         year = COALESCE($5, year),
         updated_at = NOW()
       WHERE id = $6 AND driver_id = $7
       RETURNING *`,
      [plate_number, truck_type, truck_model, capacity_tons, year, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Truck not found' });
    }
    res.json({ truck: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update truck' });
  }
};

module.exports = { getMyTruck, addTruck, updateTruck };
