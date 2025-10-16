# Loyalty Points Earning Rules

## When Customers Can Earn Points

### Requirements (ALL must be true):

1. ✅ **Active Membership**: `club_enrollments.status = 'active'` AND `expires_at > NOW()`
2. ✅ **Cumulative Threshold Met**: `cumulative_membership_days >= 365`
3. ✅ **Flag Enabled**: `loyalty_earning_active = true`

### State Transitions

```
┌─────────────────────────────────────────────────────────────┐
│                    EARNING STATE MACHINE                     │
└─────────────────────────────────────────────────────────────┘

[New Customer]
    │
    ↓ (First purchase)
[Enrolled, Day 0]
    │ cumulative_days < 365
    │ earning_active = false
    │ → No points earned
    ↓ (Purchases over time)
[Enrolled, Days 1-364]
    │ cumulative_days < 365
    │ earning_active = false
    │ → No points earned
    ↓ (Purchase crosses 365 days)
[Enrolled, Day 365+] ⭐
    │ cumulative_days >= 365
    │ earning_active = TRUE
    │ → STARTS earning (including this purchase!)
    ↓ (Continues purchasing)
[Active Earning]
    │ earning_active = true
    │ → Earns points on every purchase
    ↓ (Membership expires)
[Expired, Points Retained]
    │ cumulative_days = 365+ (kept)
    │ earning_active = FALSE (stopped)
    │ → No points earned, keeps existing points
    ↓ (Re-enrolls)
[Re-enrolled, Day 0 (of new cycle)]
    │ cumulative_days = 365+ (from before)
    │ earning_active = false (need new threshold)
    │ → No points earned yet
    ↓ (Maintains membership for 365 days)
[Re-enrolled, Day 365+] ⭐
    │ earning_active = TRUE again
    │ → RESUMES earning
```

## Detailed Scenarios

### Scenario A: First-Time Loyalty Qualification

```
Day 0 (Jan 1, 2024): Enrolled in Bronze
  cumulative_membership_days: 0
  loyalty_earning_active: false
  
Day 90 (April 1): Renewed Bronze
  cumulative_membership_days: 90
  loyalty_earning_active: false
  
Day 180 (July 1): Upgraded to Silver
  cumulative_membership_days: 180
  loyalty_earning_active: false
  
Day 365 (Jan 1, 2025): Makes $200 purchase
  → Purchase extends/renews membership
  → cumulative_membership_days: 365 🎉
  → loyalty_earning_active: TRUE ✨
  → loyalty_eligible_since: Jan 1, 2025
  → Points earned on THIS purchase: 200 points!
  
Day 395 (Jan 31, 2025): Makes $100 purchase
  → cumulative_membership_days: 395
  → loyalty_earning_active: true
  → Points earned: 100 points
  
Total points: 300
```

### Scenario B: Membership Lapses, Earning Stops

```
Ongoing: Customer earning points regularly
  cumulative_membership_days: 500
  loyalty_earning_active: true
  points_balance: 1,200

April 1: Membership expires (no purchase made)
  → Club enrollment status: 'expired'
  → loyalty_earning_active: FALSE (stops earning)
  → points_balance: 1,200 (RETAINED) ✅
  → cumulative_membership_days: 500 (RETAINED)

May 1: Customer makes $100 purchase (re-enrolls)
  → Creates new enrollment
  → cumulative_membership_days: 500 (from before)
  → loyalty_earning_active: false (need new threshold)
  → Points earned: 0
  → points_balance: Still 1,200 (kept during gap)

Customer must now maintain membership for another 365 days to earn again.
```

### Scenario C: Re-Qualifying After Gap

```
Timeline after membership lapse:

Month 0: Re-enrolled after gap
  cumulative_membership_days: 500 (from before)
  loyalty_earning_active: false
  points_balance: 1,200 (retained)

Month 6: Still active member
  cumulative_membership_days: 680
  loyalty_earning_active: false
  → Still not earning

Month 12: Maintained membership for full year!
  cumulative_membership_days: 865
  → Crosses NEW 365-day threshold since re-enrollment
  → loyalty_earning_active: TRUE ✨
  → Makes $150 purchase
  → Earns 150 points!
  → New balance: 1,350 points
```

## Point Redemption Rules

### Always Available (Anytime):
- ✅ **Merchandise** (t-shirts, glasses, corkscrews, etc.)
- ✅ **Events** (winery dinners, tours, concerts)
- ✅ **Tastings** (VIP tastings, private sessions)

### Limited Availability (Point Sales Only):
- ⚠️ **Wine** - Only during designated point sales
  - Winery creates: "May Point Sale - 2019 Reserve Cab"
  - Available: May 1-31, 2025
  - Cost: 800 points
  - After May 31: Can't redeem points for this wine

### Validation Logic

```sql
CREATE OR REPLACE FUNCTION can_redeem_reward(
  p_customer_id UUID,
  p_reward_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_customer RECORD;
  v_reward RECORD;
BEGIN
  SELECT * INTO v_customer FROM customers WHERE id = p_customer_id;
  SELECT * INTO v_reward FROM loyalty_rewards WHERE id = p_reward_id;
  
  -- Check sufficient points
  IF v_customer.loyalty_points_balance < v_reward.points_required THEN
    RETURN false;
  END IF;
  
  -- Check if reward is active
  IF NOT v_reward.is_active THEN
    RETURN false;
  END IF;
  
  -- Check time availability
  IF v_reward.available_from IS NOT NULL AND NOW() < v_reward.available_from THEN
    RETURN false;
  END IF;
  
  IF v_reward.available_until IS NOT NULL AND NOW() > v_reward.available_until THEN
    RETURN false;
  END IF;
  
  -- Check inventory
  IF v_reward.quantity_available IS NOT NULL THEN
    IF v_reward.quantity_redeemed >= v_reward.quantity_available THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Wine point sales must be in their time window
  IF v_reward.reward_type = 'wine_point_sale' THEN
    IF v_reward.available_from IS NULL OR v_reward.available_until IS NULL THEN
      RETURN false;  -- Wine sales must have dates
    END IF;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

## Benefits of This Model

### For Customers:
✅ **Immediate reward** at 1-year mark (earn on that purchase)  
✅ **Keep all points forever** even if membership lapses  
✅ **Clear earning status** - know exactly when you're earning  
✅ **Flexible redemption** - merch/events anytime, wine during sales  
✅ **Compound benefits** - discount + points after year 1  

### For Wineries:
✅ **Protects wine pricing** - points for wine only during controlled sales  
✅ **Encourages continuous membership** - must stay active to earn  
✅ **Flexible point sales** - run special promotions when you want  
✅ **Merchandise clearance** - use points to move inventory  
✅ **Event promotion** - fill seats with point redemptions  

### Business Intelligence:
✅ **Identifies best customers** - those who maintain 1+ year membership  
✅ **Tracks retention** - how many customers stay active after year 1  
✅ **Point liability** - total points outstanding  
✅ **Redemption patterns** - what customers value most  

## Example Point Sale Campaign

```
"May Vertical Tasting Point Sale"

Available Wines:
- 2018 Pinot Noir: 600 points (normally $45)
- 2019 Chardonnay: 500 points (normally $38)
- 2017 Cabernet Reserve: 1,000 points (normally $75)

Duration: May 1-31, 2025
Limit: 2 bottles per customer
Marketing: "Your loyalty rewarded - exclusive wines for points!"

Result:
- Customers excited to use accumulated points
- Winery moves specific inventory
- Controls wine discount timing
- Creates urgency (limited time)
```

## Key Differences from Traditional Points

### Traditional E-commerce Points:
- Earn on every purchase from day 1
- Can usually redeem for anything including wine
- Often expire after inactivity

### Our Wine Club Points:
- ✅ Must earn the privilege by maintaining 1-year membership
- ⚠️ Wine redemption controlled via point sales only
- ✅ Never expire
- ✅ Must maintain active membership to keep earning
- ✅ Emphasizes long-term loyalty over transactional purchases

---

This creates a perfect balance:
- Protects wine pricing integrity
- Rewards true loyal customers
- Provides flexibility for non-wine rewards
- Incentivizes continuous membership

