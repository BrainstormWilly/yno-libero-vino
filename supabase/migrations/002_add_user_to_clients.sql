-- Add user_id and user_email to clients table for future RLS support
ALTER TABLE clients 
  ADD COLUMN user_id VARCHAR(255),
  ADD COLUMN user_email VARCHAR(255);

-- Add index on user_id for performance
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
