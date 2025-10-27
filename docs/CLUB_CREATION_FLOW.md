# Club Creation Flow - Detailed Process

## Overview

This document describes the complete flow for creating a LiberoVino Club with tiers, including Commerce7 synchronization, promotion assignment, and loyalty configuration. The flow includes comprehensive error handling with rollback mechanisms to ensure data consistency.

## Flow Diagram Reference

This document describes the implementation of the attached flow diagram showing the complete club creation process with error handling and rollback mechanisms.

## High-Level Process

```
1. Create LV Club (database)
2. For each tier:
   a. Create LV Tier (database)
   b. Save Club to C7 (if first tier)
   c. Save Promo(s) to C7
   d. Save tier data to LV database
   e. Optionally add Loyalty tier to C7
3. Handle errors with appropriate rollbacks
```

## Detailed Flow

### Step 1: Create LV Club

**Action**: Create club record in LiberoVino database

**Database Operation**:
```sql
INSERT INTO club_programs (
  client_id,
  name,
  description,
  is_active
) VALUES (
  '<client_uuid>',
  'Founders Circle',
  'Our exclusive membership program',
  true
);
```

**Output**: 
- `club_program_id` - UUID for the new club

**Error Handling**:
- Database constraint violations → throw error
- Duplicate club for client → throw error

---

### Step 2: Create LV Tier

**Action**: Create tier record in LiberoVino database

**Database Operation**:
```sql
INSERT INTO club_stages (
  club_program_id,
  name,
  discount_percentage,
  duration_months,
  min_purchase_amount,
  stage_order,
  is_active
) VALUES (
  '<club_program_id>',
  'Bronze',
  15.00,
  3,
  100.00,
  1,
  true
);
```

**Output**:
- `club_stage_id` - UUID for the new tier

**Error Handling**:
- Database constraint violations → throw error
- Invalid stage_order → throw error

---

### Step 3: Save Club to C7

**Action**: Create corresponding club on Commerce7

**When**: Only on the **first tier** of a club

**API Call**:
```typescript
POST https://{tenant}.commerce7.com/api/v1/club
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "title": "Founders Circle",
  "description": "Our exclusive membership program",
  "isActive": true,
  "clubCode": "FC2025"  // Generated from LV club name
}
```

**Response**:
```json
{
  "club": {
    "id": "c7-club-uuid",
    "title": "Founders Circle",
    "clubCode": "FC2025",
    "createdAt": "2025-10-26T10:00:00Z"
  }
}
```

**Database Update**:
```sql
UPDATE club_programs
SET c7_club_id = '<c7-club-uuid>'
WHERE id = '<club_program_id>';
```

**Error Handling**:

#### If Save Fails:
```
❌ C7 API returns error
   ↓
🔄 No rollback needed (no C7 data created yet)
   ↓
🚨 Throw error to user
```

**Possible Errors**:
- 401 Unauthorized → Invalid access token
- 400 Bad Request → Invalid club data
- 409 Conflict → Club code already exists
- 500 Server Error → C7 internal error

**Rollback**: None needed (local DB data preserved for retry)

---

### Step 4: Save Promo(s) to C7

**Action**: Create promotional discount(s) for the tier on Commerce7

**When**: For every tier

**Promotion Strategy**:
- One promo per tier (simple approach)
- OR multiple promos per tier (e.g., different product categories)

**API Call**:
```typescript
POST https://{tenant}.commerce7.com/api/v1/promotion
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "title": "Bronze Member Discount",
  "code": "BRONZE-FC-2025",
  "type": "percentage",
  "value": 15.0,
  "clubId": "<c7-club-uuid>",
  "isActive": true,
  "autoApply": true,  // KEY: Automatic application
  "applicableProducts": [],  // Empty = all products
  "startDate": "2025-10-26T00:00:00Z",
  "endDate": null  // No expiration
}
```

**Response**:
```json
{
  "promotion": {
    "id": "c7-promo-uuid",
    "title": "Bronze Member Discount",
    "code": "BRONZE-FC-2025",
    "value": 15.0,
    "autoApply": true
  }
}
```

**Database Update**:
```sql
-- New table to track promos
INSERT INTO club_promotions (
  club_stage_id,
  c7_promo_id,
  promo_code,
  promo_type,
  discount_value,
  is_active
) VALUES (
  '<club_stage_id>',
  '<c7-promo-uuid>',
  'BRONZE-FC-2025',
  'percentage',
  15.0,
  true
);
```

**Error Handling**:

#### If Save Fails:
```
❌ C7 API returns error creating promo
   ↓
🔄 Rollback: Delete Club from C7
   ↓
   DELETE https://{tenant}.commerce7.com/api/v1/club/{c7-club-uuid}
   ↓
🔄 Rollback: Delete Club from LV database
   ↓
   DELETE FROM club_programs WHERE id = '<club_program_id>'
   ↓
🚨 Throw error to user
```

**Possible Errors**:
- 401 Unauthorized → Invalid access token
- 400 Bad Request → Invalid promo data
- 404 Not Found → Club ID not found (race condition)
- 409 Conflict → Promo code already exists

**Rollback Actions**:
1. Delete C7 Club (if this was first tier)
2. Delete LV Club record
3. Throw descriptive error

---

### Step 5: Save to LV Database

**Action**: Persist tier and promotion data to LiberoVino database

**Database Operations**:
```sql
-- Update tier with C7 references
UPDATE club_stages
SET c7_club_id = '<c7-club-uuid>'
WHERE id = '<club_stage_id>';

-- Promotion reference already saved in Step 4
```

**Error Handling**:

#### If Save Fails:
```
❌ Database operation fails
   ↓
🔄 Rollback: Delete Promo(s) from C7
   ↓
   DELETE https://{tenant}.commerce7.com/api/v1/promotion/{c7-promo-uuid}
   ↓
   (If deletion succeeds)
   ↓
🔄 Rollback: Delete Club from C7 (if first tier)
   ↓
   DELETE https://{tenant}.commerce7.com/api/v1/club/{c7-club-uuid}
   ↓
   (If deletion succeeds)
   ↓
🔄 Rollback: Delete Club from LV database
   ↓
   DELETE FROM club_programs WHERE id = '<club_program_id>'
   ↓
🚨 Throw error to user
```

**Complex Rollback Scenarios**:

1. **Promo deletion succeeds** → Continue to club deletion
2. **Promo deletion fails** → Log error, still throw to user
3. **Club deletion succeeds** → Clean state
4. **Club deletion fails** → Log error, orphaned C7 data (manual cleanup needed)

**Mitigation**: 
- Store all C7 IDs before operations
- Log all rollback attempts
- Admin panel to clean orphaned C7 resources

---

### Step 6: Add Loyalty (Optional)

**Decision Point**: Does this tier include loyalty benefits?

```
Add Loyalty?
   ↓
  Yes → Continue to Step 6a
   ↓
   No → Skip to "Repeat for Each Tier"
```

#### Step 6a: Create Loyalty Tier

**Action**: Configure loyalty earning for this tier

**Loyalty Configuration**:
```typescript
{
  tierName: "Bronze",
  pointsPerDollar: 1.0,
  bonusMultiplier: 1.0,  // No bonus
  minPointsForRedemption: 100
}
```

**Use Cases**:
1. **Loyalty-Only Tier**: No discount, high point earning (e.g., 10 points/$)
2. **Discount + Loyalty**: Normal discount, normal point earning (e.g., 1 point/$)
3. **Premium Tier**: High discount, high point earning (e.g., 5 points/$)

#### Step 6b: Save Loyalty to C7

**API Call**:
```typescript
POST https://{tenant}.commerce7.com/api/v1/loyalty/tier
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "Bronze Tier",
  "clubId": "<c7-club-uuid>",
  "pointsPerDollar": 1.0,
  "redemptionRate": 0.01,  // $0.01 per point
  "isActive": true
}
```

**Response**:
```json
{
  "loyaltyTier": {
    "id": "c7-loyalty-uuid",
    "name": "Bronze Tier",
    "pointsPerDollar": 1.0,
    "clubId": "<c7-club-uuid>"
  }
}
```

**Error Handling**:

#### If Save to C7 Fails:
```
❌ C7 API returns error creating loyalty tier
   ↓
🔄 No rollback of Club/Promo (they can exist without loyalty)
   ↓
🚨 Throw error to user
```

**Note**: Loyalty is optional, so club/promo remain intact

#### Step 6c: Save Loyalty to LV

**Database Operation**:
```sql
INSERT INTO tier_loyalty_config (
  club_stage_id,
  c7_loyalty_tier_id,
  points_per_dollar,
  redemption_rate,
  is_active
) VALUES (
  '<club_stage_id>',
  '<c7-loyalty-uuid>',
  1.0,
  0.01,
  true
);
```

**Error Handling**:

#### If Save to LV Fails:
```
❌ Database operation fails
   ↓
🔄 Rollback: Delete Loyalty from C7
   ↓
   DELETE https://{tenant}.commerce7.com/api/v1/loyalty/tier/{c7-loyalty-uuid}
   ↓
   (If deletion succeeds)
   ↓
🚨 Throw error to user (Club and Promo remain intact)
```

**Note**: Club and Promos are NOT rolled back since loyalty is optional

---

### Step 7: Repeat for Each Tier

**Process**: Loop through all tiers for the club

```
For each tier in club:
  ↓
  Step 2: Create LV Tier
  ↓
  Step 3: Save Club to C7 (skip if already created)
  ↓
  Step 4: Save Promo(s) to C7
  ↓
  Step 5: Save to LV
  ↓
  Step 6: Add Loyalty? (optional)
  ↓
Next tier
```

**Example**:
```
Bronze Tier (stage_order = 1)
  → Creates C7 Club "Founders Circle"
  → Creates Bronze Promo (15% discount)
  → Optionally creates Bronze Loyalty (1 pt/$)

Silver Tier (stage_order = 2)
  → Uses existing C7 Club
  → Creates Silver Promo (20% discount)
  → Optionally creates Silver Loyalty (2 pts/$)

Gold Tier (stage_order = 3)
  → Uses existing C7 Club
  → Creates Gold Promo (25% discount)
  → Optionally creates Gold Loyalty (5 pts/$)
```

---

## Error Handling Summary

### Error Categories

| Error Type | Rollback Strategy | Data Impact |
|------------|------------------|-------------|
| **Club creation fails** | None needed | LV data preserved |
| **Promo creation fails** | Delete C7 Club + LV Club | Clean slate |
| **LV save fails** | Delete C7 Promo + C7 Club + LV Club | Complex rollback |
| **Loyalty creation fails (C7)** | None (loyalty optional) | Club/Promo intact |
| **Loyalty save fails (LV)** | Delete C7 Loyalty only | Club/Promo intact |

### Rollback Decision Tree

```
Error occurs
   ↓
Was it during Club creation?
   ↓ No, club created
   └→ Delete Club from C7
   
Was it during Promo creation?
   ↓ No, promo created
   └→ Delete Promo from C7
   
Was it during Loyalty creation?
   ↓ No, loyalty created
   └→ Delete Loyalty from C7 (keep club/promo)
   
Was LV database affected?
   ↓ Yes
   └→ Delete LV records
   
Throw error to user with context
```

### Idempotency

All operations should be idempotent where possible:

- **Club creation**: Check if club exists by code before creating
- **Promo creation**: Check if promo code exists before creating
- **Loyalty creation**: Check if tier exists before creating

**Example**:
```typescript
async function createClubOnC7(clubData) {
  // Check if club already exists
  const existing = await c7.getClubByCode(clubData.clubCode);
  if (existing) {
    return existing; // Idempotent
  }
  
  // Create new club
  return await c7.createClub(clubData);
}
```

---

## Implementation Pseudocode

```typescript
async function createClubWithTiers(clubData: ClubCreationData) {
  let lvClubId: string | null = null;
  let c7ClubId: string | null = null;
  const createdPromos: string[] = [];
  const createdLoyalty: string[] = [];
  
  try {
    // Step 1: Create LV Club
    lvClubId = await db.createClubProgram(clubData);
    
    for (const tier of clubData.tiers) {
      try {
        // Step 2: Create LV Tier
        const lvTierId = await db.createClubStage(lvClubId, tier);
        
        // Step 3: Save Club to C7 (first tier only)
        if (!c7ClubId) {
          c7ClubId = await c7.createClub({
            title: clubData.name,
            description: clubData.description,
            clubCode: generateClubCode(clubData.name)
          });
          
          await db.updateClubProgramC7Id(lvClubId, c7ClubId);
        }
        
        // Step 4: Save Promo(s) to C7
        const c7PromoId = await c7.createPromotion({
          title: `${tier.name} Member Discount`,
          code: generatePromoCode(clubData.name, tier.name),
          type: 'percentage',
          value: tier.discountPercentage,
          clubId: c7ClubId,
          autoApply: true
        });
        
        createdPromos.push(c7PromoId);
        
        // Step 5: Save to LV
        await db.createClubPromotion(lvTierId, c7PromoId, {
          promoCode: generatePromoCode(clubData.name, tier.name),
          discountValue: tier.discountPercentage
        });
        
        // Step 6: Add Loyalty (optional)
        if (tier.loyaltyConfig) {
          try {
            // Step 6a: Create Loyalty
            const loyaltyConfig = tier.loyaltyConfig;
            
            // Step 6b: Save to C7
            const c7LoyaltyId = await c7.createLoyaltyTier({
              name: `${tier.name} Tier`,
              clubId: c7ClubId,
              pointsPerDollar: loyaltyConfig.pointsPerDollar,
              redemptionRate: loyaltyConfig.redemptionRate
            });
            
            createdLoyalty.push(c7LoyaltyId);
            
            // Step 6c: Save to LV
            await db.createTierLoyaltyConfig(lvTierId, c7LoyaltyId, loyaltyConfig);
            
          } catch (loyaltyError) {
            // Loyalty is optional - clean up loyalty but keep club/promo
            if (createdLoyalty.length > 0) {
              await rollbackLoyalty(createdLoyalty);
            }
            throw new Error(`Loyalty creation failed: ${loyaltyError.message}`);
          }
        }
        
      } catch (tierError) {
        // Rollback everything for this club
        await rollbackClubCreation(c7ClubId, createdPromos, createdLoyalty, lvClubId);
        throw tierError;
      }
    }
    
    return { lvClubId, c7ClubId };
    
  } catch (error) {
    // Top-level error handling
    console.error('Club creation failed:', error);
    throw error;
  }
}

async function rollbackClubCreation(
  c7ClubId: string | null,
  promoIds: string[],
  loyaltyIds: string[],
  lvClubId: string | null
) {
  // Delete loyalty tiers
  for (const loyaltyId of loyaltyIds) {
    try {
      await c7.deleteLoyaltyTier(loyaltyId);
    } catch (e) {
      console.error(`Failed to delete loyalty tier ${loyaltyId}:`, e);
    }
  }
  
  // Delete promos
  for (const promoId of promoIds) {
    try {
      await c7.deletePromotion(promoId);
    } catch (e) {
      console.error(`Failed to delete promo ${promoId}:`, e);
    }
  }
  
  // Delete club from C7
  if (c7ClubId) {
    try {
      await c7.deleteClub(c7ClubId);
    } catch (e) {
      console.error(`Failed to delete C7 club ${c7ClubId}:`, e);
    }
  }
  
  // Delete from LV database
  if (lvClubId) {
    try {
      await db.deleteClubProgram(lvClubId); // Cascades to stages and promos
    } catch (e) {
      console.error(`Failed to delete LV club ${lvClubId}:`, e);
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

1. **Club creation** - Verify database record created
2. **C7 API calls** - Mock C7 responses
3. **Rollback logic** - Verify cleanup on errors
4. **Idempotency** - Verify duplicate protection

### Integration Tests

1. **Full flow** - Create club with 3 tiers end-to-end
2. **Error at each step** - Verify rollbacks work
3. **Loyalty optional** - Verify works with/without
4. **Multiple promos** - Verify multiple promos per tier

### Manual Testing

1. **Commerce7 UI** - Verify clubs appear correctly
2. **Customer checkout** - Verify promos auto-apply
3. **Loyalty earning** - Verify points accrue correctly
4. **Error handling** - Trigger errors and verify cleanup

---

## Performance Considerations

### API Call Optimization

**Sequential (Current)**:
```
Create Club (300ms)
  → Create Promo 1 (300ms)
    → Create Promo 2 (300ms)
      → Create Loyalty (300ms)
Total: 1200ms per tier
```

**Parallel (Future Optimization)**:
```
Create Club (300ms)
  → Create [Promo 1, Promo 2, Loyalty] in parallel (300ms)
Total: 600ms per tier
```

**Consideration**: Rollback becomes more complex with parallel operations

### Database Transactions

Use database transactions for atomic operations:

```typescript
await db.transaction(async (trx) => {
  const clubId = await trx.createClubProgram(data);
  const tierId = await trx.createClubStage(clubId, tierData);
  await trx.createClubPromotion(tierId, promoData);
  // If any fail, entire transaction rolls back
});
```

---

## Monitoring & Logging

### Log Events

1. **Club creation started** - Log club name, client
2. **C7 API call** - Log endpoint, request, response
3. **Rollback triggered** - Log reason, actions taken
4. **Club creation completed** - Log IDs, duration
5. **Errors** - Log full context for debugging

### Metrics to Track

- Club creation success rate
- Average creation time per tier
- Rollback frequency by error type
- C7 API error rates

### Alerts

- High rollback rate (> 10%)
- C7 API errors (> 5%)
- Creation time > 10 seconds
- Orphaned C7 resources detected

---

**Status**: 📝 Documentation Complete
**Next Step**: Implementation

**Last Updated**: October 26, 2025

