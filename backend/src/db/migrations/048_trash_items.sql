-- Migration: 048_trash_items.sql
-- Table to store deleted items with snapshot data and attribution (who deleted & when)

CREATE TABLE IF NOT EXISTS trash_items (
  id SERIAL PRIMARY KEY,
  original_id INT,
  item_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  item_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  deleted_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  deleted_by_name VARCHAR(150),
  deleted_by_email VARCHAR(150),
  deleted_by_role VARCHAR(50),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trash_items_item_type ON trash_items(item_type);
CREATE INDEX IF NOT EXISTS idx_trash_items_deleted_at ON trash_items(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_trash_items_deleted_by ON trash_items(deleted_by_user_id);
