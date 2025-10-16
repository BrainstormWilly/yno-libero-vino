# Club Enrollment Scenarios

## Stage Configuration Example

**Winery's Club Stages:**

| Stage | Discount | Duration | Min Purchase |
|-------|----------|----------|--------------|
| Bronze | 10% | 3 months | $75 |
| Silver | 15% | 6 months | $150 |
| Gold | 20% | 12 months | $300 |

**Note:** The discount codes are created in Commerce7/Shopify with product qualifications (e.g., "must include wine products"). Our system tracks eligibility and expiration based on purchase amounts.

---

## Scenario 1: Initial Enrollment

**Timeline:**
- **Jan 1**: Customer purchases 3 bottles ($90)
  - ✅ Qualifies for Bronze
  - Enrolled: Jan 1
  - Expires: April 1 (3 months)
  - Discount: 10%

---

## Scenario 2: Early Upgrade (The Smart Move!)

**Timeline:**
- **Jan 1**: Customer purchases 3 bottles ($90)
  - Enrolled in Bronze (expires April 1)
  
- **Feb 1**: Customer purchases 6 bottles ($180)
  - ✅ Qualifies for Silver upgrade!
  - **Old expiration:** April 1 (Bronze)
  - **New expiration:** Jan 1 + 6 months = **July 1** (Silver)
  - **Bonus:** Gained 3 extra months by upgrading early!
  - Discount: 15%

**Customer thinking:** "If I upgrade now, I get the full 6 months from when I started!"

---

## Scenario 3: Late Upgrade (Still Good!)

**Timeline:**
- **Jan 1**: Customer purchases 3 bottles ($90)
  - Enrolled in Bronze (expires April 1)
  
- **March 20**: Customer purchases $180 worth of wine
  - ✅ Qualifies for Silver upgrade
  - **Old expiration:** April 1 (Bronze)
  - **New expiration:** Jan 1 + 6 months = **July 1** (Silver)
  - **Bonus:** Still gained 3 months, plus had 10% discount on the upgrade purchase!
  - Discount: 15%

**Customer thinking:** "I already got the Bronze discount on this purchase, AND I still get July 1 expiration!"

---

## Scenario 4: Simple Renewal

**Timeline:**
- **Jan 1**: Customer purchases 3 bottles ($90)
  - Enrolled in Bronze (expires April 1)
  
- **March 15**: Customer purchases $90 worth of wine
  - ✅ Renews Bronze
  - Enrolled: March 15 (resets)
  - Expires: June 15 (3 months from purchase)
  - Discount: 10%

---

## Scenario 5: Expiration and Restart

**Timeline:**
- **Jan 1**: Customer purchases 3 bottles ($90)
  - Enrolled in Bronze (expires April 1)
  
- **April 2**: No purchase made
  - ❌ Membership expires
  - Discount: None
  
- **May 1**: Customer purchases 3 bottles ($90)
  - Must start over at Bronze
  - Enrolled: May 1
  - Expires: Aug 1
  - Discount: 10% (but didn't get it for full April)

**Customer thinking:** "I should have bought earlier to keep my discount!"

---

## Scenario 6: Multiple Upgrades

**Timeline:**
- **Jan 1**: Customer purchases 3 bottles ($90)
  - Enrolled in Bronze
  - Expires: April 1
  
- **Feb 1**: Customer purchases 6 bottles ($180)
  - Upgraded to Silver
  - Expires: July 1 (Jan 1 + 6 months)
  
- **March 1**: Customer purchases $360 worth of wine
  - ✅ Upgraded to Gold!
  - **New expiration:** Jan 1 + 12 months = **Jan 1 (next year)**
  - Gained 6 more months!
  - Discount: 20%

**Customer thinking:** "The more I commit early, the longer I keep my discount!"

---

## Scenario 7: Upgrade at Last Minute

**Timeline:**
- **Jan 1**: Customer purchases 3 bottles ($90)
  - Enrolled in Bronze (expires April 1)
  
- **March 31**: Customer purchases $180 worth of wine at 11:59 PM
  - ✅ Upgraded to Silver just in time!
  - **New expiration:** Jan 1 + 6 months = **July 1**
  - Saved membership from expiring tomorrow!
  - Discount: 15%

**Customer thinking:** "Phew! Close call, but I extended my membership by 3 months!"

---

## Scenario 8: Purchase Doesn't Qualify for Upgrade

**Timeline:**
- **Jan 1**: Customer purchases 3 bottles ($90)
  - Enrolled in Bronze (expires April 1)
  
- **Feb 15**: Customer purchases $120 worth of wine
  - ✅ Renews Bronze (meets Bronze $75 minimum)
  - ❌ Doesn't upgrade to Silver (needs $150)
  - Enrolled: Feb 15 (resets)
  - Expires: May 15 (3 months)
  - Discount: 10%

---

## Scenario 9: Straight to Gold

**Timeline:**
- **Jan 1**: Customer purchases $360 worth of wine
  - ✅ Qualifies for Gold directly!
  - Enrolled: Jan 1
  - Expires: Jan 1 (next year) - 12 months
  - Discount: 20%

**Customer thinking:** "Big commitment upfront = best discount for a full year!"

---

## Key Insights from These Scenarios

### For Customers:
1. **Upgrade early = Maximum time benefit**
2. **Wait to upgrade = Still get full duration, but risk expiration**
3. **Let it expire = Start over from scratch**
4. **Big commitment early = Longest discount period**

### For Wineries:
1. **Incentivizes larger purchases** (upgrades)
2. **Encourages regular purchasing** (renewals)
3. **Creates urgency** (expiration pressure)
4. **Rewards loyalty** (time-based benefits)
5. **Flexible configuration** (set your own stages)

### Business Rules:
- ✅ Upgrade = Original date + new duration
- ✅ Renewal = Reset to now + same duration
- ✅ Multiple stages can be qualified in one purchase (highest wins)
- ✅ Discount applies to the qualifying purchase
- ❌ Cannot downgrade (only expire and restart)
- ❌ Only one active enrollment per customer

---

## Edge Cases to Handle

### 1. Purchase Qualifies for Multiple Stages
**Rule:** Customer automatically gets the highest qualifying stage.

Example: Customer spends $360 → Gets Gold, not Bronze or Silver

### 2. Purchase During Active Enrollment
**Rule:** Check if it qualifies for upgrade first, otherwise renewal.

```
IF qualifying_stage.order > current_stage.order THEN
  upgrade()
ELSE IF qualifying_stage.order = current_stage.order THEN
  renew()
ELSE
  -- Apply discount but don't change enrollment
  NULL
END
```

### 3. Purchase After Expiration But Before Detected
**Rule:** If status is still 'active' but expires_at has passed, treat as new enrollment.

### 4. Simultaneous Orders (Race Condition)
**Rule:** Use database transactions and constraints to ensure only one active enrollment.

---

This model creates a compelling "game" where customers are motivated to:
1. Purchase more (upgrade)
2. Purchase sooner (keep discount)
3. Purchase bigger (longer duration)

All while giving wineries complete control over the rules!

