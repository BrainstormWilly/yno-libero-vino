-- ============================================
-- Customer Enrollment Summary View
-- ============================================
-- This view provides a customer-centric view with their most recent enrollment
-- Shows loyalty points, cumulative days, and current/last tier information

CREATE OR REPLACE VIEW customer_enrollment_summary AS
SELECT 
  -- Customer identity
  c.id as customer_id,
  c.client_id,
  c.email,
  c.first_name,
  c.last_name,
  c.phone,
  c.crm_id,
  c.is_club_member,
  c.created_at as customer_created_at,
  
  -- Loyalty data (customer-level)
  c.loyalty_points_balance,
  c.loyalty_points_lifetime,
  c.cumulative_membership_days,
  c.loyalty_earning_active,
  c.loyalty_eligible_since,
  
  -- Most recent enrollment data
  latest_enrollment.id as enrollment_id,
  latest_enrollment.club_stage_id,
  latest_enrollment.status as enrollment_status,
  latest_enrollment.enrolled_at,
  latest_enrollment.expires_at,
  latest_enrollment.c7_membership_id,
  
  -- Tier data
  cs.name as tier_name,
  cs.duration_months as tier_duration_months,
  cs.min_purchase_amount as tier_min_purchase,
  cs.is_active as tier_is_active
  
FROM customers c
LEFT JOIN LATERAL (
  SELECT *
  FROM club_enrollments ce
  WHERE ce.customer_id = c.id
  ORDER BY ce.enrolled_at DESC
  LIMIT 1
) latest_enrollment ON true
LEFT JOIN club_stages cs ON cs.id = latest_enrollment.club_stage_id;

COMMENT ON VIEW customer_enrollment_summary IS 'Customer-centric view showing each customer with their most recent enrollment and loyalty data. Used for member listing and management.';

