# Discount Components

This directory contains components for creating and managing unified discounts that work across both Commerce7 and Shopify platforms.

## Components

### `DiscountForm.tsx`

The main form component for creating/editing discounts during tier setup.

**Features:**
- Unified interface that works for both Commerce7 and Shopify
- Discount code input (auto-uppercase, no spaces)
- Internal title for organization
- Discount type selection (percentage or fixed amount)
- Discount value with proper validation
- Minimum purchase requirements (none, amount, or quantity)
- Display of products/collections (configured separately)
- Display of customer eligibility (updated as customers join tiers)

**Props:**
```typescript
interface DiscountFormProps {
  discount: Discount;              // Current discount state
  onChangeDiscount: (discount: Discount) => void;  // Update callback
  onSubmit: () => void;             // Save action
  onCancel: () => void;             // Cancel action
  submitLabel?: string;             // Button text (default: "Save Discount")
  cancelLabel?: string;             // Button text (default: "Cancel")
}
```

**Basic Usage:**
```tsx
import DiscountForm from "~/components/DiscountForm";
import { useDiscount } from "~/hooks/useDiscount";
import { toC7Coupon, toShopifyDiscount } from "~/types";

function TierSetup({ platform }) {
  const { discount, setDiscount } = useDiscount(platform);

  const handleSave = async () => {
    // Convert to platform-specific format
    const platformDiscount = platform === "commerce7" 
      ? toC7Coupon(discount)
      : toShopifyDiscount(discount);
    
    // Send to your API
    await createDiscount(platformDiscount);
  };

  return (
    <DiscountForm
      discount={discount}
      onChangeDiscount={setDiscount}
      onSubmit={handleSave}
      onCancel={() => {/* handle cancel */}}
    />
  );
}
```

### `DiscountFormExample.tsx`

A complete example showing how to integrate the discount form into a tier creation flow.

## Hooks

### `useDiscount`

Custom hook for managing discount state.

**API:**
```typescript
const { 
  discount,        // Current discount object
  setDiscount,     // Update entire discount
  resetDiscount,   // Reset to default
  updateField      // Update single field
} = useDiscount(platform, initialDiscount?);
```

**Usage:**
```tsx
import { useDiscount } from "~/hooks/useDiscount";

function MyComponent() {
  const { discount, setDiscount } = useDiscount("commerce7");
  
  // Update the entire discount
  setDiscount({ ...discount, code: "NEWCODE" });
  
  // Or update a single field
  updateField("code", "NEWCODE");
}
```

## Tier Creation Workflow

When creating a tier with a discount:

### 1. **Create the Discount Object**

```tsx
import { createDefaultDiscount } from "~/types/discount";

// Create a new discount for the tier
const discount = createDefaultDiscount("commerce7");
discount.code = "VIP15";
discount.title = "VIP Tier 15% Off";
discount.value = { type: "percentage", percentage: 15 };
discount.minimumRequirement = { type: "amount", amount: 5000 }; // $50
```

### 2. **Configure Discount Details**

Use the `DiscountForm` component to let users configure:
- Discount code (e.g., "VIP15")
- Internal title (e.g., "VIP Tier 15% Off")
- Discount type and value (15% off or $10 off)
- Minimum purchase requirements ($50 minimum or 3 items minimum)

### 3. **Initial State**

When creating during tier setup:
- **Products/Collections**: Empty initially (can be added later)
- **Customers**: Empty initially (added as customers join the tier)
- **Status**: Set to "scheduled" or "active" based on start date

```tsx
discount.appliesTo = {
  all: false,        // Start specific, not all products
  products: [],      // Will be configured later
  collections: []    // Will be configured later
};

discount.customerSelection = {
  all: false,        // Not available to everyone
  customers: [],     // Will be added as they join tier
  segments: []       // Or use segments/tags for grouping
};
```

### 4. **Convert to Platform Format**

Before sending to Commerce7/Shopify API:

```tsx
import { toC7Coupon, toShopifyDiscount } from "~/types";

// For Commerce7
const c7Coupon = toC7Coupon(discount);
await createC7Coupon(tenantId, c7Coupon);

// For Shopify
const shopifyDiscount = toShopifyDiscount(discount);
await createShopifyDiscount(session, shopifyDiscount);
```

### 5. **Store in Database**

Save the discount details to Supabase:

```tsx
const { data, error } = await supabase
  .from('tier_discounts')
  .insert({
    tier_id: tierId,
    platform: discount.platform,
    discount_id: createdDiscount.id, // ID from C7/Shopify
    code: discount.code,
    title: discount.title,
    value_type: discount.value.type,
    value_amount: discount.value.percentage || discount.value.amount,
    min_requirement_type: discount.minimumRequirement.type,
    min_requirement_value: discount.minimumRequirement.quantity || discount.minimumRequirement.amount,
    created_at: new Date().toISOString()
  });
```

### 6. **Update Customers Later**

As customers join the tier, add them to the discount:

```tsx
// Add customer to discount
discount.customerSelection.customers.push({
  id: customerId,
  email: customer.email,
  name: customer.name
});

// Update in platform
const updated = platform === "commerce7"
  ? toC7Coupon(discount)
  : toShopifyDiscount(discount);
  
await updateDiscount(discount.id, updated);
```

## Field Descriptions

### Required Fields
- **code**: Discount code customers enter at checkout (uppercase, no spaces)
- **title**: Internal name for the discount
- **value.type**: Either "percentage" or "fixed-amount"
- **value.percentage** OR **value.amount**: The discount value

### Optional Configuration
- **minimumRequirement.type**: "none", "quantity", or "amount"
- **minimumRequirement.quantity**: Minimum items required
- **minimumRequirement.amount**: Minimum purchase amount (in cents)
- **appliesTo.all**: If true, applies to all products
- **appliesTo.products**: Array of specific products
- **appliesTo.collections**: Array of specific collections
- **customerSelection.all**: If true, available to all customers
- **customerSelection.customers**: Array of specific customers
- **customerSelection.segments**: Array of customer segments/tags

### Important Notes

1. **No Expiration**: Discounts never expire. They remain active until the client uninstalls the app. Customer duration is tracked in Supabase.

2. **Currency**: All amounts are stored in cents (e.g., $50.00 = 5000 cents) for precision.

3. **Percentages**: Store as 0-100 (e.g., 15% = 15), not 0-1. The conversion utilities handle platform-specific formats.

4. **Customer Management**: Start with zero customers when creating the discount. Add customers as they join the tier.

5. **Platform Differences**: The unified type handles platform-specific conversions automatically through `toC7Coupon()` and `toShopifyDiscount()`.

## Example: Complete Tier Setup Flow

```tsx
import React, { useState } from "react";
import { Page, Layout, Card, Button } from "@shopify/polaris";
import DiscountForm from "~/components/DiscountForm";
import { useDiscount } from "~/hooks/useDiscount";
import { toC7Coupon } from "~/types";

function TierSetupPage() {
  const [step, setStep] = useState(1);
  const { discount, setDiscount } = useDiscount("commerce7");

  const handleSaveDiscount = async () => {
    // Step 1: Convert to platform format
    const c7Coupon = toC7Coupon(discount);
    
    // Step 2: Create in Commerce7
    const response = await fetch("/api/c7/coupons", {
      method: "POST",
      body: JSON.stringify(c7Coupon)
    });
    const created = await response.json();
    
    // Step 3: Save to database
    await fetch("/api/tiers/discounts", {
      method: "POST",
      body: JSON.stringify({
        discount_id: created.id,
        code: discount.code,
        title: discount.title,
        // ... other fields
      })
    });
    
    // Step 4: Move to next step
    setStep(2);
  };

  return (
    <Page title="Create New Tier">
      <Layout>
        <Layout.Section>
          {step === 1 && (
            <Card>
              <DiscountForm
                discount={discount}
                onChangeDiscount={setDiscount}
                onSubmit={handleSaveDiscount}
                onCancel={() => history.back()}
                submitLabel="Continue to Products"
              />
            </Card>
          )}
          
          {step === 2 && (
            <Card>
              {/* Next step: Configure products/collections */}
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

## Type Reference

See `/app/types/discount.ts` for the complete type definitions:
- `Discount` - Main unified discount type
- `DiscountValueType` - "percentage" | "fixed-amount"
- `MinimumRequirementType` - "none" | "quantity" | "amount"
- `DiscountStatus` - "active" | "inactive" | "scheduled"

See `/app/types/discount-commerce7.ts` for Commerce7 conversions.
See `/app/types/discount-shopify.ts` for Shopify conversions.

