-- Add platform_tag_id field to club_stages table
-- This stores the C7 customer tag ID used for customer segmentation
ALTER TABLE club_stages 
ADD COLUMN IF NOT EXISTS platform_tag_id VARCHAR(255);

-- Add comment explaining the field
COMMENT ON COLUMN club_stages.platform_tag_id IS 'ID of the customer tag in the CRM platform (used for availableTo in Commerce7 coupons)';

