-- ============================================================
-- Migration: Add initial_qualification_allowed to club_stages
-- Description: When false, this tier cannot be assigned at initial
--              signup; it can only be reached via upgrade.
-- ============================================================

BEGIN;

ALTER TABLE club_stages
ADD COLUMN IF NOT EXISTS initial_qualification_allowed BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN club_stages.initial_qualification_allowed IS 'When false, this tier cannot be assigned at initial signup; it can only be reached via upgrade.';

COMMIT;
