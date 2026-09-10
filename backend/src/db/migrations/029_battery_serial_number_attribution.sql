-- Tracks who provided the battery manufacturer serial number ('client', 'admin', 'super_admin')
-- and when it was attached. If provided by a client, admins are restricted from overwriting it.
ALTER TABLE batteries
ADD COLUMN IF NOT EXISTS serial_number_added_by_role VARCHAR(20),
ADD COLUMN IF NOT EXISTS serial_number_added_at TIMESTAMPTZ;

-- Backfill any existing non-null serial numbers as 'admin' by default
UPDATE batteries
SET serial_number_added_by_role = 'admin',
    serial_number_added_at = created_at
WHERE serial_number IS NOT NULL
  AND serial_number <> ''
  AND serial_number_added_by_role IS NULL;
