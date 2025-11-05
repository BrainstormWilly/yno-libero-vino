-- ============================================================
-- Migration: Add min_ltv_amount to club_stages
-- Date: November 4, 2025
-- Description: Add minimum lifetime value requirement for tier qualification
--              and add 'cancelled' status option for enrollments
-- ============================================================

BEGIN;

-- Add min_ltv_amount column to club_stages
ALTER TABLE club_stages
ADD COLUMN IF NOT EXISTS min_ltv_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN club_stages.min_ltv_amount IS 'Minimum customer lifetime value (LTV) required to qualify for this tier';

-- Update club_enrollments status check to include 'cancelled'
ALTER TABLE club_enrollments
DROP CONSTRAINT IF EXISTS club_enrollments_status_check;

ALTER TABLE club_enrollments
ADD CONSTRAINT club_enrollments_status_check CHECK (
  status IN ('active', 'expired', 'upgraded', 'cancelled')
);

COMMENT ON CONSTRAINT club_enrollments_status_check ON club_enrollments IS 'Status values: active, expired, upgraded, cancelled';

COMMIT;

