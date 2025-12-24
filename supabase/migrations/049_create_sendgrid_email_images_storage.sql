-- Create storage bucket for SendGrid client email images
-- This bucket stores header and footer images for SendGrid clients only
-- Klaviyo/Mailchimp clients edit templates directly, so they don't need this

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sendgrid-email-images',
  'sendgrid-email-images',
  true,  -- Public bucket so URLs work in emails
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Service role can upload (server-side only)
CREATE POLICY "Service role can upload SendGrid images"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'sendgrid-email-images');

-- Policy: Public read access for email templates
CREATE POLICY "Public can read SendGrid email images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'sendgrid-email-images');

-- Policy: Service role can update SendGrid images
CREATE POLICY "Service role can update SendGrid images"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'sendgrid-email-images')
WITH CHECK (bucket_id = 'sendgrid-email-images');

-- Policy: Service role can delete SendGrid images
CREATE POLICY "Service role can delete SendGrid images"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'sendgrid-email-images');

