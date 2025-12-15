-- ============================================================
-- Migration: Add SMS opt-in tracking fields
-- Date: December 8, 2025
-- Description: Add fields to track SMS opt-in status, method, and confirmation
--              for TCPA compliance
-- ============================================================

BEGIN;

-- Add SMS opt-in tracking fields to communication_preferences
ALTER TABLE communication_preferences
ADD COLUMN IF NOT EXISTS sms_opted_in_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sms_opt_in_method VARCHAR(50) CHECK (sms_opt_in_method IN ('web_form', 'text_reply', 'admin_manual', 'signup_form')),
ADD COLUMN IF NOT EXISTS sms_opt_in_source TEXT,
ADD COLUMN IF NOT EXISTS sms_opt_in_request_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sms_opt_in_confirmed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN communication_preferences.sms_opted_in_at IS 'When customer initially opted in to SMS (may be same as confirmed_at for single opt-in)';
COMMENT ON COLUMN communication_preferences.sms_opt_in_method IS 'How customer opted in: web_form, text_reply, admin_manual, signup_form';
COMMENT ON COLUMN communication_preferences.sms_opt_in_source IS 'Source URL or context where opt-in occurred';
COMMENT ON COLUMN communication_preferences.sms_opt_in_request_sent_at IS 'When opt-in confirmation SMS was sent';
COMMENT ON COLUMN communication_preferences.sms_opt_in_confirmed_at IS 'When customer confirmed opt-in (via text reply or web confirmation)';

COMMIT;

