ALTER TABLE returns
ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'pending_verification',
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verified_by_user_id INTEGER REFERENCES users(id);

UPDATE returns
SET status = 'verified', verified_at = COALESCE(verified_at, returned_at)
WHERE status IS NULL OR status = 'verified';
