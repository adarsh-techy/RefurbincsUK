-- A client's own logo, uploaded by an admin when creating or editing the
-- client, shown back on that client's own dashboard. Stored on disk (see
-- controllers/client.controller.js, UPLOADS_DIR) — this column just holds
-- the generated filename, same pattern as invoices.file_path.
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS logo_path VARCHAR(255);
