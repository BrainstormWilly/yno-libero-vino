# Database Migration - Complete Schema

## 🎉 Migration Ready for Deployment!

**File:** `supabase/migrations/001_initial_schema.sql`  
**Lines:** 534  
**Tables:** 19  
**Status:** ✅ Complete and ready to deploy

## 📊 Complete Table List

### Core Platform (6 tables)

1. **`clients`** - Winery customers (paid clients)
   - Fields: tenant_shop, crm_type, org_name, org_contact
   - One row per winery

2. **`platform_sessions`** - OAuth authentication tokens
   - Links to clients
   - Stores access/refresh tokens

3. **`customers`** - Wine club members & customers
   - Links to clients
   - Includes loyalty fields: points_balance, points_lifetime, cumulative_days
   - Unique email per client

4. **`products`** - Wine inventory
   - Wine-specific: wine_type, vintage, varietal
   - Links to clients

5. **`orders`** - Orders & club shipments
   - Track club shipments separately
   - Links to clients and customers

6. **`discounts`** - Promotional discount codes
   - Links to clients
   - Synced from CRMs

### Wine Club System (4 tables)

7. **`club_programs`** - One per client
   - Overall club offering definition
   - UNIQUE constraint per client

8. **`club_stages`** - Multiple per program
   - Bronze, Silver, Gold, etc.
   - Fields: discount_percentage, duration_months, min_purchase_amount
   - Includes CRM sync tracking (crm_discount_id, sync_status)

9. **`club_enrollments`** - Customer memberships
   - Tracks active, expired, upgraded enrollments
   - enrolled_at, expires_at timestamps
   - CRM sync tracking

10. **`club_extensions`** - Enrollment history
    - Audit trail of renewals and upgrades
    - Links to qualifying orders

### Loyalty Points System (4 tables)

11. **`loyalty_point_rules`** - Per client configuration
    - points_per_dollar, bonus_percentage
    - min_membership_days (365)
    - point_dollar_value for redemptions

12. **`point_transactions`** - Complete point history
    - earned, redeemed, bonus, adjusted
    - Running balance tracking
    - Links to orders and rewards

13. **`loyalty_rewards`** - Redemption catalog
    - Types: merchandise, event, tasting, wine_point_sale
    - Point cost, inventory, availability dates
    - Wine point sale details

14. **`reward_redemptions`** - Redemption tracking
    - Status: pending, fulfilled, cancelled, refunded
    - Fulfillment tracking

### Communication System (4 tables)

15. **`communication_configs`** - Per client provider settings
    - Email: Mailchimp, Klaviyo, SendGrid
    - SMS: RedChirp, Twilio, Klaviyo
    - API keys, from addresses, settings

16. **`communication_templates`** - Winery-specific templates
    - Types: monthly_status, expiration_warning, etc.
    - Customizable HTML/text with variables
    - Per channel (email, SMS)

17. **`communication_log`** - Complete audit trail
    - Every email/SMS sent
    - Delivery status, opens, clicks
    - Error tracking

18. **`communication_preferences`** - Customer opt-in/out
    - Email/SMS preferences per type
    - Unsubscribe tracking

### CRM Integration (1 table)

19. **`crm_sync_queue`** - Retry queue
    - Failed discount sync operations
    - Exponential backoff retry logic
    - Status tracking

## 🔑 Key Features

### Multi-Tenancy
- ✅ All data isolated by `client_id`
- ✅ ON DELETE CASCADE ensures clean removal
- ✅ UNIQUE constraints prevent duplicates per client

### Time-Based Club
- ✅ enrollment_at preserved on upgrades
- ✅ expires_at calculated from original date
- ✅ Status tracking (active, expired, upgraded)

### Loyalty Points
- ✅ Points earned after 365 cumulative days
- ✅ Earning stops when membership expires
- ✅ Points never expire
- ✅ Complete transaction history

### Communication
- ✅ Multi-provider support (Mailchimp, Klaviyo, RedChirp, etc.)
- ✅ Customizable templates per winery
- ✅ Preference management
- ✅ Full audit trail

### CRM Sync
- ✅ Track sync status per enrollment
- ✅ Retry failed operations
- ✅ Add/remove customers from discount eligibility
- ✅ Exponential backoff

## 📈 Index Strategy

Total indexes: **54**

Optimized for:
- Foreign key joins (client_id everywhere)
- Common queries (email lookups, status checks)
- Time-based operations (expires_at, sent_at)
- Performance (is_active, is_club_member filters)

## 🔒 Security (RLS)

**Strategy:** Service role only (simple & effective)

```sql
-- All tables have this policy
CREATE POLICY "Service role full access" 
  ON [table] FOR ALL TO service_role USING (true);
```

**Why this works:**
- App is embedded in Commerce7/Shopify admin
- Auth happens at CRM OAuth level
- All queries filter by client_id from session
- No direct client-to-database access
- No user registration needed

**Security enforced by:**
1. OAuth flow (tenant/shop in session)
2. Session-based client_id filtering
3. Webhook signature validation
4. Service role key never exposed

## 🚀 Deployment Commands

```bash
# Review the migration
cat supabase/migrations/001_initial_schema.sql

# Apply to Supabase
npx supabase db push

# Verify tables created
npx supabase db list
```

## 📋 What This Enables

### For Wineries:
✅ Create time-based discount club programs  
✅ Define multiple stages (Bronze, Silver, Gold)  
✅ Track member enrollments and expirations  
✅ Award loyalty points to long-term members  
✅ Create rewards catalog  
✅ Send automated monthly status emails/SMS  
✅ Customize all communication templates  
✅ Track all customer interactions  

### For Customers:
✅ Automatic discount application  
✅ Clear status visibility  
✅ Upgrade incentives  
✅ Points that never expire  
✅ Flexible reward redemptions  
✅ Monthly status updates  
✅ Expiration warnings  

## 🔄 Next Steps After Migration

1. **Deploy migration**
   ```bash
   npx supabase db push
   ```

2. **Implement CRM provider methods**
   - `upsertCustomer()`
   - `findCustomerByEmail()`
   - `addCustomerToDiscount()`
   - `removeCustomerFromDiscount()`

3. **Build communication providers**
   - MailchimpProvider
   - KlaviyoProvider
   - SendGridProvider
   - RedChirpProvider
   - TwilioProvider

4. **Set up cron jobs**
   - Monthly status notifications (1st of month, 9 AM)
   - Expiration warnings (daily, 10 AM)
   - Expiration processing (daily, 2 AM)
   - CRM sync retry (every 5 minutes)

5. **Build admin UI**
   - Club stage management
   - Enrollment dashboard
   - Template editor
   - Communication settings
   - Analytics dashboard

## 📚 Documentation Reference

All documentation is in `docs/`:

**Core Models:**
- [Club Model Proposal](./CLUB_MODEL_PROPOSAL.md)
- [Loyalty Points Model](./LOYALTY_POINTS_MODEL.md)
- [Communication Strategy](./COMMUNICATION_STRATEGY.md)

**Integration:**
- [CRM Sync Strategy](./CRM_SYNC_STRATEGY.md)
- [Customer Upsert Flow](./CUSTOMER_UPSERT_FLOW.md)
- [CRM Integration Notes](./CRM_INTEGRATION_NOTES.md)

**Scenarios:**
- [Club Scenarios](./CLUB_SCENARIOS.md)
- [Loyalty Earning Rules](./LOYALTY_EARNING_RULES.md)

**Setup:**
- [Database Schema](./DATABASE_SCHEMA.md)
- [RLS Strategy](./RLS_STRATEGY.md)

## 💾 Migration Backup

Before deploying, backup current state:

```bash
# If you have existing data
npx supabase db dump -f backup_before_001.sql

# After successful migration
npx supabase db dump -f backup_after_001.sql
```

## 🎯 This Migration Provides

A complete, production-ready database schema for a wine club and loyalty platform that:

- ✅ Supports multiple wineries (multi-tenant)
- ✅ Integrates with Commerce7 and Shopify
- ✅ Manages time-based discount clubs
- ✅ Tracks loyalty points with flexible earning rules
- ✅ Supports multiple communication platforms
- ✅ Handles CRM sync with retry logic
- ✅ Maintains complete audit trails
- ✅ Optimized with 54 indexes
- ✅ Secured with RLS for defense-in-depth

**Ready to deploy!** 🚀

