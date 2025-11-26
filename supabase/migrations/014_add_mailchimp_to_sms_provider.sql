-- ============================================================
-- Migration: Add mailchimp to sms_provider CHECK constraint
-- Date: 2025
-- Description: Update sms_provider constraint to include 'mailchimp' as a valid value
-- ============================================================

BEGIN;

-- Drop the existing CHECK constraint on sms_provider
-- PostgreSQL auto-generates constraint names, so we find and drop it dynamically
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name for sms_provider CHECK constraint
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'communication_configs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%sms_provider%'
      AND pg_get_constraintdef(oid) LIKE '%CHECK%';
    
    -- Drop the constraint if found
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE communication_configs DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

-- Add the updated CHECK constraint that includes 'mailchimp'
ALTER TABLE communication_configs
ADD CONSTRAINT communication_configs_sms_provider_check CHECK (
  sms_provider IN ('redchirp', 'twilio', 'klaviyo', 'mailchimp')
);

COMMENT ON CONSTRAINT communication_configs_sms_provider_check ON communication_configs IS 
  'SMS provider values: redchirp, twilio, klaviyo, mailchimp';

COMMIT;

