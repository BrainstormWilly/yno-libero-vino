-- ============================================
-- Schedule Monthly Status Queue Processor Cron Job
-- ============================================
-- Runs every 5 minutes to process the monthly status queue
-- Similar to the CRM sync queue processor

SELECT cron.schedule(
  'process-monthly-status-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT process_monthly_status_queue();
  $$
);

-- Note: This cron job processes monthly status notification queue items every 5 minutes. Processes up to 50 jobs per run.

