-- Add website_url column to clients table
-- Stores the customer-facing website URL from Commerce7 install payload (organization-website)
-- Used by getShopUrl() function instead of constructing URL from tenant_shop
-- Ensures shop_url in email templates points to actual customer website, not CRM admin URL

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Add comment explaining usage
COMMENT ON COLUMN clients.website_url IS 'Customer-facing website URL. For Commerce7, this comes from organization-website in install payload. Falls back to constructed URL if not provided.';

