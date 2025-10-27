# Architecture Change: From Tags/Coupons to Clubs/Promos

## Date: October 26, 2025

## Executive Summary

We are implementing a major architectural change in how we integrate with Commerce7 (C7). The original approach using tags and coupons has been replaced with a more robust system using C7 Clubs, Promos, and Loyalty tiers.

## Why This Change?

### Problems with Original Approach (Tags + Coupons)

❌ **Manual Application Required**
- Coupons had to be manually applied at checkout
- Created friction in the customer experience
- Risk of customers forgetting to apply their discount

❌ **Loyalty Incompatibility**
- Tags do not integrate with C7's loyalty system
- Limited ability to offer tier-based benefits
- Could not leverage C7's native loyalty features

### Benefits of New Approach (Clubs + Promos + Loyalty)

✅ **Automatic Discount Application**
- Promos assigned to clubs automatically apply to every sale
- Seamless customer experience
- No risk of forgotten discounts

✅ **Native Loyalty Integration**
- Can assign club-specific loyalty tiers on C7
- Full access to C7's loyalty features
- Tier-based loyalty opens new opportunities

✅ **New Business Opportunities**
- Lower-end loyalty-only tiers (like coffee shop programs)
- Higher-end discount + loyalty combination tiers
- More flexible tier structures

✅ **Better Platform Alignment**
- Uses C7's native club functionality
- Better long-term maintainability
- Future-proofs the integration

## Architectural Overview

### Old Architecture

```
LiberoVino Tier
    ↓
    Creates C7 Tag
    ↓
    Creates C7 Coupon (manual application)
    ↓
    Customer must apply coupon at checkout
```

**Entities:**
- Tags (for customer categorization)
- Coupons (for discounts)

### New Architecture

```
LiberoVino Club
    ↓
    Creates C7 Club
    ↓
    Assigns Multiple C7 Promos (auto-apply)
    ↓
    Assigns C7 Loyalty Tier (optional)
    ↓
    Customer gets discounts automatically + earns loyalty points
```

**Entities:**
- **Clubs** - Container for membership (maps to LV Club)
- **ClubMemberships** - Individual customer membership in a club
- **Promos** - Automatic promotions (replaces Coupons)
- **Loyalty Tiers** - Club-specific loyalty levels

## Key Entity Changes

### Commerce7 Entities (New)

| Entity | Purpose | Key Features |
|--------|---------|--------------|
| **Club** | Represents the overall membership program | One per LV Club, contains multiple tiers |
| **ClubMembership** | Individual customer's membership | Links customer to specific tier/club |
| **Promo** | Automatic promotion/discount | Auto-applies, can stack multiple per club |
| **Loyalty Tier** | Points earning configuration | Tier-specific earning rates and benefits |

### LiberoVino Database Changes

**Minimal UI Changes:**
- Setup wizard flow remains the same
- Main change: Loyalty configuration moves from club-level to tier-level

**Backend Changes:**
- New C7 API endpoints for Club, ClubMembership, Promo, Loyalty
- Updated sync logic for new entities
- New error handling with rollback mechanisms
- Updated CrmProvider interface

## Loyalty Model Change

### Old Model: Longevity-Based Loyalty

```
Customer Timeline:
Month 0-12: Earn discount only
Month 12+:  Earn discount + loyalty points (1 point per $1)
```

**Key Characteristics:**
- Loyalty starts after 1 year of membership
- Same earning rate for all customers
- Points never expire
- Time-based progression

### New Model: Tier-Based Loyalty

```
Tier Structure:
Bronze Tier:   15% discount + 1 point per $1
Silver Tier:   20% discount + 2 points per $1
Gold Tier:     25% discount + 5 points per $1
Loyalty-Only:  0% discount + 10 points per $1
```

**Key Characteristics:**
- Loyalty tied to tier membership
- Different earning rates per tier
- Enables loyalty-only tiers
- More flexible configurations

**New Opportunities:**
1. **Loyalty-Only Tiers**: Low entry, no discount, high point earning (like Starbucks)
2. **Premium Tiers**: High discount + high point earning for VIPs
3. **Tier-Specific Benefits**: Different redemption catalogs per tier
4. **Flexible Progression**: Points can drive tier upgrades

## Platform Differences

### Commerce7
- ✅ Full implementation with Clubs, Promos, Loyalty
- ✅ Auto-applying promotions
- ✅ Native loyalty integration
- ✅ Club-based customer segmentation

### Shopify
- ⚠️ No native club/membership functionality
- ⚠️ Will require custom implementation
- ⚠️ May use customer tags + metafields
- ⚠️ Discount codes still manual or via apps

**Decision:** Build C7 implementation first, then revisit abstraction once both platforms are complete. The differences are significant enough that premature abstraction would be counterproductive.

## Implementation Phases

### Phase 1: Documentation (Current)
- ✅ Architecture change documentation
- ✅ Club creation flow documentation
- ✅ C7 API endpoint documentation
- ✅ Tier-based loyalty documentation

### Phase 2: Database Schema Updates
- [ ] Update `club_programs` table (rename from old schema)
- [ ] Update `club_stages` table (now maps to C7 Clubs)
- [ ] Add `club_promotions` table (track C7 Promos)
- [ ] Update `loyalty_point_rules` table (tier-specific)
- [ ] Migration scripts

### Phase 3: C7 Provider Implementation
- [ ] Club CRUD operations
- [ ] ClubMembership management
- [ ] Promo creation and assignment
- [ ] Loyalty tier configuration
- [ ] Webhook handlers for club events

### Phase 4: UI Updates
- [ ] Update setup wizard (minimal changes)
- [ ] Add tier-specific loyalty configuration
- [ ] Update tier creation flow
- [ ] Add promo management UI (optional)

### Phase 5: Testing & Migration
- [ ] Unit tests for new endpoints
- [ ] Integration tests for club creation flow
- [ ] Test rollback mechanisms
- [ ] Data migration for existing customers (if any)

### Phase 6: Shopify Implementation
- [ ] Determine Shopify approach
- [ ] Implement custom club logic
- [ ] Build discount automation
- [ ] Revisit abstraction patterns

## Risk Mitigation

### Rollback Mechanisms

The new architecture includes comprehensive rollback handling:

```
If Promo creation fails:
  → Delete Club from C7
  → Throw error

If LV save fails:
  → Delete Promos from C7
  → Delete Club from C7
  → Throw error

If Loyalty creation fails:
  → Delete Loyalty from C7
  → Throw error (Club/Promos remain)
```

See `CLUB_CREATION_FLOW.md` for detailed rollback logic.

### Data Consistency

- Atomic operations where possible
- Comprehensive error handling
- Audit logging for all club operations
- Idempotent operations (safe to retry)

### Backward Compatibility

- No existing production customers (new product)
- Clean slate for new architecture
- No migration concerns

## Breaking Changes

### API Changes

**Removed:**
- Tag-based customer categorization
- Coupon-based discounts
- Longevity-based loyalty

**Added:**
- Club-based membership
- Promo-based discounts (auto-apply)
- Tier-based loyalty

### Database Schema Changes

**Modified Tables:**
- `club_programs` → Now maps to C7 Club
- `club_stages` → Now represents C7 Club + Tier combination
- `loyalty_point_rules` → Now tier-specific instead of client-specific

**New Tables:**
- `club_promotions` → Track C7 Promos
- `tier_loyalty_config` → Tier-specific loyalty settings

## Documentation Index

### Related Documentation

1. **[CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md)** - Detailed creation flow with error handling
2. **[C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md)** - Commerce7 API reference
3. **[TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md)** - New loyalty model documentation
4. **[DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md)** - Schema migration guide

### Existing Documentation (Still Relevant)

- **[BRANDING_MESSAGING_GUIDE.md](./BRANDING_MESSAGING_GUIDE.md)** - Terminology and branding (updated)
- **[CRM_PROVIDER_PATTERN.md](./CRM_PROVIDER_PATTERN.md)** - Provider architecture (being updated)
- **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - Will be updated with new schema

### Deprecated Documentation

- **[TAG_IMPLEMENTATION.md](./TAG_IMPLEMENTATION.md)** - ❌ Tag-based approach (deprecated)
- **[LOYALTY_POINTS_MODEL.md](./LOYALTY_POINTS_MODEL.md)** - ⚠️ Longevity model (being replaced)

## Timeline

- **October 26, 2025**: Architecture change decision and documentation
- **Week of Oct 27**: Database schema updates and migrations
- **Week of Nov 3**: C7 Provider implementation
- **Week of Nov 10**: UI updates and testing
- **Week of Nov 17**: Integration testing and deployment
- **TBD**: Shopify implementation (after C7 is complete)

## Questions & Decisions

### Resolved
- ✅ Use C7 Clubs instead of tags
- ✅ Use Promos instead of Coupons
- ✅ Implement tier-based loyalty
- ✅ Build C7 first, Shopify later

### Pending
- [ ] How many promos per club/tier?
- [ ] Loyalty point earning rates per tier?
- [ ] Migration path for existing data (if any)?
- [ ] Shopify implementation approach?

## Success Criteria

### Technical
- ✅ Clubs auto-created on C7 for each LV tier
- ✅ Promos automatically apply at checkout
- ✅ Loyalty points earned based on tier
- ✅ Comprehensive error handling and rollback
- ✅ Full test coverage

### Business
- ✅ Seamless customer experience (no manual coupon application)
- ✅ Flexible tier structures (loyalty-only, discount-only, combined)
- ✅ Scalable for future tier additions
- ✅ Platform-aligned for long-term maintainability

---

**Status**: 📝 Documentation Phase Complete
**Next Step**: Database Schema Updates

**Last Updated**: October 26, 2025

