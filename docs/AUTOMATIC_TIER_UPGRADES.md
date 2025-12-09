# Automatic Tier Upgrades Implementation

## Overview

This document describes the implementation of automatic tier upgrades based on customer Lifetime Value (LTV). When a customer's annualized LTV qualifies them for a higher tier, they are automatically upgraded during the monthly status check.

## Architecture

### Processing Flow

```
Monthly Status Queue (Batched)
  ↓
For each active member:
  ├─ Check tier upgrade eligibility
  │  ├─ Fetch membership from Commerce7 (includes LTV)
  │  ├─ Calculate annualized LTV
  │  └─ Compare to next tier minimum
  │
  ├─ IF QUALIFIED:
  │  ├─ Cancel old membership in Commerce7
  │  ├─ Create new membership in next tier's club
  │  ├─ Update database (mark old as upgraded, create new enrollment)
  │  ├─ Send upgrade notification to customer
  │  └─ Skip monthly status (upgrade IS the status)
  │
  └─ ELSE:
     └─ Send regular monthly status notification
```

### Key Design Decisions

1. **Synchronous Processing**: Upgrades happen immediately during monthly status processing, not queued to a separate CRM sync queue
2. **One Notification**: Customers receive either an upgrade notification OR a monthly status, never both in the same month
3. **Customer-Focused**: Notifications go to the customer, not the admin (this is automatic membership liberation!)
4. **Preserve Enrollment Date**: Original enrollment date is preserved on upgrade, only expiration is extended by new tier duration

## Implementation Details

### Function: `checkAndPerformTierUpgrade()`

**Location**: `app/lib/communication/membership-communications.server.ts`

**Parameters**:
- `clientId`: Client UUID
- `enrollmentId`: Current enrollment UUID
- `c7MembershipId`: Commerce7 membership ID
- `customerCrmId`: Commerce7 customer ID
- `crmType`: CRM type (currently only 'commerce7' supported)
- `tenantShop`: Commerce7 tenant ID

**Returns**: `{ upgraded: boolean; nextTier?: any; oldTier?: any }`

**Steps**:

1. **Fetch Membership from Commerce7**
   - Calls `getClubMembership(c7MembershipId)`
   - Returns full membership with nested customer and `orderInformation.lifetimeValue`

2. **Calculate Annualized LTV**
   ```typescript
   const ltvInDollars = c7CentsToDollars(membership.customer.orderInformation.lifetimeValue);
   const yearsAsCustomer = (now - createdDate) / 365.25 days;
   const effectiveYears = Math.max(1, yearsAsCustomer);
   const annualizedLTV = ltvInDollars / effectiveYears;
   ```

3. **Check Qualification**
   - Get next tier in progression: `getNextTier(clientId, currentStage.stage_order)`
   - Compare: `annualizedLTV >= nextTier.min_ltv_amount`

4. **Perform Upgrade** (if qualified):
   
   **a. Cancel Old Membership**
   ```typescript
   await crmProvider.cancelTierMembership(
     currentStage.id,
     currentStage.c7_club_id,
     customerCrmId,
     c7MembershipId
   );
   ```
   
   **b. Create New Membership**
   ```typescript
   const newMembership = await crmProvider.createClubMembership({
     customerId: customerCrmId,
     clubId: nextTier.c7_club_id,
     billingAddressId: membership.billToCustomerAddressId,  // Preserve
     shippingAddressId: membership.shipToCustomerAddressId, // Preserve
     paymentMethodId: membership.customerCreditCardId,      // Preserve
     startDate: new Date().toISOString(),
   });
   ```
   
   **c. Update Database**
   ```typescript
   // Mark old enrollment as cancelled (proxy for 'upgraded' status)
   await db.updateEnrollmentStatus(enrollment.id, 'cancelled');
   
   // Calculate new expiration (preserve original enrollment date)
   const originalEnrolledAt = new Date(enrollment.enrolled_at);
   const newExpiresAt = new Date(originalEnrolledAt);
   newExpiresAt.setMonth(newExpiresAt.getMonth() + nextTier.duration_months);
   
   // Create new enrollment
   await db.createClubEnrollment({
     customerId: customer.id,
     clubStageId: nextTier.id,
     status: 'active',
     enrolledAt: enrollment.enrolled_at,  // Preserve original date
     expiresAt: newExpiresAt.toISOString(),
     c7MembershipId: newMembership.id,
   });
   ```
   
   **d. Send Notification**
   ```typescript
   await sendUpgradeNotification(clientId, customerCrmId, currentStage.id, nextTier.id);
   ```

5. **Return Result**
   - `{ upgraded: true, nextTier, oldTier }` if upgrade performed
   - `{ upgraded: false }` if not qualified or error occurred

### Error Handling

- **Fetch Failure**: Log and return `upgraded: false`, monthly status proceeds normally
- **LTV Missing**: Log warning and return `upgraded: false`
- **Cancel Failure**: Log error and return `upgraded: false`, no changes made
- **Create Failure**: Log error, attempt rollback (restore old membership), return `upgraded: false`
- **Database Failure**: Log error (creates inconsistency between C7 and LV), return `upgraded: false`
- **Notification Failure**: Log error but return `upgraded: true` (upgrade succeeded, notification is secondary)

### Integration with Monthly Status

**Location**: `app/lib/communication/membership-communications.server.ts:sendMonthlyStatusNotification()`

```typescript
// Check for tier upgrade FIRST
if (enrollment.c7_membership_id && /* ... */) {
  const upgradeStatus = await checkAndPerformTierUpgrade(/* ... */);
  
  if (upgradeStatus.upgraded) {
    // Upgrade notification already sent, skip monthly status
    console.info(`Tier upgrade performed, skipping monthly status`);
    return;
  }
}

// No upgrade - send regular monthly status
// ... existing monthly status logic ...
```

## Database Schema

### Enrollments

```sql
club_enrollments:
  - id (UUID)
  - customer_id (UUID)
  - club_stage_id (UUID)
  - status ('active' | 'expired' | 'cancelled')
  - enrolled_at (timestamp) -- Preserved on upgrade
  - expires_at (timestamp)  -- Extended on upgrade
  - c7_membership_id (varchar)
```

**Note**: We currently use `status = 'cancelled'` as a proxy for `'upgraded'`. A future enhancement would be to add an explicit `'upgraded'` status.

### Tier Configuration

```sql
club_stages:
  - id (UUID)
  - name (varchar)
  - stage_order (integer)  -- Determines upgrade path
  - duration_months (integer)
  - min_ltv_amount (decimal)  -- Minimum annualized LTV for automatic upgrade
  - c7_club_id (varchar)  -- Required for C7 club membership operations
```

## Testing

### Manual Test: Upgrade Eligibility

1. Create test customer in Commerce7 with high LTV (e.g., $5000)
2. Enroll customer in Bronze tier (min_ltv_amount = $1000)
3. Configure Silver tier with min_ltv_amount = $3000
4. Run monthly status queue: `SELECT * FROM process_monthly_status_queue();`
5. Verify:
   - Customer upgraded to Silver in Commerce7
   - Old Bronze membership cancelled
   - New Silver membership created
   - Database enrollment updated
   - Upgrade notification sent

### Manual Test: Not Qualified

1. Create test customer with low LTV (e.g., $500)
2. Enroll in Bronze tier
3. Configure Silver tier with min_ltv_amount = $3000
4. Run monthly status queue
5. Verify:
   - No upgrade performed
   - Regular monthly status notification sent

### Annualized LTV Calculation

```
Example 1: New customer (6 months)
  - Lifetime Value: $1000
  - Years as customer: 0.5
  - Annualized LTV: $1000 / max(1, 0.5) = $1000 / 1 = $1000

Example 2: 2-year customer
  - Lifetime Value: $4000
  - Years as customer: 2.0
  - Annualized LTV: $4000 / 2.0 = $2000

Example 3: Long-time customer (5 years)
  - Lifetime Value: $6000
  - Years as customer: 5.0
  - Annualized LTV: $6000 / 5.0 = $1200
```

## Future Enhancements

1. **Explicit 'Upgraded' Status**: Add `'upgraded'` as a distinct enrollment status instead of using `'cancelled'`
2. **Upgrade History**: Track upgrade events in a separate table for analytics
3. **Rollback Strategy**: Implement a more robust rollback if membership creation fails
4. **Admin Notifications**: Optional admin alerts for automatic upgrades
5. **Upgrade Rules**: More complex qualification logic (e.g., LTV + points + time)
6. **Multi-Tier Jumps**: Allow skipping tiers if LTV is very high
7. **Downgrade Protection**: Prevent downgrades if LTV drops

## Related Documentation

- `INTEGRATED_TEST_PLAN.md` - Testing strategy and webhook scenarios
- `CRM_SYNC_STRATEGY.md` - General CRM synchronization patterns
- `COMMUNICATION_STRATEGY.md` - Notification templates and preferences
- `TIER_BASED_LOYALTY.md` - Tier progression and loyalty rules

## Status

✅ **Implemented**: January 2025  
🧪 **Testing**: Manual testing in progress  
📦 **Production**: Pending launch

