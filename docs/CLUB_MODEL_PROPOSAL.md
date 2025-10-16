# Time-Based Discount Club Model

## Concept Overview

A wine club based on **time-limited discounts** with multiple stages/tiers. Customers progress through stages by making qualifying purchases within timeframes, or they expire and must restart.

## Key Requirements

1. Each **client** has ONE club program with multiple stages
2. Each **stage** defines: discount %, duration, minimum purchase requirement
3. Customers can:
   - Enroll in a stage by meeting purchase requirement
   - Extend their current stage by purchasing within timeframe
   - Upgrade to a higher stage with qualifying purchase
   - Expire if no purchase within stage duration

## Proposed Schema

### 1. `club_programs` (One per client)

Defines the overall club offering for a winery.

```sql
CREATE TABLE club_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  name VARCHAR(255) NOT NULL,                    -- e.g., "Founder's Circle"
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Points:**
- One program per client (UNIQUE constraint)
- Can be activated/deactivated
- Named and described by the winery

### 2. `club_stages` (Multiple per program)

Defines each discount tier/stage within a program.

```sql
CREATE TABLE club_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_program_id UUID NOT NULL REFERENCES club_programs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,                    -- e.g., "Bronze", "Silver", "Gold"
  discount_percentage DECIMAL(5,2) NOT NULL,     -- 10.00, 15.00, 20.00
  discount_code VARCHAR(255),                    -- Code synced to CRM (Commerce7/Shopify)
  duration_months INTEGER NOT NULL,              -- 3, 6, 12
  min_purchase_amount DECIMAL(10,2) NOT NULL,    -- Minimum dollar amount to qualify
  stage_order INTEGER NOT NULL,                  -- 1, 2, 3 (for progression logic)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(club_program_id, stage_order)
);
```

**Key Points:**
- Multiple stages per program
- `stage_order` determines progression hierarchy (1 = entry level)
- Dollar-based qualification only (simpler, accounts for bottle sizes)
- `discount_code` links to CRM discount (where product rules are managed)
- Can be activated/deactivated individually

### 3. `club_enrollments` (Customer membership in stages)

Tracks customer participation in club stages.

```sql
CREATE TABLE club_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  club_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  qualifying_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,  -- Order that qualified them
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'expired', 'upgraded')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate active enrollments
  CONSTRAINT unique_active_enrollment UNIQUE(customer_id, club_stage_id, status)
    WHERE status = 'active'
);
```

**Key Points:**
- Tracks when customer enrolled and when it expires
- Links to the qualifying order
- Status tracks lifecycle:
  - `active` = currently enrolled, discount applies
  - `expired` = time ran out without qualifying purchase
  - `upgraded` = moved to higher stage
- Unique constraint ensures only one active enrollment per customer per stage

### 4. `club_extensions` (History of renewals/upgrades)

Optional table to track enrollment history for analytics.

```sql
CREATE TABLE club_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES club_enrollments(id) ON DELETE CASCADE,
  extended_from_stage_id UUID REFERENCES club_stages(id) ON DELETE SET NULL,
  extended_to_stage_id UUID NOT NULL REFERENCES club_stages(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE SET NULL,
  extension_type VARCHAR(20) NOT NULL CHECK (extension_type IN ('renewal', 'upgrade')),
  extended_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  new_expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
```

**Key Points:**
- Audit trail of all extensions and upgrades
- Tracks which order triggered the extension
- Differentiates between renewal (same stage) vs upgrade (higher stage)

## Indexes

```sql
-- Club programs
CREATE INDEX idx_club_programs_client_id ON club_programs(client_id);
CREATE INDEX idx_club_programs_is_active ON club_programs(is_active);

-- Club stages
CREATE INDEX idx_club_stages_program_id ON club_stages(club_program_id);
CREATE INDEX idx_club_stages_order ON club_stages(stage_order);
CREATE INDEX idx_club_stages_is_active ON club_stages(is_active);

-- Club enrollments
CREATE INDEX idx_club_enrollments_customer_id ON club_enrollments(customer_id);
CREATE INDEX idx_club_enrollments_stage_id ON club_enrollments(club_stage_id);
CREATE INDEX idx_club_enrollments_status ON club_enrollments(status);
CREATE INDEX idx_club_enrollments_expires_at ON club_enrollments(expires_at);

-- Club extensions
CREATE INDEX idx_club_extensions_enrollment_id ON club_extensions(enrollment_id);
CREATE INDEX idx_club_extensions_order_id ON club_extensions(order_id);
```

## Important: Time Calculation Logic

**Key Rule:** When extending or upgrading, the expiration date is always calculated from the **original enrollment date** plus the stage's duration.

**Why this matters:**
- **Renewal (same stage):** Original date + stage duration (resets the clock)
- **Upgrade (higher stage):** Original date + NEW stage duration (rewards early upgrade)

This incentivizes customers to upgrade sooner rather than later!

## Business Logic Examples

### Example 1: Initial Enrollment

```sql
-- Customer makes qualifying purchase
-- Insert into club_enrollments
INSERT INTO club_enrollments (
  customer_id,
  club_stage_id,
  enrolled_at,
  expires_at,
  qualifying_order_id,
  status
) VALUES (
  '<customer_uuid>',
  '<bronze_stage_uuid>',  -- They bought 3 bottles
  NOW(),
  NOW() + INTERVAL '3 months',
  '<order_uuid>',
  'active'
);

-- Update customer record
UPDATE customers 
SET is_club_member = true 
WHERE id = '<customer_uuid>';
```

### Example 2: Extend Current Stage (Renewal)

```sql
-- Customer purchases within timeframe, extends same stage
-- For renewal, we reset to NOW as the new enrollment date
UPDATE club_enrollments
SET 
  enrolled_at = NOW(),  -- Reset enrollment date
  expires_at = NOW() + INTERVAL '3 months',  -- Reset expiration
  updated_at = NOW()
WHERE 
  customer_id = '<customer_uuid>' 
  AND status = 'active';

-- Record the extension
INSERT INTO club_extensions (
  enrollment_id,
  extended_from_stage_id,
  extended_to_stage_id,
  order_id,
  extension_type,
  new_expires_at
) VALUES (
  '<enrollment_uuid>',
  '<bronze_stage_uuid>',  -- Same stage
  '<bronze_stage_uuid>',
  '<order_uuid>',
  'renewal',
  NOW() + INTERVAL '3 months'
);
```

**Example Timeline:**
- Jan 1: Customer buys 3 bottles → Enrolled in Bronze → Expires April 1
- March 15: Customer buys 3 bottles again → Renews Bronze
- **New expiration: March 15 + 3 months = June 15**

### Example 3: Upgrade to Higher Stage

```sql
-- Customer buys 6 bottles while in Bronze, upgrade to Silver
-- Get original enrollment date and new stage duration
WITH current_enrollment AS (
  SELECT 
    ce.id,
    ce.enrolled_at,
    ce.customer_id
  FROM club_enrollments ce
  WHERE ce.customer_id = '<customer_uuid>' 
    AND ce.status = 'active'
),
new_stage AS (
  SELECT duration_months
  FROM club_stages
  WHERE id = '<silver_stage_uuid>'
)
-- Mark old enrollment as upgraded
UPDATE club_enrollments
SET 
  status = 'upgraded',
  updated_at = NOW()
WHERE 
  customer_id = '<customer_uuid>' 
  AND status = 'active';

-- Create new enrollment at higher stage
-- KEY: expires_at is calculated from ORIGINAL enrolled_at + NEW stage duration
INSERT INTO club_enrollments (
  customer_id,
  club_stage_id,
  enrolled_at,  -- Keep original enrollment date
  expires_at,   -- Original date + new duration
  qualifying_order_id,
  status
) 
SELECT
  ce.customer_id,
  '<silver_stage_uuid>',
  ce.enrolled_at,  -- ORIGINAL enrollment date (e.g., Jan 1)
  ce.enrolled_at + (ns.duration_months || ' months')::INTERVAL,  -- Jan 1 + 6 months = July 1
  '<order_uuid>',
  'active'
FROM current_enrollment ce
CROSS JOIN new_stage ns;

-- Record the upgrade
INSERT INTO club_extensions (
  enrollment_id,
  extended_from_stage_id,
  extended_to_stage_id,
  order_id,
  extension_type,
  new_expires_at
) VALUES (
  '<new_enrollment_uuid>',
  '<bronze_stage_uuid>',
  '<silver_stage_uuid>',
  '<order_uuid>',
  'upgrade',
  (SELECT enrolled_at FROM current_enrollment) + INTERVAL '6 months'
);
```

**Example Timeline:**
- Jan 1: Customer buys 3 bottles → Enrolled in Bronze (3 months) → Expires April 1
- Feb 1: Customer buys 6 bottles → Upgrades to Silver (6 months)
- **New expiration: Jan 1 + 6 months = July 1** (not Feb 1 + 6 months)
- Customer gained 3 extra months by upgrading early!

### Example 4: Expiration Check (Cron Job)

```sql
-- Daily job to expire memberships
UPDATE club_enrollments
SET 
  status = 'expired',
  updated_at = NOW()
WHERE 
  status = 'active' 
  AND expires_at < NOW();

-- Update customer flags
UPDATE customers
SET is_club_member = false
WHERE id IN (
  SELECT customer_id 
  FROM club_enrollments 
  WHERE status = 'expired'
  GROUP BY customer_id
  HAVING COUNT(CASE WHEN status = 'active' THEN 1 END) = 0
);
```

## Queries for Common Operations

### Get Customer's Current Club Status

```sql
SELECT 
  c.email,
  c.first_name,
  c.last_name,
  cs.name AS stage_name,
  cs.discount_percentage,
  ce.enrolled_at,
  ce.expires_at,
  ce.expires_at > NOW() AS is_valid,
  EXTRACT(DAY FROM ce.expires_at - NOW()) AS days_remaining
FROM customers c
JOIN club_enrollments ce ON c.id = ce.customer_id
JOIN club_stages cs ON ce.club_stage_id = cs.id
WHERE 
  c.client_id = '<client_uuid>'
  AND ce.status = 'active';
```

### Check if Order Qualifies for Stage

```sql
-- Function to check qualification
CREATE OR REPLACE FUNCTION check_stage_qualification(
  p_order_id UUID,
  p_stage_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_bottle_count INTEGER;
  v_order_total DECIMAL(10,2);
  v_min_bottles INTEGER;
  v_min_amount DECIMAL(10,2);
BEGIN
  -- Get order details (you'd need order_items table for bottle count)
  SELECT total INTO v_order_total
  FROM orders WHERE id = p_order_id;
  
  -- Get stage requirements
  SELECT min_bottles, min_purchase_amount
  INTO v_min_bottles, v_min_amount
  FROM club_stages WHERE id = p_stage_id;
  
  -- Check both conditions
  -- (Bottle count would come from order_items sum)
  RETURN v_order_total >= COALESCE(v_min_amount, 0);
END;
$$ LANGUAGE plpgsql;
```

### Get All Available Stages for Customer

```sql
-- Show what stages customer can qualify for
SELECT 
  cs.name,
  cs.discount_percentage,
  cs.duration_months,
  cs.min_bottles,
  cs.min_purchase_amount,
  cs.stage_order,
  CASE 
    WHEN ce.id IS NOT NULL THEN 'enrolled'
    WHEN cs.stage_order > COALESCE(current_stage.stage_order, 0) THEN 'upgrade_available'
    ELSE 'available'
  END AS qualification_status
FROM club_stages cs
JOIN club_programs cp ON cs.club_program_id = cp.id
LEFT JOIN club_enrollments ce ON 
  cs.id = ce.club_stage_id 
  AND ce.customer_id = '<customer_uuid>'
  AND ce.status = 'active'
LEFT JOIN (
  SELECT cs2.stage_order
  FROM club_enrollments ce2
  JOIN club_stages cs2 ON ce2.club_stage_id = cs2.id
  WHERE ce2.customer_id = '<customer_uuid>'
    AND ce2.status = 'active'
  LIMIT 1
) current_stage ON true
WHERE cp.client_id = '<client_uuid>'
  AND cs.is_active = true
ORDER BY cs.stage_order;
```

## Workflow Integration

### On Order Completion:

1. Check if order qualifies for any club stages
2. If customer has active enrollment:
   - If qualifies for same stage → extend expiration
   - If qualifies for higher stage → upgrade enrollment
3. If customer has no active enrollment:
   - If qualifies for any stage → create new enrollment
4. Record extension/upgrade in `club_extensions`
5. Apply discount to order if enrollment is active

### Scheduled Jobs:

1. **Daily Expiration Check**: Mark expired enrollments
2. **Reminder Notifications**: Email customers X days before expiration
3. **Analytics**: Calculate enrollment retention rates, upgrade rates

## Benefits of This Model

✅ **Flexible**: Clients can create unlimited stage configurations  
✅ **Time-bound**: Clear expiration logic with original date preservation  
✅ **Progressive**: Natural upgrade path with rewards for early upgrades  
✅ **Trackable**: Complete audit trail of all enrollments and extensions  
✅ **Simple**: Customer sees one active discount at a time  
✅ **Motivating**: Time pressure encourages repeat purchases AND early upgrades  
✅ **Fair**: Upgrading early gives you the full duration of the new tier  

## Alternative: Simplified Version

If you want to start simpler, you could combine `club_programs` and `club_stages` into just `club_stages` directly under `clients`, but I recommend keeping them separate for flexibility.

Would you like me to implement this in the migration?

