# Production Setup Guide

## Database Configuration

### API Base URL for Queue Processors

The following Postgres cron functions make HTTP calls to your application to process queue items:
- `process_monthly_status_queue()`
- `process_expiration_warning_queue()` 
- `process_crm_sync_queue()`

These functions default to a static Ngrok URL (`https://c7-kindly-balanced-macaw.ngrok-free.app`) for local development. **You MUST configure the production URL** or the queue processors will call the dev environment.

### Set Production URL

Run this SQL command in your production database:

```sql
-- Set the production API base URL (overrides the Ngrok dev default)
ALTER DATABASE postgres SET app.api_base_url = 'https://your-production-domain.com';

-- Verify it's set
SHOW app.api_base_url;

-- Or use the helper function
SELECT check_api_base_url();
```

### Alternative: Supabase Dashboard

1. Go to Supabase Dashboard → Database → Settings
2. Scroll to "Custom Postgres Configuration"
3. Add: `app.api_base_url` = `https://your-production-domain.com`
4. Restart the database

## Environment Variables

Ensure these environment variables are set in production:

### Required
- `DATABASE_URL` - Supabase connection string
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `SESSION_SECRET` - Secret for encrypting sessions
- `COMMERCE7_API_KEY` - Commerce7 API credentials
- `COMMERCE7_API_SECRET` - Commerce7 API credentials

### Optional (Email Providers)
- `KLAVIYO_PRIVATE_KEY` - For Klaviyo email notifications
- `MAILCHIMP_API_KEY` - For Mailchimp email notifications
- `SENDGRID_API_KEY` - For SendGrid email notifications

### Commerce7 Specific
- `COMMERCE7_API_USER` - Email used for API calls (default: `bill@ynoguy.com`)
  - Used to identify and block self-triggered webhooks

## Cron Jobs Setup

The following Postgres cron jobs should be configured in Supabase:

### Daily Expiration Check
```sql
-- Process expired enrollments daily at 2 AM
SELECT cron.schedule(
  'process-expired-enrollments',
  '0 2 * * *',  -- 2 AM daily
  'SELECT process_expired_enrollments();'
);
```

### Daily Expiration Warnings
```sql
-- Queue expiration warnings daily at 10 AM
SELECT cron.schedule(
  'queue-expiration-warnings',
  '0 10 * * *',  -- 10 AM daily
  'SELECT queue_expiration_warning_jobs();'
);

-- Process expiration warning queue every 10 minutes
SELECT cron.schedule(
  'process-expiration-warnings',
  '*/10 * * * *',  -- Every 10 minutes
  'SELECT process_expiration_warning_queue();'
);
```

### Monthly Status Notifications
```sql
-- Queue monthly status jobs on 1st of month at 9 AM
SELECT cron.schedule(
  'queue-monthly-status',
  '0 9 1 * *',  -- 9 AM on 1st of month
  'SELECT queue_monthly_status_jobs();'
);

-- Process monthly status queue every 10 minutes
SELECT cron.schedule(
  'process-monthly-status',
  '*/10 * * * *',  -- Every 10 minutes
  'SELECT process_monthly_status_queue();'
);
```

### CRM Sync Queue
```sql
-- Process CRM sync queue every 5 minutes
SELECT cron.schedule(
  'process-crm-sync',
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT process_crm_sync_queue();'
);
```

## Webhook Configuration

### Commerce7 Webhooks

Configure these webhooks in your Commerce7 admin panel to point to your production domain:

**Webhook URL**: `https://your-production-domain.com/webhooks/c7`

**Topics to subscribe:**
- `customers/update` - Customer profile changes
- `club/update` - Club configuration changes
- `club/delete` - Club deletion
- `club-membership/create` - New memberships created in C7
- `club-membership/update` - Membership changes (upgrades, cancellations, tier changes)
- `club-membership/delete` - Membership deletions

**Authentication**: None required (handled via tenant validation and self-triggered blocking)

### Shopify Webhooks (if applicable)

Configure similar webhooks for Shopify installations pointing to:
`https://your-production-domain.com/webhooks/shopify`

## Security Checklist

- [ ] Set production `app.api_base_url` in database
- [ ] Set `SESSION_SECRET` to a strong random value
- [ ] Set `COMMERCE7_API_USER` to identify self-triggered webhooks
- [ ] Configure all environment variables
- [ ] Set up all cron jobs
- [ ] Configure webhooks in Commerce7
- [ ] Test webhook delivery from Commerce7
- [ ] Test queue processing with real data
- [ ] Monitor error logs for first 24 hours

## Testing Production Setup

### Test Queue Processing
```sql
-- Manually trigger queue processing to test
SELECT * FROM process_monthly_status_queue();
SELECT * FROM process_expiration_warning_queue();
SELECT * FROM process_crm_sync_queue();
```

Check application logs to verify HTTP calls are reaching your production domain.

### Test Webhooks

In Commerce7 admin, make a test change (e.g., update a club member) and verify:
1. Webhook fires to your production domain
2. LiberoVino processes it successfully
3. Data syncs correctly in the database

## Monitoring

Monitor these areas in production:

### Queue Health
```sql
-- Check for failed jobs
SELECT 
  'monthly_status' as queue,
  status,
  COUNT(*) as count
FROM monthly_status_queue
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status;

-- Check for stuck/old pending jobs
SELECT COUNT(*) as stuck_jobs
FROM monthly_status_queue
WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '1 day';
```

### Cron Job Status
```sql
-- Check recent cron runs
SELECT 
  jobname,
  last_run,
  last_successful_run,
  status
FROM cron.job_run_details
WHERE runid > (SELECT MAX(runid) - 50 FROM cron.job_run_details);
```

## Troubleshooting

### Queue Processors Hanging

If queue processors are hanging or timing out:

1. Check `app.api_base_url` is set correctly
2. Verify your application is running and accessible at that URL
3. Check for network/firewall issues between Supabase and your app
4. Look for locked database queries: `SELECT * FROM pg_stat_activity WHERE state = 'active';`
5. Kill stuck processes if needed: `SELECT pg_terminate_backend(pid);`

### Self-Triggered Webhooks

If experiencing duplicate notifications or infinite loops:

1. Verify `COMMERCE7_API_USER` is set
2. Check webhook logs for `user` field matching your API user
3. Ensure blocking logic is working in `app/routes/webhooks.c7.tsx`

### Missing Webhook Events

If webhooks aren't being received:

1. Verify webhook URL in Commerce7 admin
2. Check Commerce7 webhook delivery logs
3. Test with `curl` to your webhook endpoint
4. Check application logs for errors
5. Verify tenant validation is working

