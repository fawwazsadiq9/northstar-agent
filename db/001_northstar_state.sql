-- Northstar production persistence bootstrap.
-- The application creates/maintains the single durable state row in lib/store.ts.
-- Run this migration before first production traffic when DATABASE_URL is provisioned.
CREATE TABLE IF NOT EXISTS northstar_state (
  id INTEGER PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
