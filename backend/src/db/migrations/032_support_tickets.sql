-- Support Tickets & Messaging System
CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  ticket_number VARCHAR(32) UNIQUE NOT NULL,
  client_id INT REFERENCES clients(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  subject VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  priority VARCHAR(32) NOT NULL DEFAULT 'normal',
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  battery_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_client ON support_tickets(client_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at DESC);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id INT REFERENCES users(id) ON DELETE SET NULL,
  sender_name VARCHAR(255) NOT NULL,
  sender_role VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created ON support_ticket_messages(created_at ASC);
