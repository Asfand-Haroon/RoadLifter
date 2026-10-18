const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireVerifiedDriver } = require('../../middleware/auth');
const { getNearby, updateLocation, getMyLocation, setStatus, completeProfile } = require('./driver.controller');

const injectIo = (req, res, next) => {
  req.io = req.app.get('io');
  next();
};

// Get nearby drivers (senders only)
router.get('/nearby', authenticate, requireRole('SENDER'), getNearby);

// Driver's own location
router.get('/location', authenticate, requireRole('DRIVER'), getMyLocation);

// Update driver location (driver only)
router.put('/location', authenticate, requireRole('DRIVER'), requireVerifiedDriver, injectIo, updateLocation);

// Toggle online status
router.patch('/status', authenticate, requireRole('DRIVER'), requireVerifiedDriver, injectIo, setStatus);

// Complete driver profile verification
router.post('/complete-profile', authenticate, requireRole('DRIVER'), completeProfile);

module.exports = router;
