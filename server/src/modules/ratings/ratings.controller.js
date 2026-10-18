const db = require('../../config/db');
const { randomUUID } = require('crypto');

/**
 * Submit a star rating and credibility review for a delivery
 * Both Driver and Shipper can rate each other
 */
const createRating = async (req, res) => {
  try {
    const {
      cargo_id,
      rating,
      on_time = true,
      items_intact = true,
      paid_agreed = true,
      accurate_description = true,
      comment = '',
    } = req.body;

    if (typeof cargo_id !== 'string' || !cargo_id) {
      return res.status(400).json({ error: 'cargo_id is required' });
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }
    if ([on_time, items_intact, paid_agreed, accurate_description].some((value) => typeof value !== 'boolean')) {
      return res.status(400).json({ error: 'Rating aspects must be boolean values' });
    }
    if (typeof comment !== 'string' || comment.length > 2000) {
      return res.status(400).json({ error: 'Comment must be 2000 characters or fewer' });
    }

    // 1. Fetch cargo to verify participation
    const cargoResult = await db.query(
      `SELECT id, sender_id, driver_id, status, title FROM cargo WHERE id = $1`,
      [cargo_id]
    );

    if (cargoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    const cargo = cargoResult.rows[0];
    const currentUserId = req.user.id;

    if (!cargo.driver_id) {
      return res.status(400).json({ error: 'Cannot rate a shipment that has no assigned driver yet' });
    }

    if (cargo.status !== 'DELIVERED') {
      return res.status(400).json({ error: 'You can only rate a shipment after it has been delivered' });
    }

    // Verify current user is either the sender or the driver
    const isSender = cargo.sender_id === currentUserId;
    const isDriver = cargo.driver_id === currentUserId;

    if (!isSender && !isDriver) {
      return res.status(403).json({ error: 'Only the shipper or assigned driver can rate this delivery' });
    }

    // Determine who is being rated
    const rateeId = isSender ? cargo.driver_id : cargo.sender_id;

    // 2. Check if this user has already rated this cargo
    const existingRating = await db.query(
      `SELECT id FROM ratings WHERE cargo_id = $1 AND rater_id = $2`,
      [cargo_id, currentUserId]
    );

    if (existingRating.rows.length > 0) {
      return res.status(409).json({ error: 'You have already rated this delivery' });
    }

    // 3. Insert rating record
    const ratingId = randomUUID();
    const insertResult = await db.query(
      `INSERT INTO ratings (
         id, cargo_id, rater_id, ratee_id, rating,
         on_time, items_intact, paid_agreed, accurate_description,
         comment, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (cargo_id, rater_id) DO NOTHING
       RETURNING *`,
      [
        ratingId,
        cargo_id,
        currentUserId,
        rateeId,
        numericRating,
        on_time,
        items_intact,
        paid_agreed,
        accurate_description,
        comment.trim() || null,
      ]
    );

    if (insertResult.rows.length === 0) {
      return res.status(409).json({ error: 'You have already rated this delivery' });
    }

    const savedRating = insertResult.rows[0];

    // 4. Calculate updated statistics and evaluate Blacklist / Barred condition
    // Fetch all ratings for the ratee ordered by most recent first
    const rateeRatingsResult = await db.query(
      `SELECT rating, created_at FROM ratings WHERE ratee_id = $1 ORDER BY created_at DESC`,
      [rateeId]
    );

    const allRatings = rateeRatingsResult.rows;
    const totalCount = allRatings.length;
    const sumRatings = allRatings.reduce((acc, r) => acc + r.rating, 0);
    const avgRating = totalCount > 0 ? parseFloat((sumRatings / totalCount).toFixed(2)) : 5.0;

    // Count consecutive 1-star ratings from the latest delivery backward
    let consecutive1Stars = 0;
    for (const r of allRatings) {
      if (r.rating === 1) {
        consecutive1Stars++;
      } else {
        break;
      }
    }

    // Blacklist rule:
    // 1) 3 continuous 1-star ratings on straight deliveries
    // 2) OR low rating (average < 2.0 with at least 3 total reviews)
    const isBarred = consecutive1Stars >= 3 || (totalCount >= 3 && avgRating < 2.0);
    let blacklistReason = null;
    let blacklistedAt = null;

    if (isBarred) {
      if (consecutive1Stars >= 3) {
        blacklistReason = 'You are barred from using the service due to receiving 1-star ratings on 3 consecutive deliveries.';
      } else {
        blacklistReason = `You are barred from using the service due to an unacceptably low overall rating of ${avgRating.toFixed(1)} stars.`;
      }
      blacklistedAt = new Date();
    }

    // 5. Update ratee's user record
    await db.query(
      `UPDATE users
       SET rating_avg = $1,
           rating_count = $2,
           consecutive_low_ratings = $3,
           is_blacklisted = $4,
           blacklist_reason = $5,
           blacklisted_at = $6,
           is_active = CASE WHEN $4 = true THEN false ELSE is_active END,
           updated_at = NOW()
       WHERE id = $7`,
      [
        avgRating,
        totalCount,
        consecutive1Stars,
        isBarred,
        blacklistReason,
        blacklistedAt,
        rateeId,
      ]
    );

    // 6. Broadcast via Socket.IO if available
    if (req.io) {
      // Notify the ratee of their new rating
      req.io.to(`user:${rateeId}`).emit('rating:received', {
        rating: savedRating,
        newStats: {
          rating_avg: avgRating,
          rating_count: totalCount,
          consecutive_low_ratings: consecutive1Stars,
          is_blacklisted: isBarred,
          blacklist_reason: blacklistReason,
        },
      });

      // If ratee is barred, notify them immediately so their screen locks/warns
      if (isBarred) {
        req.io.to(`user:${rateeId}`).emit('user:barred', {
          message: 'You are barred from using the service',
          reason: blacklistReason,
        });
      }
    }

    res.status(201).json({
      message: 'Rating submitted successfully',
      rating: savedRating,
      rateeStats: {
        ratee_id: rateeId,
        rating_avg: avgRating,
        rating_count: totalCount,
        consecutive_low_ratings: consecutive1Stars,
        is_blacklisted: isBarred,
        blacklist_reason: blacklistReason,
      },
    });
  } catch (err) {
    console.error('createRating error:', err);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
};

/**
 * Get detailed rating profile & trust breakdown for any user (shipper or driver)
 */
const getUserRatings = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user basic profile & rating summary
    const userResult = await db.query(
      `SELECT id, name, role, rating_avg, rating_count
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUser = userResult.rows[0];

    // Fetch reviews received
    const reviewsResult = await db.query(
      `SELECT r.*, u.name AS rater_name, u.role AS rater_role, c.title AS cargo_title
       FROM ratings r
       JOIN users u ON r.rater_id = u.id
       JOIN cargo c ON r.cargo_id = c.id
       WHERE r.ratee_id = $1
       ORDER BY r.created_at DESC
       LIMIT 30`,
      [userId]
    );

    const reviews = reviewsResult.rows;
    const total = reviews.length;

    // Compute aspect credibility percentages
    const onTimeCount = reviews.filter((r) => r.on_time).length;
    const itemsIntactCount = reviews.filter((r) => r.items_intact).length;
    const paidAgreedCount = reviews.filter((r) => r.paid_agreed).length;
    const accurateDescCount = reviews.filter((r) => r.accurate_description).length;

    const breakdown = {
      on_time_pct: total > 0 ? Math.round((onTimeCount / total) * 100) : 100,
      items_intact_pct: total > 0 ? Math.round((itemsIntactCount / total) * 100) : 100,
      paid_agreed_pct: total > 0 ? Math.round((paidAgreedCount / total) * 100) : 100,
      accurate_desc_pct: total > 0 ? Math.round((accurateDescCount / total) * 100) : 100,
    };

    res.json({
      user: targetUser,
      breakdown,
      reviews,
    });
  } catch (err) {
    console.error('getUserRatings error:', err);
    res.status(500).json({ error: 'Failed to fetch user rating profile' });
  }
};

/**
 * Get rating status for a specific shipment
 */
const getCargoRatingStatus = async (req, res) => {
  try {
    const { cargoId } = req.params;
    const currentUserId = req.user.id;
    const cargoResult = await db.query(
      'SELECT sender_id, driver_id FROM cargo WHERE id = $1',
      [cargoId]
    );
    if (cargoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    const cargo = cargoResult.rows[0];
    if (cargo.sender_id !== currentUserId && cargo.driver_id !== currentUserId) {
      return res.status(403).json({ error: 'You are not a participant in this shipment' });
    }

    const ratingsResult = await db.query(
      `SELECT r.*, u.name AS rater_name, u.role AS rater_role
       FROM ratings r
       JOIN users u ON r.rater_id = u.id
       WHERE r.cargo_id = $1`,
      [cargoId]
    );

    const myRating = ratingsResult.rows.find((r) => r.rater_id === currentUserId) || null;
    const partnerRating = ratingsResult.rows.find((r) => r.rater_id !== currentUserId) || null;

    res.json({
      hasRated: Boolean(myRating),
      myRating,
      partnerRating,
      allRatings: ratingsResult.rows,
    });
  } catch (err) {
    console.error('getCargoRatingStatus error:', err);
    res.status(500).json({ error: 'Failed to fetch shipment rating status' });
  }
};

module.exports = {
  createRating,
  getUserRatings,
  getCargoRatingStatus,
};
