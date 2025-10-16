# Loyalty Points System

## Concept Overview

Customers who maintain membership for **more than 1 year** (cumulative) start earning loyalty points on purchases. Points never expire and can be redeemed for merchandise, events, tastings, or additional discounts.

## Key Requirements

1. Points start accruing after 1 year of **cumulative membership** (including on that qualifying purchase!)
2. Points only accrue while membership is **active**
3. If membership expires, earning stops (but points are retained)
4. To earn again, customer must reach another 1-year cumulative threshold
5. Point value and earning rate are configurable per client
6. Points can be redeemed for:
   - ✅ Merchandise - anytime
   - ✅ Events - anytime
   - ✅ Tastings - anytime
   - ⚠️ Wine - only during special "point sales" (protects pricing integrity)
7. Points never expire
8. Full transaction history for auditing

## Proposed Schema

### 1. `loyalty_point_rules` (Per Client Configuration)

Defines how customers earn points and point value.

```sql
CREATE TABLE loyalty_point_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  
  -- Earning Rules
  points_per_dollar DECIMAL(10,2) NOT NULL DEFAULT 1.00,   -- e.g., 1 point per $1 spent
  bonus_points_percentage DECIMAL(5,2) DEFAULT 0,          -- e.g., 50% bonus (1.5x points)
  
  -- Minimum to start earning
  min_membership_days INTEGER NOT NULL DEFAULT 365,        -- Must be member for 365+ days
  
  -- Point Value (for redemption calculations)
  point_dollar_value DECIMAL(10,4) NOT NULL DEFAULT 0.01,  -- e.g., 100 points = $1
  
  -- Redemption Rules
  min_points_for_redemption INTEGER DEFAULT 100,           -- Min points to redeem
  max_points_per_order INTEGER,                            -- Optional cap per order
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Points:**
- One rule set per client (UNIQUE constraint)
- Dollar-based earning only (simpler, accounts for different bottle sizes)
- Optional bonus multiplier for special promotions
- Point value determines redemption rate
- Client controls minimum redemption threshold

### 2. `point_transactions` (Complete History)

Tracks all point earning and spending.

```sql
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Transaction Details
  transaction_type VARCHAR(20) NOT NULL CHECK (
    transaction_type IN ('earned', 'redeemed', 'bonus', 'adjusted', 'expired')
  ),
  points INTEGER NOT NULL,  -- Positive for earned, negative for redeemed
  
  -- Context
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES loyalty_rewards(id) ON DELETE SET NULL,
  description TEXT,  -- Human-readable description
  
  -- Metadata
  balance_after INTEGER NOT NULL,  -- Running balance after this transaction
  created_by VARCHAR(100),         -- 'system', 'admin', 'customer'
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Points:**
- Complete audit trail of all point changes
- Running balance makes queries efficient
- Links to orders (earning) and rewards (redemption)
- Supports manual adjustments by admins
- Transaction type covers all scenarios

### 3. `loyalty_rewards` (Redemption Catalog)

Defines what customers can redeem points for.

```sql
CREATE TABLE loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Reward Details
  reward_type VARCHAR(20) NOT NULL CHECK (
    reward_type IN ('merchandise', 'event', 'tasting', 'wine_point_sale', 'other')
  ),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  
  -- Point Cost
  points_required INTEGER NOT NULL,
  
  -- Wine Point Sale Details (only for reward_type = 'wine_point_sale')
  wine_crm_id VARCHAR(255),          -- Links to specific wine product in CRM
  wine_sku VARCHAR(255),
  wine_title VARCHAR(500),
  regular_price DECIMAL(10,2),       -- Show value to customer
  
  -- Inventory (optional)
  quantity_available INTEGER,        -- NULL = unlimited
  quantity_redeemed INTEGER DEFAULT 0,
  
  -- Availability
  is_active BOOLEAN DEFAULT true,
  available_from TIMESTAMP WITH TIME ZONE,
  available_until TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Points:**
- Flexible reward types including special `wine_point_sale`
- Wine rewards only available during specific point sales (time-bound)
- Merchandise, events, tastings available anytime
- Optional inventory tracking
- Links to CRM product for wine rewards

### 4. `reward_redemptions` (Redemption History)

Tracks when customers redeem rewards.

```sql
CREATE TABLE reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES loyalty_rewards(id) ON DELETE CASCADE,
  point_transaction_id UUID NOT NULL REFERENCES point_transactions(id) ON DELETE CASCADE,
  
  -- Redemption Details
  points_spent INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'fulfilled', 'cancelled', 'refunded')
  ),
  
  -- Fulfillment
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  fulfilled_by VARCHAR(100),
  notes TEXT,
  
  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Points:**
- Links customer, reward, and point transaction
- Tracks fulfillment status
- Supports refunds (points returned)

### 5. Update `customers` Table

Add fields to track point balance and eligibility.

```sql
ALTER TABLE customers 
ADD COLUMN loyalty_points_balance INTEGER NOT NULL DEFAULT 0,
ADD COLUMN loyalty_points_lifetime INTEGER NOT NULL DEFAULT 0,
ADD COLUMN cumulative_membership_days INTEGER NOT NULL DEFAULT 0,
ADD COLUMN loyalty_earning_active BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN loyalty_eligible_since TIMESTAMP WITH TIME ZONE;
```

**Key Points:**
- `loyalty_points_balance` - Current available points (never expire)
- `loyalty_points_lifetime` - Total ever earned (for VIP tiers)
- `cumulative_membership_days` - Total days as member (across all enrollments)
- `loyalty_earning_active` - Can they currently earn points? (requires active membership + 365+ days)
- `loyalty_eligible_since` - When they crossed 1 year threshold

## Indexes

```sql
-- Loyalty point rules
CREATE INDEX idx_loyalty_point_rules_client_id ON loyalty_point_rules(client_id);

-- Point transactions
CREATE INDEX idx_point_transactions_customer_id ON point_transactions(customer_id);
CREATE INDEX idx_point_transactions_type ON point_transactions(transaction_type);
CREATE INDEX idx_point_transactions_date ON point_transactions(transaction_date);
CREATE INDEX idx_point_transactions_order_id ON point_transactions(order_id);

-- Loyalty rewards
CREATE INDEX idx_loyalty_rewards_client_id ON loyalty_rewards(client_id);
CREATE INDEX idx_loyalty_rewards_type ON loyalty_rewards(reward_type);
CREATE INDEX idx_loyalty_rewards_is_active ON loyalty_rewards(is_active);

-- Reward redemptions
CREATE INDEX idx_reward_redemptions_customer_id ON reward_redemptions(customer_id);
CREATE INDEX idx_reward_redemptions_reward_id ON reward_redemptions(reward_id);
CREATE INDEX idx_reward_redemptions_status ON reward_redemptions(status);

-- Customer loyalty fields
CREATE INDEX idx_customers_loyalty_eligible ON customers(loyalty_eligible_since);
CREATE INDEX idx_customers_points_balance ON customers(loyalty_points_balance);
```

## Business Logic

### Calculating Cumulative Membership Days

```sql
-- Function to calculate total membership days for a customer
CREATE OR REPLACE FUNCTION calculate_membership_days(p_customer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total_days INTEGER := 0;
  v_enrollment RECORD;
BEGIN
  -- Sum up all enrollment periods (including active)
  FOR v_enrollment IN
    SELECT 
      enrolled_at,
      CASE 
        WHEN status = 'active' THEN LEAST(expires_at, NOW())
        WHEN status IN ('expired', 'upgraded') THEN expires_at
      END as end_date
    FROM club_enrollments
    WHERE customer_id = p_customer_id
    ORDER BY enrolled_at
  LOOP
    v_total_days := v_total_days + 
      EXTRACT(DAY FROM v_enrollment.end_date - v_enrollment.enrolled_at);
  END LOOP;
  
  RETURN v_total_days;
END;
$$ LANGUAGE plpgsql;

-- Update customer's cumulative days and earning status
UPDATE customers 
SET 
  cumulative_membership_days = calculate_membership_days(id),
  loyalty_earning_active = CASE
    WHEN calculate_membership_days(id) >= 365 
         AND EXISTS (
           SELECT 1 FROM club_enrollments 
           WHERE customer_id = id 
             AND status = 'active' 
             AND expires_at > NOW()
         )
    THEN true
    ELSE false
  END,
  loyalty_eligible_since = CASE
    WHEN calculate_membership_days(id) >= 365 
         AND loyalty_eligible_since IS NULL
    THEN NOW()
    ELSE loyalty_eligible_since
  END
WHERE id = '<customer_uuid>';
```

### Awarding Points on Order

```sql
-- When order is completed and customer is eligible
CREATE OR REPLACE FUNCTION award_loyalty_points(
  p_customer_id UUID,
  p_order_id UUID,
  p_order_total DECIMAL(10,2)
) RETURNS INTEGER AS $$
DECLARE
  v_rules RECORD;
  v_customer RECORD;
  v_points_earned INTEGER := 0;
  v_new_balance INTEGER;
BEGIN
  -- Get customer info
  SELECT 
    cumulative_membership_days,
    loyalty_points_balance,
    client_id
  INTO v_customer
  FROM customers WHERE id = p_customer_id;
  
  -- Get client's point rules
  SELECT * INTO v_rules
  FROM loyalty_point_rules
  WHERE client_id = v_customer.client_id
    AND is_active = true;
  
  -- Check if customer can currently earn points
  -- Must have loyalty_earning_active = true (active membership + 365+ days)
  IF NOT v_customer.loyalty_earning_active THEN
    RETURN 0;  -- Not currently earning
  END IF;
  
  -- Calculate points earned (dollar-based only)
  v_points_earned := p_order_total * v_rules.points_per_dollar;
  
  -- Apply bonus multiplier if configured
  IF v_rules.bonus_points_percentage > 0 THEN
    v_points_earned := v_points_earned * 
      (1 + (v_rules.bonus_points_percentage / 100));
  END IF;
  
  v_points_earned := FLOOR(v_points_earned);  -- Round down
  
  -- Update customer balance
  v_new_balance := v_customer.loyalty_points_balance + v_points_earned;
  
  UPDATE customers
  SET 
    loyalty_points_balance = v_new_balance,
    loyalty_points_lifetime = loyalty_points_lifetime + v_points_earned
  WHERE id = p_customer_id;
  
  -- Record transaction
  INSERT INTO point_transactions (
    customer_id,
    transaction_type,
    points,
    order_id,
    description,
    balance_after,
    created_by
  ) VALUES (
    p_customer_id,
    'earned',
    v_points_earned,
    p_order_id,
    format('Earned %s points from order', v_points_earned),
    v_new_balance,
    'system'
  );
  
  RETURN v_points_earned;
END;
$$ LANGUAGE plpgsql;
```

### Redeeming Points

```sql
-- Redeem points for a reward
CREATE OR REPLACE FUNCTION redeem_loyalty_reward(
  p_customer_id UUID,
  p_reward_id UUID
) RETURNS UUID AS $$
DECLARE
  v_customer RECORD;
  v_reward RECORD;
  v_redemption_id UUID;
  v_transaction_id UUID;
  v_new_balance INTEGER;
BEGIN
  -- Get customer info
  SELECT loyalty_points_balance, client_id
  INTO v_customer
  FROM customers WHERE id = p_customer_id;
  
  -- Get reward info
  SELECT *
  INTO v_reward
  FROM loyalty_rewards
  WHERE id = p_reward_id
    AND client_id = v_customer.client_id
    AND is_active = true;
  
  -- Validate
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reward not found or not active';
  END IF;
  
  IF v_customer.loyalty_points_balance < v_reward.points_required THEN
    RAISE EXCEPTION 'Insufficient points';
  END IF;
  
  -- Check inventory
  IF v_reward.quantity_available IS NOT NULL THEN
    IF v_reward.quantity_redeemed >= v_reward.quantity_available THEN
      RAISE EXCEPTION 'Reward out of stock';
    END IF;
  END IF;
  
  -- Deduct points
  v_new_balance := v_customer.loyalty_points_balance - v_reward.points_required;
  
  UPDATE customers
  SET loyalty_points_balance = v_new_balance
  WHERE id = p_customer_id;
  
  -- Record transaction
  INSERT INTO point_transactions (
    customer_id,
    transaction_type,
    points,
    reward_id,
    description,
    balance_after,
    created_by
  ) VALUES (
    p_customer_id,
    'redeemed',
    -v_reward.points_required,
    p_reward_id,
    format('Redeemed: %s', v_reward.name),
    v_new_balance,
    'customer'
  )
  RETURNING id INTO v_transaction_id;
  
  -- Update reward inventory
  UPDATE loyalty_rewards
  SET quantity_redeemed = quantity_redeemed + 1
  WHERE id = p_reward_id;
  
  -- Create redemption record
  INSERT INTO reward_redemptions (
    customer_id,
    reward_id,
    point_transaction_id,
    points_spent,
    status
  ) VALUES (
    p_customer_id,
    p_reward_id,
    v_transaction_id,
    v_reward.points_required,
    'pending'
  )
  RETURNING id INTO v_redemption_id;
  
  RETURN v_redemption_id;
END;
$$ LANGUAGE plpgsql;
```

## Example Scenarios

### Scenario 1: Customer Reaches 1 Year (Rewarded Immediately!)

```
Timeline:
- Jan 1 2024: Enrolled in Bronze (3 months)
- March 15 2024: Renewed Bronze (3 months) → 73 days elapsed
- June 1 2024: Upgraded to Silver (6 months) → 150 days total
- Nov 15 2024: Renewed Silver (6 months) → 318 days total

- Dec 20 2024: Makes $200 purchase
  → This purchase extends membership
  → cumulative_membership_days = 353 (still not eligible)
  → No points earned yet
  → Status: Still need 12 more days

- Jan 15 2025: Makes $150 purchase (48 days since last)
  → cumulative_membership_days = 401 days! 🎉
  → Crosses the 365-day threshold!
  → loyalty_eligible_since = Jan 15 2025
  → Points earned on THIS purchase: $150 × 1 point/$ = 150 points ✨
  → Customer is rewarded immediately for reaching milestone!
```

### Scenario 2: Earning and Redeeming

```
Customer Profile:
- Member for 400 days (eligible)
- Current balance: 450 points
- Client rules: 1 point per $1

New Order: $180
→ Points earned: 180 × 1 = 180 points
→ New balance: 630 points

Available Rewards:
- Winery Tour (event): 500 points - Available anytime ✅
- Logo T-Shirt (merchandise): 300 points - Available anytime ✅
- VIP Tasting (tasting): 400 points - Available anytime ✅
- 2019 Reserve Cab (wine_point_sale): 800 points - Only during May Point Sale ⚠️

Customer redeems:
→ Winery Tour (500 points) - Redeemed immediately
→ New balance: 130 points
→ Redemption created (status: pending)
→ Winery fulfills tour booking

Customer tries to redeem:
→ 2019 Reserve Cab (800 points) - Cannot redeem (not during point sale period)
```

### Scenario 3: Membership Expires - Points Retained, Earning Stops

```
Customer history:
- 2024: Earned 1,200 points (cumulative days: 380)
- 2025: Earned 800 points, spent 500 points (cumulative days: 730)
- April 2026: Membership expires (no purchase made)
  → Stops earning points
  → Keeps 1,500 points balance ✅

- June 2026: Customer makes $200 purchase (re-enrolls in Bronze)
  → cumulative_membership_days = 730 (from before, still above 365)
  → BUT membership was expired, so NOT currently eligible
  → No points earned on this purchase
  → Earning counter resets - need another full year

- June 2027: Customer maintains membership for full year
  → cumulative_membership_days = 1,095 days
  → loyalty_eligible_since = June 2027
  → Starts earning again! ✨
  → Makes $100 purchase → Earns 100 points
  → Total balance: 1,500 + 100 = 1,600 points

Key insight: Points never expire, but you must maintain active membership to earn!
```

## Benefits

✅ **Long-term retention**: Rewards customers who stay 1+ year  
✅ **Forever value**: Points never expire  
✅ **Client control**: Flexible earning and redemption rules  
✅ **Multiple reward types**: Merch, events, tastings, discounts  
✅ **Full transparency**: Complete transaction history  
✅ **VIP potential**: Lifetime points can unlock tiers  
✅ **Gamification**: Clear progression and rewards  

## Integration with Club System

The loyalty points system complements the club stages:

1. **Months 0-12**: Customer focused on maintaining club discount
2. **Month 12+**: Customer now ALSO earning points on purchases
3. **Long-term**: Customer has both active discount AND accumulated points

This creates a compound benefit that increases customer lifetime value!

---

Ready to add this to the migration?

