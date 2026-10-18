-- Migration: Ratings and Blacklisting system for Credibility & Trust
-- Adds rating tracking and blacklisting capability to users and creates ratings table

-- 1. Add rating and blacklist columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 5.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consecutive_low_ratings INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blacklisted_at TIMESTAMPTZ;

-- 2. Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cargo_id              UUID NOT NULL REFERENCES cargo(id) ON DELETE CASCADE,
  rater_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ratee_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating                INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  on_time               BOOLEAN DEFAULT true,
  items_intact          BOOLEAN DEFAULT true,
  paid_agreed           BOOLEAN DEFAULT true,
  accurate_description  BOOLEAN DEFAULT true,
  comment               TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_cargo_rater UNIQUE(cargo_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_cargo ON ratings(cargo_id);
CREATE INDEX IF NOT EXISTS idx_users_blacklisted ON users(is_blacklisted);

-- 3. Set realistic initial ratings for demo drivers and senders
UPDATE users SET rating_avg = 4.9, rating_count = 14 WHERE email = 'driver1@demo.com';
UPDATE users SET rating_avg = 5.0, rating_count = 21 WHERE email = 'driver2@demo.com';
UPDATE users SET rating_avg = 4.7, rating_count = 9 WHERE email = 'driver3@demo.com';
UPDATE users SET rating_avg = 4.8, rating_count = 18 WHERE email = 'sender@demo.com';
