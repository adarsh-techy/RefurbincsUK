-- Adds optional service/labor charge per part in inventory.
ALTER TABLE parts ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10, 2) NOT NULL DEFAULT 0;
