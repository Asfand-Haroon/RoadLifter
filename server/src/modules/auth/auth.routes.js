const express = require('express');
const router = express.Router();
const { googleAuth, completeGoogleProfile, me } = require('./auth.controller');
const { authenticate } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimiter');

router.post('/google', authLimiter, googleAuth);
router.post('/google/complete-profile', authLimiter, completeGoogleProfile);
router.get('/me', authenticate, me);

module.exports = router;
