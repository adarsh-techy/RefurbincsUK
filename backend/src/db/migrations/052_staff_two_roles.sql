-- Migration: 052_staff_two_roles.sql
-- The workshop now has exactly two roles: 'technician' and 'supervisor'.
-- Former 'manager' (and any tester/qa) rows had supervisor-level access, so
-- they become supervisors; anything else/blank becomes technician.

UPDATE staff SET role = 'supervisor' WHERE lower(role) IN ('manager', 'tester', 'qa', 'supervisor');
UPDATE staff SET role = 'technician' WHERE role IS NULL OR lower(role) NOT IN ('supervisor');

ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('technician', 'supervisor'));
