# Tier-Based Loyalty Model

## Overview

The LiberoVino loyalty system has evolved from a **longevity-based** model (earn after 1 year) to a **tier-based** model where loyalty benefits are tied directly to membership tier. This change aligns with the new Commerce7 club architecture and opens new business opportunities.

## What Changed?

### Old Model: Longevity-Based Loyalty

**Concept**: Loyalty starts after 1 year of cumulative membership

```
Timeline:
Month 0-12:  Customer earns discount only
Month 12+:   Customer earns discount + loyalty points
```

**Characteristics**:
- ✅ Rewards long-term customers
- ✅ Points never expire
- ❌ One earning rate for all customers
- ❌ No flexibility for different tier benefits
- ❌ Doesn't integrate with C7's native loyalty

**Example**:
```
Customer enrolled in Bronze (15% discount)
  → Months 1-12: Gets 15% discount
  → Month 13+: Gets 15% discount + 1 point per $1

Customer enrolled in Gold (25% discount)
  → Months 1-12: Gets 25% discount
  → Month 13+: Gets 25% discount + 1 point per $1 (same earning rate!)
```

### New Model: Tier-Based Loyalty

**Concept**: Loyalty benefits tied to membership tier

```
Tier Structure:
Loyalty-Only:  0% discount + 10 points per $1
Bronze Tier:   15% discount + 1 point per $1
Silver Tier:   20% discount + 2 points per $1
Gold Tier:     25% discount + 5 points per $1
```

**Characteristics**:
- ✅ Flexible earning rates per tier
- ✅ Enables loyalty-only tiers
- ✅ Integrates with C7 native loyalty
- ✅ Clear tier progression incentive
- ✅ More business model options
- ⚠️ Earning starts immediately (no waiting period)

**Example**:
```
Customer in Bronze Tier:
  → Immediately: 15% discount + 1 point per $1

Customer in Gold Tier:
  → Immediately: 25% discount + 5 points per $1

Loyalty-Only Member:
  → Immediately: 0% discount + 10 points per $1
```

---

## Tier Types & Strategies

### 1. Loyalty-Only Tier (Like Starbucks)

**Purpose**: Low barrier to entry, build loyalty base

**Configuration**:
```json
{
  "name": "Rewards Member",
  "discountPercentage": 0,
  "loyaltyConfig": {
    "pointsPerDollar": 10.0,
    "redemptionRate": 0.01,
    "minPointsForRedemption": 100
  },
  "minPurchaseAmount": 50,
  "durationMonths": 12
}
```

**Customer Experience**:
```
Spend $50 → Join Rewards Member
  → Earn 500 points ($5 value)
  → No discount on this purchase
  → Redeem points for merch, events, tastings

After 1 year:
  → If spent $1000 → Earned 10,000 points ($100 value)
  → Can redeem for wine during point sales
  → May qualify for discount tier
```

**Use Case**: Customer who wants benefits but not ready for commitment

---

### 2. Entry Discount Tier (Bronze)

**Purpose**: Entry-level discount with modest loyalty

**Configuration**:
```json
{
  "name": "Bronze Member",
  "discountPercentage": 15,
  "loyaltyConfig": {
    "pointsPerDollar": 1.0,
    "redemptionRate": 0.01,
    "minPointsForRedemption": 100
  },
  "minPurchaseAmount": 100,
  "durationMonths": 3
}
```

**Customer Experience**:
```
Spend $100 → Join Bronze Tier
  → Save $15 on this purchase (15% discount)
  → Earn 100 points ($1 value)
  
After 3 months (3 purchases @ $100):
  → Saved $45 in discounts
  → Earned 300 points ($3 value)
  → Total benefit: $48
```

**Use Case**: Regular customer ready for membership

---

### 3. Mid-Tier (Silver)

**Purpose**: Reward frequent buyers with better benefits

**Configuration**:
```json
{
  "name": "Silver Member",
  "discountPercentage": 20,
  "loyaltyConfig": {
    "pointsPerDollar": 2.0,
    "redemptionRate": 0.01,
    "minPointsForRedemption": 100
  },
  "minPurchaseAmount": 200,
  "durationMonths": 6
}
```

**Customer Experience**:
```
Spend $200 → Join Silver Tier
  → Save $40 on this purchase (20% discount)
  → Earn 400 points ($4 value)
  → Total benefit: $44

After 6 months (6 purchases @ $200):
  → Saved $240 in discounts
  → Earned 2,400 points ($24 value)
  → Total benefit: $264
```

**Use Case**: Committed customer, higher spending

---

### 4. Premium Tier (Gold)

**Purpose**: VIP treatment for best customers

**Configuration**:
```json
{
  "name": "Gold Member",
  "discountPercentage": 25,
  "loyaltyConfig": {
    "pointsPerDollar": 5.0,
    "redemptionRate": 0.02,
    "minPointsForRedemption": 100
  },
  "minPurchaseAmount": 500,
  "durationMonths": 12
}
```

**Customer Experience**:
```
Spend $500 → Join Gold Tier
  → Save $125 on this purchase (25% discount)
  → Earn 2,500 points ($50 value at 2¢/point)
  → Total benefit: $175

After 12 months (12 purchases @ $500):
  → Saved $1,500 in discounts
  → Earned 30,000 points ($600 value)
  → Total benefit: $2,100
```

**Use Case**: Top-tier customer, highest spending

---

## Point Earning Examples

### Example 1: Loyalty-Only Member

```
Member Type: Rewards Member
Discount: 0%
Point Rate: 10 points per $1
Redemption: $0.01 per point (100 points = $1)

Purchase: $150 wine order
  → Discount: $0 (0%)
  → Points Earned: 1,500 points ($15 value)
  → Net Cost: $150
  → Future Value: $15 in points

Over 1 year ($1,800 spent):
  → Discounts: $0
  → Points: 18,000 points ($180 value)
  → Total Benefit: $180 (10% back in points)
```

### Example 2: Bronze Member

```
Member Type: Bronze Member
Discount: 15%
Point Rate: 1 point per $1
Redemption: $0.01 per point

Purchase: $150 wine order
  → Discount: $22.50 (15%)
  → Points Earned: 150 points ($1.50 value)
  → Net Cost: $127.50
  → Future Value: $1.50 in points

Over 1 year ($1,800 spent):
  → Discounts: $270
  → Points: 1,800 points ($18 value)
  → Total Benefit: $288 (16% total value)
```

### Example 3: Gold Member

```
Member Type: Gold Member
Discount: 25%
Point Rate: 5 points per $1
Redemption: $0.02 per point (better rate!)

Purchase: $500 wine order
  → Discount: $125 (25%)
  → Points Earned: 2,500 points ($50 value)
  → Net Cost: $375
  → Future Value: $50 in points

Over 1 year ($6,000 spent):
  → Discounts: $1,500
  → Points: 30,000 points ($600 value)
  → Total Benefit: $2,100 (35% total value)
```

---

## Tier Progression Strategies

### Strategy 1: Point-Driven Progression

Points earned can unlock higher tiers:

```
Rewards Member (loyalty-only)
  → Earn 5,000 points
  → Unlock Bronze Tier upgrade (no purchase required)

Bronze Member
  → Earn 10,000 lifetime points
  → Unlock Silver Tier upgrade

Silver Member
  → Earn 25,000 lifetime points
  → Unlock Gold Tier upgrade
```

**Implementation**:
```sql
-- Check lifetime points for tier eligibility
SELECT 
  c.id,
  c.loyalty_points_lifetime,
  CASE
    WHEN loyalty_points_lifetime >= 25000 THEN 'Gold'
    WHEN loyalty_points_lifetime >= 10000 THEN 'Silver'
    WHEN loyalty_points_lifetime >= 5000 THEN 'Bronze'
    ELSE 'Rewards'
  END AS eligible_tier
FROM customers c
WHERE c.client_id = '<client_uuid>';
```

### Strategy 2: Purchase-Driven Progression

Minimum purchase qualifies for tier:

```
Rewards Member (free to join)
  → Spend $100 → Bronze Tier (15% + 1 pt/$)

Bronze Member
  → Spend $200 → Silver Tier (20% + 2 pts/$)

Silver Member
  → Spend $500 → Gold Tier (25% + 5 pts/$)
```

**Implementation**: This is the current model in club_stages.min_purchase_amount

### Strategy 3: Hybrid Progression

Combine points + purchase:

```
Bronze Member
  → Spend $200 AND have 5,000 lifetime points
  → Upgrade to Silver

Silver Member
  → Spend $500 AND have 15,000 lifetime points
  → Upgrade to Gold
```

---

## Redemption Catalog

### Tier-Specific Rewards

Different tiers can have different redemption options:

**Rewards Member Only**:
- Logo T-Shirt: 1,000 points
- Tote Bag: 500 points
- Tasting Pass (2 guests): 2,000 points

**Bronze+ Members**:
- Private Tour: 3,000 points
- Wine Club Gift Box: 5,000 points
- Vertical Tasting Event: 7,500 points

**Silver+ Members**:
- Winemaker Dinner (2 guests): 10,000 points
- Library Wine Selection: 15,000 points

**Gold Members Only**:
- Barrel Tasting Experience: 20,000 points
- Harvest Day Participation: 30,000 points
- Custom Blend Session: 50,000 points

**Database Schema**:
```sql
CREATE TABLE loyalty_rewards (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  reward_type VARCHAR(20),
  name VARCHAR(255),
  points_required INTEGER,
  min_tier VARCHAR(50),  -- NEW: Minimum tier required
  -- ... other fields
);

-- Example: Private Tour (Bronze+ only)
INSERT INTO loyalty_rewards (
  name,
  points_required,
  min_tier,
  reward_type
) VALUES (
  'Private Tour',
  3000,
  'Bronze',
  'event'
);
```

---

## Integration with Commerce7

### C7 Loyalty Tier Configuration

Each LV tier maps to a C7 loyalty tier:

```typescript
// LV Bronze Tier → C7 Loyalty Tier
{
  name: "Bronze Member Loyalty",
  clubId: "<c7-club-id>",
  pointsPerDollar: 1.0,
  redemptionRate: 0.01
}

// LV Silver Tier → C7 Loyalty Tier
{
  name: "Silver Member Loyalty",
  clubId: "<c7-club-id>",
  pointsPerDollar: 2.0,
  redemptionRate: 0.01
}

// LV Gold Tier → C7 Loyalty Tier  
{
  name: "Gold Member Loyalty",
  clubId: "<c7-club-id>",
  pointsPerDollar: 5.0,
  redemptionRate: 0.02  // Better redemption rate!
}
```

### Point Syncing

Points are tracked in both systems:

**Commerce7**: Source of truth for point earning
- C7 awards points on order completion
- Sends webhook to LV

**LiberoVino**: Aggregates and manages redemptions
- Receives webhook from C7
- Updates customer point balance
- Manages redemption catalog
- Syncs redemptions back to C7

**Flow**:
```
Customer makes $100 purchase (Silver tier)
  ↓
C7 processes order
  ↓
C7 awards 200 points (2 pts/$)
  ↓
C7 sends webhook to LV
  ↓
LV updates customer balance
  ↓
Customer balance: 1,200 → 1,400 points
```

---

## Database Schema Changes

### New Table: `tier_loyalty_config`

Replaces client-level `loyalty_point_rules` with tier-level config:

```sql
CREATE TABLE tier_loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  
  -- C7 Reference
  c7_loyalty_tier_id VARCHAR(255),
  
  -- Earning Rules (per tier)
  points_per_dollar DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  bonus_multiplier DECIMAL(5,2) DEFAULT 1.0,
  
  -- Redemption Rules (per tier)
  redemption_rate DECIMAL(10,4) NOT NULL DEFAULT 0.01,
  min_points_for_redemption INTEGER DEFAULT 100,
  max_points_per_order INTEGER,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(club_stage_id)
);
```

### Update `loyalty_rewards` Table

Add tier restrictions:

```sql
ALTER TABLE loyalty_rewards
ADD COLUMN min_tier_order INTEGER,  -- Minimum stage_order to access
ADD COLUMN exclusive_tier_order INTEGER;  -- Only this tier (NULL = all)

-- Example: Gold-only reward
INSERT INTO loyalty_rewards (
  name,
  points_required,
  exclusive_tier_order
) VALUES (
  'Barrel Tasting Experience',
  20000,
  3  -- Gold tier only (stage_order = 3)
);

-- Example: Silver+ reward
INSERT INTO loyalty_rewards (
  name,
  points_required,
  min_tier_order
) VALUES (
  'Winemaker Dinner',
  10000,
  2  -- Silver and above (stage_order >= 2)
);
```

### Update `customers` Table

Keep lifetime tracking for tier progression:

```sql
-- Already exists:
-- loyalty_points_balance
-- loyalty_points_lifetime

-- Add current tier tracking
ALTER TABLE customers
ADD COLUMN current_club_stage_id UUID REFERENCES club_stages(id);

-- Update on tier change
UPDATE customers
SET current_club_stage_id = '<new_stage_id>'
WHERE id = '<customer_id>';
```

---

## Migration from Old Model

### For Existing Customers (if any)

```sql
-- Step 1: Preserve all existing points
-- (loyalty_points_balance already exists on customers table)

-- Step 2: Create tier loyalty configs for all existing tiers
INSERT INTO tier_loyalty_config (
  club_stage_id,
  points_per_dollar,
  redemption_rate
)
SELECT 
  cs.id,
  1.0,  -- Default: 1 point per dollar
  0.01  -- Default: 100 points = $1
FROM club_stages cs
WHERE NOT EXISTS (
  SELECT 1 FROM tier_loyalty_config tlc
  WHERE tlc.club_stage_id = cs.id
);

-- Step 3: Set customer current tier
UPDATE customers c
SET current_club_stage_id = (
  SELECT ce.club_stage_id
  FROM club_enrollments ce
  WHERE ce.customer_id = c.id
    AND ce.status = 'active'
  LIMIT 1
)
WHERE c.is_club_member = true;

-- Step 4: Deprecate old loyalty_point_rules table
-- (Keep for historical reference, but no longer used)
ALTER TABLE loyalty_point_rules
ADD COLUMN deprecated BOOLEAN DEFAULT true;
```

---

## Business Opportunities

### 1. Loyalty-Only Launch Tier

**Scenario**: Winery launching LiberoVino for first time

```
Initial Tier: "Founding Members" (loyalty-only)
  → Free to join (just create account)
  → 15 points per $1 (high earning rate)
  → Builds loyalty base before discount tiers
  → After 6 months, convert to discount tiers

Result:
  → 500 members enrolled
  → Average $500 spent → 7,500 points each
  → High engagement, ready for discount tiers
```

### 2. Coffee Shop Model

**Scenario**: Tasting room wants punch card effect

```
Tier: "Tasting Room Rewards"
  → Free to join at first tasting
  → 20 points per $1 (very high)
  → Redemption: 500 pts = Free tasting ($25 value)
  
Customer Experience:
  → Visit 1: Spend $25 on tasting → 500 points
  → Visit 2: Redeem 500 points for free tasting
  → Visit 3: Spend $25 → 500 points + buy 2 bottles
  → Repeat cycle
```

### 3. VIP Tier with Premium Redemptions

**Scenario**: Exclusive tier for top spenders

```
Tier: "Inner Circle" (invite-only)
  → 30% discount
  → 10 points per $1
  → 50 points = $1 (better redemption rate)
  → Exclusive rewards: barrel selection, winemaker dinners
  
Only accessible:
  → Lifetime spend $10,000+
  → Or 50,000 lifetime points
  → Or special invitation
```

---

## Analytics & Reporting

### Key Metrics to Track

```sql
-- Average points earned per tier
SELECT 
  cs.name AS tier_name,
  AVG(c.loyalty_points_balance) AS avg_balance,
  AVG(c.loyalty_points_lifetime) AS avg_lifetime,
  COUNT(c.id) AS member_count
FROM customers c
JOIN club_stages cs ON c.current_club_stage_id = cs.id
GROUP BY cs.name
ORDER BY cs.stage_order;

-- Redemption rate by tier
SELECT 
  cs.name AS tier_name,
  COUNT(rr.id) AS total_redemptions,
  SUM(rr.points_spent) AS points_redeemed,
  AVG(rr.points_spent) AS avg_redemption
FROM reward_redemptions rr
JOIN customers c ON rr.customer_id = c.id
JOIN club_stages cs ON c.current_club_stage_id = cs.id
GROUP BY cs.name;

-- Tier progression tracking
SELECT 
  cs_from.name AS from_tier,
  cs_to.name AS to_tier,
  COUNT(*) AS upgrade_count,
  AVG(EXTRACT(DAY FROM ce_to.enrolled_at - ce_from.enrolled_at)) AS avg_days_to_upgrade
FROM club_enrollments ce_from
JOIN club_enrollments ce_to ON ce_from.customer_id = ce_to.customer_id
JOIN club_stages cs_from ON ce_from.club_stage_id = cs_from.id
JOIN club_stages cs_to ON ce_to.club_stage_id = cs_to.id
WHERE ce_from.status = 'upgraded'
  AND cs_to.stage_order > cs_from.stage_order
GROUP BY cs_from.name, cs_to.name;
```

---

## Success Criteria

### Technical
- ✅ Loyalty config stored per tier
- ✅ C7 loyalty tiers created and synced
- ✅ Points awarded based on tier
- ✅ Tier-specific redemption catalog
- ✅ Migration preserves existing points

### Business
- ✅ Flexible tier structures (loyalty-only, discount+loyalty, premium)
- ✅ Clear progression incentive
- ✅ Tier-specific benefits and rewards
- ✅ Analytics on tier performance

---

**Status**: 📝 Documentation Complete
**Model**: Tier-Based Loyalty
**Last Updated**: October 26, 2025

