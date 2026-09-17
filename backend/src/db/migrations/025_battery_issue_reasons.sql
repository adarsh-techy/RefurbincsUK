-- Admin-managed list of reasons a technician can give when a battery can't
-- be serviced (e.g. "Battery is dead") — surfaced in the mobile app's
-- Report Issue flow and editable from the admin panel, same pattern as
-- parts/clients.
CREATE TABLE IF NOT EXISTS issue_reasons (
  id SERIAL PRIMARY KEY,
  label VARCHAR(120) UNIQUE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No seed rows on purpose — this list is entirely admin-managed from the
-- Issue Reasons page; a fresh install starts empty rather than with
-- example reasons the admin didn't ask for.

-- New terminal status: a technician reports mid-repair that the battery
-- can't be serviced. Distinct from 'repaired' and stays out of the active
-- queue, same as 'repaired'/'returned'.
ALTER TABLE batteries DROP CONSTRAINT batteries_status_check;
ALTER TABLE batteries ADD CONSTRAINT batteries_status_check
  CHECK (status IN ('in_repair', 'in_progress', 'in_testing', 'repaired', 'returned', 'unserviceable'));

-- One row per reported issue: battery, who reported it, which reason, and
-- their free-text note. Kept as history (like repairs) rather than columns
-- on batteries, in case a battery is later reinstated and re-reported.
CREATE TABLE IF NOT EXISTS battery_issues (
  id SERIAL PRIMARY KEY,
  battery_id INTEGER NOT NULL REFERENCES batteries(id),
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  reason_id INTEGER NOT NULL REFERENCES issue_reasons(id),
  note TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
