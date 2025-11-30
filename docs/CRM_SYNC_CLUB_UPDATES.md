# CRM Sync Club Architecture Updates

## Summary

Updated the CRM sync cron job system to use the club-based architecture instead of the deprecated discount-based approach. The system now properly handles:

- **Commerce7**: Uses clubs (`c7_club_id`) for tier membership management
- **Shopify**: Uses promotions from `club_stage_promotions` table (club_id is NULL)

## Key Changes

### 1. Terminology Updates
- Changed from "discount" terminology to "tier membership" terminology
- Method names: `addTierMembership()` / `cancelTierMembership()` instead of discount operations
- Action types: `add_membership`, `cancel_membership`, `upgrade_membership`

### 2. Architecture Changes
- **Removed**: References to `crm_discount_id` (deprecated column)
- **Added**: Use of `c7_club_id` from `club_stages` table (nullable)
- **Added**: Support for `c7_membership_id` from `club_enrollments` for cancellations

### 3. CRM-Specific Handling

#### Commerce7
- Uses `c7_club_id` to identify which club to add/remove customers from
- Uses `c7_membership_id` (if available) for membership cancellations
- `c7_club_id` is nullable but required for membership operations

#### Shopify
- `c7_club_id` will be NULL (Shopify doesn't have clubs)
- Promotions are looked up from `club_stage_promotions` table using `stage_id`
- Multiple promotions per tier are supported

## Migrations Created

### 026_update_sync_queue_action_types.sql
Updates action type values to use membership terminology:
- `add_customer` → `add_membership`
- `remove_customer` → `cancel_membership`
- `upgrade_customer` → `upgrade_membership`

### 027_fix_expiration_cron_for_clubs.sql
Fixes the expiration cron job to:
- Use `c7_club_id` instead of `crm_discount_id`
- Remove references to deprecated `synced_to_crm` column
- Get `c7_membership_id` from enrollments for context

### 028_fix_sync_queue_for_clubs.sql
Updates the sync queue processor to:
- Use `clubId` instead of `discountId` in API requests
- Handle nullable `c7_club_id` for Shopify
- Pass `membershipId` for Commerce7 cancellations
- Look up enrollment data to get membership IDs

## API Changes

### `/api/cron/sync` Endpoint

**Request Body Changes:**
- `discountId` → `clubId` (nullable - Commerce7 only)
- Added `membershipId` (optional - Commerce7 membership ID for cancellations)
- `oldDiscountId` → `oldClubId` (nullable)

**Validation:**
- Commerce7 requires `clubId` for add/upgrade operations
- Commerce7 cancellations require either `membershipId` or `clubId`
- Shopify operations don't require `clubId` (will be NULL)

## CRM Provider Interface Updates

### Method Signatures Changed

```typescript
// Old
addTierMembership(discountId: string, customerId: string): Promise<void>;
cancelTierMembership(discountId: string, customerId: string): Promise<void>;

// New
addTierMembership(stageId: string, clubId: string | null, customerId: string): Promise<void>;
cancelTierMembership(stageId: string, clubId: string | null, customerId: string, membershipId?: string | null): Promise<void>;
```

### Implementation Requirements

**Commerce7:**
- `addTierMembership`: Uses `clubId` to add customer to Commerce7 club
- `cancelTierMembership`: Uses `membershipId` if available, otherwise uses `clubId` + `customerId` to find membership

**Shopify:**
- `addTierMembership`: Uses `stageId` to look up promotions from `club_stage_promotions`, adds customer to all promotions
- `cancelTierMembership`: Uses `stageId` to look up promotions, removes customer from all promotions
- `clubId` and `membershipId` are ignored (always NULL for Shopify)

## Database Schema Notes

### `club_stages` Table
- `c7_club_id` VARCHAR(255) - **nullable** (required for Commerce7, NULL for Shopify)
- Indexed for lookups

### `club_stage_promotions` Table
- Multiple promotions per tier
- `crm_id` - Promotion ID from CRM
- `crm_type` - 'commerce7' or 'shopify'
- Used by Shopify for membership operations

### `club_enrollments` Table
- `c7_membership_id` VARCHAR(255) - **nullable** (Commerce7 membership ID)
- Used for direct membership cancellation in Commerce7

## When Operations Happen

### Cancellations (Cron Jobs)
- **Trigger**: Daily expiration cron job at 2 AM UTC
- **Action**: `cancel_membership`
- **Commerce7**: Uses `c7_membership_id` or `c7_club_id` + customer to find membership
- **Shopify**: Removes customer from all tier promotions

### New Memberships (Order Webhooks)
- **Trigger**: Order webhook from CRM
- **Action**: `add_membership`
- **Commerce7**: Creates ClubMembership (via `createClubMembership()`)
- **Shopify**: Adds customer to all tier promotions

### Upgrades (Order Webhooks)
- **Trigger**: Order webhook when customer qualifies for higher tier
- **Action**: `upgrade_membership`
- **Commerce7**: Cancels old membership, creates new membership
- **Shopify**: Removes from old promotions, adds to new promotions

## Next Steps

1. **Implement Commerce7 Methods:**
   - Complete `addTierMembership()` - may need to recreate membership if sync queue retry
   - Complete `cancelTierMembership()` - use membershipId if available, otherwise lookup

2. **Implement Shopify Methods:**
   - Query `club_stage_promotions` by `stage_id` and `crm_type = 'shopify'`
   - Add/remove customer from each promotion's eligibility list
   - Handle multiple promotions per tier

3. **Testing:**
   - Test Commerce7 membership cancellation with and without `membershipId`
   - Test Shopify promotion management
   - Test upgrade flows for both CRMs

4. **Documentation:**
   - Update CRM provider implementation docs
   - Document Shopify promotion management strategy

