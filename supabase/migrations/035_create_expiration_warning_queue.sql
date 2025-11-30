-- ============================================
-- Expiration Warning Queue Table
-- ============================================
-- Queue for processing expiration warning notifications
-- Similar to monthly_status_queue, but for expiration warnings
-- Sent X days (default 7) before membership expires

CREATE TABLE IF NOT EXISTS expiration_warning_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  enrollment_id UUID NOT NULL REFERENCES club_enrollments(id) ON DELETE CASCADE,
  
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

-- Note: Deduplication is handled by the queue_expiration_warning_jobs() function
-- which checks for existing warnings in the same month before inserting.
-- This prevents duplicates while avoiding immutability issues with DATE_TRUNC.

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expiration_warning_queue_status ON expiration_warning_queue(status);
CREATE INDEX IF NOT EXISTS idx_expiration_warning_queue_next_retry ON expiration_warning_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_expiration_warning_queue_client_id ON expiration_warning_queue(client_id);
CREATE INDEX IF NOT EXISTS idx_expiration_warning_queue_customer_id ON expiration_warning_queue(customer_id);
CREATE INDEX IF NOT EXISTS idx_expiration_warning_queue_enrollment_id ON expiration_warning_queue(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_expiration_warning_queue_created_at ON expiration_warning_queue(created_at);

COMMENT ON TABLE expiration_warning_queue IS 'Queue for processing expiration warning notifications. Jobs are created by the daily cron and processed by a worker that runs periodically. The queue_expiration_warning_jobs() function prevents duplicate expiration warnings for the same enrollment in the same month by checking before inserting.';
COMMENT ON COLUMN expiration_warning_queue.customer_id IS 'The customer to send expiration warning notification to';
COMMENT ON COLUMN expiration_warning_queue.enrollment_id IS 'The enrollment that is expiring';
COMMENT ON COLUMN expiration_warning_queue.status IS 'Queue item status: pending (ready to process), processing (currently being processed), completed (sent successfully), failed (max attempts reached)';

-- Enable RLS
ALTER TABLE expiration_warning_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON expiration_warning_queue FOR ALL TO service_role USING (true);

