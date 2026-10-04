-- Distinguish a battery marked unserviceable by the tester during QA testing
-- ("Test Failed") from one a technician marked unserviceable mid-repair.
ALTER TABLE battery_issues ADD COLUMN IF NOT EXISTS failed_testing BOOLEAN NOT NULL DEFAULT false;

-- Backfill: the testing-time flow has no reason picker (reason_id NULL), and
-- testers are supervisors.
UPDATE battery_issues bi
SET failed_testing = true
WHERE bi.reason_id IS NULL
   OR EXISTS (SELECT 1 FROM staff s WHERE s.id = bi.staff_id AND lower(s.role) = 'supervisor');
