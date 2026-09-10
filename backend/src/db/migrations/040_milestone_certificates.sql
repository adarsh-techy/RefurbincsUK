-- Create milestone_certificates table for eco / CO2 impact and service volume achievements
CREATE TABLE IF NOT EXISTS milestone_certificates (
  id SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  milestone_tier VARCHAR(50) NOT NULL,
  milestone_count INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  co2_saved_kg NUMERIC(12, 2) DEFAULT 0,
  ewaste_diverted_kg NUMERIC(12, 2) DEFAULT 0,
  certificate_code VARCHAR(100) UNIQUE NOT NULL,
  custom_note TEXT,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT uq_client_milestone_count UNIQUE (client_id, milestone_count)
);

CREATE INDEX IF NOT EXISTS idx_milestone_certs_client ON milestone_certificates(client_id);
CREATE INDEX IF NOT EXISTS idx_milestone_certs_code ON milestone_certificates(certificate_code);
