-- Migration: Driver Verification and Onboarding
-- Adds fields for driver identity verification and security

-- Add driver verification columns to users table (only if they don't exist)
DO $$
BEGIN
    -- Add each column individually with IF NOT EXISTS logic
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'legal_name') THEN
        ALTER TABLE users ADD COLUMN legal_name VARCHAR(150);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'cnic_number') THEN
        ALTER TABLE users ADD COLUMN cnic_number VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'vehicle_number') THEN
        ALTER TABLE users ADD COLUMN vehicle_number VARCHAR(20);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'license_number') THEN
        ALTER TABLE users ADD COLUMN license_number VARCHAR(50);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'license_expiry') THEN
        ALTER TABLE users ADD COLUMN license_expiry DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'profile_completed') THEN
        ALTER TABLE users ADD COLUMN profile_completed BOOLEAN DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verified_at') THEN
        ALTER TABLE users ADD COLUMN verified_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'verification_status') THEN
        ALTER TABLE users ADD COLUMN verification_status VARCHAR(20) DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED'));
    END IF;
END $$;

-- Create indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_profile_completed ON users(profile_completed);
CREATE INDEX IF NOT EXISTS idx_users_driver_role ON users(role) WHERE role = 'DRIVER';
