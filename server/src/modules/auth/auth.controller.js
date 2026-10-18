const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');
const db = require('../../config/db');
const env = require('../../config/env');
const { getFirebaseAuth } = require('../../lib/firebaseAdmin');

const invalidGoogleTokenCodes = new Set([
  'auth/argument-error',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/invalid-id-token',
  'auth/tenant-id-mismatch',
]);

const generateToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  env.JWT_SECRET,
  { expiresIn: env.JWT_EXPIRES_IN }
);

const toUserPayload = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  auth_provider: 'google',
  phone: user.phone || null,
  avatar_url: user.avatar_url || null,
  rating_avg: user.rating_avg ? parseFloat(user.rating_avg) : 5.0,
  rating_count: user.rating_count || 0,
  is_blacklisted: Boolean(user.is_blacklisted),
  blacklist_reason: user.blacklist_reason || null,
  profile_completed: Boolean(user.profile_completed),
  verification_status: user.verification_status || 'PENDING',
  email_verified: Boolean(user.email_verified),
});

const verifyGoogleToken = async (idToken) => {
  if (typeof idToken !== 'string' || idToken.length > 8192) {
    const error = new Error('A valid Google sign-in token is required');
    error.status = 400;
    throw error;
  }

  const firebaseAuth = getFirebaseAuth();
  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(idToken);
  } catch (err) {
    if (!err || !invalidGoogleTokenCodes.has(err.code)) throw err;
    const error = new Error('Google sign-in expired or is invalid. Please try again.');
    error.status = 401;
    throw error;
  }

  if (decoded.firebase?.sign_in_provider !== 'google.com' ||
      decoded.email_verified !== true ||
      typeof decoded.email !== 'string' ||
      typeof decoded.name !== 'string' ||
      !decoded.email.trim() ||
      !decoded.name.trim()) {
    const error = new Error('Sign in with a Google account that has a verified email address');
    error.status = 403;
    throw error;
  }

  return {
    uid: decoded.uid,
    email: decoded.email.trim().toLowerCase(),
    name: decoded.name.trim().slice(0, 100),
    avatarUrl: typeof decoded.picture === 'string' ? decoded.picture : null,
  };
};

const rejectUnavailableAccount = (user, res) => {
  if (user.is_blacklisted) {
    res.status(403).json({
      error: 'You are barred from using the service',
      is_blacklisted: true,
      blacklist_reason: user.blacklist_reason || 'You are barred from using the service',
    });
    return true;
  }
  if (!user.is_active) {
    res.status(403).json({ error: 'Account has been deactivated' });
    return true;
  }
  return false;
};

const sendSession = (user, res) => {
  if (rejectUnavailableAccount(user, res)) return;
  res.json({ message: 'Google sign-in successful', token: generateToken(user), user: toUserPayload(user) });
};

const googleAuth = async (req, res) => {
  try {
    const profile = await verifyGoogleToken(req.body?.idToken);
    const result = await db.query(
      `SELECT id, name, email, role, phone, avatar_url,
              rating_avg, rating_count, is_active, is_blacklisted, blacklist_reason,
              profile_completed, verification_status, email_verified
       FROM users WHERE firebase_uid = $1`,
      [profile.uid]
    );

    if (result.rows.length) {
      return sendSession(result.rows[0], res);
    }

    res.json({
      needs_profile: true,
      profile: { name: profile.name, email: profile.email, avatar_url: profile.avatarUrl },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('Google sign-in error:', err);
    res.status(500).json({ error: 'Unable to sign in with Google' });
  }
};

const completeGoogleProfile = async (req, res) => {
  const { role, name, phone } = req.body || {};
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!['DRIVER', 'SENDER'].includes(role) ||
      !normalizedName || normalizedName.length > 100 ||
      (phone !== undefined && phone !== null &&
        (typeof phone !== 'string' || phone.trim().length > 20))) {
    return res.status(400).json({ error: 'Provide a valid name, role, and phone number' });
  }

  let client;
  try {
    const profile = await verifyGoogleToken(req.body?.idToken);
    client = await db.getClient();
    await client.query('BEGIN');

    const existingResult = await client.query(
      `SELECT id, name, email, role, phone, avatar_url,
              rating_avg, rating_count, is_active, is_blacklisted, blacklist_reason,
              profile_completed, verification_status, email_verified
       FROM users WHERE firebase_uid = $1`,
      [profile.uid]
    );

    let user = existingResult.rows[0];
    if (!user) {
      const result = await client.query(
        `INSERT INTO users (
           id, firebase_uid, name, email, role, phone, avatar_url,
           email_verified, email_verified_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
         RETURNING id, name, email, role, phone, avatar_url,
                   rating_avg, rating_count, is_active, is_blacklisted, blacklist_reason,
                   profile_completed, verification_status, email_verified`,
        [
          randomUUID(),
          profile.uid,
          normalizedName,
          profile.email,
          role,
          typeof phone === 'string' && phone.trim() ? phone.trim() : null,
          profile.avatarUrl,
        ]
      );
      user = result.rows[0];

      if (role === 'DRIVER') {
        await client.query(
          `INSERT INTO driver_locations (id, driver_id, lat, lng, is_active)
           VALUES ($1, $2, $3, $4, false)`,
          [randomUUID(), user.id, 40.7128, -74.006]
        );
      }
    }

    await client.query('COMMIT');
    sendSession(user, res);
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === '23505') {
      // Distinguish email uniqueness violation from other unique constraint failures
      if (err.constraint && err.constraint.includes('email')) {
        return res.status(409).json({
          error: 'An account with this email address already exists. Please sign in with your existing account instead.',
        });
      }
      return res.status(409).json({ error: 'This Google account is already registered. Please sign in again.' });
    }
    console.error('Complete Google profile error:', err);
    res.status(500).json({ error: 'Unable to create your RoadLifter account' });
  } finally {
    client?.release();
  }
};

const me = async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      return res.json({
        user: {
          id: 'admin',
          name: 'RoadLifter Admin',
          email: req.user.email,
          role: 'ADMIN',
          phone: null,
          rating_avg: 5.0,
          rating_count: 0,
          is_blacklisted: false,
          blacklist_reason: null,
          profile_completed: true,
          verification_status: 'VERIFIED',
          email_verified: true,
        },
      });
    }

    const result = await db.query(
      `SELECT id, name, email, role, phone, avatar_url,
              rating_avg, rating_count, consecutive_low_ratings, is_blacklisted, blacklist_reason,
              vehicle_number,
              profile_completed, verification_status, verified_at, email_verified
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: toUserPayload(result.rows[0]) });
  } catch (err) {
    console.error('Fetch current user error:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

module.exports = { googleAuth, completeGoogleProfile, me };
