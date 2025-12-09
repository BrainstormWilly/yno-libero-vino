# LiberoVino Integrated Test Plan

> **Comprehensive testing guide covering all system functionality**

---

## Testing Philosophy

This test plan prioritizes **real-world testing** using actual Commerce7 admin actions and the LiberoVino embedded app UI. We test with real payloads from Commerce7 whenever possible, and use programmatic testing (curl, SQL) for edge cases, error scenarios, and background processes.

### Testing Methods

1. **Real-World Testing (Primary)**
   - **Commerce7 Admin Actions:** Perform actual actions in Commerce7 admin to trigger real webhooks
   - **LiberoVino Embedded App:** Test UI flows in the embedded app (enrollment, setup wizard, etc.)
   - **Verification:** Check database, server logs, and communications

2. **Programmatic Testing (Secondary)**
   - **curl commands:** Test edge cases, error scenarios, payload variations
   - **SQL queries:** Trigger cron jobs manually, verify database state
   - **API endpoints:** Test validation, authentication, error handling

### What Gets Tested Where

| Component | Testing Method | Primary Location |
|-----------|---------------|------------------|
| **Webhooks** | Real C7 admin actions → Verify payloads | Commerce7 Admin |
| **Webhook Edge Cases** | curl with variations | Command line |
| **Embedded App UI** | User interactions | LiberoVino App (embedded in C7) |
| **Cron Jobs** | Manual SQL triggers | Database |
| **CRM Sync Queue** | Manual API calls | API endpoints |
| **Communications** | Verify in provider dashboards | Email/SMS providers |
| **API Endpoints** | curl/API calls | Command line |

---

## Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [Webhook Testing](#webhook-testing)
3. [CRM Sync Queue Testing](#crm-sync-queue-testing)
4. [Cron Job Testing](#cron-job-testing)
5. [Member Enrollment Testing](#member-enrollment-testing)
6. [Tier Upgrade Testing](#tier-upgrade-testing)
7. [Communication Testing](#communication-testing)
8. [Setup Wizard Testing](#setup-wizard-testing)
9. [API Endpoint Testing](#api-endpoint-testing)
10. [Integration Test Scenarios](#integration-test-scenarios)
11. [End-to-End Test Flows](#end-to-end-test-flows)
12. [Performance Testing](#performance-testing)
13. [Security Testing](#security-testing)
14. [Test Checklist](#test-checklist)

---

## Test Environment Setup

### Prerequisites

```bash
# Environment Variables Required
NODE_ENV=development
IN_COMMERCE7=no  # For C7-only admin bypass and UI design testing (not for webhook testing)
COMMERCE7_WEBHOOK_PASSWORD=your_test_password
COMMERCE7_KEY=your_test_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Required for all C7 and Shopify admin testing (webhooks need to be received)
NGROK_URL=your-ngrok-domain.ngrok-free.app
```

### Test Constants (UUIDs for Reuse)

**Copy these UUID constants for use in all test commands/queries. These IDs cascade across all tests.**

**Note:** These are literal UUID values. Copy and paste them directly into SQL queries, curl commands, and test scenarios.

#### LiberoVino Internal IDs (UUID format)

```
Test Client ID:      00000000-0000-0000-0000-000000000001
Test Program ID:     00000000-0000-0000-0000-000000000002
Test Customer ID:    00000000-0000-0000-0000-000000000010
Test Enrollment ID:  00000000-0000-0000-0000-000000000020
Bronze Enrollment:   00000000-0000-0000-0000-000000000021
Silver Enrollment:   00000000-0000-0000-0000-000000000022

Bronze Stage ID:     00000000-0000-0000-0000-000000000101
Silver Stage ID:     00000000-0000-0000-0000-000000000102
Gold Stage ID:       00000000-0000-0000-0000-000000000103

Queue Item ID:       00000000-0000-0000-0000-000000000201
Monthly Status Q:    00000000-0000-0000-0000-000000000211
Exp Warning Q:       00000000-0000-0000-0000-000000000221
```

#### Commerce7 IDs (UUID format as used by C7)

```
C7 Bronze Club ID:   11111111-1111-1111-1111-111111111101
C7 Silver Club ID:   11111111-1111-1111-1111-111111111102
C7 Gold Club ID:     11111111-1111-1111-1111-111111111103
C7 Deleted Club:     11111111-1111-1111-1111-111111111199

C7 Customer ID:      22222222-2222-2222-2222-222222222201

C7 Membership ID:    33333333-3333-3333-3333-333333333301
C7 Bronze Membership: 33333333-3333-3333-3333-333333333301
C7 Silver Membership: 33333333-3333-3333-3333-333333333302
C7 Deleted Membership: 33333333-3333-3333-3333-333333333399

C7 Tenant ID:        test-tenant  (String, not UUID)
```

**Quick Reference Table:**

| Entity | UUID Value |
|--------|-----------|
| Test Client | `00000000-0000-0000-0000-000000000001` |
| Test Program | `00000000-0000-0000-0000-000000000002` |
| Test Customer | `00000000-0000-0000-0000-000000000010` |
| Bronze Stage | `00000000-0000-0000-0000-000000000101` |
| Silver Stage | `00000000-0000-0000-0000-000000000102` |
| Gold Stage | `00000000-0000-0000-0000-000000000103` |
| C7 Bronze Club | `11111111-1111-1111-1111-111111111101` |
| C7 Customer | `22222222-2222-2222-2222-222222222201` |
| C7 Membership | `33333333-3333-3333-3333-333333333301` |

**Usage:**
- Copy UUID values directly into SQL queries
- Use in curl command JSON payloads
- Replace placeholders in test verification queries
- All tests cascade using these same IDs

### Database Setup

**Note:** Use the UUID constants defined above. Replace them directly in SQL queries.

```sql
-- Create test client
INSERT INTO clients (id, tenant_shop, crm_type, org_name, setup_complete)
VALUES ('00000000-0000-0000-0000-000000000001', 'test-tenant', 'commerce7', 'Test Winery', false);

-- Create test club program
INSERT INTO club_programs (id, client_id, name, description)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test Wine Club', 'Test Description');

-- Create test tiers
INSERT INTO club_stages (id, club_program_id, name, stage_order, duration_months, min_purchase_amount, min_ltv_amount, c7_club_id)
VALUES 
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', 'Bronze', 1, 3, 90.00, 0, '11111111-1111-1111-1111-111111111101'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', 'Silver', 2, 6, 180.00, 500.00, '11111111-1111-1111-1111-111111111102'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000002', 'Gold', 3, 12, 360.00, 1000.00, '11111111-1111-1111-1111-111111111103');
```

### Test Data Scripts

**Creating test customers, enrollments, and queue items:**

```sql
-- Create test customer
INSERT INTO customers (id, client_id, email, first_name, last_name, crm_id)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'test@example.com', 'Test', 'User', '22222222-2222-2222-2222-222222222201');

-- Create test enrollment (Bronze tier)
INSERT INTO club_enrollments (id, customer_id, club_stage_id, status, enrolled_at, expires_at, c7_membership_id)
VALUES ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000101', 'active', NOW(), NOW() + INTERVAL '3 months', '33333333-3333-3333-3333-333333333301');
```

**Note:** All IDs used here match the constants defined in the Test Constants section above. Use these same UUIDs throughout all test scenarios.

---

## Webhook Testing

### Commerce7 Webhook Configuration

**Prerequisites:**
1. Configure webhook URL in Commerce7 admin: `https://c7.yourdomain.com/webhooks/c7`
   - **Note:** For local testing, use Ngrok URL: `https://c7-your-ngrok-domain.ngrok-free.app/webhooks/c7`
2. Set Basic Auth credentials in Commerce7 webhook settings:
   - Username: `liberovino`
   - Password: `COMMERCE7_WEBHOOK_PASSWORD` (from your environment variables)
3. Enable webhooks for the following events in Commerce7:
   - Customer Update
   - Club Update
   - Club Delete
   - Club Membership Update
   - Club Membership Delete

---

### Real-World Webhook Testing (From Commerce7 Admin)

**Primary Testing Method:** Test each webhook by performing actual actions in Commerce7 admin interface. This ensures we receive real payloads with actual data structures.

#### Test 1: Customer Update Webhook

**Steps in Commerce7 Admin:**
1. Navigate to **Customers** → Select an existing customer
2. Edit customer information (e.g., change email, name, address)
3. Save changes

**Expected in LiberoVino:**
- ✅ Webhook received at `/webhooks/c7`
- ✅ Server logs show: `Processing Commerce7 webhook: customers/update`
- ✅ Customer record updated in database
- ✅ Related enrollments remain unchanged
- ✅ Response: `200 OK` with success message

**Verification:**
```sql
-- Check customer was updated
-- Replace '22222222-2222-2222-2222-222222222201' with actual C7 customer ID from webhook payload
SELECT id, email, first_name, last_name, updated_at 
FROM customers 
WHERE crm_id = '22222222-2222-2222-2222-222222222201';
-- updated_at should reflect recent timestamp
```

**What to Verify:**
- Customer email, name, address fields updated
- `updated_at` timestamp is recent
- No changes to related `club_enrollments`

---

#### Test 2: Club Update Webhook

**Steps in Commerce7 Admin:**
1. Navigate to **Clubs** → Select a club that corresponds to a tier in LiberoVino
2. Edit club settings (e.g., name, description, visibility)
3. Save changes

**Expected in LiberoVino:**
- ✅ Webhook received with `object: "Club"` and `action: "Update"`
- ✅ Server logs show: `Processing Commerce7 webhook: club/update`
- ✅ `club_stages` record updated (if club matches a tier via `c7_club_id`)
- ✅ Club stage name or settings updated if applicable

**Verification:**
```sql
-- Check club stage was updated
-- Replace '11111111-1111-1111-1111-111111111101' with actual C7 club ID from webhook payload
SELECT id, name, c7_club_id, updated_at 
FROM club_stages 
WHERE c7_club_id = '11111111-1111-1111-1111-111111111101';
```

**What to Verify:**
- Club stage `c7_club_id` matches webhook payload
- Any club-related fields are synced correctly

---

#### Test 3: Club Delete Webhook

**Steps in Commerce7 Admin:**
1. Navigate to **Clubs** → Select a club
2. Delete the club (ensure it has active memberships first)

**Expected in LiberoVino:**
- ✅ Webhook received with `object: "Club"` and `action: "Delete"`
- ✅ Server logs show: `Processing Commerce7 webhook: club/delete`
- ✅ All related `club_stages` marked as `is_active = false`
- ✅ All active enrollments for those stages marked as `status = 'expired'`
- ✅ Customer flags updated (`is_club_member = false`, `current_club_stage_id = null`)

**Verification:**
```sql
-- Check club stages marked inactive
-- Replace '11111111-1111-1111-1111-111111111199' with actual deleted C7 club ID from webhook payload
SELECT id, name, is_active, c7_club_id 
FROM club_stages 
WHERE c7_club_id = '11111111-1111-1111-1111-111111111199';
-- is_active should be false

-- Check enrollments expired
SELECT id, status, expires_at 
FROM club_enrollments 
WHERE club_stage_id IN (
  SELECT id FROM club_stages WHERE c7_club_id = '11111111-1111-1111-1111-111111111199'
);
-- All should have status = 'expired'

-- Check customer flags
SELECT id, email, is_club_member, current_club_stage_id 
FROM customers 
WHERE id IN (
  SELECT customer_id FROM club_enrollments 
  WHERE club_stage_id IN (
    SELECT id FROM club_stages WHERE c7_club_id = '11111111-1111-1111-1111-111111111199'
  )
);
-- is_club_member should be false, current_club_stage_id should be null
```

---

#### Test 4: Club Membership Update Webhook (Status Change)

**Steps in Commerce7 Admin:**
1. Navigate to **Club Members** (or **Clubs → [Select Club] → Members**)
2. Select a membership
3. Change membership status to **"Cancelled"** (or set a cancel date)
4. Save changes

**Expected in LiberoVino:**
- ✅ Webhook received with `object: "Club Membership"` and `action: "Update"`
- ✅ Server logs show: `Processing Commerce7 webhook: club-membership/update`
- ✅ Enrollment marked as `status = 'expired'` (if status changed to Cancelled)
- ✅ Expiration notification sent
- ✅ Customer flags updated if no other active enrollments

**Verification:**
```sql
-- Check enrollment expired
-- Replace '33333333-3333-3333-3333-333333333301' with actual C7 membership ID from webhook payload
SELECT id, status, expires_at, updated_at 
FROM club_enrollments 
WHERE c7_membership_id = '33333333-3333-3333-3333-333333333301';
-- status should be 'expired'
```

**Alternative Test: Update Cancel Date**
- Change cancel date instead of status
- Verify `expires_at` is updated to match cancel date

---

#### Test 5: Club Membership Delete Webhook

**Steps in Commerce7 Admin:**
1. Navigate to **Club Members** → Select a membership
2. Delete the membership

**Expected in LiberoVino:**
- ✅ Webhook received with `object: "Club Membership"` and `action: "Delete"`
- ✅ Server logs show: `Processing Commerce7 webhook: club-membership/delete`
- ✅ Enrollment record **deleted** from database
- ✅ Customer flags updated (`is_club_member = false`, `current_club_stage_id = null`)

**Verification:**
```sql
-- Check enrollment was deleted
-- Replace '33333333-3333-3333-3333-333333333399' with actual deleted C7 membership ID from webhook payload
SELECT * FROM club_enrollments 
WHERE c7_membership_id = '33333333-3333-3333-3333-333333333399';
-- Should return no rows

-- Check customer flags updated
-- Replace '00000000-0000-0000-0000-000000000010' with actual customer ID
SELECT id, email, is_club_member, current_club_stage_id 
FROM customers 
WHERE id = '00000000-0000-0000-0000-000000000010';
-- is_club_member should be false, current_club_stage_id should be null
```

---

### Webhook Endpoint Validation (curl Testing)

**Secondary Testing Method:** Use curl to test edge cases, error scenarios, and payload variations that may not occur naturally from Commerce7 admin.

#### Test 1: Basic Authentication Validation

**Test Valid Credentials:**
```bash
# Capture a real webhook payload from Commerce7 first, then test with curl
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'liberovino:your_test_password' | base64)" \
  -d '{
    "object": "Customer",
    "action": "Update",
    "payload": {
      "id": "22222222-2222-2222-2222-222222222201",
      "email": "test@example.com",
      "firstName": "Test",
      "lastName": "User"
    },
    "tenantId": "test-tenant",
    "user": "admin@winery.com"
  }'

# Expected: 200 OK with {"success": true, "message": "Webhook processed successfully"}
```

**Test Invalid Credentials:**
```bash
# Wrong username
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'wronguser:password' | base64)" \
  -d '{...}'
# Expected: 401 Unauthorized

# Wrong password
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:wrongpass' | base64)" \
  -d '{...}'
# Expected: 401 Unauthorized

# Missing Authorization header
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -d '{...}'
# Expected: 401 Unauthorized
```

#### Test 2: Payload Validation

**Test Missing Required Fields:**
```bash
# Missing object
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{"action": "Update", "payload": {}, "tenantId": "test-tenant"}'
# Expected: 400 Bad Request

# Missing action
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{"object": "Customer", "payload": {}, "tenantId": "test-tenant"}'
# Expected: 400 Bad Request

# Missing payload
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{"object": "Customer", "action": "Update", "tenantId": "test-tenant"}'
# Expected: 400 Bad Request

# Missing tenantId
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{"object": "Customer", "action": "Update", "payload": {}}'
# Expected: 400 Bad Request

# Invalid JSON
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{invalid json}'
# Expected: 400 Bad Request
```

#### Test 3: Topic Mapping Variations

**Test Case Variations:**
```bash
# Test case-insensitive object matching
# Commerce7 may send "Customer", "CUSTOMER", or "customer"
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{
    "object": "CUSTOMER",  # Uppercase
    "action": "Update",
    "payload": {...},
    "tenantId": "test-tenant",
    "user": "admin@winery.com"
  }'
# Expected: Should still match "customer" and process

# Test "Club Membership" with space (Commerce7 format)
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{
    "object": "Club Membership",  # With space
    "action": "Update",
    "payload": {...},
    "tenantId": "test-tenant",
    "user": "admin@winery.com"
  }'
# Expected: Should normalize to "club membership" and process

# Test unhandled object/action combination
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{
    "object": "Product",
    "action": "Create",
    "payload": {...},
    "tenantId": "test-tenant",
    "user": "admin@winery.com"
  }'
# Expected: 400 Bad Request - "Unhandled webhook type: Product/Create"
```

#### Test 4: Self-Triggered Webhook Blocking

**Purpose:** Block webhooks triggered by our own API calls to prevent duplicate processing and loops.

**Scenario:** 
- We update a club in Commerce7 via our API
- Commerce7 sends a webhook back with `user: "bill@ynoguy.com"`
- We should ignore this webhook to prevent re-processing our own changes

**Test with Self-Triggered User:**
```bash
# Send webhook with user=bill@ynoguy.com (our API user)
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{
    "object": "Club",
    "action": "Update",
    "payload": {
      "id": "11111111-1111-1111-1111-111111111101",
      "title": "Updated Club Name"
    },
    "tenantId": "test-tenant",
    "user": "bill@ynoguy.com"
  }'

# Expected: 200 OK with success message indicating webhook was ignored
# Response: {"success": true, "message": "Webhook ignored - triggered by our own API call"}
# Server logs should show: "Ignoring webhook triggered by our own API call: Club/Update (user: bill@ynoguy.com)"
# Database should NOT be updated (webhook was ignored)
```

**Test Cases:**
- ✅ Webhook with `user: "bill@ynoguy.com"` → Ignored, 200 OK
- ✅ Webhook with `user: "admin@winery.com"` → Processed normally
- ✅ Webhook with `user: "other@email.com"` → Processed normally
- ✅ Missing `user` field → Processed normally (not blocked)

**Real-World Test:**
1. **In LiberoVino Embedded App:** Update a club tier (which updates Commerce7)
2. **Automatic:** Commerce7 sends webhook with `user: "bill@ynoguy.com"`
3. **Verification:** Check server logs - should show webhook was ignored
4. **Verification:** Check database - should NOT have duplicate updates

---

#### Test 5: Client Lookup Edge Cases

**Test Invalid Tenant:**
```bash
# Use real webhook payload but change tenantId
curl -X POST https://c7-yourdomain.com/webhooks/c7 \
  -H "Authorization: Basic $(echo -n 'liberovino:password' | base64)" \
  -d '{
    "object": "Customer",
    "action": "Update",
    "payload": {...},
    "tenantId": "non-existent-tenant",
    "user": "admin@winery.com"
  }'
# Expected: Error logged, 500 Internal Server Error
# Server logs should show: "Client not found for tenant: non-existent-tenant"
```

---

### Webhook Testing Workflow

**Recommended Testing Order:**

1. **Configure Webhooks in Commerce7**
   - Set webhook URL
   - Configure Basic Auth credentials
   - Enable required webhook events

2. **Test Each Webhook Type from Commerce7 Admin**
   - Perform actual actions in Commerce7
   - Verify webhook received in server logs
   - Verify database updates

3. **Test Edge Cases with curl**
   - Use real payloads captured from Commerce7
   - Modify payloads to test error scenarios
   - Test authentication failures
   - Test invalid payloads

4. **Monitor and Verify**
   - Check server logs for processing
   - Verify database state changes
   - Check for error responses

---

### Webhook Payload Capture

**To capture real webhook payloads from Commerce7:**

1. Set up webhook endpoint with logging
2. Perform action in Commerce7 admin
3. Check server logs or webhook inspector (Ngrok provides this)
4. Save payload structure for future curl testing

**Example captured payload structure:**
```json
{
  "object": "Customer",
  "action": "Update",
  "payload": {
    "id": "22222222-2222-2222-2222-222222222201",
    "email": "actual@email.com",
    "firstName": "Actual",
    "lastName": "Name",
    // ... full Commerce7 customer object
  },
  "tenantId": "test-tenant",
  "user": "actual@winery.com"
}
```

---

### Webhook Testing Summary

**Primary Testing Approach:**
1. ✅ Configure webhooks in Commerce7 admin
2. ✅ Perform real actions in Commerce7 admin (edit customer, delete club, etc.)
3. ✅ Verify webhooks received in server logs
4. ✅ Verify database updates match expected behavior

**Secondary Testing (Edge Cases):**
1. ✅ Use curl to test payload variations
2. ✅ Test authentication failures
3. ✅ Test invalid payload structures
4. ✅ Test error scenarios

**Key Takeaway:** Always test webhooks with **real Commerce7 actions first** to capture actual payload structures, then use curl for edge cases and variations.

---

## CRM Sync Queue Testing

### Queue Processing Endpoint

**Endpoint:** `POST /api/cron/sync`

#### Test 1: Manual Queue Processing

```bash
# Trigger queue processing manually
# Replace UUIDs with actual IDs from your test data
curl -X POST http://localhost:3000/api/cron/sync \
  -H "Content-Type: application/json" \
  -H "User-Agent: pg_net-cron-processor" \
  -d '{
    "queueId": "00000000-0000-0000-0000-000000000201",
    "clientId": "00000000-0000-0000-0000-000000000001",
    "actionType": "cancel_membership",
    "crmType": "commerce7",
    "tenantShop": "test-tenant",
    "stageId": "00000000-0000-0000-0000-000000000101",
    "clubId": "11111111-1111-1111-1111-111111111101",
    "membershipId": "33333333-3333-3333-3333-333333333301",
    "customerCrmId": "22222222-2222-2222-2222-222222222201"
  }'
```

#### Test 2: Cancel Membership Action

**Prerequisites:**
- Create test enrollment with `c7_membership_id`
- Create queue entry: `actionType = 'cancel_membership'`

**Test Steps:**
1. Verify enrollment exists and is active
2. Send queue processing request
3. Verify:
   - Enrollment status → `'expired'`
   - Commerce7 membership `cancelDate` set
   - Expiration notification sent
   - Queue item status → `'completed'`

#### Test 3: Upgrade Membership Action

**Prerequisites:**
- Create test enrollment in Bronze tier
- Customer qualifies for Silver tier (LTV check)
- Create queue entry: `actionType = 'upgrade_membership'`

**Test Steps:**
1. Verify old enrollment exists
2. Send queue processing request with `oldStageId` and `newStageId`
3. Verify:
   - Old tier membership cancelled in Commerce7
   - New tier membership created in Commerce7
   - New enrollment created in database
   - Upgrade notification sent
   - Queue item status → `'completed'`

#### Test 4: Queue Retry Logic

**Test Scenarios:**
- ✅ First attempt succeeds → Status = 'completed'
- ✅ First attempt fails → Status = 'pending', `retry_count` incremented
- ✅ Max retries reached → Status = 'failed'
- ✅ Exponential backoff applied between retries

#### Test 5: Validation

**Test Cases:**
- ✅ Missing `queueId` → 400 Bad Request
- ✅ Missing `clientId` → 400 Bad Request
- ✅ Missing `actionType` → 400 Bad Request
- ✅ Invalid `actionType` → 400 Bad Request
- ✅ Missing `oldStageId` for upgrade → 400 Bad Request
- ✅ Missing `clubId` for Commerce7 upgrade → 400 Bad Request
- ✅ All required fields present → 200 OK

---

## Cron Job Testing

### 1. Expiration Processing Cron

**Schedule:** Daily at 2 AM UTC

**Manual Trigger:**
```sql
-- Run manually for testing
SELECT * FROM process_expired_enrollments();
```

**Test Scenarios:**

**Scenario A: Single Enrollment Expires**
- Setup: One active enrollment, `expires_at` in the past
- Expected:
  - Enrollment status → `'expired'`
  - Customer `is_club_member` → `false`
  - CRM sync queued: `cancel_membership`
  - Expiration notification sent

**Scenario B: Multiple Enrollments (One Expires)**
- Setup: Two active enrollments, one expires
- Expected:
  - Expired enrollment → `'expired'`
  - Customer flags remain `true` (has active enrollment)
  - Only expired enrollment queued for CRM sync

**Scenario C: Batch Expiration**
- Setup: Multiple enrollments expire on same day
- Expected:
  - All processed in single run
  - All customer flags updated correctly
  - All CRM syncs queued

### 2. Monthly Status Queue Cron

**Schedule:** 1st of each month at 9 AM UTC

**Functions:**
- `queue_monthly_status_jobs()` - Enqueues jobs
- `process_monthly_status_queue()` - Processes queue

**Manual Trigger:**
```sql
-- Queue jobs
SELECT * FROM queue_monthly_status_jobs();

-- Process queue
SELECT * FROM process_monthly_status_queue();
```

**Test Scenarios:**

**Scenario A: Queue Monthly Status Jobs**
- Setup: Client with monthly status enabled, active members
- Expected:
  - Jobs created in `monthly_status_queue` for each active member
  - No duplicate jobs for same customer in same month
  - Jobs have `status = 'pending'`

**Scenario B: Process Monthly Status Queue**
- Setup: Queue items in `monthly_status_queue`
- Expected:
  - Up to 50 items processed per run
  - Monthly status notification sent OR upgrade notification sent (if upgrade detected)
  - Queue item status → `'completed'`
  - Only one notification per member per month

**Scenario C: Tier Upgrade Detection**
- Setup: Member qualifies for next tier (annualized LTV check)
- Expected:
  - Upgrade notification sent (serves as monthly status)
  - Regular monthly status notification skipped
  - Upgrade queued in CRM sync queue

### 3. Expiration Warning Queue Cron

**Schedule:** Daily at 10 AM UTC (queue jobs), Every 5 minutes (process queue)

**Manual Trigger:**
```sql
-- Queue jobs
SELECT * FROM queue_expiration_warning_jobs();

-- Process queue
SELECT * FROM process_expiration_warning_queue();
```

**Test Scenarios:**

**Scenario A: Queue Expiration Warnings**
- Setup: Client with warnings enabled, enrollments expiring within `warning_days_before`
- Expected:
  - Jobs created in `expiration_warning_queue` for qualifying enrollments
  - No duplicate jobs
  - Jobs have `status = 'pending'`

**Scenario B: Process Expiration Warnings**
- Setup: Queue items in `expiration_warning_queue`
- Expected:
  - Up to 50 items processed per run
  - Expiration warning notification sent
  - Queue item status → `'completed'`

**Scenario C: Warning Timing**
- Setup: Enrollment expiring in 7 days, `warning_days_before = 7`
- Expected:
  - Warning queued on day 7
  - Warning sent when queue processed
  - No duplicate warnings

---

## Member Enrollment Testing

### Enrollment Flow

**Route:** `/app/members/new`

**Test Scenarios:**

#### Test 1: Complete Enrollment Flow

**Steps:**
1. Navigate to `/app/members/new`
2. **Step 1:** Search/select customer from CRM
3. **Step 2:** Select/enter customer address
4. **Step 3:** Select/enter payment method
5. **Step 4:** Review enrollment details
6. **Step 5:** Submit enrollment

**Expected:**
- ✅ Customer created/updated in database
- ✅ Enrollment created with `status = 'active'`
- ✅ CRM membership created (Commerce7)
- ✅ Welcome bonus points awarded (if configured)
- ✅ Welcome notification sent (Klaviyo/Mailchimp/SendGrid)
- ✅ Enrollment record has `c7_membership_id`

#### Test 2: CRM Sync Failure

**Setup:** Mock Commerce7 API to return error

**Expected:**
- ✅ Enrollment fails immediately (no local record created)
- ✅ Error message displayed to user
- ✅ User can retry enrollment

#### Test 3: Invalid Customer Data

**Test Cases:**
- ✅ Missing email → Validation error
- ✅ Missing address → Validation error
- ✅ Missing payment method → Validation error
- ✅ Invalid tier selection → Validation error

#### Test 4: Communication Preferences

**Setup:** Customer with `unsubscribedAll = true`

**Expected:**
- ✅ Enrollment succeeds
- ✅ Welcome notification skipped
- ✅ Enrollment record created

---

## Tier Upgrade Testing

### Upgrade Detection

**Trigger:** Monthly status cron job

#### Test 1: LTV-Based Upgrade

**Setup:**
- Customer in Bronze tier (min LTV: $0)
- Customer has $600 annualized LTV
- Silver tier requires $500 annualized LTV

**Expected:**
- ✅ Upgrade detected during monthly status scan
- ✅ Upgrade queued in CRM sync queue
- ✅ Upgrade notification sent (serves as monthly status)
- ✅ CRM sync processes upgrade:
  - Old tier membership cancelled
  - New tier membership created

#### Test 2: Annualized LTV Calculation

**Setup:**
- Customer created: 2020-01-01
- Current date: 2025-01-01
- Total LTV: $2400
- Annualized: $2400 / 5 years = $480/year

**Expected:**
- ✅ Annualized LTV calculated correctly
- ✅ Upgrade qualification based on annualized LTV

#### Test 3: Upgrade Notification Timing

**Setup:** Upgrade detected during monthly status

**Expected:**
- ✅ Upgrade notification sent immediately
- ✅ Regular monthly status notification skipped
- ✅ Only one notification per month

#### Test 4: No Upgrade Available

**Setup:** Customer at highest tier

**Expected:**
- ✅ No upgrade detected
- ✅ Regular monthly status notification sent

---

## Communication Testing

### Communication Providers

**Supported:** Klaviyo, Mailchimp, SendGrid

#### Test 1: Expiration Notification

**Trigger:** Membership cancellation (CRM sync or webhook)

**Expected:**
- ✅ Notification sent to configured provider
- ✅ Customer preferences respected (`unsubscribedAll`, `emailExpirationWarnings`)
- ✅ Notification includes expiration date, tier info

#### Test 2: Upgrade Notification

**Trigger:** Tier upgrade detected

**Expected:**
- ✅ Notification sent to configured provider
- ✅ Includes old tier and new tier information
- ✅ Customer preferences respected

#### Test 3: Monthly Status Notification

**Trigger:** Monthly status cron job

**Expected:**
- ✅ Notification sent if no upgrade detected
- ✅ Includes current tier, expiration date, points balance
- ✅ Only sent once per month per customer

#### Test 4: Expiration Warning Notification

**Trigger:** Expiration warning cron job

**Expected:**
- ✅ Notification sent X days before expiration
- ✅ Includes days remaining, renewal requirements
- ✅ Customer preferences respected

#### Test 5: Provider Failures

**Test Cases:**
- ✅ Klaviyo API error → Error logged, process continues
- ✅ Mailchimp API error → Error logged, process continues
- ✅ SendGrid API error → Error logged, process continues
- ✅ Missing API key → Warning logged, provider skipped

---

## Setup Wizard Testing

**Route:** `/app/setup` or `/setup`

#### Test 1: Initial Setup Flow

**Steps:**
1. Navigate to setup wizard
2. **Step 1:** Welcome screen
3. **Step 2:** Club name and description
4. **Step 3:** Configure tiers (add/remove/reorder)
5. **Step 4:** Configure loyalty points
6. **Step 5:** Review and complete

**Expected:**
- ✅ All steps navigable
- ✅ Data persists between steps
- ✅ Validation on each step
- ✅ Club program created
- ✅ Tiers created
- ✅ Loyalty rules created
- ✅ `setup_complete = true`

#### Test 2: Tier Management

**Test Cases:**
- ✅ Add unlimited tiers
- ✅ Remove tiers (minimum 1)
- ✅ Reorder tiers with ↑/↓ buttons
- ✅ Parallel tiers (same duration, different benefits)
- ✅ Progressive tiers (Bronze → Silver → Gold)

#### Test 3: Edit Existing Setup

**Route:** `/app/setup` (after initial setup)

**Expected:**
- ✅ Existing data pre-populated
- ✅ Can modify all settings
- ✅ Changes saved correctly

---

## API Endpoint Testing

### 1. Customers API

**Endpoint:** `GET /api/customers`

**Test Cases:**
- ✅ Search by query (`?q=john`)
- ✅ Get single customer (`?id=00000000-0000-0000-0000-000000000010`)
- ✅ Returns customers with LTV calculated
- ✅ Requires authentication
- ✅ Returns empty array for invalid query

### 2. Products API

**Endpoint:** `GET /api/products`

**Test Cases:**
- ✅ Search products (`?q=wine`)
- ✅ Limit results (`?limit=50`)
- ✅ Requires authentication
- ✅ Returns products from CRM

### 3. Collections API

**Endpoint:** `GET /api/collections`

**Test Cases:**
- ✅ Search collections (`?q=red`)
- ✅ Limit results (`?limit=25`)
- ✅ Requires authentication
- ✅ Returns collections from CRM

### 4. Members API

**Endpoint:** `GET /api/members?clientId=client-id`

**Test Cases:**
- ✅ Returns all enrollments for client
- ✅ Requires authentication
- ✅ Returns empty array if no clientId

### 5. Cron API

**Endpoint:** `POST /api/cron?action=sync`

**Test Cases:**
- ✅ Manual trigger for sync queue processing
- ✅ Validates User-Agent header
- ✅ Returns status of cron execution

---

## Integration Test Scenarios

### Scenario 1: Complete Member Lifecycle

**Flow:**
1. **In LiberoVino Embedded App:** Complete setup wizard
2. **In LiberoVino Embedded App:** Enroll new member via `/app/members/new`
3. **Automatic (Cron):** Monthly status cron runs, sends status notification
4. **Automatic (Cron):** Tier upgrade detected during monthly status scan
5. **Automatic (Cron):** CRM sync processes upgrade queue
6. **Automatic (Cron):** Membership expires, expiration cron processes
7. **Automatic (Cron):** Expiration notification sent

**Verification:**
- ✅ All steps execute without errors
- ✅ All notifications sent
- ✅ Database records updated correctly
- ✅ CRM sync successful

**What to Test:**
- Steps 1-2: Test in LiberoVino UI
- Steps 3-7: Trigger cron jobs manually or wait for scheduled runs

### Scenario 2: Webhook → Database Sync (Customer Update)

**Flow:**
1. **In Commerce7 Admin:** Navigate to Customers → Edit customer information → Save
2. **Automatic:** Commerce7 sends webhook to `/webhooks/c7`
3. **Automatic:** Webhook processed, customer record updated in database
4. **Verification:** Check database for updated customer

**Verification:**
- ✅ Webhook received (check server logs)
- ✅ Customer record updated correctly in database
- ✅ Related enrollments remain unchanged

**What to Test:**
- Step 1: Perform actual action in Commerce7 admin
- Steps 2-3: Monitor server logs and database

### Scenario 3: Club Deletion

**Flow:**
1. **In Commerce7 Admin:** Navigate to Clubs → Delete a club
2. **Automatic:** Commerce7 sends webhook to `/webhooks/c7`
3. **Automatic:** Webhook processed:
   - All related `club_stages` marked `is_active = false`
   - All active enrollments for those stages marked `expired`
   - Customer flags updated

**Verification:**
- ✅ Webhook received (check server logs)
- ✅ All related enrollments expired
- ✅ Customer flags updated (1 customer/1 tier policy)

**What to Test:**
- Step 1: Perform actual deletion in Commerce7 admin
- Steps 2-3: Monitor server logs and verify database changes

### Scenario 4: Membership Cancellation via Webhook

**Flow:**
1. **In Commerce7 Admin:** Navigate to Club Members → Select membership → Change status to "Cancelled" → Save
2. **Automatic:** Commerce7 sends webhook to `/webhooks/c7`
3. **Automatic:** Webhook processed:
   - Enrollment marked `expired`
   - Expiration notification sent

**Verification:**
- ✅ Webhook received (check server logs)
- ✅ Enrollment status = `'expired'`
- ✅ Expiration notification sent (check communication logs)

**What to Test:**
- Step 1: Perform actual action in Commerce7 admin
- Steps 2-3: Monitor server logs and verify database/communications

---

## End-to-End Test Flows

### E2E Test 1: New Winery Onboarding

**Steps:**
1. **Commerce7 Admin:** Install LiberoVino app in Commerce7
2. **LiberoVino Embedded App:** Complete setup wizard (`/app/setup`)
3. **LiberoVino Embedded App:** Configure communication provider (`/app/setup/communication`)
4. **LiberoVino Embedded App:** Enroll first member (`/app/members/new`)
5. **Verification:** Check member receives welcome email
6. **Wait or Trigger:** Monthly status cron runs (manual trigger or wait for schedule)
7. **Verification:** Check monthly status notification sent

**Expected:**
- ✅ All steps complete successfully
- ✅ Data persists correctly
- ✅ Communications sent

**What to Test:**
- Steps 1-4: Test in actual Commerce7/LiberoVino UI
- Steps 5, 7: Verify communications via email provider dashboard or database logs

### E2E Test 2: Member Upgrade Journey

**Steps:**
1. **LiberoVino Embedded App:** Enroll member in Bronze tier
2. **In Commerce7 Admin or Storefront:** Member makes qualifying purchase (or manually adjust LTV for testing)
3. **Automatic:** Customer's LTV increases above Silver threshold
4. **Manual Trigger or Wait:** Monthly status cron runs
   ```sql
   SELECT * FROM queue_monthly_status_jobs();
   SELECT * FROM process_monthly_status_queue();
   ```
5. **Automatic:** Upgrade detected and queued during monthly status scan
6. **Manual Trigger or Wait:** CRM sync processes upgrade queue
   ```sql
   SELECT * FROM process_crm_sync_queue();
   ```
7. **Verification:** Member receives upgrade notification

**Expected:**
- ✅ Upgrade detected correctly
- ✅ CRM sync successful (old tier cancelled, new tier added in Commerce7)
- ✅ Notification sent

**What to Test:**
- Step 1: Test in LiberoVino UI
- Step 2: Use Commerce7 admin to create order, or manually update customer LTV
- Steps 4, 6: Trigger cron jobs manually for testing
- Step 7: Verify notification sent

### E2E Test 3: Membership Expiration

**Steps:**
1. **LiberoVino Embedded App:** Enroll member with 3-month duration
2. **Wait or Manual:** 3 months pass (or manually update `expires_at` to past date for testing)
   ```sql
   UPDATE club_enrollments 
   SET expires_at = NOW() - INTERVAL '1 day' 
   WHERE id = '00000000-0000-0000-0000-000000000020';
   ```
3. **Manual Trigger:** Expiration cron runs
   ```sql
   SELECT * FROM process_expired_enrollments();
   ```
4. **Automatic:** Enrollment marked expired, CRM sync queued
5. **Manual Trigger:** CRM sync processes cancellation queue
   ```sql
   SELECT * FROM process_crm_sync_queue();
   ```
6. **Automatic:** CRM sync processes cancellation (sets cancelDate in Commerce7)
7. **Verification:** Expiration notification sent

**Expected:**
- ✅ Expiration processed correctly
- ✅ CRM sync successful (membership cancelled in Commerce7)
- ✅ Notification sent

**What to Test:**
- Step 1: Test in LiberoVino UI
- Step 2: Manually adjust expiration date for faster testing
- Steps 3, 5: Trigger cron jobs manually
- Step 7: Verify notification sent

### E2E Test 4: Webhook-Driven Membership Cancellation

**Steps:**
1. **LiberoVino Embedded App:** Enroll member
2. **Commerce7 Admin:** Navigate to Club Members → Select membership → Change status to "Cancelled"
3. **Automatic:** Commerce7 sends webhook to `/webhooks/c7`
4. **Automatic:** Webhook processed:
   - Enrollment marked expired
   - Expiration notification sent
5. **Verification:** Check database and communication logs

**Expected:**
- ✅ Webhook received and processed
- ✅ Enrollment status updated
- ✅ Notification sent

**What to Test:**
- Step 1: Test in LiberoVino UI
- Step 2: Perform actual action in Commerce7 admin
- Steps 3-4: Monitor server logs and verify database changes

---

## Performance Testing

### Load Testing

**Scenarios:**
- ✅ Process 1000+ enrollments in expiration cron
- ✅ Process 100+ queue items in sync queue processor
- ✅ Handle 50+ concurrent webhook requests
- ✅ Process monthly status for 500+ members

**Metrics:**
- Response time < 2 seconds for API endpoints
- Queue processing: 50 items per 5-minute run
- No database deadlocks
- No memory leaks

### Stress Testing

**Scenarios:**
- ✅ Rapid webhook delivery (10+ per second)
- ✅ Large batch operations (1000+ enrollments)
- ✅ Concurrent cron jobs

---

## Security Testing

### Authentication & Authorization

**Test Cases:**
- ✅ Webhook Basic Auth validation
- ✅ API endpoint authentication required
- ✅ Session validation on protected routes
- ✅ Client data isolation (can't access other clients' data)

### Input Validation

**Test Cases:**
- ✅ SQL injection attempts blocked
- ✅ XSS attempts sanitized
- ✅ Invalid JSON handled gracefully
- ✅ Missing required fields validated

### Error Handling

**Test Cases:**
- ✅ Errors don't expose sensitive information
- ✅ Proper HTTP status codes returned
- ✅ Error messages logged securely

---

## Test Checklist

### Webhooks
- [ ] Basic Auth validation
- [ ] Payload validation
- [ ] Topic mapping (all 5 topics)
- [ ] Client lookup
- [ ] Error handling
- [ ] All webhook handlers execute correctly

### CRM Sync Queue
- [ ] Queue item creation
- [ ] Queue processing endpoint
- [ ] Cancel membership action
- [ ] Upgrade membership action
- [ ] Retry logic
- [ ] Validation

### Cron Jobs
- [ ] Expiration processing
- [ ] Monthly status queue jobs
- [ ] Monthly status processing
- [ ] Expiration warning queue jobs
- [ ] Expiration warning processing
- [ ] Sync queue processing

### Member Enrollment
- [ ] Complete enrollment flow
- [ ] CRM sync before enrollment
- [ ] Welcome notification
- [ ] Bonus points award
- [ ] Error handling

### Tier Upgrades
- [ ] LTV calculation
- [ ] Annualized LTV
- [ ] Upgrade detection
- [ ] Upgrade notification
- [ ] CRM sync for upgrade

### Communications
- [ ] Expiration notifications
- [ ] Upgrade notifications
- [ ] Monthly status notifications
- [ ] Expiration warnings
- [ ] Provider failures handled

### Setup Wizard
- [ ] Initial setup flow
- [ ] Tier management
- [ ] Edit existing setup
- [ ] Data persistence

### API Endpoints
- [ ] Customers API
- [ ] Products API
- [ ] Collections API
- [ ] Members API
- [ ] Cron API

### Integration
- [ ] Complete member lifecycle
- [ ] Webhook → database sync
- [ ] Club deletion
- [ ] Membership cancellation

### End-to-End
- [ ] New winery onboarding
- [ ] Member upgrade journey
- [ ] Membership expiration

### Performance
- [ ] Load testing
- [ ] Stress testing
- [ ] Database query optimization

### Security
- [ ] Authentication
- [ ] Authorization
- [ ] Input validation
- [ ] Error handling

---

## Test Data Management

### Creating Test Data

```sql
-- Test client (matches constants defined above)
INSERT INTO clients (id, tenant_shop, crm_type, org_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'test-tenant', 'commerce7', 'Test Winery');

-- Test customer (matches constants defined above)
INSERT INTO customers (id, client_id, email, first_name, last_name, crm_id)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'test@example.com', 'Test', 'User', '22222222-2222-2222-2222-222222222201');

-- Test enrollment (matches constants defined above)
INSERT INTO club_enrollments (id, customer_id, club_stage_id, status, enrolled_at, expires_at, c7_membership_id)
VALUES ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000101', 'active', NOW(), NOW() + INTERVAL '3 months', '33333333-3333-3333-3333-333333333301');
```

### Cleaning Up Test Data

```sql
-- Remove test data (use UUIDs from constants)
DELETE FROM club_enrollments WHERE customer_id = '00000000-0000-0000-0000-000000000010';
DELETE FROM customers WHERE id = '00000000-0000-0000-0000-000000000010';
DELETE FROM clients WHERE id = '00000000-0000-0000-0000-000000000001';
```

---

## Reporting Test Results

For each test:
- ✅ Pass
- ❌ Fail (with error details)
- ⚠️ Partial (with notes)

Document:
- Test environment
- Test date/time
- Test results
- Issues found
- Screenshots/logs

---

*Last updated: January 2025*

