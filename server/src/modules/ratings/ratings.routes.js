const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');
const {
  createRating,
  getUserRatings,
  getCargoRatingStatus,
} = require('./ratings.controller');

// Inject socket.io into req
const injectIo = (req, res, next) => {
  req.io = req.app.get('io');
  next();
};

// Submit a star rating & review for a shipment
router.post('/', authenticate, injectIo, createRating);

// Get rating statistics and reviews for a user
router.get('/user/:userId', authenticate, getUserRatings);

// Check rating status for a specific shipment
router.get('/cargo/:cargoId', authenticate, getCargoRatingStatus);

module.exports = router;
