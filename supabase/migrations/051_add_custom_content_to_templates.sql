-- Add custom_content column to communication_templates table
-- This field is optional text-only content that gets inserted into SendGrid templates
-- Only used for SendGrid clients - Klaviyo/Mailchimp clients manage templates in their own platforms

ALTER TABLE communication_templates
ADD COLUMN IF NOT EXISTS custom_content TEXT;

COMMENT ON COLUMN communication_templates.custom_content IS 'Optional text-only content for SendGrid templates. Inserted into template at {{custom_content}} placeholder. Only used for SendGrid clients.';

