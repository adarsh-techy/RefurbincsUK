CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number VARCHAR(100) NOT NULL UNIQUE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  file_path VARCHAR(500),
  file_name VARCHAR(255),
  file_size INTEGER,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
