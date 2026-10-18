const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const { broadcastToNearbySenders } = require('./geoFilter');

// In-memory store of connected socket sessions
// { socketId: { userId, role, lat, lng, name } }
const connectedSockets = new Map();

const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, env.JWT_SECRET);
    const result = await db.query(
      'SELECT id, name, role, verification_status, is_blacklisted FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (result.rows.length === 0) return next(new Error('User not found'));
    if (result.rows[0].is_blacklisted) return next(new Error('Account is unavailable'));

    socket.user = result.rows[0];
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
};

const initSocketManager = (io) => {
  // Auth middleware for all socket connections
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const { id: userId, name, role } = socket.user;
    console.log(`🔌 Socket connected: ${name} (${role}) [${socket.id}]`);

    // Track connection
    connectedSockets.set(socket.id, {
      userId, name, role, lat: null, lng: null, socketId: socket.id,
    });

    // Join role-based rooms
    if (role === 'SENDER') socket.join('senders');
    if (role === 'DRIVER' && socket.user.verification_status === 'VERIFIED') socket.join('drivers');
    socket.join(`user:${userId}`);

    // --- DRIVER EVENTS ---
    if (role === 'DRIVER' && socket.user.verification_status === 'VERIFIED') {
      socket.on('driver:setViewport', (data = {}) => {
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        const radius = Number(data.radius ?? 50);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
            !Number.isFinite(lng) || lng < -180 || lng > 180 ||
            !Number.isFinite(radius) || radius < 1 || radius > 500) return;
        const session = connectedSockets.get(socket.id);
        if (session) {
          session.lat = lat;
          session.lng = lng;
          session.radius = radius;
        }
      });

      // Driver updates their live location
      socket.on('driver:updateLocation', async (data) => {
        try {
            const { lat, lng, heading = 0, speed = 0, isActive = true } = data;
            const latitude = Number(lat);
            const longitude = Number(lng);
            const direction = Number(heading);
            const speedKph = Number(speed);
            if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
              !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
              !Number.isFinite(direction) || direction < 0 || direction >= 360 ||
              !Number.isFinite(speedKph) || speedKph < 0 || speedKph > 300 ||
              typeof isActive !== 'boolean') return;

          // Update in-memory store
          const session = connectedSockets.get(socket.id);
          if (session) {
            session.lat = latitude;
            session.lng = longitude;
            session.heading = direction;
            session.isActive = isActive;
          }

          // Update DB
          await db.query(
            `UPDATE driver_locations
             SET lat = $1, lng = $2, heading = $3, speed = $4, is_active = $5, updated_at = NOW()
             WHERE driver_id = $6`,
            [latitude, longitude, direction, speedKph, isActive, userId]
          );

          broadcastToNearbySenders(io, connectedSockets, 'driver:locationUpdate', {
            driverId: userId,
            name,
            lat: latitude,
            lng: longitude,
            heading: direction,
            speed: speedKph,
            isActive,
          }, latitude, longitude);
        } catch (err) {
          console.error('Socket location update error:', err.message);
        }
      });

      // Driver goes online
      socket.on('driver:online', async () => {
        try {
          await db.query(
            'UPDATE driver_locations SET is_active = true, updated_at = NOW() WHERE driver_id = $1',
            [userId]
          );
          const session = connectedSockets.get(socket.id);
          if (session && Number.isFinite(session.lat) && Number.isFinite(session.lng)) {
            broadcastToNearbySenders(io, connectedSockets, 'driver:statusChange', { driverId: userId, isActive: true }, session.lat, session.lng);
          }
        } catch (err) {
          console.error('Driver online update error:', err.message);
        }
      });

      // Driver goes offline
      socket.on('driver:offline', async () => {
        try {
          await db.query(
            'UPDATE driver_locations SET is_active = false, updated_at = NOW() WHERE driver_id = $1',
            [userId]
          );
          const session = connectedSockets.get(socket.id);
          if (session && Number.isFinite(session.lat) && Number.isFinite(session.lng)) {
            broadcastToNearbySenders(io, connectedSockets, 'driver:statusChange', { driverId: userId, isActive: false }, session.lat, session.lng);
          }
        } catch (err) {
          console.error('Driver offline update error:', err.message);
        }
      });
    }

    // --- SENDER EVENTS ---
    if (role === 'SENDER') {
      // Sender subscribes to their view area
      socket.on('sender:setViewport', (data = {}) => {
        const lat = Number(data.lat);
        const lng = Number(data.lng);
        const radius = Number(data.radius ?? 50);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
            !Number.isFinite(lng) || lng < -180 || lng > 180 ||
            !Number.isFinite(radius) || radius < 1 || radius > 500) return;
        const session = connectedSockets.get(socket.id);
        if (session) {
          session.lat = lat;
          session.lng = lng;
          session.radius = radius;
        }
      });
    }

    // --- DISCONNECT ---
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: ${name} (${role}) [${socket.id}]`);
      const disconnectedSession = connectedSockets.get(socket.id);
      connectedSockets.delete(socket.id);
      const hasAnotherSession = [...connectedSockets.values()].some((session) => session.userId === userId);

      // Mark driver as offline on disconnect
      if (role === 'DRIVER' && socket.user.verification_status === 'VERIFIED' && !hasAnotherSession) {
        try {
          await db.query(
            'UPDATE driver_locations SET is_active = false, updated_at = NOW() WHERE driver_id = $1',
            [userId]
          );
          if (disconnectedSession && Number.isFinite(disconnectedSession.lat) && Number.isFinite(disconnectedSession.lng)) {
            broadcastToNearbySenders(io, connectedSockets, 'driver:statusChange', { driverId: userId, isActive: false }, disconnectedSession.lat, disconnectedSession.lng);
          }
        } catch (err) {
          console.error('Disconnect cleanup error:', err.message);
        }
      }
    });
  });

  console.log('✅ Socket.io manager initialized');
  return { connectedSockets };
};

module.exports = { initSocketManager, connectedSockets };
