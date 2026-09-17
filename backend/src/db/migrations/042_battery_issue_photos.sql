-- Adds photo_urls array column to battery_issues table for up to 3 photos of unserviceable batteries
ALTER TABLE battery_issues ADD COLUMN IF NOT EXISTS photo_urls TEXT[] DEFAULT '{}';
