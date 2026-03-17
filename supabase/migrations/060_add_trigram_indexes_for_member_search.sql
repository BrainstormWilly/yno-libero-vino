-- ============================================
-- Add trigram indexes for fast ILIKE search
-- ============================================
-- The /members search uses ILIKE '%term%' on first_name, last_name, email.
-- Standard B-tree indexes cannot optimize ILIKE with leading wildcards.
-- The pg_trgm extension provides GIN indexes that enable index scans for
-- these patterns, dramatically speeding up member search.
--
-- See: https://www.postgresql.org/docs/current/pgtrgm.html

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for ILIKE search on customers (used by customer_enrollment_summary view)
-- Each column gets its own index so OR(first_name.ilike.x, last_name.ilike.x, email.ilike.x)
-- can use index scans on any of the conditions
CREATE INDEX IF NOT EXISTS idx_customers_first_name_trgm 
  ON customers USING gin (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_last_name_trgm 
  ON customers USING gin (last_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_email_trgm 
  ON customers USING gin (email gin_trgm_ops);
