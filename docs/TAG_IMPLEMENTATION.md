# Commerce7 Tag Implementation for Customer Segmentation

## Overview

This implementation uses Commerce7 customer tags for tier-based customer segmentation instead of individual customer selection. Each club tier automatically gets its own tag, and customers are added to tiers by applying the appropriate tag.

## Benefits

1. **Simplified UI**: No need for customer selection UI since tags are managed automatically
2. **Scalable**: Tags can handle unlimited customers without API limitations
3. **Clear Naming**: "Yno" prefix helps users identify app-created resources
4. **Automatic**: Tag creation and application happens seamlessly during setup

## What Was Created

### 1. Type Definitions (`app/types/tag.ts`)
- `C7Tag` - Commerce7 tag structure
- `C7TagObjectType` - Enum for tag types (Customer, Order, etc.)
- `TagListItem` - Simplified type for UI display
- Helper functions for tag conversion

### 2. Naming Utilities (`app/lib/naming.ts`)
Standardized naming with "Yno" prefix:
- `formatClubName("Wine Club")` → `"Yno Wine Club"`
- `formatTagName("Gold Tier")` → `"Yno Gold Tier"`
- `formatCouponTitle("Gold Discount")` → `"Yno Gold Discount"`
- `formatCouponCode("gold tier")` → `"YNO-GOLDTIER"`

### 3. Commerce7 API Methods (`app/lib/crm/commerce7.server.ts`)
New methods on `Commerce7Provider`:

#### Tag Management
- `searchCustomerTags(params?)` - Search for customer tags
- `getTag(id)` - Get a specific tag by ID
- `createCustomerTag(title, type)` - Create a new customer tag
- `deleteTag(tagId)` - Delete a tag

#### Customer Tagging
- `tagCustomer(customerId, tagId)` - Add a tag to a customer
- `untagCustomer(customerId, tagId)` - Remove a tag from a customer
- `getCustomerTags(customerId)` - Get all tags for a customer

### 4. Tier Helper Functions (`app/lib/tier-helpers.server.ts`)
High-level functions for tier management:

```typescript
// Create tag + coupon for a new tier
createTierTagAndCoupon(provider, tierName, discount)

// Update existing tier's coupon
updateTierCoupon(provider, couponId, tagId, tagTitle, discount)

// Add customer to a tier
addCustomerToTier(provider, customerId, tagId)

// Remove customer from a tier
removeCustomerFromTier(provider, customerId, tagId)
```

### 5. Database Migration (`supabase/migrations/009_add_tag_to_club_stages.sql`)
Added `platform_tag_id` field to `club_stages` table to store the tag ID for each tier.

## Integration into Setup Flow

### Creating a New Tier

When creating a tier in `app.setup.tsx`, replace the coupon creation logic with:

```typescript
import { createTierTagAndCoupon } from "~/lib/tier-helpers.server";
import { Commerce7Provider } from "~/lib/crm/commerce7.server";

// In your action function:
for (const tier of tiers) {
  // 1. Insert tier into database
  const { data: createdTier } = await supabase
    .from('club_stages')
    .insert({
      club_program_id: programId,
      name: tier.name,
      discount_percentage: parseFloat(tier.discountPercentage),
      duration_months: parseInt(tier.durationMonths),
      min_purchase_amount: parseFloat(tier.minPurchaseAmount),
      stage_order: i,
    })
    .select()
    .single();

  // 2. Create tag and coupon together
  if (tier.discount) {
    const provider = new Commerce7Provider(session.tenantShop);
    const discount = parseDiscount(tier.discount);
    
    const result = await createTierTagAndCoupon(
      provider,
      tier.name,
      discount
    );
    
    // 3. Update tier with tag and coupon IDs
    await supabase
      .from('club_stages')
      .update({
        platform_tag_id: result.tagId,
        platform_discount_id: result.couponId,
        discount_code: result.couponCode,
        discount_title: result.couponTitle,
      })
      .eq('id', createdTier.id);
  }
}
```

### Updating an Existing Tier

```typescript
import { updateTierCoupon } from "~/lib/tier-helpers.server";

// Get existing tier data
const existingTier = existingProgram.club_stages.find((s: any) => s.id === tier.id);

if (existingTier?.platform_discount_id && tier.discount) {
  const provider = new Commerce7Provider(session.tenantShop);
  const discount = parseDiscount(tier.discount);
  
  const result = await updateTierCoupon(
    provider,
    existingTier.platform_discount_id,
    existingTier.platform_tag_id,
    existingTier.name, // or get tag title from C7
    discount
  );
  
  // Update database
  await supabase
    .from('club_stages')
    .update({
      discount_code: result.couponCode,
      discount_title: result.couponTitle,
    })
    .eq('id', tier.id);
}
```

### Deleting a Tier

When deleting a tier, clean up both the coupon and tag:

```typescript
const tierToDelete = existingProgram.club_stages.find((s: any) => s.id === tierIdToDelete);

if (tierToDelete && session.crmType === 'commerce7') {
  const provider = new Commerce7Provider(session.tenantShop);
  
  // Delete coupon
  if (tierToDelete.platform_discount_id) {
    await provider.deleteC7Coupon(tierToDelete.platform_discount_id);
  }
  
  // Delete tag
  if (tierToDelete.platform_tag_id) {
    await provider.deleteTag(tierToDelete.platform_tag_id);
  }
}

// Delete from database
await supabase.from('club_stages').delete().eq('id', tierIdToDelete);
```

## Adding Customers to Tiers

When enrolling a customer in a tier:

```typescript
import { addCustomerToTier } from "~/lib/tier-helpers.server";

// After creating the enrollment in Supabase
const provider = new Commerce7Provider(session.tenantShop);
await addCustomerToTier(
  provider,
  customer.crm_id, // Customer's Commerce7 ID
  tier.platform_tag_id
);
```

## UI Considerations

### Remove Customer Selection UI
Since tags are managed automatically, you should:
1. Remove the customer selection interface from the discount form
2. Show a read-only indicator that the discount uses tier-based tagging
3. Display which tag is being used (e.g., "Available to: Yno Gold Tier")

### Example UI Update

```typescript
// In your discount form component:
{session.crmType === 'commerce7' && (
  <Banner tone="info">
    <Text as="p">
      This discount is automatically available to customers in the{' '}
      <Text as="span" fontWeight="bold">{tierName}</Text> tier.
      Customers are added to tiers through enrollment, not individual selection.
    </Text>
  </Banner>
)}
```

## Naming Convention Summary

All resources created by the app use the "Yno" prefix:

| Resource Type | Example Input | Output |
|--------------|---------------|---------|
| Club Name | "Wine Lovers Club" | "Yno Wine Lovers Club" |
| Tier Tag | "Gold Tier" | "Yno Gold Tier" |
| Coupon Title | "Gold Member Discount" | "Yno Gold Member Discount" |
| Coupon Code | "gold tier" | "YNO-GOLDTIER" |

Users can always change these in Commerce7 if desired, but the initial naming helps identify app-created resources.

## Database Schema Update

The `club_stages` table now includes:
```sql
platform_tag_id VARCHAR(255)  -- ID of the customer tag in Commerce7
```

This field is populated when a tier is created and used when enrolling customers.

## Error Handling

The `createTierTagAndCoupon` function includes automatic cleanup:
- If tag creation succeeds but coupon creation fails, the tag is automatically deleted
- This prevents orphaned tags in Commerce7

## Migration Path

To migrate existing tiers without tags:

```typescript
// Run this as a one-time migration
for (const tier of existingTiers) {
  if (!tier.platform_tag_id && tier.platform_discount_id) {
    const provider = new Commerce7Provider(tenantId);
    
    // Create tag
    const tagTitle = formatTagName(tier.name);
    const tag = await provider.createCustomerTag(tagTitle);
    
    // Update coupon to use tag
    const discount = {
      /* ... build discount from tier data ... */
      customerSelection: {
        all: false,
        customers: [],
        segments: [{ id: tag.id, name: tag.title }],
      },
    };
    
    await updateTierCoupon(
      provider,
      tier.platform_discount_id,
      tag.id,
      tag.title,
      discount
    );
    
    // Update database
    await supabase
      .from('club_stages')
      .update({ platform_tag_id: tag.id })
      .eq('id', tier.id);
  }
}
```

## Next Steps

1. Run the database migration: `009_add_tag_to_club_stages.sql`
2. Update the setup flow to use `createTierTagAndCoupon`
3. Update tier update logic to use `updateTierCoupon`
4. Add customer enrollment logic with `addCustomerToTier`
5. Remove customer selection UI from discount forms (for Commerce7)
6. Test tag creation and customer tagging in Commerce7

