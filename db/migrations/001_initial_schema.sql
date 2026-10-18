-- RoadLifter Database Schema
-- Run this migration to set up all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                  VARCHAR(100) NOT NULL,
  email                 VARCHAR(255) UNIQUE NOT NULL,
  password_hash         VARCHAR(255) NOT NULL,
  role                  VARCHAR(10) NOT NULL CHECK (role IN ('DRIVER', 'SENDER')),
  phone                 VARCHAR(20),
  avatar_url            TEXT,
  is_active             BOOLEAN DEFAULT true,
  rating_avg            NUMERIC(3,2) DEFAULT 5.0,
  rating_count          INTEGER DEFAULT 0,
  consecutive_low_ratings INTEGER DEFAULT 0,
  is_blacklisted        BOOLEAN DEFAULT false,
  blacklist_reason      TEXT,
  blacklisted_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Driver live locations
CREATE TABLE IF NOT EXISTS driver_locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL DEFAULT 40.7128,
  lng         DOUBLE PRECISION NOT NULL DEFAULT -74.0060,
  heading     DOUBLE PRECISION DEFAULT 0,
  speed       DOUBLE PRECISION DEFAULT 0,
  is_active   BOOLEAN DEFAULT false,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id)
);

CREATE INDEX IF NOT EXISTS idx_driver_locations_active ON driver_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);

-- Trucks
CREATE TABLE IF NOT EXISTS trucks (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plate_number   VARCHAR(20) NOT NULL,
  truck_type     VARCHAR(50) NOT NULL,
  truck_model    VARCHAR(100),
  capacity_tons  DECIMAL(10,2),
  year           INTEGER,
  is_primary     BOOLEAN DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trucks_driver ON trucks(driver_id);

-- Cargo / Shipments
CREATE TABLE IF NOT EXISTS cargo (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  title             VARCHAR(200) NOT NULL,
  description       TEXT,
  cargo_type        VARCHAR(50) DEFAULT 'GENERAL',
  pickup_address    TEXT NOT NULL,
  pickup_lat        DOUBLE PRECISION NOT NULL,
  pickup_lng        DOUBLE PRECISION NOT NULL,
  delivery_address  TEXT NOT NULL,
  delivery_lat      DOUBLE PRECISION,
  delivery_lng      DOUBLE PRECISION,
  weight_kg         DECIMAL(10,2),
  budget            DECIMAL(10,2),
  status            VARCHAR(20) DEFAULT 'OPEN' 
                      CHECK (status IN ('OPEN','ACCEPTED','IN_TRANSIT','DELIVERED','CANCELLED')),
  accepted_at       TIMESTAMPTZ,
  pod_image         TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cargo_status ON cargo(status);
CREATE INDEX IF NOT EXISTS idx_cargo_sender ON cargo(sender_id);
CREATE INDEX IF NOT EXISTS idx_cargo_driver ON cargo(driver_id);
CREATE INDEX IF NOT EXISTS idx_cargo_pickup_location ON cargo(pickup_lat, pickup_lng);

-- Ratings table
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

