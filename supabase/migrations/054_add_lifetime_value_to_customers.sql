-- ============================================================
-- Migration: Add lifetime_value to customers
-- Date: [Current Date]
-- Description: Add lifetime_value field to track cumulative purchase total for LTV-based tier qualification
-- ============================================================

BEGIN;

-- Add lifetime_value column to customers
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS lifetime_value DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN customers.lifetime_value IS 'Cumulative lifetime value (total of all orders) for tier qualification based on min_ltv_amount. Updated on order webhooks and reconciled inline during monthly status processing.';

-- Create index for queries filtering by LTV
CREATE INDEX IF NOT EXISTS idx_customers_lifetime_value ON customers(lifetime_value);

-- Create function to update customer LTV (for use in order webhooks)
CREATE OR REPLACE FUNCTION update_customer_ltv(
  customer_id UUID,
  amount_change DECIMAL(10,2)
)
RETURNS void AS $$
BEGIN
  UPDATE customers
  SET 
    lifetime_value = GREATEST(0, lifetime_value + amount_change),
    updated_at = NOW()
  WHERE id = customer_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_customer_ltv IS 'Updates customer lifetime_value by adding amount_change. Ensures LTV never goes below 0.';

COMMIT;
