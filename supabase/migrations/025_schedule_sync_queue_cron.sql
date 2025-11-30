-- Schedule CRM sync queue processor to run every 5 minutes
SELECT cron.schedule(
  'process-crm-sync-queue',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT process_crm_sync_queue();
  $$
);

-- Note: The cron job will call process_crm_sync_queue() which uses pg_net
-- to call our API endpoint at /api/cron/sync for processing

