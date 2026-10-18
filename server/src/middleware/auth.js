const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (decoded.role === 'ADMIN') {
      if (decoded.id !== 'admin' || decoded.email !== env.ADMIN_EMAIL) {
        return res.status(401).json({ error: 'Invalid admin token' });
      }
      req.user = {
        id: 'admin',
        name: 'RoadLifter Admin',
        email: env.ADMIN_EMAIL,
        role: 'ADMIN',
        is_active: true,
        is_blacklisted: false,
        blacklist_reason: null,
        verification_status: 'VERIFIED',
      };
      return next();
    }

    const result = await db.query(
      'SELECT id, name, email, role, is_active, is_blacklisted, blacklist_reason, verification_status FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    if (user.is_blacklisted) {
      return res.status(403).json({
        error: 'You are barred from using the service',
        is_blacklisted: true,
        blacklist_reason: user.blacklist_reason || 'You are barred from using the service',
      });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'User account has been deactivated' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}` });
    }
    next();
  };
};

const requireVerifiedDriver = (req, res, next) => {
  if (req.user?.verification_status !== 'VERIFIED') {
    return res.status(403).json({
      error: 'Driver verification is required before using this feature',
      verification_status: req.user?.verification_status || 'PENDING',
    });
  }
  next();
};

module.exports = { authenticate, requireRole, requireVerifiedDriver };
