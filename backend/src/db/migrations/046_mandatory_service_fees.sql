-- Migration: 046_mandatory_service_fees.sql
-- Adds is_mandatory flag to services table so mandatory fees can be automatically applied to all battery intakes

ALTER TABLE services
ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_services_is_mandatory ON services(is_mandatory);

-- Optionally insert default mandatory intake fee if no mandatory service exists
INSERT INTO services (name, description, rate, sort_order, active, is_mandatory)
SELECT 'Mandatory Intake & Diagnostic Fee', 'Standard baseline diagnostic and handling fee automatically applied upon battery intake', 5.00, 100, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE is_mandatory = true
);
