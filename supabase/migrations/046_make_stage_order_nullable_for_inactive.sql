-- ============================================================
-- Migration: Make stage_order nullable for inactive tiers
-- Date: December 8, 2025
-- Description: Allow inactive tiers to have NULL stage_order to prevent
--              conflicts when reordering active tiers. Only active tiers
--              must have unique stage_order values per club_program.
-- ============================================================

BEGIN;

-- 1. Drop the existing unique constraint
ALTER TABLE club_stages
DROP CONSTRAINT IF EXISTS club_stages_club_program_id_stage_order_key;

-- 2. Make stage_order nullable
ALTER TABLE club_stages
ALTER COLUMN stage_order DROP NOT NULL;

-- 3. Create a partial unique index that only applies to active tiers
-- This ensures active tiers have unique stage_order values, but inactive tiers can have NULL
CREATE UNIQUE INDEX IF NOT EXISTS club_stages_active_order_unique 
ON club_stages(club_program_id, stage_order)
WHERE is_active = true AND stage_order IS NOT NULL;

-- 4. Set stage_order to NULL for all inactive tiers
UPDATE club_stages
SET stage_order = NULL, updated_at = NOW()
WHERE is_active = false AND stage_order IS NOT NULL;

-- 5. Add comment explaining the logic
COMMENT ON COLUMN club_stages.stage_order IS 'Upgrade order (1, 2, 3...). NULL for inactive tiers. Only active tiers must have unique stage_order per club_program.';

COMMIT;

