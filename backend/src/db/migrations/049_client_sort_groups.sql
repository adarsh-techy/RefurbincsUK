-- Migration: 049_client_sort_groups.sql
-- Persist client battery sorting groups to PostgreSQL database rather than browser localStorage,
-- ensuring each database environment keeps its own sort groups isolated.

CREATE TABLE IF NOT EXISTS client_sort_groups (
  id VARCHAR(100) PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  batteries JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_sort_groups_client_id ON client_sort_groups(client_id);
CREATE INDEX IF NOT EXISTS idx_client_sort_groups_user_id ON client_sort_groups(user_id);
