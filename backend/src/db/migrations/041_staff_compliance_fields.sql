-- Add compliance, identification, and document upload fields to staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS passport_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS ni_number TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS share_code TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS document_path TEXT;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS document_name TEXT;
