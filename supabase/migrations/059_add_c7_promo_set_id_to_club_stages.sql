-- ============================================================
-- Migration: Add c7_promo_set_id to club_stages
-- Description: C7 promotion-set ID when this tier has multiple
--              promos (so they all apply to orders).
-- ============================================================

BEGIN;

ALTER TABLE club_stages
ADD COLUMN IF NOT EXISTS c7_promo_set_id VARCHAR(255) NULL;

COMMENT ON COLUMN club_stages.c7_promo_set_id IS 'C7 promotion-set ID when tier has multiple promos (so they all apply to orders).';

COMMIT;
