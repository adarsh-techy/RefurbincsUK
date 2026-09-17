-- Migration: 047_tested_parts_removed_status.sql
-- Adds 'tested_parts_removed' status to batteries status check constraint

ALTER TABLE batteries DROP CONSTRAINT IF EXISTS batteries_status_check;
ALTER TABLE batteries ADD CONSTRAINT batteries_status_check
  CHECK (status IN ('in_repair', 'in_progress', 'in_testing', 'repaired', 'returned', 'unserviceable', 'recycled', 'tested_parts_removed'));
