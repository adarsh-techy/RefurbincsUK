-- Add optional invoice_email to clients table for dispatching invoices & statements
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invoice_email VARCHAR(255);
