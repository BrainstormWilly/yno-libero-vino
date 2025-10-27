# Database Schema Updates - Club Architecture

## Overview

This document outlines the database schema changes required to support the new club-based architecture with Commerce7 integration. These changes align the LiberoVino database with the new Club, Promotion, and Loyalty entities.

## Migration Overview

**From**: Tag + Coupon-based architecture
**To**: Club + Promo + Loyalty architecture

**Impact**:
- ✅ Minimal changes to `club_programs` and `club_stages`
- ✅ New table: `club_promotions`
- ✅ New table: `tier_loyalty_config`
- ✅ Updates to existing tables for C7 references
- ⚠️ Deprecate: `loyalty_point_rules` (client-level)

---

## Schema Changes

### 1. Update `club_programs` Table

**Purpose**: Store C7 Club ID reference

**Changes**:
```sql
-- Add C7 club reference
ALTER TABLE club_programs
ADD COLUMN c7_club_id VARCHAR(255) UNIQUE,
ADD COLUMN c7_club_code VARCHAR(100),
ADD COLUMN c7_sync_status VARCHAR(20) DEFAULT 'pending' CHECK (
  c7_sync_status IN ('pending', 'synced', 'failed', 'orphaned')
),
ADD COLUMN c7_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN c7_last_error TEXT;

-- Add index for lookups
CREATE INDEX idx_club_programs_c7_id ON club_programs(c7_club_id);
CREATE INDEX idx_club_programs_sync_status ON club_programs(c7_sync_status);

-- Add comments
COMMENT ON COLUMN club_programs.c7_club_id IS 'Commerce7 Club UUID';
COMMENT ON COLUMN club_programs.c7_sync_status IS 'Sync status: pending (not synced), synced (active), failed (error), orphaned (C7 deleted)';
```

**Updated Schema**:
```sql
CREATE TABLE club_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Club Details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- Commerce7 Integration (NEW)
  c7_club_id VARCHAR(255) UNIQUE,
  c7_club_code VARCHAR(100),
  c7_sync_status VARCHAR(20) DEFAULT 'pending',
  c7_synced_at TIMESTAMP WITH TIME ZONE,
  c7_last_error TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_club_per_client UNIQUE(client_id)
);
```

---

### 2. Update `club_stages` Table

**Purpose**: Store C7 references and remove tag/coupon fields

**Changes**:
```sql
-- Add C7 references
ALTER TABLE club_stages
ADD COLUMN c7_club_id VARCHAR(255),  -- Reference to C7 club (denormalized for convenience)
ADD COLUMN c7_sync_status VARCHAR(20) DEFAULT 'pending' CHECK (
  c7_sync_status IN ('pending', 'synced', 'failed')
),
ADD COLUMN c7_synced_at TIMESTAMP WITH TIME ZONE;

-- Remove deprecated fields (if they exist)
ALTER TABLE club_stages
DROP COLUMN IF EXISTS discount_code,
DROP COLUMN IF EXISTS discount_title,
DROP COLUMN IF EXISTS tag;

-- Update comments
COMMENT ON COLUMN club_stages.c7_club_id IS 'C7 Club ID (denormalized from club_programs)';
COMMENT ON TABLE club_stages IS 'Club tiers/stages - each tier gets own promo(s) and optional loyalty config';
```

**Updated Schema**:
```sql
CREATE TABLE club_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_program_id UUID NOT NULL REFERENCES club_programs(id) ON DELETE CASCADE,
  
  -- Tier Details
  name VARCHAR(255) NOT NULL,
  discount_percentage DECIMAL(5,2) NOT NULL,
  duration_months INTEGER NOT NULL,
  min_purchase_amount DECIMAL(10,2) NOT NULL,
  stage_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  
  -- Commerce7 Integration (NEW)
  c7_club_id VARCHAR(255),
  c7_sync_status VARCHAR(20) DEFAULT 'pending',
  c7_synced_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(club_program_id, stage_order)
);
```

---

### 3. Create `club_promotions` Table (NEW)

**Purpose**: Track C7 promotions assigned to each tier

**Rationale**: 
- Each tier can have multiple promotions
- Promotions are created on C7 and referenced here
- Supports different promo types (percentage, fixed, product-specific)

**Schema**:
```sql
CREATE TABLE club_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  
  -- C7 Promotion Reference
  c7_promo_id VARCHAR(255) NOT NULL UNIQUE,
  c7_promo_code VARCHAR(100) NOT NULL,
  
  -- Promotion Details (mirrored from C7)
  title VARCHAR(255) NOT NULL,
  promo_type VARCHAR(20) NOT NULL CHECK (
    promo_type IN ('percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping')
  ),
  discount_value DECIMAL(10,2) NOT NULL,
  
  -- Application Rules
  auto_apply BOOLEAN DEFAULT true,
  applicable_products TEXT[],  -- Array of C7 product IDs
  applicable_collections TEXT[],  -- Array of C7 collection IDs
  min_purchase_amount DECIMAL(10,2),
  max_discount_amount DECIMAL(10,2),
  
  -- Validity
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  
  -- Usage Tracking (synced from C7)
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  
  -- Sync Status
  c7_sync_status VARCHAR(20) DEFAULT 'synced',
  c7_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_club_promotions_stage_id ON club_promotions(club_stage_id);
CREATE INDEX idx_club_promotions_c7_id ON club_promotions(c7_promo_id);
CREATE INDEX idx_club_promotions_code ON club_promotions(c7_promo_code);
CREATE INDEX idx_club_promotions_active ON club_promotions(is_active);

-- Comments
COMMENT ON TABLE club_promotions IS 'C7 promotions assigned to club tiers - auto-apply at checkout';
COMMENT ON COLUMN club_promotions.auto_apply IS 'If true, promo applies automatically without code entry';
COMMENT ON COLUMN club_promotions.applicable_products IS 'Empty array = all products';
```

**Example Data**:
```sql
-- Bronze tier 15% discount
INSERT INTO club_promotions (
  club_stage_id,
  c7_promo_id,
  c7_promo_code,
  title,
  promo_type,
  discount_value,
  auto_apply
) VALUES (
  '<bronze_stage_uuid>',
  'c7-promo-bronze-uuid',
  'BRONZE-FC-2025',
  'Bronze Member Discount',
  'percentage',
  15.0,
  true
);

-- Silver tier with product-specific promo
INSERT INTO club_promotions (
  club_stage_id,
  c7_promo_id,
  c7_promo_code,
  title,
  promo_type,
  discount_value,
  auto_apply,
  applicable_collections
) VALUES (
  '<silver_stage_uuid>',
  'c7-promo-silver-special-uuid',
  'SILVER-LIBRARY-2025',
  'Silver Library Wine Discount',
  'percentage',
  30.0,
  true,
  ARRAY['c7-library-collection-uuid']
);
```

---

### 4. Create `tier_loyalty_config` Table (NEW)

**Purpose**: Store tier-specific loyalty configuration (replaces client-level `loyalty_point_rules`)

**Rationale**:
- Each tier has its own loyalty earning rate
- Supports loyalty-only tiers (0% discount, high points)
- Integrates with C7 loyalty tiers

**Schema**:
```sql
CREATE TABLE tier_loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  
  -- C7 Loyalty Tier Reference
  c7_loyalty_tier_id VARCHAR(255) UNIQUE,
  
  -- Earning Rules
  points_per_dollar DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  bonus_multiplier DECIMAL(5,2) DEFAULT 1.0,  -- 1.5 = 50% bonus
  
  -- Redemption Rules
  redemption_rate DECIMAL(10,4) NOT NULL DEFAULT 0.01,  -- Dollar value per point
  min_points_for_redemption INTEGER DEFAULT 100,
  max_points_per_order INTEGER,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Sync Status
  c7_sync_status VARCHAR(20) DEFAULT 'pending',
  c7_synced_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_loyalty_per_tier UNIQUE(club_stage_id)
);

-- Indexes
CREATE INDEX idx_tier_loyalty_stage_id ON tier_loyalty_config(club_stage_id);
CREATE INDEX idx_tier_loyalty_c7_id ON tier_loyalty_config(c7_loyalty_tier_id);
CREATE INDEX idx_tier_loyalty_active ON tier_loyalty_config(is_active);

-- Comments
COMMENT ON TABLE tier_loyalty_config IS 'Tier-specific loyalty point earning and redemption rules';
COMMENT ON COLUMN tier_loyalty_config.points_per_dollar IS 'Points earned per $1 spent';
COMMENT ON COLUMN tier_loyalty_config.redemption_rate IS 'Dollar value per point (0.01 = 100 pts = $1)';
```

**Example Data**:
```sql
-- Loyalty-only tier: High earning, no discount
INSERT INTO tier_loyalty_config (
  club_stage_id,
  c7_loyalty_tier_id,
  points_per_dollar,
  redemption_rate
) VALUES (
  '<rewards_stage_uuid>',
  'c7-loyalty-rewards-uuid',
  10.0,  -- 10 points per dollar
  0.01   -- 100 points = $1
);

-- Bronze tier: Standard earning
INSERT INTO tier_loyalty_config (
  club_stage_id,
  c7_loyalty_tier_id,
  points_per_dollar,
  redemption_rate
) VALUES (
  '<bronze_stage_uuid>',
  'c7-loyalty-bronze-uuid',
  1.0,   -- 1 point per dollar
  0.01   -- 100 points = $1
);

-- Gold tier: High earning + better redemption
INSERT INTO tier_loyalty_config (
  club_stage_id,
  c7_loyalty_tier_id,
  points_per_dollar,
  redemption_rate
) VALUES (
  '<gold_stage_uuid>',
  'c7-loyalty-gold-uuid',
  5.0,   -- 5 points per dollar
  0.02   -- 50 points = $1 (better rate!)
);
```

---

### 5. Update `customers` Table

**Purpose**: Add current tier tracking

**Changes**:
```sql
-- Add current tier reference
ALTER TABLE customers
ADD COLUMN current_club_stage_id UUID REFERENCES club_stages(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX idx_customers_current_tier ON customers(current_club_stage_id);

-- Update comment
COMMENT ON COLUMN customers.current_club_stage_id IS 'Current active tier membership (NULL if not enrolled)';
```

**Updated Fields**:
```sql
-- Existing fields (already present):
-- loyalty_points_balance INTEGER
-- loyalty_points_lifetime INTEGER

-- New field:
-- current_club_stage_id UUID
```

---

### 6. Update `loyalty_rewards` Table

**Purpose**: Add tier restrictions for redemptions

**Changes**:
```sql
-- Add tier restriction fields
ALTER TABLE loyalty_rewards
ADD COLUMN min_tier_order INTEGER,
ADD COLUMN exclusive_tier_order INTEGER,
ADD COLUMN tier_restricted BOOLEAN DEFAULT false;

-- Add indexes
CREATE INDEX idx_loyalty_rewards_min_tier ON loyalty_rewards(min_tier_order);
CREATE INDEX idx_loyalty_rewards_exclusive_tier ON loyalty_rewards(exclusive_tier_order);

-- Add comments
COMMENT ON COLUMN loyalty_rewards.min_tier_order IS 'Minimum stage_order to access this reward (NULL = all tiers)';
COMMENT ON COLUMN loyalty_rewards.exclusive_tier_order IS 'Only this specific stage_order can access (NULL = not exclusive)';
COMMENT ON COLUMN loyalty_rewards.tier_restricted IS 'Quick flag for tier-restricted rewards';
```

**Example Queries**:
```sql
-- Gold-only reward (exclusive)
INSERT INTO loyalty_rewards (
  name,
  points_required,
  exclusive_tier_order,
  tier_restricted
) VALUES (
  'Barrel Tasting Experience',
  20000,
  3,  -- Gold tier (stage_order = 3)
  true
);

-- Silver+ reward (minimum tier)
INSERT INTO loyalty_rewards (
  name,
  points_required,
  min_tier_order,
  tier_restricted
) VALUES (
  'Winemaker Dinner',
  10000,
  2,  -- Silver and above (stage_order >= 2)
  true
);

-- Get rewards for customer's tier
SELECT lr.*
FROM loyalty_rewards lr
JOIN customers c ON c.id = '<customer_uuid>'
JOIN club_stages cs ON c.current_club_stage_id = cs.id
WHERE lr.is_active = true
  AND (
    -- Not tier restricted
    lr.tier_restricted = false
    OR
    -- Exclusive to this tier
    lr.exclusive_tier_order = cs.stage_order
    OR
    -- Tier meets minimum
    (lr.min_tier_order IS NOT NULL AND cs.stage_order >= lr.min_tier_order)
  );
```

---

### 7. Deprecate `loyalty_point_rules` Table

**Purpose**: Client-level loyalty rules no longer used (now tier-level)

**Changes**:
```sql
-- Mark as deprecated (keep for historical reference)
ALTER TABLE loyalty_point_rules
ADD COLUMN deprecated BOOLEAN DEFAULT true,
ADD COLUMN deprecated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN replacement_note TEXT DEFAULT 'Replaced by tier_loyalty_config table';

-- Add comment
COMMENT ON TABLE loyalty_point_rules IS 'DEPRECATED: Client-level loyalty rules. Now using tier_loyalty_config for tier-specific rules.';
```

**Migration**: If any active rules exist, they should be converted to tier configs:

```sql
-- Convert existing client rules to tier configs
INSERT INTO tier_loyalty_config (
  club_stage_id,
  points_per_dollar,
  redemption_rate,
  min_points_for_redemption
)
SELECT 
  cs.id,
  lpr.points_per_dollar,
  lpr.point_dollar_value,
  lpr.min_points_for_redemption
FROM loyalty_point_rules lpr
JOIN club_programs cp ON lpr.client_id = cp.client_id
JOIN club_stages cs ON cp.id = cs.club_program_id
WHERE lpr.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM tier_loyalty_config tlc
    WHERE tlc.club_stage_id = cs.id
  );
```

---

## Complete Migration Script

### Migration: `010_club_architecture_update.sql`

```sql
-- ============================================================
-- Migration: Club Architecture Update
-- Date: October 26, 2025
-- Description: Update schema for C7 club-based architecture
-- ============================================================

BEGIN;

-- 1. Update club_programs table
ALTER TABLE club_programs
ADD COLUMN IF NOT EXISTS c7_club_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS c7_club_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS c7_sync_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS c7_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS c7_last_error TEXT;

CREATE INDEX IF NOT EXISTS idx_club_programs_c7_id ON club_programs(c7_club_id);
CREATE INDEX IF NOT EXISTS idx_club_programs_sync_status ON club_programs(c7_sync_status);

-- 2. Update club_stages table
ALTER TABLE club_stages
ADD COLUMN IF NOT EXISTS c7_club_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS c7_sync_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS c7_synced_at TIMESTAMP WITH TIME ZONE;

-- Remove deprecated columns
ALTER TABLE club_stages
DROP COLUMN IF EXISTS discount_code,
DROP COLUMN IF EXISTS discount_title,
DROP COLUMN IF EXISTS tag;

-- 3. Create club_promotions table
CREATE TABLE IF NOT EXISTS club_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  
  c7_promo_id VARCHAR(255) NOT NULL UNIQUE,
  c7_promo_code VARCHAR(100) NOT NULL,
  
  title VARCHAR(255) NOT NULL,
  promo_type VARCHAR(20) NOT NULL CHECK (
    promo_type IN ('percentage', 'fixed_amount', 'buy_x_get_y', 'free_shipping')
  ),
  discount_value DECIMAL(10,2) NOT NULL,
  
  auto_apply BOOLEAN DEFAULT true,
  applicable_products TEXT[],
  applicable_collections TEXT[],
  min_purchase_amount DECIMAL(10,2),
  max_discount_amount DECIMAL(10,2),
  
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  
  c7_sync_status VARCHAR(20) DEFAULT 'synced',
  c7_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_promotions_stage_id ON club_promotions(club_stage_id);
CREATE INDEX IF NOT EXISTS idx_club_promotions_c7_id ON club_promotions(c7_promo_id);
CREATE INDEX IF NOT EXISTS idx_club_promotions_code ON club_promotions(c7_promo_code);
CREATE INDEX IF NOT EXISTS idx_club_promotions_active ON club_promotions(is_active);

-- 4. Create tier_loyalty_config table
CREATE TABLE IF NOT EXISTS tier_loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  
  c7_loyalty_tier_id VARCHAR(255) UNIQUE,
  
  points_per_dollar DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  bonus_multiplier DECIMAL(5,2) DEFAULT 1.0,
  
  redemption_rate DECIMAL(10,4) NOT NULL DEFAULT 0.01,
  min_points_for_redemption INTEGER DEFAULT 100,
  max_points_per_order INTEGER,
  
  is_active BOOLEAN DEFAULT true,
  c7_sync_status VARCHAR(20) DEFAULT 'pending',
  c7_synced_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_loyalty_per_tier UNIQUE(club_stage_id)
);

CREATE INDEX IF NOT EXISTS idx_tier_loyalty_stage_id ON tier_loyalty_config(club_stage_id);
CREATE INDEX IF NOT EXISTS idx_tier_loyalty_c7_id ON tier_loyalty_config(c7_loyalty_tier_id);
CREATE INDEX IF NOT EXISTS idx_tier_loyalty_active ON tier_loyalty_config(is_active);

-- 5. Update customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS current_club_stage_id UUID REFERENCES club_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_current_tier ON customers(current_club_stage_id);

-- 6. Update loyalty_rewards table
ALTER TABLE loyalty_rewards
ADD COLUMN IF NOT EXISTS min_tier_order INTEGER,
ADD COLUMN IF NOT EXISTS exclusive_tier_order INTEGER,
ADD COLUMN IF NOT EXISTS tier_restricted BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_min_tier ON loyalty_rewards(min_tier_order);
CREATE INDEX IF NOT EXISTS idx_loyalty_rewards_exclusive_tier ON loyalty_rewards(exclusive_tier_order);

-- 7. Deprecate loyalty_point_rules (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loyalty_point_rules') THEN
    ALTER TABLE loyalty_point_rules
    ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS replacement_note TEXT DEFAULT 'Replaced by tier_loyalty_config table';
  END IF;
END
$$;

-- 8. Data migration: Set current tier for existing members
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

COMMIT;

-- ============================================================
-- End Migration
-- ============================================================
```

---

## Rollback Script

### Rollback: `010_club_architecture_update_rollback.sql`

```sql
BEGIN;

-- Remove new columns from loyalty_rewards
ALTER TABLE loyalty_rewards
DROP COLUMN IF EXISTS min_tier_order,
DROP COLUMN IF EXISTS exclusive_tier_order,
DROP COLUMN IF EXISTS tier_restricted;

-- Remove current tier from customers
ALTER TABLE customers
DROP COLUMN IF EXISTS current_club_stage_id;

-- Drop new tables
DROP TABLE IF EXISTS tier_loyalty_config CASCADE;
DROP TABLE IF EXISTS club_promotions CASCADE;

-- Remove new columns from club_stages
ALTER TABLE club_stages
DROP COLUMN IF EXISTS c7_club_id,
DROP COLUMN IF EXISTS c7_sync_status,
DROP COLUMN IF EXISTS c7_synced_at;

-- Remove new columns from club_programs
ALTER TABLE club_programs
DROP COLUMN IF EXISTS c7_club_id,
DROP COLUMN IF EXISTS c7_club_code,
DROP COLUMN IF EXISTS c7_sync_status,
DROP COLUMN IF EXISTS c7_synced_at,
DROP COLUMN IF EXISTS c7_last_error;

-- Re-enable loyalty_point_rules (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'loyalty_point_rules') THEN
    UPDATE loyalty_point_rules SET deprecated = false;
  END IF;
END
$$;

COMMIT;
```

---

## Testing Checklist

### Schema Validation

- [ ] All tables created successfully
- [ ] All indexes created successfully
- [ ] Foreign key constraints working
- [ ] Check constraints enforced
- [ ] Unique constraints enforced

### Data Integrity

- [ ] Existing club_programs preserved
- [ ] Existing club_stages preserved
- [ ] Existing customers preserved
- [ ] Existing loyalty points preserved
- [ ] Current tier assignments correct

### Functionality

- [ ] Can create club with C7 reference
- [ ] Can create promotions for tier
- [ ] Can create loyalty config for tier
- [ ] Can query tier-specific rewards
- [ ] Cascading deletes work correctly

---

**Status**: 📝 Documentation Complete
**Migration**: Ready for Implementation
**Last Updated**: October 26, 2025

