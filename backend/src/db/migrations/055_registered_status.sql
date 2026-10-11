-- Migration: 055_registered_status.sql
-- A battery created on the Generate QR / RFID pages was stored as 'returned',
-- so clients and admins saw "Returned to Client" on batteries that had never
-- been serviced. 'registered' now means: with the client, never serviced.
-- 'returned' keeps meaning: came back from the workshop after a visit.

ALTER TABLE batteries DROP CONSTRAINT IF EXISTS batteries_status_check;
ALTER TABLE batteries ADD CONSTRAINT batteries_status_check
  CHECK (status IN ('registered', 'in_repair', 'in_progress', 'in_testing', 'repaired', 'returned', 'unserviceable', 'recycled', 'tested_parts_removed'));

-- Existing never-serviced batteries: no return dispatch, no workshop visit,
-- not on a truck (same rule the fleet list already used to show "Registered").
UPDATE batteries b
   SET status = 'registered'
 WHERE b.status = 'returned'
   AND b.truck_intake_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM return_batteries rb WHERE rb.battery_id = b.id)
   AND NOT EXISTS (SELECT 1 FROM battery_visits bv WHERE bv.battery_id = b.id);
