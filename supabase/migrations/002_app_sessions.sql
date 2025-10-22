-- Create app_sessions table for web app session management
-- This is separate from platform_sessions which stores OAuth tokens
CREATE TABLE IF NOT EXISTS app_sessions (
  id TEXT PRIMARY KEY, -- Session ID (stored in cookie)
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Session data
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  
  -- Session metadata
  ip_address INET,
  user_agent TEXT,
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_sessions_client_id ON app_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_app_sessions_last_activity ON app_sessions(last_activity_at);

-- Enable RLS
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;

-- Service role full access policy
CREATE POLICY "Service role full access" ON app_sessions FOR ALL TO service_role USING (true);

-- Function to clean up expired sessions (run via cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_app_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM app_sessions
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the difference
COMMENT ON TABLE app_sessions IS 'Web app user sessions for maintaining authenticated state across routes. Separate from platform_sessions which stores OAuth tokens for Commerce7/Shopify API access.';
COMMENT ON TABLE platform_sessions IS 'OAuth access/refresh tokens for Commerce7 and Shopify API access. Separate from app_sessions which handles web app user sessions.';

