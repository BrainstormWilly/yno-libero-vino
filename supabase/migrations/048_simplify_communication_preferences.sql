-- Simplify communication_preferences to align with Klaviyo subscription model
-- Transactional emails (monthly status, expiration warnings) are now automatic/required
-- Only marketing preferences are tracked

-- Add new columns
ALTER TABLE communication_preferences
  ADD COLUMN IF NOT EXISTS email_marketing BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_transactional BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_marketing BOOLEAN DEFAULT false;

-- Migrate existing data to new structure
-- email_marketing: true if any of the old email preferences were true (except if unsubscribed_all)
UPDATE communication_preferences
SET 
  email_marketing = CASE 
    WHEN unsubscribed_all THEN false
    WHEN email_promotions = true THEN true
    ELSE false
  END,
  sms_transactional = CASE 
    WHEN unsubscribed_all THEN false
    WHEN sms_monthly_status = true OR sms_expiration_warnings = true THEN true
    ELSE false
  END,
  sms_marketing = CASE 
    WHEN unsubscribed_all THEN false
    WHEN sms_promotions = true THEN true
    ELSE false
  END;

-- Drop old columns
ALTER TABLE communication_preferences
  DROP COLUMN IF EXISTS email_monthly_status,
  DROP COLUMN IF EXISTS email_expiration_warnings,
  DROP COLUMN IF EXISTS email_promotions,
  DROP COLUMN IF EXISTS sms_monthly_status,
  DROP COLUMN IF EXISTS sms_expiration_warnings,
  DROP COLUMN IF EXISTS sms_promotions;

-- Add comments
COMMENT ON COLUMN communication_preferences.email_marketing IS 'Opt-in for marketing emails (product suggestions, LV-specific promotions). Transactional emails (monthly status, expiration warnings) are automatic/required.';
COMMENT ON COLUMN communication_preferences.sms_transactional IS 'Opt-in for transactional SMS (monthly status, expiration warnings)';
COMMENT ON COLUMN communication_preferences.sms_marketing IS 'Opt-in for marketing SMS (promotions, product suggestions)';

