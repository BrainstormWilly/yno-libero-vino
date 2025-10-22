# LiberoVino Development & Testing Guide

> **How to test LiberoVino locally without Commerce7 embedding**

---

## 🔓 Local Testing Bypass

To test the LiberoVino app locally without needing to embed it in Commerce7, we've added a development bypass similar to yno-neighborly.

### **Environment Variable:**

```bash
IN_COMMERCE7=no
```

### **What it does:**

When `IN_COMMERCE7=no` and `NODE_ENV=development`:
- ✅ Bypasses Commerce7 OAuth/embedding requirements
- ✅ Uses a fake session with test credentials
- ✅ Auto-creates a dev test client in database
- ✅ Allows full testing of setup wizard and all features
- ✅ Console logs show "🔓 DEV MODE: Using fake session"

---

## 🚀 Quick Start

### **1. Set up your environment:**

```bash
# Copy env.example to .env
cp env.example .env

# Edit .env and set:
NODE_ENV=development
IN_COMMERCE7=no
SESSION_SECRET=any-secret-key-for-dev

# Add your Supabase credentials
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### **2. Start the dev server:**

```bash
npm run dev
```

### **3. Navigate to the app:**

```bash
# Open browser to:
http://localhost:3000/app

# Or setup wizard:
http://localhost:3000/setup

# Or settings:
http://localhost:3000/settings
```

### **4. Test the features:**

✅ **Setup Wizard:** Create club programs, tiers, loyalty rules  
✅ **Dashboard:** View club stats and quick actions  
✅ **Settings:** Edit organization details  

All without needing to be embedded in Commerce7!

---

## 🧪 Fake Session Details

When bypass is enabled, the following test data is used:

```typescript
{
  clientId: 'dev-test-client-id',
  tenantShop: 'dev-test-tenant',
  crmType: 'commerce7',
  userName: 'Dev Tester',
  userEmail: 'dev@test.com',
  theme: 'light',
}
```

### **Auto-Created Test Client:**

On first access, the app automatically creates:

```sql
INSERT INTO clients (
  id,
  tenant_shop,
  crm_type,
  org_name,
  org_contact,
  user_email
) VALUES (
  'dev-test-client-id',
  'dev-test-tenant',
  'commerce7',
  'Dev Test Winery',
  'Dev Tester',
  'dev@test.com'
);
```

---

## 🔄 Testing Workflow

### **First Run (Setup Not Complete):**

```
1. Visit http://localhost:3000/app
2. Auto-redirects to /setup (setup_complete = false)
3. Complete the 5-step wizard
4. Saves club_programs, club_stages, loyalty_point_rules
5. Sets setup_complete = true
6. Redirects to /app (dashboard)
```

### **Subsequent Runs (Setup Complete):**

```
1. Visit http://localhost:3000/app
2. Shows dashboard directly
3. Can access /settings to edit
4. Can re-run /setup to modify configuration
```

### **Reset Setup:**

To test the setup wizard again:

```sql
-- Clear setup data
DELETE FROM club_extensions WHERE enrollment_id IN (
  SELECT id FROM club_enrollments WHERE customer_id IN (
    SELECT id FROM customers WHERE client_id = 'dev-test-client-id'
  )
);
DELETE FROM club_enrollments WHERE customer_id IN (
  SELECT id FROM customers WHERE client_id = 'dev-test-client-id'
);
DELETE FROM club_stages WHERE club_program_id IN (
  SELECT id FROM club_programs WHERE client_id = 'dev-test-client-id'
);
DELETE FROM club_programs WHERE client_id = 'dev-test-client-id';
DELETE FROM loyalty_point_rules WHERE client_id = 'dev-test-client-id';

-- Mark setup incomplete
UPDATE clients 
SET setup_complete = false 
WHERE id = 'dev-test-client-id';
```

Or just delete the entire test client:

```sql
DELETE FROM clients WHERE id = 'dev-test-client-id';
```

The next page load will recreate it automatically.

---

## 🌐 Testing with Embedded Mode

To test the actual Commerce7 embedding:

### **1. Disable bypass:**

```bash
# In .env
IN_COMMERCE7=yes
# or remove the line entirely
```

### **2. Set up Ngrok:**

```bash
# Start ngrok
./scripts/start-ngrok.sh

# Update .env
NGROK_URL=your-ngrok-url.ngrok-free.app
```

### **3. Access via Commerce7 admin:**

```
https://c7.your-ngrok-url.ngrok-free.app?tenantId=YOUR_TENANT&account=YOUR_ACCOUNT_TOKEN
```

---

## 🔧 Modified Files

The bypass is implemented in:

1. **`app/lib/sessions.server.ts`**
   - `getAppSession()` - Returns fake session when `IN_COMMERCE7=no`
   - `requireAppSession()` - Returns fake session when `IN_COMMERCE7=no`

2. **`app/routes/app.tsx`**
   - Loader checks bypass and creates dev client
   - Skips C7 authorization

3. **`app/routes/setup.tsx`**
   - Loader checks bypass and creates dev client
   - Works with fake session

4. **`app/routes/settings.tsx`**
   - Loader checks bypass and creates dev client
   - Works with fake session

5. **`env.example`**
   - Added `IN_COMMERCE7` documentation
   - Added `SESSION_SECRET` (was missing)

---

## 📊 Testing Scenarios

### **✅ Test Setup Wizard:**

```
1. Clear setup (SQL above)
2. Visit http://localhost:3000/app
3. Should redirect to /setup (setup_complete = false)
4. Complete all 5 steps:
   - Welcome
   - Club name/description
   - Create multiple tiers
   - Loyalty points config
   - Review & launch
5. Should redirect to /app
6. Verify database has:
   - club_programs row
   - club_stages rows
   - loyalty_point_rules row
   - clients.setup_complete = true
```

### **✅ Test Tier Flexibility:**

```
1. Add unlimited tiers
2. Reorder with ↑/↓ buttons
3. Remove tiers (minimum 1)
4. Try progressive tiers (Bronze → Gold)
5. Try parallel tiers (6-mo $400 vs 6-mo $800)
6. Verify all save correctly
```

### **✅ Test Edit Mode:**

```
1. Complete setup
2. Go to Settings
3. Click "View Club Setup"
4. Modify tiers
5. Change loyalty rules
6. Save changes
7. Verify updates in database
```

### **✅ Test Branding:**

```
1. Review all copy in wizard
2. Verify terminology:
   - Club (not program)
   - Member (not subscriber)
   - Tier (not stage)
   - Duration (not expiration)
3. Check liberation messaging
4. Confirm empowering tone
```

---

## 🐛 Troubleshooting

### **Issue: "Session Error. Missing client"**

**Solution:** Make sure `IN_COMMERCE7=no` is set in `.env`

### **Issue: "Failed to create dev client"**

**Solution:** Check Supabase credentials and connection

### **Issue: "Redirects to home page"**

**Solution:** Session bypass might not be working. Check:
```bash
# In terminal output:
🔓 DEV MODE: Using fake session (IN_COMMERCE7=no)
```

If you don't see this, verify:
- `NODE_ENV=development`
- `IN_COMMERCE7=no`
- Restart dev server after changing .env

### **Issue: UUID constraint violation**

**Solution:** The dev client might already exist with different data. Delete it:
```sql
DELETE FROM clients WHERE tenant_shop = 'dev-test-tenant';
```

---

## 🚀 Production Deployment

### **⚠️ IMPORTANT:**

Never deploy with `IN_COMMERCE7=no` in production!

### **Before deploying:**

```bash
# In production .env (Heroku config vars):
NODE_ENV=production
IN_COMMERCE7=yes
# or omit IN_COMMERCE7 entirely
```

The bypass only works when **both** conditions are true:
1. `NODE_ENV=development`
2. `IN_COMMERCE7=no`

So even if `IN_COMMERCE7=no` accidentally stays in production, it won't activate the bypass because `NODE_ENV=production`.

---

## 📝 Console Output

When bypass is active, you'll see:

```
🔓 DEV MODE: Using fake session (IN_COMMERCE7=no)
```

This appears in:
- Page loads (getAppSession)
- Protected routes (requireAppSession)
- Any route that checks authentication

If you don't see this and expect to, check your environment variables!

---

## 🎯 Summary

| Mode | `NODE_ENV` | `IN_COMMERCE7` | Behavior |
|------|------------|----------------|----------|
| **Local Testing** | `development` | `no` | ✅ Bypass enabled, fake session |
| **Embedded Testing** | `development` | `yes` or omit | Real C7 auth required |
| **Production** | `production` | any value | Real C7 auth required |

---

## 🔗 Related Docs

- **SETUP_WIZARD_GUIDE.md** - Complete wizard documentation
- **BRANDING_MESSAGING_GUIDE.md** - Copy and terminology
- **NGROK_WEBHOOK_SETUP.md** - Webhook testing
- **SUBDOMAIN_SETUP.md** - Local domain setup

---

*Happy Testing! 🍷✨*

