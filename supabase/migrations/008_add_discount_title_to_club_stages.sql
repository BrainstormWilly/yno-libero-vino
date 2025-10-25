-- Add discount_title field to club_stages table
ALTER TABLE club_stages 
ADD COLUMN IF NOT EXISTS discount_title VARCHAR(500);

-- Rename crm_discount_id to platform_discount_id for consistency
ALTER TABLE club_stages 
RENAME COLUMN crm_discount_id TO platform_discount_id;

-- Add comment explaining the fields
COMMENT ON COLUMN club_stages.discount_code IS 'The discount code used by customers (e.g., BRONZE10)';
COMMENT ON COLUMN club_stages.discount_title IS 'Internal title/name for the discount (e.g., Bronze Tier - 10% Off)';
COMMENT ON COLUMN club_stages.platform_discount_id IS 'ID of the discount in the CRM platform (Commerce7 or Shopify)';

