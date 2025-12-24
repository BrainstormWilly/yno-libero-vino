-- Add email image URL columns to clients table for SendGrid clients
-- These are only used for SendGrid email templates
-- Klaviyo/Mailchimp clients edit templates directly, so they don't use these

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS email_header_image_url TEXT,
ADD COLUMN IF NOT EXISTS email_footer_image_url TEXT;

-- Add comments explaining usage
COMMENT ON COLUMN clients.email_header_image_url IS 'Header image URL for SendGrid email templates. Only used for SendGrid clients. Klaviyo/Mailchimp clients edit templates directly.';
COMMENT ON COLUMN clients.email_footer_image_url IS 'Footer image URL for SendGrid email templates. Only used for SendGrid clients. Klaviyo/Mailchimp clients edit templates directly.';

