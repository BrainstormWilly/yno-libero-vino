# 🌱 Snaplet Seed Setup - YNO FANBASE

> **Quick setup for local development with real yno-fanbase C7 account**

---

## ✅ What's Been Created

1. **`seed.config.ts`** - Snaplet configuration
2. **`seed.ts`** - Seeds yno-fanbase client
3. **Updated all dev mode code** to use "yno-fanbase" instead of fake data

---

## 🚀 Quick Start

### **1. Set Up Environment**

Add to your `.env`:

```bash
# Database connection for Snaplet
SUPABASE_DB_URL=postgresql://postgres:[YOUR_PASSWORD]@[YOUR_HOST]:5432/postgres

# Dev mode bypass
NODE_ENV=development
IN_COMMERCE7=no
```

### **2. Run the Seed**

```bash
# Install dependencies (if needed)
npm install

# Run seed
npx tsx seed.ts
```

**Output:**
```
✅ Seeded LiberoVino database with yno-fanbase client

📝 Use these credentials for IN_COMMERCE7=no mode:
   tenant_shop: yno-fanbase
   client_id: yno-fanbase-client-id
```

### **3. Start Dev Server**

```bash
npm run dev
```

### **4. Test**

Visit: `http://localhost:3000/app`

You should see:
- ✅ Console: `🔓 DEV MODE: Using yno-fanbase session (IN_COMMERCE7=no)`
- ✅ App loads with "Yno Fanbase" as org name
- ✅ No authentication errors
- ✅ Can access setup wizard, settings, etc.

---

## 📊 What Gets Seeded

The seed creates one client in your local database:

```typescript
{
  id: "yno-fanbase-client-id",
  tenant_shop: "yno-fanbase",
  crm_type: "commerce7",
  org_name: "Yno Fanbase",
  org_contact: "William Langley",
  user_email: "will@ynosoftware.com",
  setup_complete: false, // Allows testing setup wizard
}
```

---

## 🔄 Resetting Data

To reset and re-seed:

```bash
# This will:
# 1. Clear all data from database
# 2. Re-create yno-fanbase client

npx tsx seed.ts
```

**⚠️ Warning:** This deletes ALL data in your local database!

---

## 🧪 What Changed from Fake Data

### **Before (Fake Data):**
```typescript
{
  clientId: 'dev-test-client-id',
  tenantShop: 'dev-test-tenant',
  userName: 'Dev Tester',
  userEmail: 'dev@test.com',
}
```

### **After (Real YNO Fanbase):**
```typescript
{
  clientId: 'yno-fanbase-client-id',
  tenantShop: 'yno-fanbase',
  userName: 'William Langley',
  userEmail: 'will@ynosoftware.com',
}
```

---

## 📝 Files Updated

All files now use `yno-fanbase` instead of `dev-test-*`:

- ✅ `app/lib/sessions.server.ts` - Dev mode session data
- ✅ `app/routes/app.tsx` - Dev mode client lookup
- ✅ `app/routes/setup.tsx` - Dev mode client lookup
- ✅ `app/routes/settings.tsx` - Dev mode client lookup

---

## 🎯 Adding More Seed Data

To add more data (customers, orders, etc.) later, edit `seed.ts`:

```typescript
// Example: Add test customers
await seed.customers([
  {
    client_id: "yno-fanbase-client-id",
    email: "test@example.com",
    first_name: "Test",
    last_name: "Customer",
    is_club_member: false,
  },
]);

// Example: Add club program
await seed.club_programs([
  {
    client_id: "yno-fanbase-client-id",
    name: "Yno Fanbase Wine Club",
    description: "Liberation starts here!",
    is_active: true,
  },
]);
```

---

## 🔍 Troubleshooting

### **Issue: "SUPABASE_DB_URL not found"**

**Solution:** Add the connection string to `.env`:

```bash
# Get from Supabase dashboard → Project Settings → Database
SUPABASE_DB_URL=postgresql://postgres:password@host:5432/postgres
```

### **Issue: "Client already exists" error**

**Solution:** The seed resets the database first, but if you get an error:

```sql
-- Manually delete the client
DELETE FROM clients WHERE id = 'yno-fanbase-client-id';
```

Then re-run the seed.

### **Issue: Dev mode not working**

**Solution:** Make sure you have BOTH:

```bash
NODE_ENV=development
IN_COMMERCE7=no
```

---

## ✨ Benefits

- ✅ **Real C7 account data** - Uses actual yno-fanbase tenant
- ✅ **Consistent testing** - Same data every time
- ✅ **Quick reset** - One command to start fresh
- ✅ **No fake data** - More realistic development experience
- ✅ **Easy to extend** - Add more seed data as needed

---

## 🚀 Next Steps

1. **Run the seed** - `npx tsx seed.ts`
2. **Start dev server** - `npm run dev`
3. **Test the app** - Visit `http://localhost:3000/app`
4. **Complete setup wizard** - Test tier creation, loyalty config
5. **Add more seeds** - Customers, orders, enrollments as needed

---

*Ready to develop with yno-fanbase! 🍷✨*

