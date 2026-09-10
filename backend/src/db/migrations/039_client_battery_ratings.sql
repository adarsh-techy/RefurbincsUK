-- Create battery_ratings table for client star ratings & preset / custom feedback
CREATE TABLE IF NOT EXISTS battery_ratings (
  id SERIAL PRIMARY KEY,
  client_id INT REFERENCES clients(id) ON DELETE CASCADE,
  client_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  battery_id INT REFERENCES batteries(id) ON DELETE SET NULL,
  battery_code VARCHAR(100),
  return_id INT REFERENCES returns(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  preset_tags JSONB DEFAULT '[]'::jsonb,
  custom_feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battery_ratings_client ON battery_ratings(client_id);
CREATE INDEX IF NOT EXISTS idx_battery_ratings_battery_code ON battery_ratings(battery_code);
CREATE INDEX IF NOT EXISTS idx_battery_ratings_created_at ON battery_ratings(created_at DESC);
