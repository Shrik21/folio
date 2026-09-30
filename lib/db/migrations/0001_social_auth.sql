-- Run once against the configured PostgreSQL database after reviewing/backing it up.
-- Existing portfolios retain their owner; no legacy data is assigned to a new user.
BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  name text NOT NULL,
  email text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_provider_identity_unique ON users(provider, provider_user_id);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS oauth_states (
  state_hash text PRIMARY KEY,
  browser_hash text NOT NULL,
  provider text NOT NULL,
  verifier text NOT NULL,
  nonce text NOT NULL,
  return_to text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS oauth_states_expiry_idx ON oauth_states(expires_at);
ALTER TABLE portfolios ALTER COLUMN owner_id DROP DEFAULT;
COMMIT;
