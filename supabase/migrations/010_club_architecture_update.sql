-- ============================================================
-- Migration: Club Architecture Update
-- Date: October 27, 2025
-- Description: Update schema for C7 club-based architecture
-- ============================================================

BEGIN;

-- ============================================
-- 1. club_programs table
-- No changes needed - this is LiberoVino concept only
-- No CRM equivalent (1 program per client, contains multiple tiers)
-- ============================================
COMMENT ON TABLE club_programs IS 'LiberoVino club programs - organizational container for tiers (no CRM equivalent)';

-- ============================================
-- 2. Update club_stages table
-- Add C7 club ID, remove deprecated fields
-- ============================================
ALTER TABLE club_stages
ADD COLUMN IF NOT EXISTS c7_club_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_club_stages_c7_id ON club_stages(c7_club_id);

-- Remove deprecated columns (if they exist)
-- Discounts now live in club_stage_promotions table
ALTER TABLE club_stages
DROP COLUMN IF EXISTS discount_percentage,
DROP COLUMN IF EXISTS discount_code,
DROP COLUMN IF EXISTS discount_title,
DROP COLUMN IF EXISTS tag,
DROP COLUMN IF EXISTS crm_discount_id,
DROP COLUMN IF EXISTS last_sync_at,
DROP COLUMN IF EXISTS sync_status;

COMMENT ON COLUMN club_stages.c7_club_id IS 'C7 Club ID - each tier gets its own C7 club (adminStatus: Not Available = hidden from C7 admin UI)';
COMMENT ON TABLE club_stages IS 'Club tiers - each tier maps to a C7 club and can have multiple promotions';

-- ============================================
-- 3. Create club_stage_promotions table
-- CRITICAL: NO unique constraint on club_stage_id
-- This allows multiple promotions per tier!
-- ============================================
CREATE TABLE IF NOT EXISTS club_stage_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tier Link
  club_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  
  -- CRM Reference (source of truth)
  crm_id VARCHAR(255) NOT NULL,
  crm_type VARCHAR(20) NOT NULL CHECK (crm_type IN ('commerce7', 'shopify')),
  
  -- Optional Cache (for display only, can become stale)
  title VARCHAR(255),
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate CRM promotions
  UNIQUE(crm_id, crm_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_club_stage_promotions_stage_id ON club_stage_promotions(club_stage_id);
CREATE INDEX IF NOT EXISTS idx_club_stage_promotions_crm ON club_stage_promotions(crm_id, crm_type);

COMMENT ON TABLE club_stage_promotions IS 'CRM promotions linked to tiers - multiple per tier allowed (e.g., 20% off + free shipping)';
COMMENT ON COLUMN club_stage_promotions.crm_id IS 'Promotion ID from CRM (C7/Shopify) - fetch full details from CRM as needed';
COMMENT ON COLUMN club_stage_promotions.title IS 'Cached for display - may be stale, always fetch from CRM for authoritative data';

-- ============================================
-- 4. Create tier_loyalty_config table
-- Tier-specific loyalty (optional, 1-to-1 with club_stage)
-- ============================================
CREATE TABLE IF NOT EXISTS tier_loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_stage_id UUID NOT NULL UNIQUE REFERENCES club_stages(id) ON DELETE CASCADE,
  
  -- C7 Loyalty Tier Reference (source of truth)
  c7_loyalty_tier_id VARCHAR(255) NOT NULL UNIQUE,
  
  -- Display cache (may be stale, fetch from C7 for authoritative data)
  tier_title VARCHAR(255),
  earn_rate DECIMAL(5,4),  -- e.g., 0.02 = 2% points per dollar
  
  -- Preload bonus points on member signup (controlled by us, not C7)
  initial_points_bonus INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tier_loyalty_stage_id ON tier_loyalty_config(club_stage_id);
CREATE INDEX IF NOT EXISTS idx_tier_loyalty_c7_id ON tier_loyalty_config(c7_loyalty_tier_id);

COMMENT ON TABLE tier_loyalty_config IS 'Tier-specific loyalty config - optional, 1-to-1 with club_stage. Customer gets loyalty tier automatically when joining club.';
COMMENT ON COLUMN tier_loyalty_config.c7_loyalty_tier_id IS 'C7 Loyalty Tier ID - fetch full details from C7 as needed';
COMMENT ON COLUMN tier_loyalty_config.tier_title IS 'Cached for display - may be stale, always fetch from C7 for authoritative data';
COMMENT ON COLUMN tier_loyalty_config.earn_rate IS 'Cached earn rate (e.g., 0.02 = 2%) - fetch from C7 for current value';
COMMENT ON COLUMN tier_loyalty_config.initial_points_bonus IS 'Bonus points to preload via loyalty-transaction when member signs up (e.g., 1000 for Gold tier)';

-- ============================================
-- 5. Update customers table
-- Add current tier tracking
-- ============================================
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS current_club_stage_id UUID REFERENCES club_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_current_tier ON customers(current_club_stage_id);

COMMENT ON COLUMN customers.current_club_stage_id IS 'Current active tier (NULL if not enrolled)';

-- ============================================
-- 6. Update loyalty_rewards table
-- Add tier restrictions
-- ============================================
ALTER TABLE loyalty_rewards
ADD COLUMN IF NOT EXISTS min_tier_order INTEGER,
ADD COLUMN IF NOT EXISTS exclusive_tier_order INTEGER,
ADD COLUMN IF NOT EXISTS tier_restricted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_min_tier ON loyalty_rewards(min_tier_order);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_exclusive_tier ON loyalty_rewards(exclusive_tier_order);

COMMENT ON COLUMN loyalty_rewards.min_tier_order IS 'Minimum stage_order to access (NULL = all tiers)';
COMMENT ON COLUMN loyalty_rewards.exclusive_tier_order IS 'Only this stage_order can access (NULL = not exclusive)';

-- ============================================
-- 7. Deprecate loyalty_point_rules (if exists)
-- Client-level rules replaced by tier-level
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loyalty_point_rules') THEN
    ALTER TABLE loyalty_point_rules
    ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS replacement_note TEXT DEFAULT 'Replaced by tier_loyalty_config table';
    
    COMMENT ON TABLE loyalty_point_rules IS 'DEPRECATED: Use tier_loyalty_config instead';
  END IF;
END
$$;

-- ============================================
-- 7. Update club_enrollments table
-- Replace CRM sync fields with direct C7 membership reference
-- ============================================
ALTER TABLE club_enrollments
ADD COLUMN IF NOT EXISTS c7_membership_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_club_enrollments_c7_id ON club_enrollments(c7_membership_id);

-- Remove old sync tracking fields
ALTER TABLE club_enrollments
DROP COLUMN IF EXISTS synced_to_crm,
DROP COLUMN IF EXISTS crm_sync_at,
DROP COLUMN IF EXISTS crm_sync_error;

COMMENT ON COLUMN club_enrollments.c7_membership_id IS 'C7 ClubMembership ID - links LV enrollment to C7 membership record';

-- ============================================
-- 8. Review crm_sync_queue table
-- May not be needed with atomic operations
-- ============================================
-- NOTE: crm_sync_queue was designed for async retry logic
-- With atomic club/promo creation, may not be needed
-- Leaving in place for now - can deprecate later if unused

-- ============================================
-- 9. Data migration
-- Set current tier for existing members
-- ============================================
UPDATE customers c
SET current_club_stage_id = (
  SELECT ce.club_stage_id
  FROM club_enrollments ce
  WHERE ce.customer_id = c.id
    AND ce.status = 'active'
  ORDER BY ce.enrolled_at DESC
  LIMIT 1
)
WHERE c.is_club_member = true
  AND c.current_club_stage_id IS NULL;

-- ============================================
-- 10. Enable RLS for new tables
-- ============================================
ALTER TABLE club_stage_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_loyalty_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (service role has full access)
CREATE POLICY "Service role full access" ON club_stage_promotions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access" ON tier_loyalty_config FOR ALL TO service_role USING (true);

COMMIT;

-- ============================================================
-- Verification Queries (for testing)
-- ============================================================
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('club_programs', 'club_stages', 'club_stage_promotions', 'tier_loyalty_config')
-- ORDER BY table_name, ordinal_position;

