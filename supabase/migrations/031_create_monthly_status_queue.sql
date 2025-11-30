-- ============================================
-- Monthly Status Queue Table
-- ============================================
-- Queue for processing monthly status notifications
-- Similar to crm_sync_queue, but for monthly status emails

CREATE TABLE IF NOT EXISTS monthly_status_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: Deduplication is handled by the queue_monthly_status_jobs() function
-- which checks for existing notifications in the same month before inserting.
-- This prevents duplicates while avoiding immutability issues with DATE_TRUNC.

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_monthly_status_queue_status ON monthly_status_queue(status);
CREATE INDEX IF NOT EXISTS idx_monthly_status_queue_next_retry ON monthly_status_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_monthly_status_queue_client_id ON monthly_status_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_monthly_status_queue_customer_id ON monthly_status_queue(customer_id);
CREATE INDEX IF NOT EXISTS idx_monthly_status_queue_created_at ON monthly_status_queue(created_at);

COMMENT ON TABLE monthly_status_queue IS 'Queue for processing monthly status notifications. Jobs are created by the monthly cron and processed by a worker that runs periodically. The queue_monthly_status_jobs() function prevents duplicate monthly status notifications for the same customer in the same month by checking before inserting.';
COMMENT ON COLUMN monthly_status_queue.customer_id IS 'The customer to send monthly status notification to';
COMMENT ON COLUMN monthly_status_queue.status IS 'Queue item status: pending (ready to process), processing (currently being processed), completed (sent successfully), failed (max attempts reached)';

-- Enable RLS
ALTER TABLE monthly_status_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON monthly_status_queue FOR ALL TO service_role USING (true);

