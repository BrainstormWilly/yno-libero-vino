-- Schedule expiration processing to run daily at 2 AM UTC
SELECT cron.schedule(
  'process-expired-enrollments',
  '0 2 * * *', -- Daily at 2:00 AM UTC
  $$
  SELECT process_expired_enrollments();
  $$
);

