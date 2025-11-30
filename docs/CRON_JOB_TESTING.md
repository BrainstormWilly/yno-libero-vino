# Cron Job Testing Guide

> **How to test the expiration processing cron job**

---

## Overview

The expiration processing cron job runs daily at 2 AM UTC to:
1. Find all active enrollments where `expires_at < NOW()`
2. Mark enrollments as 'expired'
3. Update customer flags (`is_club_member`, `loyalty_earning_active`) if no other active enrollments exist
4. Queue CRM sync operations to remove customers from discount eligibility

---

## Local Testing (Supabase CLI)

### 1. Apply the Migrations

```bash
# If using Supabase CLI locally
npx supabase db reset
# or
npx supabase migration up
```

### 2. Create Test Data

First, find an existing enrollment or create test data:

```sql
-- Option A: Use an existing enrollment and modify it
-- Find an active enrollment
SELECT ce.id, ce.customer_id, ce.expires_at, ce.status, c.email
FROM club_enrollments ce
INNER JOIN customers c ON ce.customer_id = c.id
WHERE ce.status = 'active'
LIMIT 5;

-- Set one to expire in the past (for testing)
UPDATE club_enrollments 
SET expires_at = NOW() - INTERVAL '1 day'
WHERE id = '<enrollment-id-from-above>';
```

### 3. Run the Test Function Manually

```sql
-- Call the test function
SELECT * FROM test_process_expired_enrollments();
```

**Expected output:**
```
 processed_count | error_count 
-----------------+-------------
               1 |           0
```

### 4. Verify the Results

```sql
-- Check that enrollment status changed to 'expired'
SELECT id, status, expires_at, updated_at
FROM club_enrollments
WHERE id = '<enrollment-id>';

-- Check customer flags (if no other active enrollments)
SELECT id, email, is_club_member, loyalty_earning_active
FROM customers
WHERE id = '<customer-id>';

-- Check CRM sync queue (if enrollment was synced to CRM)
SELECT id, action_type, status, customer_crm_id
FROM crm_sync_queue
WHERE enrollment_id = '<enrollment-id>';
```

### 5. Test Edge Cases

```sql
-- Test with customer who has multiple enrollments
-- (one expired, one still active - customer flags should NOT change)
-- Create another active enrollment for the same customer first
-- Then expire one and verify is_club_member stays true

-- Test with enrollment that wasn't synced to CRM
-- (should not create CRM sync queue entry)
```

---

## Complete Test Script

Here's a complete test you can run:

```sql
-- Step 1: Find or create test enrollment
-- (Use an existing one or create test data)

-- Step 2: Make it expired
UPDATE club_enrollments 
SET expires_at = NOW() - INTERVAL '1 day',
    status = 'active'  -- Ensure it's active first
WHERE id = '<your-test-enrollment-id>';

-- Step 3: Run the function
SELECT * FROM test_process_expired_enrollments();

-- Step 4: Verify
SELECT 
  ce.id,
  ce.status,
  ce.expires_at,
  c.is_club_member,
  c.loyalty_earning_active,
  (SELECT COUNT(*) FROM crm_sync_queue WHERE enrollment_id = ce.id) as sync_queue_count
FROM club_enrollments ce
INNER JOIN customers c ON ce.customer_id = c.id
WHERE ce.id = '<your-test-enrollment-id>';
```

---

## Expected Results

After running the test function, you should see:

✅ **Enrollment Status:**
- `status` should be `'expired'`
- `updated_at` should be recent timestamp

✅ **Customer Flags** (if customer has no other active enrollments):
- `is_club_member` should be `false`
- `loyalty_earning_active` should be `false`

✅ **CRM Sync Queue** (if enrollment was synced to CRM):
- A row should exist in `crm_sync_queue` with:
  - `action_type = 'cancel_membership'`
  - `status = 'pending'`
  - `enrollment_id` matching the expired enrollment

---

## Production Testing

### 1. Check Cron Job Status

```sql
-- View all cron jobs
SELECT * FROM cron.job 
WHERE jobname = 'process-expired-enrollments';
```

### 2. View Cron Job History

```sql
-- See recent execution history
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid 
  FROM cron.job 
  WHERE jobname = 'process-expired-enrollments'
)
ORDER BY start_time DESC 
LIMIT 10;
```

### 3. Monitor Logs

- Check **Supabase Dashboard → Logs → Postgres Logs**
- Look for any warnings or errors from the function
- Verify `processed_count` and `error_count` in the results

### 4. Test the Scheduled Execution

```sql
-- Manually trigger the cron job (if needed for testing)
SELECT cron.schedule('process-expired-enrollments', '0 2 * * *', 
  $$SELECT process_expired_enrollments();$$);

-- Or just run the function directly
SELECT * FROM process_expired_enrollments();
```

---

## Testing Scenarios

### Scenario 1: Single Enrollment Expiration

**Setup:**
- Customer has one active enrollment
- Enrollment expires

**Expected:**
- Enrollment status → `'expired'`
- Customer `is_club_member` → `false`
- Customer `loyalty_earning_active` → `false`
- CRM sync queued (if synced)

### Scenario 2: Multiple Enrollments (One Expires)

**Setup:**
- Customer has two active enrollments
- One enrollment expires

**Expected:**
- Expired enrollment status → `'expired'`
- Customer `is_club_member` → `true` (still has active enrollment)
- Customer `loyalty_earning_active` → `true` (still has active enrollment)
- CRM sync queued for expired enrollment only

### Scenario 3: Enrollment Not Synced to CRM

**Setup:**
- Enrollment with `synced_to_crm = false`
- Enrollment expires

**Expected:**
- Enrollment status → `'expired'`
- Customer flags updated (if no other active enrollments)
- **No** CRM sync queue entry created

### Scenario 4: Batch Processing

**Setup:**
- Multiple enrollments expire on the same day

**Expected:**
- All expired enrollments processed in single run
- `processed_count` matches number of expired enrollments
- All customer flags updated correctly
- All CRM syncs queued

---

## Troubleshooting

### Issue: Function Returns Errors

**Check:**
- All required tables exist (`club_enrollments`, `customers`, `club_stages`, `crm_sync_queue`)
- Enrollment has valid `customer_id` and `club_stage_id`
- Check Postgres logs for detailed error messages

**Solution:**
```sql
-- Verify table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'club_enrollments';

-- Check for orphaned records
SELECT ce.id, ce.customer_id, ce.club_stage_id
FROM club_enrollments ce
LEFT JOIN customers c ON ce.customer_id = c.id
LEFT JOIN club_stages cs ON ce.club_stage_id = cs.id
WHERE c.id IS NULL OR cs.id IS NULL;
```

### Issue: Cron Job Doesn't Run

**Check:**
- `pg_cron` extension is enabled:
  ```sql
  SELECT * FROM pg_extension WHERE extname = 'pg_cron';
  ```
- Supabase Pro plan (pg_cron requires Pro)
- Schedule syntax is correct:
  ```sql
  SELECT * FROM cron.job WHERE jobname = 'process-expired-enrollments';
  ```

**Solution:**
```sql
-- Re-enable extension if needed
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Re-schedule the job
SELECT cron.unschedule('process-expired-enrollments');
SELECT cron.schedule(
  'process-expired-enrollments',
  '0 2 * * *',
  $$SELECT process_expired_enrollments();$$
);
```

### Issue: Customer Flags Not Updating

**Check:**
- Customer has other active enrollments:
  ```sql
  SELECT COUNT(*) 
  FROM club_enrollments 
  WHERE customer_id = '<customer-id>' 
    AND status = 'active';
  ```

**Expected Behavior:**
- If count > 0: Flags should remain `true`
- If count = 0: Flags should be set to `false`

### Issue: CRM Sync Queue Not Created

**Check:**
- Enrollment was synced to CRM:
  ```sql
  SELECT synced_to_crm, crm_discount_id 
  FROM club_enrollments 
  WHERE id = '<enrollment-id>';
  ```
- Customer has CRM ID:
  ```sql
  SELECT crm_id 
  FROM customers 
  WHERE id = '<customer-id>';
  ```

**Expected Behavior:**
- Queue entry only created if:
  - `synced_to_crm = true`
  - `crm_discount_id IS NOT NULL`
  - `crm_id IS NOT NULL`

---

## Performance Testing

### Test with Large Dataset

```sql
-- Create multiple expired enrollments
UPDATE club_enrollments 
SET expires_at = NOW() - INTERVAL '1 day',
    status = 'active'
WHERE id IN (
  SELECT id FROM club_enrollments 
  WHERE status = 'active' 
  LIMIT 100
);

-- Run function and measure time
\timing on
SELECT * FROM test_process_expired_enrollments();
\timing off
```

### Monitor Query Performance

```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT ce.id, ce.customer_id, ce.club_stage_id
FROM club_enrollments ce
INNER JOIN club_stages cs ON ce.club_stage_id = cs.id
INNER JOIN customers c ON ce.customer_id = c.id
WHERE ce.status = 'active'
  AND ce.expires_at < NOW();
```

---

## Verification Checklist

After testing, verify:

- [ ] Function executes without errors
- [ ] Expired enrollments are marked as `'expired'`
- [ ] Customer flags update correctly based on active enrollment count
- [ ] CRM sync queue entries are created for synced enrollments
- [ ] No duplicate queue entries are created
- [ ] Function is idempotent (can be run multiple times safely)
- [ ] Cron job is scheduled correctly
- [ ] Cron job history shows successful runs
- [ ] Performance is acceptable for expected volume

---

## Related Documentation

- **Migration Files:**
  - `017_enable_pg_cron.sql` - Extension setup
  - `018_process_expired_enrollments.sql` - Main function
  - `019_schedule_expiration_cron.sql` - Cron scheduling
  - `020_create_test_expiration_function.sql` - Test function
  - `021_add_expiration_indexes.sql` - Performance indexes

- **Other Docs:**
  - `DEVELOPMENT_TESTING.md` - General development testing
  - `CRM_SYNC_STRATEGY.md` - CRM sync queue details

---

*Last updated: After migration 021*

