-- The testing-time "mark unserviceable" flow (tester/technician reporting
-- straight from testing) deliberately has no reason picker — just notes +
-- an optional photo — so it has no reason to attach. reason_id no longer
-- needs to be mandatory; the mid-repair flow's own form still requires
-- picking one before it will submit.
ALTER TABLE battery_issues ALTER COLUMN reason_id DROP NOT NULL;
