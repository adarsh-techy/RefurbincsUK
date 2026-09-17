-- Table for admin-managed services & rate pricing (e.g. Cell Balancing, Testing, Calibration)
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table for logging services performed on batteries
CREATE TABLE IF NOT EXISTS battery_services (
  id SERIAL PRIMARY KEY,
  battery_id INT NOT NULL REFERENCES batteries(id) ON DELETE CASCADE,
  service_id INT REFERENCES services(id) ON DELETE SET NULL,
  service_name VARCHAR(150) NOT NULL,
  rate NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  staff_id INT REFERENCES staff(id) ON DELETE SET NULL,
  notes TEXT,
  batch_id VARCHAR(64),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battery_services_battery_id ON battery_services(battery_id);
CREATE INDEX IF NOT EXISTS idx_battery_services_completed_at ON battery_services(completed_at);

-- Initial seed data
INSERT INTO services (name, description, rate, sort_order)
VALUES
  ('Cell Balancing', 'Precision balance charging and voltage leveling across all cells', 15.00, 1),
  ('Capacity Verification & Cycling', 'Full charge-discharge cycle capacity test with efficiency log', 20.00, 2),
  ('Thermal & BMS Calibration', 'Thermal sensor verification and BMS safety threshold calibration', 10.00, 3)
ON CONFLICT DO NOTHING;
