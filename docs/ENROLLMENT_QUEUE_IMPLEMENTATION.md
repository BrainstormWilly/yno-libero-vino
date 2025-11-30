# Enrollment Queue Implementation

## Summary

Implemented queue support for enrollment endpoints so that CRM sync failures don't block enrollments. Enrollments now complete successfully even if CRM sync fails, and failed syncs are automatically queued for retry.

## Changes Made

### 1. Database Helper Function

**File**: `app/lib/db/supabase.server.ts`

Added `queueCrmSync()` helper function to insert queue entries:

```typescript
export async function queueCrmSync(data: {
  clientId: string;
  enrollmentId?: string | null;
  actionType: 'add_membership' | 'cancel_membership' | 'upgrade_membership';
  stageId: string;
  oldStageId?: string | null;
  customerCrmId: string;
})
```

### 2. Enrollment Endpoint Update

**File**: `app/routes/app.members.new_.review.tsx`

**Key Changes**:
- **Enrollment created first**: Enrollment record is now created in our database BEFORE attempting CRM sync
- **Non-blocking CRM sync**: CRM sync happens in a try/catch block that doesn't fail the enrollment
- **Automatic queueing**: If CRM sync fails, it's automatically queued for retry
- **Shopify support**: Shopify enrollments are always queued (since they require promotion lookups)

**Flow**:
1. Create customer in LV database (if needed)
2. Create enrollment record in LV database (source of truth)
3. Try CRM sync:
   - **Commerce7**: Attempt to create club membership directly
   - **Shopify**: Queue for async processing (promotions lookup needed)
4. If CRM sync succeeds: Update enrollment with membership ID
5. If CRM sync fails: Queue for retry, but enrollment already succeeded

### 3. Error Handling

- Enrollments **never fail** due to CRM sync errors
- CRM sync errors are logged but don't block enrollment completion
- Failed syncs are automatically queued for retry by the cron job processor
- Users see successful enrollment even if CRM sync is pending

## Benefits

### ✅ Resilience
- Enrollments complete even if CRM is temporarily down
- No customer-facing errors due to CRM sync issues
- Automatic retry mechanism handles transient failures

### ✅ Performance
- Enrollment response is faster (doesn't wait for CRM sync in all cases)
- Shopify enrollments are queued by default (no blocking lookup)

### ✅ Reliability
- Source of truth (our database) is updated immediately
- CRM sync happens asynchronously via queue
- Queue processor handles retries with exponential backoff

## Queue Processing

Queue entries are automatically processed by:
- **Cron job**: Runs every 5 minutes (`process_crm_sync_queue()` function)
- **API endpoint**: `/api/cron/sync` (called by pg_net from database)
- **Retry logic**: Exponential backoff, max 5 attempts

## What Gets Queued

1. **Failed Commerce7 syncs**: If `createClubMembership()` fails
2. **All Shopify syncs**: Always queued (requires promotion lookups)
3. **Cancellations**: From expiration cron job (already implemented)
4. **Upgrades**: From order webhooks (when implemented)

## Testing

To verify queue implementation:

1. **Successful enrollment**: Should create enrollment and optionally sync to CRM
2. **Failed CRM sync**: Should create enrollment AND queue entry
3. **Queue processing**: Check `crm_sync_queue` table for pending items
4. **Retry logic**: Verify queue items are retried after failures

## Next Steps

- [ ] Implement webhook handlers to queue upgrade operations
- [ ] Add admin UI to view/manually retry queue items
- [ ] Monitor queue processing for failures
- [ ] Add alerting for permanently failed queue items

