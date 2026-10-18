-- Migration: account security and admin support
DO $$
BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'
    ) THEN
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    END IF;
END $$;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ALTER COLUMN role TYPE VARCHAR(20);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS account_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('PASSWORD_RESET', 'EMAIL_VERIFICATION')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_tokens_user ON account_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_account_tokens_token ON account_tokens(token);
CREATE INDEX IF NOT EXISTS idx_account_tokens_purpose ON account_tokens(purpose);

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('DRIVER', 'SENDER', 'ADMIN'));
