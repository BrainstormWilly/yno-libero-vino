-- ============================================================
-- Migration: Add provider confirmation fields
-- Date: 2025
-- Description: Add email_provider_confirmed and sms_provider_confirmed 
--              fields to track when providers have been tested and confirmed
-- ============================================================

BEGIN;

-- Add confirmation fields to communication_configs table
ALTER TABLE communication_configs
ADD COLUMN IF NOT EXISTS email_provider_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_provider_confirmed BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN communication_configs.email_provider_confirmed IS 
  'Indicates if the email provider has been tested and confirmed by the user';
COMMENT ON COLUMN communication_configs.sms_provider_confirmed IS 
  'Indicates if the SMS provider has been tested and confirmed by the user';

COMMIT;

