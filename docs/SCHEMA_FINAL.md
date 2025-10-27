# Final Database Schema - Club Architecture

## Migration Status: ✅ Applied (010_club_architecture_update.sql)

**Date**: October 27, 2025  
**Status**: Ready for Development

---

## Core Tables

### `club_programs`
**Purpose**: LiberoVino organizational container (1 per client)

**Fields**:
```sql
id                  UUID PRIMARY KEY
client_id           UUID REFERENCES clients(id) UNIQUE
name                VARCHAR(255)        -- Customer-facing name (e.g., "Founders Circle")
description         TEXT                -- Customer-facing description
is_active           BOOLEAN
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**Key Points**:
- ✅ NO CRM fields (this is LV concept only)
- ✅ Name/description for winery branding
- ✅ One per client

---

### `club_stages`
**Purpose**: Membership tiers (Bronze, Silver, Gold)

**Fields**:
```sql
id                  UUID PRIMARY KEY
club_program_id     UUID REFERENCES club_programs(id)
name                VARCHAR(255)        -- Tier name
stage_order         INTEGER             -- Progression order (1, 2, 3)
min_purchase_amount DECIMAL(10,2)       -- $ requirement
duration_months     INTEGER             -- Membership duration
is_active           BOOLEAN

-- C7 Integration
c7_club_id          VARCHAR(255)        -- Each tier = C7 club

created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**Removed Fields** (now in other tables):
- ❌ discount_percentage → In club_stage_promotions
- ❌ discount_code → Coupons only
- ❌ discount_title → Not needed
- ❌ tag → Old approach
- ❌ crm_discount_id → Not used
- ❌ last_sync_at → Atomic creation
- ❌ sync_status → Atomic creation

**Key Points**:
- ✅ Each tier gets own C7 club
- ✅ Clean tier configuration only
- ✅ Discounts moved to promotions table

---

### `club_stage_promotions` ⭐ NEW
**Purpose**: Auto-applying promotions (multiple per tier)

**Fields**:
```sql
id                  UUID PRIMARY KEY
club_stage_id       UUID REFERENCES club_stages(id)

-- CRM Reference (source of truth)
crm_id              VARCHAR(255) NOT NULL
crm_type            VARCHAR(20) CHECK ('commerce7' | 'shopify')

-- Optional Cache (for display, can be stale)
title               VARCHAR(255)
description         TEXT

created_at          TIMESTAMP
updated_at          TIMESTAMP

UNIQUE(crm_id, crm_type)
```

**Key Points**:
- ✅ **Multiple promotions per tier** (no unique on club_stage_id)
- ✅ CRM-agnostic (works with C7 or Shopify)
- ✅ Minimal storage - full details fetched from CRM
- ✅ Atomic creation (no sync_status needed)

**Examples**:
```sql
-- Silver tier with 2 promotions:
| club_stage_id | crm_id      | crm_type  | title           |
|---------------|-------------|-----------|-----------------|
| silver-uuid   | c7-promo-1  | commerce7 | 20% Discount    |
| silver-uuid   | c7-promo-2  | commerce7 | Free Shipping   |
```

---

### `tier_loyalty_config` ⭐ NEW
**Purpose**: Optional tier-specific loyalty earning

**Fields**:
```sql
id                          UUID PRIMARY KEY
club_stage_id               UUID REFERENCES club_stages(id) UNIQUE

-- C7 Reference
c7_loyalty_tier_id          VARCHAR(255) UNIQUE

-- Earning Rules (format TBD - pending C7 testing)
points_per_dollar           DECIMAL(10,2) DEFAULT 1.00
bonus_multiplier            DECIMAL(5,2) DEFAULT 1.0

-- Redemption Rules
redemption_rate             DECIMAL(10,4) DEFAULT 0.01
min_points_for_redemption   INTEGER DEFAULT 100
max_points_per_order        INTEGER

is_active                   BOOLEAN
created_at                  TIMESTAMP
updated_at                  TIMESTAMP
```

**Key Points**:
- ✅ Optional (not all tiers need loyalty)
- ✅ One per tier max (UNIQUE on club_stage_id)
- ✅ Different rates per tier (incentivizes upgrades)
- ⚠️ Format TBD - pending C7 curl testing

**Examples**:
```sql
-- Bronze with loyalty
| club_stage_id | c7_loyalty_tier_id | points_per_dollar |
|---------------|--------------------|-------------------|
| bronze-uuid   | c7-loyalty-1       | 1.0               |

-- Gold with higher earning
| club_stage_id | c7_loyalty_tier_id | points_per_dollar |
|---------------|--------------------|-------------------|
| gold-uuid     | c7-loyalty-3       | 5.0               |

-- Silver WITHOUT loyalty (no row exists)
```

---

### `club_enrollments`
**Purpose**: Track customer membership in tiers

**Fields**:
```sql
id                  UUID PRIMARY KEY
customer_id         UUID REFERENCES customers(id)
club_stage_id       UUID REFERENCES club_stages(id)
enrolled_at         TIMESTAMP
expires_at          TIMESTAMP
qualifying_order_id UUID REFERENCES orders(id)
status              VARCHAR(20) CHECK ('active' | 'expired' | 'upgraded')

-- C7 Integration (NEW)
c7_membership_id    VARCHAR(255)        -- Links to C7 ClubMembership

created_at          TIMESTAMP
updated_at          TIMESTAMP
```

**Removed Fields**:
- ❌ synced_to_crm → Atomic creation
- ❌ crm_sync_at → Not needed
- ❌ crm_sync_error → Not needed

**Key Points**:
- ✅ LV tracks enrollment dates/status
- ✅ Links to C7 ClubMembership via c7_membership_id
- ✅ Clean, no sync fields

---

### `customers`
**Updated**: Added current tier tracking

**New Field**:
```sql
current_club_stage_id  UUID REFERENCES club_stages(id)  -- Current active tier
```

**Existing Fields** (unchanged):
```sql
loyalty_points_balance
loyalty_points_lifetime
cumulative_membership_days
loyalty_earning_active
loyalty_eligible_since
```

---

### `loyalty_rewards`
**Updated**: Added tier restrictions

**New Fields**:
```sql
min_tier_order       INTEGER  -- Minimum stage_order to access
exclusive_tier_order INTEGER  -- Only this stage_order
tier_restricted      BOOLEAN  -- Quick flag
```

**Examples**:
```sql
-- Gold-only reward
| name                  | min_tier_order | exclusive_tier_order |
|-----------------------|----------------|----------------------|
| Barrel Tasting        | NULL           | 3                    |

-- Silver+ reward  
| name                  | min_tier_order | exclusive_tier_order |
|-----------------------|----------------|----------------------|
| Winemaker Dinner      | 2              | NULL                 |

-- All tiers
| name                  | min_tier_order | exclusive_tier_order |
|-----------------------|----------------|----------------------|
| Logo T-Shirt          | NULL           | NULL                 |
```

---

### `loyalty_point_rules`
**Status**: DEPRECATED

**Changes**:
```sql
deprecated           BOOLEAN DEFAULT true
deprecated_at        TIMESTAMP
replacement_note     TEXT -- 'Replaced by tier_loyalty_config table'
```

**Reason**: Client-level loyalty replaced by tier-level loyalty

---

## Table Relationships

```
clients (wineries)
  └─ club_programs (1 per client)
      └─ club_stages (tiers: Bronze, Silver, Gold)
          ├─ club_stage_promotions (1:many - multiple promos per tier) ⭐
          ├─ tier_loyalty_config (1:1 - optional loyalty) ⭐
          └─ club_enrollments (customers enrolled in this tier)
              └─ customers
```

## CRM Mappings

### Commerce7
```
LV club_stages → C7 Club (1:1)
  ├─ c7_club_id stored in club_stages
  
LV club_stage_promotions → C7 Promotion (1:many)
  ├─ crm_id = C7 promotion ID
  ├─ Multiple promotions per tier
  ├─ Promotion Sets TBD (testing needed)
  
LV tier_loyalty_config → C7 LoyaltyTier (1:1 optional)
  ├─ c7_loyalty_tier_id stored
  ├─ Format/linking TBD (testing needed)
  
LV club_enrollments → C7 ClubMembership (1:1)
  ├─ c7_membership_id stored
```

### Shopify
```
TBD - Build after C7 is complete
(No native club functionality)
```

---

## What's Clean

✅ **No sync_status fields** - Atomic operations  
✅ **No CRM-specific fields** - Generic crm_id + crm_type  
✅ **Multiple promos per tier** - Key flexibility  
✅ **Optional loyalty** - Not all tiers need it  
✅ **Tier-based loyalty** - Different rates per tier  
✅ **RLS enabled** - Security in place  

---

## What's Pending

⚠️ **Loyalty Format** - Need C7 curl testing for:
- earnRate format (0.01 = ?)
- How loyalty tier links to club
- qualificationType options

⚠️ **Promotion Sets** - Need C7 admin testing for:
- How to create sets
- API endpoint for sets
- Do we need to store set IDs?

⚠️ **Customer Enrollment** - Need to implement:
- Customer + Address creation
- Credit card handling
- ClubMembership creation flow

---

## Next Steps

### Database: ✅ DONE
- [x] Migration created
- [x] Applied to local DB
- [x] New tables created
- [x] Old fields removed
- [x] RLS policies added
- [x] Clean, atomic design

### C7 Provider: ✅ DONE
- [x] Club CRUD methods
- [x] Promotion CRUD methods
- [x] Loyalty CRUD methods (ready, not using yet)
- [x] Types defined

### Testing Needed:
- [ ] Promotion Sets (user testing now)
- [ ] Loyalty endpoint format
- [ ] Customer enrollment flow

### Coming Soon:
- [ ] Helper function: createTierWithPromotions()
- [ ] Update setup wizard
- [ ] Customer enrollment UI

---

**Status**: 🎯 Database Ready, Waiting on C7 Testing
**Last Updated**: October 27, 2025

