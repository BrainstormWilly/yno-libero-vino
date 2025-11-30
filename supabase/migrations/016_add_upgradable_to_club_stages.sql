-- Add upgradable field to club_stages
-- This field indicates whether a tier can be upgraded to.
-- Top tiers may be set to false if they are only available to high-value customers.

ALTER TABLE club_stages
ADD COLUMN IF NOT EXISTS upgradable BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN club_stages.upgradable IS 'Indicates whether this tier can be upgraded to. Top tiers may be set to false if they are only available to high-value customers.';

