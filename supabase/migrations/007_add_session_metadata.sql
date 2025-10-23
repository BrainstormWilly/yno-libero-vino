-- Add metadata column to app_sessions for CRM-specific data
-- This allows us to store access tokens, scope, and other CRM-specific info
-- without adding separate columns for each platform

ALTER TABLE app_sessions 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Index for metadata queries (if needed)
CREATE INDEX IF NOT EXISTS idx_app_sessions_metadata ON app_sessions USING gin(metadata);

-- Update comment to reflect new structure
COMMENT ON TABLE app_sessions IS 'Web app sessions for Commerce7 and Shopify. Uses DB storage (no cookies due to Shopify iframe restrictions). Session ID passed via URL parameter. Metadata stores CRM-specific data (tokens, scope, etc).';
COMMENT ON COLUMN app_sessions.metadata IS 'CRM-specific session data: { tenantShop, crmType, accessToken, scope, accountToken }';

