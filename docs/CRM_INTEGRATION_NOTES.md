# CRM Integration Notes

## Discount Management Strategy

### Core Principle

**Our system tracks eligibility and expiration. The CRM enforces the discount.**

### How It Works

#### 1. Stage Configuration in Our System

```sql
-- Example: Silver Stage
{
  name: "Silver",
  discount_percentage: 15.00,
  discount_code: "CLUB-SILVER-15",  -- References CRM discount
  duration_months: 6,
  min_purchase_amount: 150.00,
  stage_order: 2
}
```

#### 2. Discount Creation in CRM

**Commerce7:**
```
Create Coupon Code: "CLUB-SILVER-15"
- Type: Percentage
- Value: 15%
- Applies to: Wine products only
- Usage: Unlimited (we control eligibility)
- Active: Yes
```

**Shopify:**
```
Create Discount Code: "CLUB-SILVER-15"
- Type: Percentage
- Value: 15%
- Applies to: Collection "Wines"
- Customer eligibility: All customers (we control via app)
- Usage limits: None (we control eligibility)
- Active: Yes
```

#### 3. Order Flow

```
1. Customer shops on CRM platform (Commerce7/Shopify)

2. At checkout:
   - CRM queries our webhook endpoint: "Is customer eligible for club discount?"
   - OR customer enters discount code manually
   - OR discount auto-applied via CRM app integration

3. Our system checks:
   - Does customer have active club_enrollment?
   - Is expires_at > NOW()?
   - If yes → return discount code "CLUB-SILVER-15"

4. CRM applies discount:
   - Validates discount code exists
   - Validates product qualifications (CRM handles this)
   - Applies 15% to qualifying products

5. Order completes in CRM

6. Webhook fires to our system:
   POST /webhooks/c7 or /webhooks/shp
   {
     "order_id": "...",
     "customer_id": "...",
     "total": 180.00,
     "discount_codes": ["CLUB-SILVER-15"]
   }

7. Our system processes:
   - Check if order qualifies for stage renewal/upgrade
   - Update club_enrollment accordingly
   - Award loyalty points if eligible
   - Store order in our database
```

## Product Qualification Handling

### Why CRM Manages Product Rules

**Problem:** Different bottle sizes, product types, exclusions

**Solution:** Let the CRM handle it!

- Commerce7 & Shopify have robust product qualification rules
- They can specify: "applies to wine products, excludes accessories"
- They handle complex rules: "minimum 2 bottles, exclude sale items"
- We don't need to duplicate this logic

### Our Role

We simply:
1. Track whether customer qualifies for a discount tier
2. Provide the discount code to use
3. Let CRM enforce product-level rules

### Example Scenarios

**Scenario 1: Customer buys wine + accessories**
```
Cart:
- 2 bottles wine ($150)
- Wine opener ($25)
Total: $175

Our system: "Customer qualifies for Silver (15% off)"
CRM applies: 15% off wines only = $150 × 0.15 = $22.50 discount
Final total: $152.50

Our webhook receives: total = $152.50
We check: $152.50 meets Silver minimum? Yes! → Renew Silver
```

**Scenario 2: Customer buys sale wine**
```
Cart:
- Sale wine already 20% off ($80)

CRM rules: "Discount codes don't stack with sale prices"
CRM applies: No additional discount
Final total: $80

Our webhook receives: total = $80
We check: $80 meets Bronze minimum? Yes! → Renew Bronze
```

## Webhook Processing

### Key Data Points We Need

From **Commerce7:**
```json
{
  "tenantId": "winery-123",
  "event": "orders/create",
  "data": {
    "id": "order-456",
    "customerId": "cust-789",
    "total": 180.00,
    "discountCodes": ["CLUB-SILVER-15"],
    "createdAt": "2025-01-15T10:30:00Z"
  }
}
```

From **Shopify:**
```json
{
  "shop": "my-winery.myshopify.com",
  "topic": "orders/create",
  "id": 12345,
  "customer": {
    "id": 67890
  },
  "total_price": "180.00",
  "discount_codes": [
    {"code": "CLUB-SILVER-15", "amount": "27.00"}
  ],
  "created_at": "2025-01-15T10:30:00Z"
}
```

### Processing Logic

```typescript
async function processOrderWebhook(webhookData) {
  // 1. Identify client (tenant/shop)
  const client = await getClientByTenantShop(webhookData.tenant_or_shop);
  
  // 2. Find or create customer
  const customer = await upsertCustomer({
    client_id: client.id,
    crm_id: webhookData.customer_id,
    // ... other fields
  });
  
  // 3. Store order
  const order = await createOrder({
    client_id: client.id,
    crm_id: webhookData.order_id,
    customer_id: customer.id,
    total: webhookData.total,
    // ...
  });
  
  // 4. Check for club qualification
  const stages = await getActiveStages(client.id);
  const qualifyingStage = stages
    .filter(s => webhookData.total >= s.min_purchase_amount)
    .sort((a, b) => b.stage_order - a.stage_order)[0]; // Highest tier
  
  if (qualifyingStage) {
    await processClubEnrollment(customer, qualifyingStage, order);
  }
  
  // 5. Award loyalty points if eligible
  if (customer.cumulative_membership_days >= 365) {
    await awardLoyaltyPoints(customer.id, order.id, order.total);
  }
}
```

## Discount Code Sync

### Initial Setup

When winery creates stages in our system:

```typescript
async function createClubStage(stageData) {
  // 1. Create stage in our DB
  const stage = await db.club_stages.create(stageData);
  
  // 2. Generate discount code if not provided
  if (!stage.discount_code) {
    stage.discount_code = `CLUB-${stage.name.toUpperCase()}-${stage.discount_percentage}`;
    await db.club_stages.update(stage.id, { discount_code: stage.discount_code });
  }
  
  // 3. Show instructions to winery
  return {
    stage,
    instructions: `
      Please create this discount code in your ${client.crm_type} account:
      
      Code: ${stage.discount_code}
      Type: Percentage
      Value: ${stage.discount_percentage}%
      Applies to: Wine products (configure in CRM)
      Usage: Unlimited
    `
  };
}
```

### Future Enhancement: Auto-Sync

Could potentially use CRM APIs to auto-create discount codes:

**Commerce7 API:**
```typescript
await commerce7.createCoupon({
  code: stage.discount_code,
  type: 'percentage',
  value: stage.discount_percentage,
  // ... product rules
});
```

**Shopify Admin API:**
```typescript
await shopify.createPriceRule({
  title: stage.name,
  value_type: 'percentage',
  value: -stage.discount_percentage,
  // ... product collections
});
```

## Benefits of This Approach

✅ **Separation of Concerns**
- We handle: eligibility, timing, expiration
- CRM handles: product rules, inventory, pricing

✅ **Flexibility**
- Winery can change product rules in CRM without touching our system
- Can exclude specific products, add minimum bottle requirements, etc.

✅ **Simplicity**
- No need to track product catalogs
- No need to handle bottle sizes, SKUs, etc.
- Dollar-based qualification is clean and simple

✅ **CRM Native**
- Discount codes work exactly like any other CRM discount
- Familiar to winery staff
- Integrates with their existing workflows

## Data We Don't Need to Track

❌ Product SKUs  
❌ Bottle sizes (375ml, 750ml, 1.5L, etc.)  
❌ Product categories  
❌ Inventory levels  
❌ Individual line items  
❌ Product-level qualification rules  

## Data We DO Track

✅ Order total (dollar amount)  
✅ Customer who made purchase  
✅ Which discount code was used (optional, for verification)  
✅ Club enrollment eligibility  
✅ Loyalty points eligibility  

---

This clean separation makes our system:
- Easier to build
- Easier to maintain
- More flexible for clients
- Less coupled to CRM specifics

