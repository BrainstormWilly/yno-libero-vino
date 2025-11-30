-- ============================================
-- Schedule Monthly Status Notifications Cron Job
-- ============================================
-- Runs on the 1st of each month at 9:00 AM UTC
-- This queues monthly status notification jobs for all active club members
-- The actual sending is handled by the queue processor cron job

-- Schedule queue job: Runs on the 1st of each month at 9:00 AM UTC
-- Queues monthly status notification jobs for all active club members
-- Jobs are processed by the monthly-status-queue-processor cron job (runs every 5 minutes)
SELECT cron.schedule(
  'queue-monthly-status-jobs',
  '0 9 1 * *',  -- 9:00 AM UTC on the 1st of each month
  $$
  SELECT queue_monthly_status_jobs();
  $$
);

