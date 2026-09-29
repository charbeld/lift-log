-- Lift Log D1 schema. Apply with: npx wrangler d1 execute liftlog --remote --file schema.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,            -- Google "sub"
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  token_hash TEXT PRIMARY KEY,    -- sha256 of the bearer token; the token itself is never stored
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workouts (
  user_id TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,             -- full session JSON
  deleted INTEGER NOT NULL DEFAULT 0,
  client_updated_at INTEGER NOT NULL,
  server_updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS workouts_sync ON workouts (user_id, server_updated_at);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  program TEXT,
  settings TEXT,
  client_updated_at INTEGER NOT NULL,
  server_updated_at INTEGER NOT NULL
);
