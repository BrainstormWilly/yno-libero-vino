-- Add shop_url column to clients table
-- This is the URL used in all "Shop Now" buttons in email templates
-- Defaults to (website_url)/shop but can be customized per client

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS shop_url TEXT;

-- Add comment explaining usage
COMMENT ON COLUMN clients.shop_url IS 'Custom shop URL for "Shop Now" buttons in emails. Defaults to (website_url)/shop but can be customized to point to collections/wines/etc pages.';

