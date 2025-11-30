-- ============================================
-- Schedule Expiration Warning Cron Jobs
-- ============================================
-- 1. Queue job: Runs daily at 10:00 AM UTC to queue expiration warnings
-- 2. Processor job: Runs every 5 minutes to process the queue

-- Queue expiration warning jobs (runs daily at 10 AM)
SELECT cron.schedule(
  'queue-expiration-warning-jobs',
  '0 10 * * *',  -- Daily at 10:00 AM UTC
  $$
  SELECT queue_expiration_warning_jobs();
  $$
);

-- Process expiration warning queue (runs every 5 minutes)
-- Processes up to 50 jobs per run
SELECT cron.schedule(
  'process-expiration-warning-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT process_expiration_warning_queue();
  $$
);

