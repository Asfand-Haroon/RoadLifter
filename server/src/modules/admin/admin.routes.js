const express = require('express');
const { timingSafeEqual } = require('crypto');
const env = require('../../config/env');
const { authenticate } = require('../../middleware/auth');
const {
  getPendingDrivers, getDashboardSummary, getDashboardUsers,
  getDashboardShipments, reviewDriver, loginAdmin,
} = require('./admin.controller');

const router = express.Router();

const requireAdminKey = (req, res, next) => {
  const providedKey = req.get('x-admin-key') || '';
  if (providedKey) {
    const expected = Buffer.from(env.ADMIN_API_KEY);
    const provided = Buffer.from(providedKey);
    if (expected.length >= 32 && provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return authenticate(req, res, () => {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    });
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

router.post('/login', loginAdmin);
router.use(requireAdminKey);
router.get('/dashboard/summary', getDashboardSummary);
router.get('/dashboard/users', getDashboardUsers);
router.get('/dashboard/shipments', getDashboardShipments);
router.get('/drivers/pending', getPendingDrivers);
router.patch('/drivers/:driverId', reviewDriver);

module.exports = router;
