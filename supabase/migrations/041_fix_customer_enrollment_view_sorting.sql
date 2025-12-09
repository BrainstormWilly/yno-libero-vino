-- ============================================
-- Fix Customer Enrollment Summary View Sorting
-- ============================================
-- This migration fixes the customer_enrollment_summary view to correctly
-- prioritize active enrollments when multiple enrollments have the same
-- enrolled_at date (which happens during tier upgrades).
--
-- Issue: When upgrading, the new enrollment preserves the original enrolled_at
-- date, so both old (cancelled) and new (active) enrollments have the same date.
-- The view was picking one arbitrarily, often showing the cancelled one.
--
-- Fix: Add explicit sorting to prioritize active status when dates are equal.

DROP VIEW IF EXISTS customer_enrollment_summary;

CREATE OR REPLACE VIEW customer_enrollment_summary AS
SELECT 
  c.id as customer_id,
  c.client_id,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  c.crm_id,
  c.is_club_member,
  c.loyalty_points_balance,
  c.loyalty_points_lifetime,
  c.cumulative_membership_days,
  c.loyalty_earning_active,
  c.loyalty_eligible_since,
  c.created_at as customer_created_at,
  
  -- Most recent enrollment data
  -- Prioritize active enrollments when enrolled_at dates are equal
  latest_enrollment.id as enrollment_id,
  latest_enrollment.club_stage_id,
  latest_enrollment.status as enrollment_status,
  latest_enrollment.enrolled_at,
  latest_enrollment.expires_at,
  latest_enrollment.c7_membership_id,
  
  -- Tier data
  cs.name as tier_name,
  cs.duration_months,
  cs.min_purchase_amount
  
FROM customers c
LEFT JOIN LATERAL (
  SELECT *
  FROM club_enrollments ce
  WHERE ce.customer_id = c.id
  ORDER BY 
    ce.enrolled_at DESC,                                  -- Latest enrollment first
    CASE WHEN ce.status = 'active' THEN 0 ELSE 1 END,    -- Active before cancelled/expired
    ce.created_at DESC                                     -- Newest created first as tiebreaker
  LIMIT 1
) latest_enrollment ON true
LEFT JOIN club_stages cs ON cs.id = latest_enrollment.club_stage_id;

-- Recreate index for performance (unchanged from previous migration)
CREATE INDEX IF NOT EXISTS idx_customer_enrollment_summary_client 
  ON customers(client_id);

COMMENT ON VIEW customer_enrollment_summary IS 'Customer-centric view with most recent enrollment. Prioritizes active enrollments when multiple enrollments share the same enrolled_at date (e.g., during upgrades).';

