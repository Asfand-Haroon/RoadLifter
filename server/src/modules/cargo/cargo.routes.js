const express = require('express');
const router = express.Router();
const { authenticate, requireRole, requireVerifiedDriver } = require('../../middleware/auth');
const {
  getNearby, getMySender, getMyDriver,
  getById, create, cancel, accept, updateStatus
} = require('./cargo.controller');

// Inject socket.io into req
const injectIo = (req, res, next) => {
  req.io = req.app.get('io');
  next();
};

// Nearby shipments for drivers
router.get('/nearby', authenticate, requireRole('DRIVER'), requireVerifiedDriver, getNearby);

// Sender's own shipments
router.get('/my/sender', authenticate, requireRole('SENDER'), getMySender);

// Driver's accepted shipments
router.get('/my/driver', authenticate, requireRole('DRIVER'), getMyDriver);

// Get single shipment
router.get('/:id', authenticate, getById);

// Create shipment (sender only)
router.post('/', authenticate, requireRole('SENDER'), injectIo, create);

// Cancel/remove shipment (sender only)
router.delete('/:id', authenticate, requireRole('SENDER'), injectIo, cancel);

// Accept shipment (driver only)
router.post('/:id/accept', authenticate, requireRole('DRIVER'), requireVerifiedDriver, injectIo, accept);

// Update status (driver only)
router.patch('/:id/status', authenticate, requireRole('DRIVER'), requireVerifiedDriver, injectIo, updateStatus);

module.exports = router;
