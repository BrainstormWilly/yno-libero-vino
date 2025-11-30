-- Fix is_club_member flag for existing customers with active enrollments
-- This migration corrects data where customers have active enrollments
-- but is_club_member is incorrectly set to false

UPDATE customers
SET 
  is_club_member = true,
  updated_at = NOW()
WHERE id IN (
  SELECT DISTINCT customer_id
  FROM club_enrollments
  WHERE status = 'active'
)
AND is_club_member = false;

COMMENT ON COLUMN customers.is_club_member IS 'Denormalized flag indicating if customer has any active club enrollments. Updated when enrollments are created/expired.';

