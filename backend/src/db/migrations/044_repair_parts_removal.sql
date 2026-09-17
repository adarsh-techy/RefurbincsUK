-- Tracks reclaiming parts from a battery that was declared unserviceable
-- during testing (after repair parts were already fitted). Nullable: a
-- repair row starts unreclaimed, and is stamped once the part is physically
-- pulled back out and restocked to inventory.
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS removed_by_staff_id INTEGER REFERENCES staff(id);
