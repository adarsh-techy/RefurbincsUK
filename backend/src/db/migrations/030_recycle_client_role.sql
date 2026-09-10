-- Adds the recycle_client role to the system and links recycle shipments to a client.
-- A recycle_client user logs in to their own dashboard and sees only the recycle
-- batches that were assigned to them when the batch was created by an admin.

ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'client', 'technician', 'recycle_client'));

-- Which client (recycling company) this shipment was sent to.
ALTER TABLE recycle_batches ADD COLUMN IF NOT EXISTS recycle_client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL;
