-- This migration intentionally resets all existing user-owned platform data.
-- Cargo, ratings, trucks, and driver locations are permanently deleted as part
-- of the requested switch to new Google-authenticated accounts.
DELETE FROM ratings;
DELETE FROM cargo;
DELETE FROM trucks;
DELETE FROM driver_locations;
DELETE FROM users;

DROP TABLE IF EXISTS account_tokens;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE users ALTER COLUMN firebase_uid SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_firebase_uid_key UNIQUE (firebase_uid);
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT true;
ALTER TABLE users ALTER COLUMN email_verified SET NOT NULL;
