-- Add setup_complete flag to clients table
ALTER TABLE clients 
  ADD COLUMN setup_complete BOOLEAN NOT NULL DEFAULT false;

-- Add index for filtering incomplete setups
CREATE INDEX IF NOT EXISTS idx_clients_setup_complete ON clients(setup_complete);

-- Add comment
COMMENT ON COLUMN clients.setup_complete IS 'True when client has completed initial setup (club programs, loyalty rules, notifications)';
