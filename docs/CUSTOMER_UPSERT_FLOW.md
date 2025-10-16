# Customer Upsert Flow for CRM Sync

## Problem Statement

When enrolling a customer in a club stage through LiberVino (not via CRM webhook), we need to:
1. Ensure customer exists in the CRM
2. Get their CRM customer ID
3. Add them to the discount eligibility list

## Solution: Upsert Flow

### Customer Enrollment from LiberVino

```typescript
async function enrollCustomerInStage(customerData, stageId) {
  // 1. Create/update customer in our database
  const customer = await db.customers.upsert({
    where: {
      client_id_email: {
        client_id: customerData.client_id,
        email: customerData.email
      }
    },
    create: {
      client_id: customerData.client_id,
      email: customerData.email,
      first_name: customerData.first_name,
      last_name: customerData.last_name,
      phone: customerData.phone,
      crm_id: null,  // Don't have it yet
      is_club_member: true
    },
    update: {
      is_club_member: true
    }
  });
  
  // 2. Ensure customer exists in CRM
  const client = await db.clients.findById(customerData.client_id);
  const crmProvider = getCrmProvider(client.crm_type);
  
  let crmCustomer;
  
  if (customer.crm_id) {
    // Customer already has CRM ID, verify they exist
    try {
      crmCustomer = await crmProvider.getCustomer(customer.crm_id);
    } catch (error) {
      // CRM customer not found, create new one
      crmCustomer = await crmProvider.upsertCustomer({
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone
      });
      
      // Update our record with CRM ID
      await db.customers.update(customer.id, {
        crm_id: crmCustomer.id
      });
    }
  } else {
    // No CRM ID, upsert in CRM
    crmCustomer = await crmProvider.upsertCustomer({
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone
    });
    
    // Store CRM ID
    await db.customers.update(customer.id, {
      crm_id: crmCustomer.id
    });
  }
  
  // 3. Create club enrollment
  const stage = await db.club_stages.findById(stageId);
  const enrollment = await db.club_enrollments.create({
    customer_id: customer.id,
    club_stage_id: stageId,
    enrolled_at: new Date(),
    expires_at: calculateExpiration(stage),
    status: 'active'
  });
  
  // 4. Add to CRM discount eligibility
  try {
    await crmProvider.addCustomerToDiscount(
      stage.crm_discount_id,
      crmCustomer.id
    );
    
    await db.club_enrollments.update(enrollment.id, {
      synced_to_crm: true,
      crm_sync_at: new Date()
    });
  } catch (error) {
    // Queue for retry
    await queueCrmSync(enrollment.id, 'add_customer');
  }
  
  return enrollment;
}
```

## CRM Upsert Implementations

### Commerce7 Upsert

```typescript
// In commerce7.server.ts
async upsertCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer> {
  const { tenant } = await this.getCurrentTenant();
  
  // Try to find existing customer by email
  const existingCustomer = await this.findCustomerByEmail(customer.email);
  
  if (existingCustomer) {
    // Update existing customer
    return await this.updateCustomer(existingCustomer.id, customer);
  }
  
  // Create new customer
  const response = await fetch(`${API_URL}/customer`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: apiAuth,
      tenant: tenant
    },
    body: JSON.stringify({
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      tags: ['libero-vino-club']  // Tag for tracking
    })
  });
  
  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`Error creating Commerce7 customer: ${data.errors[0]?.message}`);
  }
  
  return {
    id: data.id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

async findCustomerByEmail(email: string): Promise<CrmCustomer | null> {
  const { tenant } = await this.getCurrentTenant();
  
  const response = await fetch(
    `${API_URL}/customer?q=${encodeURIComponent(email)}&limit=1`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: apiAuth,
        tenant: tenant
      }
    }
  );
  
  const data = await response.json();
  
  if (data.customers && data.customers.length > 0) {
    const c = data.customers[0];
    return {
      id: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    };
  }
  
  return null;
}
```

### Shopify Upsert

```typescript
// In shopify.server.ts
async upsertCustomer(customer: Partial<CrmCustomer>): Promise<CrmCustomer> {
  // Try to find existing customer by email
  const existingCustomer = await this.findCustomerByEmail(customer.email);
  
  if (existingCustomer) {
    // Shopify customer exists, return it
    return existingCustomer;
  }
  
  // Create new customer via GraphQL
  const response = await shopify.graphql(`
    mutation customerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer {
          id
          email
          firstName
          lastName
          phone
          createdAt
          updatedAt
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    input: {
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      tags: ['libero-vino-club']
    }
  });
  
  if (response.customerCreate.userErrors.length > 0) {
    throw new Error(response.customerCreate.userErrors[0].message);
  }
  
  const c = response.customerCreate.customer;
  
  return {
    id: c.id.replace('gid://shopify/Customer/', ''),  // Extract numeric ID
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}

async findCustomerByEmail(email: string): Promise<CrmCustomer | null> {
  const response = await shopify.graphql(`
    query findCustomerByEmail($email: String!) {
      customers(first: 1, query: $email) {
        edges {
          node {
            id
            email
            firstName
            lastName
            phone
            createdAt
            updatedAt
          }
        }
      }
    }
  `, {
    email: `email:${email}`
  });
  
  if (response.customers.edges.length === 0) {
    return null;
  }
  
  const c = response.customers.edges[0].node;
  
  return {
    id: c.id.replace('gid://shopify/Customer/', ''),
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
}
```

## Use Cases

### Use Case 1: Manual Enrollment (Admin)

```
Winery admin in LiberVino portal:
  ↓
"Add John Doe to Bronze tier"
  ↓
System checks:
  - Does John exist in our DB? → No
  - Create in our DB
  ↓
System checks CRM:
  - Does john@email.com exist in Commerce7? → No
  - Create customer in Commerce7
  - Get CRM customer ID
  - Update our record with crm_id
  ↓
Create enrollment
  ↓
Add to Bronze discount in Commerce7
  ↓
Done! John gets 10% automatically on next purchase
```

### Use Case 2: Import from Spreadsheet

```
Winery uploads CSV with email list:
  ↓
For each row:
  ├→ Create/update in our DB
  ├→ Upsert in CRM (find by email or create)
  ├→ Store crm_id
  ├→ Create enrollment
  └→ Add to discount eligibility
  ↓
Bulk enrollment complete!
```

### Use Case 3: Customer Self-Signup

```
Customer fills out form on LiberVino portal:
  ↓
Capture: email, name, phone, initial purchase details
  ↓
Create customer in our DB
  ↓
Upsert to CRM
  ↓
Create enrollment
  ↓
Add to discount
  ↓
Send welcome email:
  "You're enrolled! Your 10% discount will auto-apply at checkout"
```

### Use Case 4: Webhook Creates Customer (Reverse Flow)

```
Customer makes purchase on CRM site:
  ↓
Webhook fires with order + customer data
  ↓
We upsert customer in our DB:
  - If exists: Update
  - If new: Create with crm_id from webhook
  ↓
Check qualification and enroll
  ↓
Sync back to CRM (add to discount)
```

## Updated Database Schema

### Update `customers` table

Add a unique constraint for email per client:

```sql
-- In migration
CREATE UNIQUE INDEX idx_customers_client_email 
  ON customers(client_id, email);
```

This ensures:
- One customer record per email per winery
- Can efficiently find/upsert by email
- Prevents duplicates

## Benefits of Upsert Approach

✅ **No double-entry** - Create once, syncs everywhere  
✅ **Handles all sources** - Works from LiberVino or CRM  
✅ **Idempotent** - Safe to call multiple times  
✅ **Resilient** - Email-based lookup prevents duplicates  
✅ **Flexible** - Supports manual enrollment, imports, self-service  

## Error Handling

```typescript
async function ensureCustomerInCrm(customer, client) {
  const crmProvider = getCrmProvider(client.crm_type);
  
  try {
    // If we already have crm_id, verify it exists
    if (customer.crm_id) {
      try {
        await crmProvider.getCustomer(customer.crm_id);
        return customer.crm_id;  // Customer exists, we're good
      } catch (error) {
        // CRM customer not found with this ID, fall through to upsert
        console.warn(`Customer ${customer.crm_id} not found in CRM, upserting...`);
      }
    }
    
    // Upsert customer
    const crmCustomer = await crmProvider.upsertCustomer({
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone
    });
    
    // Update our record with CRM ID
    if (customer.crm_id !== crmCustomer.id) {
      await db.customers.update(customer.id, {
        crm_id: crmCustomer.id
      });
    }
    
    return crmCustomer.id;
    
  } catch (error) {
    console.error('Failed to ensure customer in CRM:', error);
    throw new Error(`Cannot enroll customer: CRM sync failed - ${error.message}`);
  }
}
```

## Complete Enrollment Flow with Upsert

```typescript
async function enrollCustomerInClub(enrollmentData) {
  const { email, firstName, lastName, phone, clientId, stageId } = enrollmentData;
  
  // Step 1: Create/update customer in our database
  const customer = await db.customers.upsert({
    where: {
      client_id_email: { client_id: clientId, email: email }
    },
    create: {
      client_id: clientId,
      email: email,
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      is_club_member: true,
      crm_id: null  // Will be set in next step
    },
    update: {
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      is_club_member: true
    }
  });
  
  // Step 2: Ensure customer exists in CRM and get crm_id
  const client = await db.clients.findById(clientId);
  const crmCustomerId = await ensureCustomerInCrm(customer, client);
  
  // Step 3: Get stage details
  const stage = await db.club_stages.findById(stageId);
  
  // Step 4: Create enrollment
  const enrollment = await db.club_enrollments.create({
    customer_id: customer.id,
    club_stage_id: stageId,
    enrolled_at: new Date(),
    expires_at: new Date(Date.now() + stage.duration_months * 30 * 24 * 60 * 60 * 1000),
    status: 'active',
    qualifying_order_id: null  // Manual enrollment
  });
  
  // Step 5: Add to CRM discount (async, non-blocking)
  queueCrmSync({
    action_type: 'add_customer',
    enrollment_id: enrollment.id,
    stage_id: stageId,
    customer_crm_id: crmCustomerId,
    client_id: clientId
  });
  
  return {
    customer,
    enrollment,
    message: 'Customer enrolled successfully. CRM sync in progress.'
  };
}
```

## Webhook Flow (Reverse Direction)

When webhook arrives from CRM with customer data:

```typescript
async function processOrderWebhook(webhookData) {
  const client = await getClientByTenantShop(webhookData.tenant_or_shop);
  
  // Upsert customer in our database
  const customer = await db.customers.upsert({
    where: {
      client_id_crm_id: {
        client_id: client.id,
        crm_id: webhookData.customer.id
      }
    },
    create: {
      client_id: client.id,
      crm_id: webhookData.customer.id,  // Already have it from webhook
      email: webhookData.customer.email,
      first_name: webhookData.customer.firstName,
      last_name: webhookData.customer.lastName,
      phone: webhookData.customer.phone
    },
    update: {
      email: webhookData.customer.email,
      first_name: webhookData.customer.firstName,
      last_name: webhookData.customer.lastName,
      phone: webhookData.customer.phone
    }
  });
  
  // Process order and check for club qualification
  await processClubQualification(customer, webhookData.order);
}
```

## Updated Database Constraints

```sql
-- Ensure unique email per client
CREATE UNIQUE INDEX idx_customers_client_email 
  ON customers(client_id, email);

-- Ensure unique crm_id per client (when set)
CREATE UNIQUE INDEX idx_customers_client_crm_id 
  ON customers(client_id, crm_id)
  WHERE crm_id IS NOT NULL;

-- Allow NULL crm_id initially (before CRM sync)
ALTER TABLE customers 
  ALTER COLUMN crm_id DROP NOT NULL;
```

## Benefits

✅ **Single source of entry** - Create customer once, anywhere  
✅ **Automatic sync** - No manual duplication  
✅ **Email as key** - Universal identifier across systems  
✅ **Handles both directions** - LiberVino → CRM and CRM → LiberVino  
✅ **Safe retries** - Idempotent upsert operations  
✅ **Prevents duplicates** - Unique constraints on both email and crm_id  

## Edge Cases Handled

### Case 1: Customer exists in CRM but not our DB
```
Webhook arrives with customer data
→ Create in our DB with crm_id
→ No CRM sync needed (already exists)
```

### Case 2: Customer exists in our DB but not CRM
```
Manual enrollment through LiberVino
→ Create in CRM
→ Get crm_id and update our DB
→ Add to discount
```

### Case 3: Customer exists in both
```
Email match found
→ Update both records
→ Add to discount (if not already)
```

### Case 4: Email changed in CRM
```
Webhook arrives with new email
→ Update our DB
→ Keep same crm_id
→ Discount still applies (uses crm_id, not email)
```

### Case 5: CRM customer deleted
```
Try to sync enrollment
→ CRM returns 404
→ Attempt to recreate customer
→ If successful, continue
→ If fails, queue for manual review
```

## Admin UI Features

### Customer Management Screen

```
Actions available:
├─ Import from CSV
│  └→ Upsert all customers to CRM
├─ Manual Enroll
│  └→ Create customer + enroll + sync to CRM
├─ Bulk Enroll
│  └→ Select multiple customers → Enroll in stage
└─ Sync Status
   ├→ Show sync_status for each enrollment
   └→ Retry failed syncs
```

### Sync Health Dashboard

```
Metrics to display:
- Customers synced vs. pending
- Failed sync attempts
- Last successful sync time
- Retry queue length
- CRM API response times
```

This upsert approach ensures customers are never duplicated and can be enrolled from any entry point!

Would you like me to add these upsert methods to the CRM provider implementations?

