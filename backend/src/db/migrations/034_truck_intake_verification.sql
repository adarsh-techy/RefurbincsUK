ALTER TABLE truck_intakes
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'verified',
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS verified_by_user_id INTEGER REFERENCES users(id);

UPDATE truck_intakes
SET status = 'verified', verified_at = COALESCE(verified_at, intake_at)
WHERE status IS NULL OR status = 'verified';
