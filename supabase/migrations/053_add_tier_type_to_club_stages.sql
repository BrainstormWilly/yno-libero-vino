-- ============================================================
-- Migration: Add tier_type to club_stages
-- Date: January 2025
-- Description: Add tier_type field to distinguish discount vs allocation tiers
-- ============================================================

BEGIN;

-- Add tier_type column to club_stages
ALTER TABLE club_stages
ADD COLUMN IF NOT EXISTS tier_type VARCHAR(20) DEFAULT 'discount' CHECK (
  tier_type IN ('discount', 'allocation')
);

-- Add comment for documentation
COMMENT ON COLUMN club_stages.tier_type IS 'Tier type: discount (discount-based benefits, may have product restrictions), allocation (product access only, 0% discount, cumulative products)';

COMMIT;

