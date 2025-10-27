# Club Architecture - Documentation Index

## Quick Start

**New to this architecture change?** Start here:

1. 📖 Read [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md) - Understand why and what changed
2. 🔄 Review [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - See how clubs are created
3. 🔌 Check [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - Commerce7 API reference
4. 🎯 Study [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) - New loyalty model
5. 🗄️ Review [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) - Database changes

---

## Documentation Overview

### Core Architecture Documents

#### [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md)
**What it covers:**
- Why we moved from tags/coupons to clubs/promos
- Problems with old approach
- Benefits of new approach
- Platform differences (C7 vs Shopify)
- Implementation phases
- Timeline and roadmap

**Read this if:**
- You're new to the project
- You need to understand the "why"
- You're explaining this to stakeholders
- You want the big picture

**Key Sections:**
- Why This Change?
- Architectural Overview (old vs new)
- Loyalty Model Change
- Implementation Phases
- Breaking Changes

---

#### [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md)
**What it covers:**
- Step-by-step club creation process
- Error handling and rollback mechanisms
- C7 API integration points
- Implementation pseudocode
- Testing strategy

**Read this if:**
- You're implementing club creation
- You need to understand error handling
- You're debugging creation failures
- You're writing tests

**Key Sections:**
- Detailed Flow (7 steps)
- Error Handling Summary
- Rollback Decision Tree
- Implementation Pseudocode
- Performance Considerations

**Flow Diagram**: Describes the attached flowchart showing the complete process

---

#### [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md)
**What it covers:**
- Complete Commerce7 API reference
- All club-related endpoints
- Request/response examples
- Error codes and handling
- Best practices

**Read this if:**
- You're implementing C7 integration
- You need API endpoint details
- You're troubleshooting API calls
- You're writing API wrappers

**Key Sections:**
- Clubs API (CRUD operations)
- Club Membership API
- Promotions API
- Loyalty API
- Webhooks
- Rate Limits
- Error Responses

**Quick Reference:**
- `POST /club` - Create club
- `POST /club/:id/membership` - Enroll customer
- `POST /promotion` - Create promo
- `POST /loyalty/tier` - Create loyalty tier

---

#### [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md)
**What it covers:**
- New tier-based loyalty model
- Comparison with old longevity-based model
- Tier types and strategies
- Point earning examples
- Business opportunities

**Read this if:**
- You're configuring loyalty
- You need to explain loyalty to customers
- You're designing tier structures
- You're analyzing loyalty metrics

**Key Sections:**
- What Changed? (old vs new)
- Tier Types & Strategies
- Point Earning Examples
- Tier Progression Strategies
- Redemption Catalog
- Business Opportunities

**Tier Examples:**
- Loyalty-Only (like Starbucks)
- Entry Discount (Bronze)
- Mid-Tier (Silver)
- Premium (Gold)

---

#### [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md)
**What it covers:**
- Complete database schema changes
- Migration scripts
- Rollback procedures
- Testing checklist

**Read this if:**
- You're running migrations
- You need to understand data model
- You're writing database queries
- You're troubleshooting data issues

**Key Sections:**
- Schema Changes (7 tables affected)
- Complete Migration Script
- Rollback Script
- Testing Checklist

**Tables Changed:**
- `club_programs` (updated)
- `club_stages` (updated)
- `club_promotions` (NEW)
- `tier_loyalty_config` (NEW)
- `customers` (updated)
- `loyalty_rewards` (updated)
- `loyalty_point_rules` (deprecated)

---

## Document Map

### By Role

#### **Developer / Engineer**
Start with these in order:
1. [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md) - Context
2. [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) - Data model
3. [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Implementation
4. [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - API reference

#### **Product Manager**
Focus on these:
1. [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md) - Why and what
2. [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) - Business model
3. [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Technical process

#### **Winery Client / Customer Success**
Read these:
1. [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) - Loyalty benefits
2. [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md) - Overview
3. [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - What happens in C7

#### **QA / Testing**
Essential docs:
1. [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Testing strategy
2. [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) - Testing checklist
3. [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - API testing

---

## By Topic

### Understanding the Change
- [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md) - Complete overview
- Section: "Why This Change?"
- Section: "Old vs New Architecture"

### Creating Clubs
- [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Complete flow
- [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - API calls
- Section: Clubs API

### Promotions (Discounts)
- [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - Promotions API
- [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Step 4: Save Promo(s)
- Section: Auto-applying promotions

### Loyalty & Points
- [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) - Complete loyalty guide
- [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - Loyalty API
- Section: Tier Types & Strategies

### Error Handling
- [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Complete error handling
- Section: Error Handling Summary
- Section: Rollback Decision Tree

### Database & Schema
- [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) - All schema changes
- Section: Migration Script
- Section: Rollback Script

### Commerce7 Integration
- [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - All C7 APIs
- [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - C7 integration points
- Section: Webhooks

---

## Quick Reference

### Key Concepts

| Concept | Old Approach | New Approach | Doc Reference |
|---------|-------------|--------------|---------------|
| Discounts | Coupons (manual) | Promos (auto-apply) | [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) |
| Customer Grouping | Tags | Club Membership | [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md) |
| Loyalty | Longevity-based | Tier-based | [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) |
| Earning Points | After 1 year | Immediate (tier-based) | [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) |

### Key Entities

| Entity | Purpose | Created On | Stored In | Doc |
|--------|---------|-----------|-----------|-----|
| **Club** | Overall program | C7 | `club_programs` | [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md) |
| **Tier** | Membership level | LV | `club_stages` | [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) |
| **Promo** | Auto-discount | C7 | `club_promotions` | [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) |
| **Loyalty** | Point earning | C7 | `tier_loyalty_config` | [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) |
| **Membership** | Customer enrollment | C7 | `club_enrollments` | [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) |

### Key Endpoints

| Operation | Method | Endpoint | Doc |
|-----------|--------|----------|-----|
| Create Club | POST | `/club` | [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md#create-club) |
| Create Promo | POST | `/promotion` | [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md#create-promotion) |
| Create Loyalty | POST | `/loyalty/tier` | [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md#create-loyalty-tier) |
| Enroll Customer | POST | `/club/:id/membership` | [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md#create-club-membership) |
| Award Points | POST | `/loyalty/points/award` | [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md#award-loyalty-points) |

### Database Tables

| Table | Purpose | New/Updated | Doc |
|-------|---------|-------------|-----|
| `club_programs` | LV clubs | Updated | [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md#1-update-club_programs-table) |
| `club_stages` | LV tiers | Updated | [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md#2-update-club_stages-table) |
| `club_promotions` | C7 promos | **NEW** | [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md#3-create-club_promotions-table-new) |
| `tier_loyalty_config` | Tier loyalty | **NEW** | [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md#4-create-tier_loyalty_config-table-new) |
| `customers` | Current tier | Updated | [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md#5-update-customers-table) |
| `loyalty_rewards` | Tier rewards | Updated | [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md#6-update-loyalty_rewards-table) |

---

## Common Tasks

### Task: Create a New Club

**Steps:**
1. Read [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Understand the flow
2. Review [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - API calls needed
3. Check [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) - Tables involved

**Implementation:**
- Follow 7-step process in CLUB_CREATION_FLOW.md
- Use API examples from C7_CLUB_ENDPOINTS.md
- Handle errors per CLUB_CREATION_FLOW.md error handling section

---

### Task: Configure Loyalty for a Tier

**Steps:**
1. Read [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) - Understand tier types
2. Review [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - Loyalty API
3. Check [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) - tier_loyalty_config table

**Configuration:**
- Choose tier type (loyalty-only, discount+loyalty, premium)
- Set points_per_dollar (1.0, 5.0, 10.0)
- Set redemption_rate (0.01, 0.02)
- Save to C7 and LV

---

### Task: Troubleshoot Failed Club Creation

**Debug Steps:**
1. Check [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Error handling section
2. Review [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - Error codes
3. Check database for partial creates in `club_programs`, `club_promotions`

**Common Issues:**
- Club code conflict → Check existing clubs
- Promo creation failed → Check rollback occurred
- Loyalty sync failed → Club/promo may still exist

---

### Task: Run Database Migration

**Steps:**
1. Read [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) - Complete migration
2. Review schema changes section
3. Run migration script: `010_club_architecture_update.sql`
4. Verify with testing checklist

**Migration:**
```bash
# Apply migration
psql -f supabase/migrations/010_club_architecture_update.sql

# Verify
psql -c "SELECT * FROM club_promotions LIMIT 1;"
psql -c "SELECT * FROM tier_loyalty_config LIMIT 1;"
```

---

## Deprecated Documentation

These documents are outdated after this architecture change:

- ❌ **[TAG_IMPLEMENTATION.md](./TAG_IMPLEMENTATION.md)** - Tag-based approach (replaced)
- ⚠️ **[LOYALTY_POINTS_MODEL.md](./LOYALTY_POINTS_MODEL.md)** - Longevity model (replaced by tier-based)

**Note**: These are kept for historical reference but should not be used for new implementations.

---

## Related Documentation

### Still Relevant

- ✅ **[BRANDING_MESSAGING_GUIDE.md](./BRANDING_MESSAGING_GUIDE.md)** - Terminology (updated for clubs)
- ✅ **[CRM_PROVIDER_PATTERN.md](./CRM_PROVIDER_PATTERN.md)** - Provider architecture (being updated)
- ✅ **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - Base schema (will be updated)
- ✅ **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Overall project status

### Existing Documentation (No Changes)

- [C7_AUTHORIZATION.md](./C7_AUTHORIZATION.md) - Commerce7 auth
- [C7_INSTALL_FLOW.md](./C7_INSTALL_FLOW.md) - Installation process
- [DEPLOYMENT_READY.md](./DEPLOYMENT_READY.md) - Deployment guide
- [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) - Local setup

---

## FAQ

### Q: Where do I start?
**A:** Read [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md) first for context, then pick the doc most relevant to your role (see "Document Map > By Role" above).

### Q: How do I create a club?
**A:** Follow the step-by-step process in [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md).

### Q: What changed in loyalty?
**A:** Read [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) - Section "What Changed?" for the comparison.

### Q: Where are the API endpoints?
**A:** All Commerce7 APIs are documented in [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md).

### Q: How do I run migrations?
**A:** See [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) - Section "Complete Migration Script".

### Q: What if club creation fails?
**A:** Check [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) - Section "Error Handling Summary" for rollback logic.

### Q: How do promos auto-apply?
**A:** Set `autoApply: true` when creating the promo. See [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) - Promotions API.

### Q: Can I have loyalty without discounts?
**A:** Yes! See [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) - Section "Loyalty-Only Tier".

---

## Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md) | ✅ Complete | Oct 26, 2025 |
| [CLUB_CREATION_FLOW.md](./CLUB_CREATION_FLOW.md) | ✅ Complete | Oct 26, 2025 |
| [C7_CLUB_ENDPOINTS.md](./C7_CLUB_ENDPOINTS.md) | ✅ Complete | Oct 26, 2025 |
| [TIER_BASED_LOYALTY.md](./TIER_BASED_LOYALTY.md) | ✅ Complete | Oct 26, 2025 |
| [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md) | ✅ Complete | Oct 26, 2025 |
| **CLUB_ARCHITECTURE_INDEX.md** (this doc) | ✅ Complete | Oct 26, 2025 |

---

## Next Steps

1. **Read the Docs**: Start with your role-specific reading list above
2. **Review Changes**: Understand what's changing in [ARCHITECTURE_CHANGE.md](./ARCHITECTURE_CHANGE.md)
3. **Plan Implementation**: Review timeline in ARCHITECTURE_CHANGE.md
4. **Run Migration**: When ready, follow [DATABASE_SCHEMA_UPDATES.md](./DATABASE_SCHEMA_UPDATES.md)

---

**Last Updated**: October 26, 2025
**Documentation Version**: 1.0
**Architecture**: Club-Based (Commerce7)

