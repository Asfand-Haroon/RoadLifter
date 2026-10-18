const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../../middleware/auth');
const { getMyTruck, addTruck, updateTruck } = require('./trucks.controller');

router.get('/', authenticate, requireRole('DRIVER'), getMyTruck);
router.post('/', authenticate, requireRole('DRIVER'), addTruck);
router.put('/:id', authenticate, requireRole('DRIVER'), updateTruck);

module.exports = router;
