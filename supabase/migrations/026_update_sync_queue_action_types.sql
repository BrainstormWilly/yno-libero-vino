-- Update crm_sync_queue action_type values to use membership terminology
-- Old: 'add_customer', 'remove_customer', 'upgrade_customer'
-- New: 'add_membership', 'cancel_membership', 'upgrade_membership'

-- Drop the old constraint FIRST to allow data updates
ALTER TABLE crm_sync_queue 
DROP CONSTRAINT IF EXISTS crm_sync_queue_action_type_check;

-- Update existing data (if any) - now that constraint is dropped
UPDATE crm_sync_queue
SET action_type = CASE
  WHEN action_type = 'add_customer' THEN 'add_membership'
  WHEN action_type = 'remove_customer' THEN 'cancel_membership'
  WHEN action_type = 'upgrade_customer' THEN 'upgrade_membership'
  ELSE action_type
END
WHERE action_type IN ('add_customer', 'remove_customer', 'upgrade_customer');

-- Add new constraint with membership terminology
ALTER TABLE crm_sync_queue
ADD CONSTRAINT crm_sync_queue_action_type_check 
CHECK (action_type IN ('add_membership', 'cancel_membership', 'upgrade_membership'));

COMMENT ON COLUMN crm_sync_queue.action_type IS 'Membership operation type. cancel_membership (from cron expirations) and upgrade_membership (from background webhooks) are queued. add_membership is never queued - happens in UI and must succeed immediately.';

