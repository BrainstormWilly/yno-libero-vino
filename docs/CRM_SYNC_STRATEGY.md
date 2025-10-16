# CRM Discount Synchronization Strategy

## Overview

We create discount codes in the CRM for each club stage and manage customer eligibility lists. This leverages native CRM features for automatic discount application while our system remains the source of truth for enrollment logic.

## The Approach

### 1. One Discount Per Stage (In CRM)

**Commerce7 Example:**
```
Coupon Code: CLUB-BRONZE-10
- Type: Percentage
- Value: 10%
- Customer Eligibility: Specific customers (managed by us)
- Applies to: Wine products only
- Auto-apply: Yes (automatic at checkout)
- Active: Yes
- Usage per customer: Unlimited
```

**Shopify Example:**
```
Price Rule: "Wine Club - Bronze Tier"
- Code: CLUB-BRONZE-10
- Type: Percentage
- Value: 10%
- Customer eligibility: Specific customers (managed via API)
- Collections: Wines
- Automatic: Yes
- Usage: Unlimited per customer
```

### 2. Sync Operations

We need to sync customer eligibility when:

| Event | Action |
|-------|--------|
| **Customer enrolls in stage** | Add customer to CRM discount eligibility list |
| **Customer upgrades stage** | Remove from old discount, add to new discount |
| **Customer renews (same stage)** | No CRM change needed (already in list) |
| **Membership expires** | Remove customer from CRM discount eligibility list |
| **Daily cron job** | Check all expirations, remove from CRM |

### 3. Data Model Updates

Add sync tracking to `club_stages`:

```sql
ALTER TABLE club_stages
ADD COLUMN crm_discount_id VARCHAR(255),  -- ID of discount in CRM
ADD COLUMN last_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN sync_status VARCHAR(20) CHECK (sync_status IN ('synced', 'pending', 'error'));
```

Add sync tracking to `club_enrollments`:

```sql
ALTER TABLE club_enrollments
ADD COLUMN synced_to_crm BOOLEAN DEFAULT false,
ADD COLUMN crm_sync_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN crm_sync_error TEXT;
```

## Implementation Details

### A. Stage Creation Flow

```typescript
async function createClubStage(stageData) {
  // 1. Create stage in our database
  const stage = await db.club_stages.create({
    ...stageData,
    sync_status: 'pending'
  });
  
  // 2. Create discount in CRM
  const crmProvider = getCrmProvider(client.crm_type);
  const discountCode = `CLUB-${stage.name.toUpperCase()}-${stage.discount_percentage}`;
  
  const crmDiscount = await crmProvider.createDiscount({
    code: discountCode,
    type: 'percentage',
    value: stage.discount_percentage,
    customerEligibility: 'specific',  // Key setting!
    eligibleCustomers: [],  // Start with empty list
    autoApply: true,
    usageLimit: null  // Unlimited
  });
  
  // 3. Update stage with CRM discount ID
  await db.club_stages.update(stage.id, {
    discount_code: discountCode,
    crm_discount_id: crmDiscount.id,
    sync_status: 'synced',
    last_sync_at: new Date()
  });
  
  return stage;
}
```

### B. Customer Enrollment Sync

```typescript
async function syncEnrollmentToCrm(enrollment) {
  const customer = await db.customers.findById(enrollment.customer_id);
  const stage = await db.club_stages.findById(enrollment.club_stage_id);
  const client = await db.clients.findById(customer.client_id);
  
  const crmProvider = getCrmProvider(client.crm_type);
  
  try {
    // Add customer to discount eligibility list
    await crmProvider.addCustomerToDiscount(
      stage.crm_discount_id,
      customer.crm_id
    );
    
    // Mark as synced
    await db.club_enrollments.update(enrollment.id, {
      synced_to_crm: true,
      crm_sync_at: new Date(),
      crm_sync_error: null
    });
    
    return { success: true };
  } catch (error) {
    // Log sync error but don't fail enrollment
    await db.club_enrollments.update(enrollment.id, {
      synced_to_crm: false,
      crm_sync_error: error.message
    });
    
    // Queue for retry
    await queueCrmSync(enrollment.id, 'add_customer');
    
    return { success: false, error };
  }
}
```

### C. Customer Upgrade Sync

```typescript
async function syncUpgradeToCrm(oldEnrollment, newEnrollment) {
  const customer = await db.customers.findById(newEnrollment.customer_id);
  const oldStage = await db.club_stages.findById(oldEnrollment.club_stage_id);
  const newStage = await db.club_stages.findById(newEnrollment.club_stage_id);
  const client = await db.clients.findById(customer.client_id);
  
  const crmProvider = getCrmProvider(client.crm_type);
  
  try {
    // Remove from old discount
    await crmProvider.removeCustomerFromDiscount(
      oldStage.crm_discount_id,
      customer.crm_id
    );
    
    // Add to new discount
    await crmProvider.addCustomerToDiscount(
      newStage.crm_discount_id,
      customer.crm_id
    );
    
    // Mark both as synced
    await db.club_enrollments.update(oldEnrollment.id, {
      synced_to_crm: true,
      crm_sync_at: new Date()
    });
    
    await db.club_enrollments.update(newEnrollment.id, {
      synced_to_crm: true,
      crm_sync_at: new Date()
    });
    
    return { success: true };
  } catch (error) {
    // Queue for retry
    await queueCrmSync(newEnrollment.id, 'upgrade_customer');
    return { success: false, error };
  }
}
```

### D. Daily Expiration Cron Job

```typescript
// Run daily at 2 AM
async function processExpirations() {
  console.log('Starting daily expiration check...');
  
  // Find all enrollments that expired in last 24 hours
  const expiredEnrollments = await db.club_enrollments.findMany({
    where: {
      status: 'active',
      expires_at: {
        lt: new Date(),
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000)  // Last 24 hours
      },
      synced_to_crm: true  // Only process synced ones
    },
    include: {
      customer: true,
      club_stage: true
    }
  });
  
  console.log(`Found ${expiredEnrollments.length} expired enrollments`);
  
  for (const enrollment of expiredEnrollments) {
    try {
      // 1. Mark as expired in our DB
      await db.club_enrollments.update(enrollment.id, {
        status: 'expired'
      });
      
      // 2. Update customer flags
      await db.customers.update(enrollment.customer.id, {
        is_club_member: false,
        loyalty_earning_active: false  // Stop earning points
      });
      
      // 3. Remove from CRM discount list
      const client = await db.clients.findById(enrollment.customer.client_id);
      const crmProvider = getCrmProvider(client.crm_type);
      
      await crmProvider.removeCustomerFromDiscount(
        enrollment.club_stage.crm_discount_id,
        enrollment.customer.crm_id
      );
      
      console.log(`Expired and removed: Customer ${enrollment.customer.email} from ${enrollment.club_stage.name}`);
      
    } catch (error) {
      console.error(`Error processing expiration for enrollment ${enrollment.id}:`, error);
      // Queue for retry
      await queueCrmSync(enrollment.id, 'remove_customer');
    }
  }
  
  console.log('Expiration check complete');
}

// Schedule with cron (e.g., in Heroku Scheduler or node-cron)
import cron from 'node-cron';

// Run daily at 2 AM
cron.schedule('0 2 * * *', processExpirations);
```

### E. CRM Provider Interface Updates

Add to `CrmProvider` interface:

```typescript
export interface CrmProvider {
  // ... existing methods
  
  // Customer management
  upsertCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer>;  // Create or update
  findCustomerByEmail(email: string): Promise<CrmCustomer | null>;
  
  // Customer-specific discount management
  addCustomerToDiscount(discountId: string, customerId: string): Promise<void>;
  removeCustomerFromDiscount(discountId: string, customerId: string): Promise<void>;
  getDiscountCustomers(discountId: string): Promise<string[]>;  // Returns array of customer IDs
}
```

### F. Commerce7 Implementation

```typescript
// In commerce7.server.ts
async addCustomerToDiscount(discountId: string, customerId: string): Promise<void> {
  const { tenant } = await this.getCurrentTenant();
  
  const response = await fetch(`${API_URL}/coupon/${discountId}/customer/${customerId}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: apiAuth,
      tenant: tenant
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to add customer to Commerce7 discount: ${response.statusText}`);
  }
}

async removeCustomerFromDiscount(discountId: string, customerId: string): Promise<void> {
  const { tenant } = await this.getCurrentTenant();
  
  const response = await fetch(`${API_URL}/coupon/${discountId}/customer/${customerId}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      Authorization: apiAuth,
      tenant: tenant
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to remove customer from Commerce7 discount: ${response.statusText}`);
  }
}

async getDiscountCustomers(discountId: string): Promise<string[]> {
  const { tenant } = await this.getCurrentTenant();
  
  const response = await fetch(`${API_URL}/coupon/${discountId}/customers`, {
    headers: {
      Accept: 'application/json',
      Authorization: apiAuth,
      tenant: tenant
    }
  });
  
  const data = await response.json();
  return data.customers?.map((c: any) => c.id) || [];
}
```

### G. Shopify Implementation

```typescript
// In shopify.server.ts
async addCustomerToDiscount(priceRuleId: string, customerId: string): Promise<void> {
  // Shopify uses customer segments or manual customer IDs
  // Add customer to the price rule's entitled customer list
  
  const response = await shopify.graphql(`
    mutation addCustomerToDiscount($priceRuleId: ID!, $customerId: ID!) {
      priceRuleUpdate(
        priceRuleId: $priceRuleId
        priceRule: {
          entitledCustomerIds: {
            add: [$customerId]
          }
        }
      ) {
        priceRule {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    priceRuleId: `gid://shopify/PriceRule/${priceRuleId}`,
    customerId: `gid://shopify/Customer/${customerId}`
  });
  
  if (response.priceRuleUpdate.userErrors.length > 0) {
    throw new Error(response.priceRuleUpdate.userErrors[0].message);
  }
}

async removeCustomerFromDiscount(priceRuleId: string, customerId: string): Promise<void> {
  const response = await shopify.graphql(`
    mutation removeCustomerFromDiscount($priceRuleId: ID!, $customerId: ID!) {
      priceRuleUpdate(
        priceRuleId: $priceRuleId
        priceRule: {
          entitledCustomerIds: {
            remove: [$customerId]
          }
        }
      ) {
        priceRule {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    priceRuleId: `gid://shopify/PriceRule/${priceRuleId}`,
    customerId: `gid://shopify/Customer/${customerId}`
  });
  
  if (response.priceRuleUpdate.userErrors.length > 0) {
    throw new Error(response.priceRuleUpdate.userErrors[0].message);
  }
}
```

## Workflow Diagrams

### Initial Setup (One-time per client)

```
Winery creates club stages in our admin UI
    ↓
For each stage:
    ↓
Create discount in CRM
    ├→ Commerce7: Create coupon with customer eligibility
    └→ Shopify: Create price rule with customer entitlement
    ↓
Store crm_discount_id in club_stages table
    ↓
Stage ready to accept customers
```

### Customer Enrollment Flow

```
Customer makes qualifying purchase on CRM site
    ↓
Webhook fires to our system
    ↓
Process webhook:
    ├→ Check order total
    ├→ Find qualifying stage
    └→ Customer qualifies for Bronze ($75+)
    ↓
Create club_enrollment record
    ├→ enrolled_at: NOW()
    ├→ expires_at: NOW() + 3 months
    └→ status: 'active'
    ↓
Sync to CRM (async):
    ├→ Add customer.crm_id to Bronze discount eligibility
    ├→ Mark enrollment.synced_to_crm = true
    └→ If error: Queue for retry
    ↓
Next customer purchase:
    └→ Bronze discount auto-applies! ✨
```

### Customer Upgrade Flow

```
Customer makes larger purchase ($150+)
    ↓
Webhook fires to our system
    ↓
Process webhook:
    ├→ Check order total
    ├→ Find qualifying stage (Silver)
    └→ Qualifies for upgrade!
    ↓
Update enrollments:
    ├→ Mark old enrollment (Bronze) as 'upgraded'
    └→ Create new enrollment (Silver)
         ├→ enrolled_at: KEEP original date
         └→ expires_at: original_date + 6 months
    ↓
Sync to CRM (async):
    ├→ Remove from Bronze discount eligibility
    ├→ Add to Silver discount eligibility
    └→ If error: Queue for retry
    ↓
Next purchase:
    └→ Silver (15%) auto-applies instead of Bronze (10%)! ✨
```

### Daily Expiration Cron

```
2 AM Daily: Run expiration check
    ↓
Query club_enrollments:
    WHERE status = 'active'
    AND expires_at < NOW()
    ↓
For each expired enrollment:
    ↓
Update our database:
    ├→ Mark enrollment as 'expired'
    ├→ Set customer.is_club_member = false
    └→ Set customer.loyalty_earning_active = false
    ↓
Sync to CRM:
    ├→ Remove customer from stage discount eligibility
    └→ Log result
    ↓
Email customer (optional):
    └→ "Your membership has expired. Purchase $X to re-enroll!"
```

## Retry Queue for Failed Syncs

### Sync Queue Table

```sql
CREATE TABLE crm_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES club_enrollments(id) ON DELETE CASCADE,
  
  action_type VARCHAR(50) NOT NULL CHECK (
    action_type IN ('add_customer', 'remove_customer', 'upgrade_customer')
  ),
  
  -- Data needed for sync
  stage_id UUID REFERENCES club_stages(id) ON DELETE CASCADE,
  old_stage_id UUID REFERENCES club_stages(id) ON DELETE SET NULL,
  customer_crm_id VARCHAR(255) NOT NULL,
  
  -- Retry logic
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  last_attempt_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sync_queue_status ON crm_sync_queue(status);
CREATE INDEX idx_sync_queue_next_retry ON crm_sync_queue(next_retry_at);
CREATE INDEX idx_sync_queue_client_id ON crm_sync_queue(client_id);
```

### Retry Worker

```typescript
// Run every 5 minutes
async function processSyncQueue() {
  const pendingJobs = await db.crm_sync_queue.findMany({
    where: {
      status: 'pending',
      next_retry_at: { lte: new Date() },
      attempts: { lt: sql`max_attempts` }
    },
    limit: 50  // Process in batches
  });
  
  for (const job of pendingJobs) {
    await db.crm_sync_queue.update(job.id, {
      status: 'processing',
      attempts: job.attempts + 1,
      last_attempt_at: new Date()
    });
    
    try {
      const client = await db.clients.findById(job.client_id);
      const crmProvider = getCrmProvider(client.crm_type);
      
      switch (job.action_type) {
        case 'add_customer':
          const stage = await db.club_stages.findById(job.stage_id);
          await crmProvider.addCustomerToDiscount(
            stage.crm_discount_id,
            job.customer_crm_id
          );
          break;
          
        case 'remove_customer':
          const stageToRemove = await db.club_stages.findById(job.stage_id);
          await crmProvider.removeCustomerFromDiscount(
            stageToRemove.crm_discount_id,
            job.customer_crm_id
          );
          break;
          
        case 'upgrade_customer':
          // Remove from old, add to new
          const oldStage = await db.club_stages.findById(job.old_stage_id);
          const newStage = await db.club_stages.findById(job.stage_id);
          
          await crmProvider.removeCustomerFromDiscount(
            oldStage.crm_discount_id,
            job.customer_crm_id
          );
          
          await crmProvider.addCustomerToDiscount(
            newStage.crm_discount_id,
            job.customer_crm_id
          );
          break;
      }
      
      // Mark as completed
      await db.crm_sync_queue.update(job.id, {
        status: 'completed'
      });
      
    } catch (error) {
      // Calculate exponential backoff
      const nextRetry = new Date(Date.now() + Math.pow(2, job.attempts) * 60000);
      
      await db.crm_sync_queue.update(job.id, {
        status: job.attempts >= job.max_attempts ? 'failed' : 'pending',
        error_message: error.message,
        next_retry_at: nextRetry
      });
      
      // Alert if max attempts reached
      if (job.attempts >= job.max_attempts) {
        await sendAlert(`CRM sync failed permanently for job ${job.id}`);
      }
    }
  }
}

// Schedule
cron.schedule('*/5 * * * *', processSyncQueue);  // Every 5 minutes
```

## Error Handling

### Sync Failures Don't Block Enrollment

```typescript
// When customer enrolls
async function enrollCustomer(customerId, stageId, orderId) {
  // 1. Create enrollment in our DB (source of truth)
  const enrollment = await db.club_enrollments.create({
    customer_id: customerId,
    club_stage_id: stageId,
    qualifying_order_id: orderId,
    enrolled_at: new Date(),
    expires_at: calculateExpiration(stageId),
    status: 'active',
    synced_to_crm: false  // Not yet synced
  });
  
  // 2. Try to sync to CRM (non-blocking)
  try {
    await syncEnrollmentToCrm(enrollment);
  } catch (error) {
    // Log but don't fail
    console.error('CRM sync failed, queued for retry:', error);
    // Queue will pick it up
  }
  
  return enrollment;
}
```

### Manual Sync Trigger

Admin UI should allow manual sync:

```typescript
// Resync all enrollments for a client
async function resyncClientEnrollments(clientId: string) {
  const activeEnrollments = await db.club_enrollments.findMany({
    where: {
      status: 'active',
      customer: { client_id: clientId }
    },
    include: {
      customer: true,
      club_stage: true
    }
  });
  
  for (const enrollment of activeEnrollments) {
    await syncEnrollmentToCrm(enrollment);
  }
}
```

## Benefits of This Approach

### ✅ Automatic Discount Application
- No coupon codes to remember
- No manual entry at checkout
- Seamless customer experience
- "Magic" for the customer

### ✅ CRM Handles Product Rules
- Winery configures which products qualify in CRM
- Can exclude sale items, specific SKUs, etc.
- No need to duplicate product logic in our system
- Flexibility per winery's needs

### ✅ Our System Remains Source of Truth
- We control enrollment logic
- We manage expiration
- We track timeline and upgrades
- CRM is just the enforcement layer

### ✅ Resilient to Failures
- Sync failures don't block enrollment
- Retry queue ensures eventual consistency
- Manual sync available for recovery
- Monitoring and alerts for issues

### ✅ Clean Separation
- Our system: Eligibility, timing, business rules
- CRM system: Product rules, pricing, checkout
- Clear boundaries, easy to debug

## Monitoring & Observability

### Metrics to Track

```typescript
// Dashboard metrics
{
  enrollments_pending_sync: count(where: { synced_to_crm: false }),
  sync_failures_24h: count(crm_sync_queue where: { status: 'failed', created_at: last 24h }),
  customers_per_stage: group_by(club_stage_id),
  expirations_processed_today: count(where: { status: 'expired', updated_at: today }),
  average_sync_time: avg(crm_sync_at - created_at)
}
```

### Alerts

- ⚠️ Sync queue > 100 items
- 🚨 Sync failure rate > 5%
- ⚠️ Enrollment not synced after 1 hour
- 🚨 Daily cron job didn't run

## Migration Impact

Need to add to `001_initial_schema.sql`:

1. New columns on `club_stages`
2. New columns on `club_enrollments`
3. New table `crm_sync_queue`

Would you like me to implement this in the migration now?

