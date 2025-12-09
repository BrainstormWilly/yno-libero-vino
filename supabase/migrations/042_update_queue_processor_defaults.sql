-- ============================================
-- Queue Processor URL Configuration
-- ============================================
-- This migration documents the URL configuration for queue processor functions.
-- 
-- DEFAULT: Static Ngrok URL for local development (paid plan with static domain)
--   https://c7-kindly-balanced-macaw.ngrok-free.app
-- 
-- PRODUCTION: Override by setting the database parameter:
--   ALTER DATABASE postgres SET app.api_base_url = 'https://your-production-domain.com';
--
-- This allows:
-- - Local dev: Works out-of-the-box with static Ngrok URL
-- - Production: Explicitly configured, prevents accidental use of dev URLs
--
-- Note: This migration adds helper functions and comments.
-- The actual queue processor functions are in migrations 028, 033, and 037.

COMMENT ON FUNCTION process_monthly_status_queue IS 'Processes monthly status queue by calling API endpoint. PRODUCTION: Set app.api_base_url = https://liberovino.wine';
COMMENT ON FUNCTION process_expiration_warning_queue IS 'Processes expiration warning queue by calling API endpoint. PRODUCTION: Set app.api_base_url = https://liberovino.wine';
COMMENT ON FUNCTION process_crm_sync_queue IS 'Processes CRM sync queue by calling API endpoint. PRODUCTION: Set app.api_base_url = https://liberovino.wine';

-- Provide a helper function to check if the URL is configured
CREATE OR REPLACE FUNCTION check_api_base_url()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_url TEXT;
BEGIN
  v_url := current_setting('app.api_base_url', true);
  
  IF v_url IS NULL THEN
    RETURN 'NOT SET - Using default localhost:3000. Set with: ALTER DATABASE postgres SET app.api_base_url = ''https://liberovino.wine'';';
  ELSE
    RETURN 'Configured: ' || v_url;
  END IF;
END;
$$;

COMMENT ON FUNCTION check_api_base_url IS 'Helper function to check if app.api_base_url is configured for production queue processing';

