# CRM Sync Cron Implementation with pg_net

## Overview

This document describes the implementation of the CRM sync queue processor using pg_net to call CRM APIs. The system processes expired enrollments (via cron) and syncs tier membership changes to Commerce7/Shopify.

**Important:** Cron jobs only handle membership **cancellations** (expirations). New memberships and upgrades come from **order webhooks** when customers make qualifying purchases.

## Architecture

### Flow
1. **Expiration Cron Job** (runs daily at 2 AM UTC)
   - Finds expired enrollments
   - Marks them as expired in database
   - Updates customer flags
   - **Queues membership cancellations** to `crm_sync_queue` table
   - **Note:** Cron jobs only handle cancellations. New memberships come from order webhooks.

2. **Sync Queue Processor** (runs every 5 minutes)
   - Processes pending sync queue items
   - Uses `pg_net` to call our API endpoint `/api/cron/sync`
   - API endpoint handles actual CRM API calls (has access to env vars)
   - Updates queue status (completed/failed)

3. **API Endpoint** (`/api/cron/sync`)
   - Receives sync requests from pg_net
   - Gets CRM credentials from database/environment
   - Calls CRM provider methods (`addTierMembership`, `cancelTierMembership`)
   - Returns success/error status

### Membership Operations

- **`add_membership`** - Created from order webhooks when customer enrolls in a tier
- **`cancel_membership`** - Created from cron job when membership expires
- **`upgrade_membership`** - Created from order webhooks when customer qualifies for higher tier

## Migrations Created

### 023_enable_pg_net.sql
- Enables the `pg_net` extension for making HTTP requests from PostgreSQL

### 024_process_crm_sync_queue.sql
- Creates `process_crm_sync_queue()` function
- Processes pending queue items
- Uses pg_net to call `/api/cron/sync` endpoint
- Handles retry logic with exponential backoff
- Returns counts of processed/succeeded/failed jobs

### 025_schedule_sync_queue_cron.sql
- Schedules sync queue processor to run every 5 minutes

### 026_update_sync_queue_action_types.sql
- Updates action_type values to use membership terminology
- Changes: `add_customer` → `add_membership`, `remove_customer` → `cancel_membership`, `upgrade_customer` → `upgrade_membership`

## API Routes Created

### `/api/cron` (GET/POST)
- **GET**: Check cron job status and execution history
- **POST**: Manually trigger cron jobs
  - `action=trigger` - Run expiration processor
  - `action=test` - Run test expiration function
  - `action=sync` - Run sync queue processor

### `/api/cron/sync` (POST)
- Called by pg_net from database function
- Processes individual sync queue items
- Validates request body
- Gets CRM provider instance
- Executes sync action (add/cancel/upgrade membership)
- Returns success/error status

## Database Functions

### `process_expired_enrollments()`
- Finds active enrollments where `expires_at < NOW()`
- Marks as expired
- Updates customer flags if no other active enrollments
- Queues membership cancellations (`cancel_membership` action)
- **Note:** This is the only cron job that creates sync queue items. New memberships come from order webhooks.

### `process_crm_sync_queue()`
- Processes up to 50 pending sync jobs
- Calls `/api/cron/sync` via pg_net
- Handles errors with exponential backoff
- Returns processing statistics

## Configuration

### API Base URL
Set the API base URL for pg_net to call:
```sql
ALTER DATABASE postgres SET app.api_base_url = 'https://your-production-url.com';
```

Or for a specific session:
```sql
SET app.api_base_url = 'https://your-production-url.com';
```

Default: `http://localhost:5173` (for local development)

### Environment Variables Required
- `COMMERCE7_KEY` - Commerce7 API key (for API endpoint)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

## Testing

### Manual Trigger via API
```bash
# Trigger expiration processor
curl -X POST http://localhost:5173/api/cron \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=trigger&job=process-expired-enrollments"

# Trigger sync queue processor
curl -X POST http://localhost:5173/api/cron \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "action=sync"
```

### Test Database Function Directly
```sql
-- Test expiration processor
SELECT * FROM test_process_expired_enrollments();

-- Test sync queue processor
SELECT * FROM process_crm_sync_queue();
```

### Check Queue Status
```sql
-- View pending sync jobs
SELECT 
  id,
  action_type,
  status,
  attempts,
  error_message,
  created_at,
  next_retry_at
FROM crm_sync_queue
WHERE status = 'pending'
ORDER BY created_at ASC;
```

## Error Handling

### Exponential Backoff
- Failed syncs are retried with exponential backoff
- Formula: `next_retry_at = NOW() + (2^attempts) minutes`
- Max attempts: 5 (configurable per queue item)

### Queue Status Values
- `pending` - Waiting to be processed
- `processing` - Currently being processed
- `completed` - Successfully processed
- `failed` - Failed after max attempts

### Action Types
- `add_membership` - Add customer to tier (from order webhooks)
- `cancel_membership` - Cancel tier membership (from cron expirations)
- `upgrade_membership` - Upgrade to higher tier (from order webhooks)

## Monitoring

### Check Cron Job Status
```sql
-- View cron job schedule
SELECT * FROM cron.job 
WHERE jobname IN ('process-expired-enrollments', 'process-crm-sync-queue');

-- View recent execution history
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname IN ('process-expired-enrollments', 'process-crm-sync-queue')
)
ORDER BY start_time DESC 
LIMIT 20;
```

### Queue Metrics
```sql
-- Count by status
SELECT status, COUNT(*) 
FROM crm_sync_queue 
GROUP BY status;

-- Count by action type
SELECT action_type, COUNT(*) 
FROM crm_sync_queue 
GROUP BY action_type;

-- Recent errors
SELECT 
  id,
  action_type,
  error_message,
  attempts,
  created_at
FROM crm_sync_queue
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

## When Each Operation Happens

### Cancellations (Cron Jobs)
- **When:** Daily at 2 AM UTC
- **Trigger:** Membership expiration (`expires_at < NOW()`)
- **Action:** `cancel_membership`
- **Created by:** `process_expired_enrollments()` function

### New Memberships (Webhooks)
- **When:** Customer makes qualifying purchase
- **Trigger:** Order webhook from CRM
- **Action:** `add_membership`
- **Created by:** Order webhook processing logic

### Upgrades (Webhooks)
- **When:** Customer makes larger purchase qualifying for higher tier
- **Trigger:** Order webhook from CRM
- **Action:** `upgrade_membership`
- **Created by:** Order webhook processing logic

## Next Steps

1. **Implement CRM Provider Methods**
   - Complete `addTierMembership()` for Commerce7
   - Complete `cancelTierMembership()` for Commerce7
   - Implement Shopify equivalents

2. **Add Authentication**
   - Secure `/api/cron/sync` endpoint (currently allows any request)
   - Add API key or token validation

3. **Improve Error Handling**
   - Add detailed error logging
   - Create error alerting system
   - Monitor queue growth

4. **Performance Optimization**
   - Batch processing improvements
   - Parallel processing for multiple jobs
   - Queue prioritization

## Notes

- pg_net is async, so the function waits for responses (using `pg_sleep` and immediate collection)
- For production, consider using Supabase Edge Functions instead of direct API calls
- API credentials are kept secure by using environment variables in the API endpoint
- The sync endpoint can be called directly by pg_net without authentication (should be secured in production)
- Cron jobs only create `cancel_membership` actions. All `add_membership` and `upgrade_membership` actions come from order webhooks.
