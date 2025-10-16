# Row Level Security (RLS) Strategy

## Current State

Right now, we're using a simple "allow all for service role" policy, which effectively bypasses RLS. This is fine for initial development but not suitable for production.

```sql
-- Current (Development Only)
CREATE POLICY "Allow all operations for service role" ON clients FOR ALL USING (true);
```

This works when:
- All database access is server-side via API routes
- Using `SUPABASE_SERVICE_ROLE_KEY` in backend
- No direct database access from client-side code

## Architecture Decision: Who Accesses the Database?

### Option 1: API-Only Architecture (Recommended for MVP)

**No RLS needed initially:**
- All database operations go through React Router server actions/loaders
- Client-side code never directly accesses Supabase
- Backend uses service role key (bypasses RLS)
- We implement authorization in application code

**Pros:**
✅ Simpler to start
✅ No user management needed initially
✅ Full control over authorization logic
✅ Easier to debug
✅ Standard API pattern

**Cons:**
❌ Can't use Supabase Realtime features from client
❌ Backend must handle all data access

### Option 2: Multi-Tenant RLS (Production-Ready)

**RLS enforces data isolation:**
- Winery admins can log in and access their data directly
- Wine club members can log in and see their info
- RLS policies prevent cross-tenant data leaks
- Multiple user roles with different permissions

**Pros:**
✅ Strongest security (defense in depth)
✅ Enables Realtime subscriptions
✅ Direct client queries possible
✅ Supabase handles auth

**Cons:**
❌ More complex setup
❌ Need user authentication system
❌ RLS policies can be tricky
❌ Performance considerations

## Recommended Approach: Hybrid

Start with **Option 1** for MVP, add **Option 2** later for admin portals.

### Phase 1: Service Role Only (Current)

```sql
-- All tables
CREATE POLICY "Service role has full access" 
  ON [table_name] FOR ALL 
  USING (true);
```

Authorization handled in application code:

```typescript
// In server actions/loaders
export async function loader({ request }: LoaderFunctionArgs) {
  // Get session from cookie/header
  const session = await getSession(request);
  
  // Verify user has access to this client
  if (session.client_id !== requestedClientId) {
    throw new Response('Unauthorized', { status: 403 });
  }
  
  // Query with service role (bypasses RLS)
  const data = await supabase
    .from('customers')
    .select('*')
    .eq('client_id', session.client_id);
  
  return json(data);
}
```

### Phase 2: Add RLS for Admin Portal

When you want winery admins to log in:

## RLS Policies for Production

### User Types

We'll need 3 types of database users:

1. **Service Role** (Backend API)
   - Bypasses all RLS
   - Used by webhooks and server actions
   - Has full access

2. **Winery Admin** (Winery staff)
   - Can see/manage all data for their winery
   - Authenticated via Supabase Auth
   - `user_metadata.client_id` identifies their winery

3. **Wine Club Member** (End customers)
   - Can only see their own customer data
   - Authenticated via Supabase Auth
   - `user_metadata.customer_id` identifies them

### User Management Tables

```sql
-- Winery admin users
CREATE TABLE winery_admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wine club member users (optional - if building customer portal)
CREATE TABLE customer_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### RLS Policies for Multi-Tenant Access

#### Example: `clients` Table

```sql
-- Service role (backend)
CREATE POLICY "service_role_all_clients"
  ON clients FOR ALL
  TO service_role
  USING (true);

-- Winery admins can only see their own client
CREATE POLICY "winery_admins_own_client"
  ON clients FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT client_id FROM winery_admins 
      WHERE id = auth.uid()
    )
  );
```

#### Example: `customers` Table

```sql
-- Service role (backend)
CREATE POLICY "service_role_all_customers"
  ON customers FOR ALL
  TO service_role
  USING (true);

-- Winery admins can see/manage their winery's customers
CREATE POLICY "winery_admins_own_customers"
  ON customers FOR ALL
  TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM winery_admins 
      WHERE id = auth.uid()
    )
  );

-- Wine club members can only see themselves (if building customer portal)
CREATE POLICY "customers_own_data"
  ON customers FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT customer_id FROM customer_users 
      WHERE id = auth.uid()
    )
  );
```

#### Example: `club_enrollments` Table

```sql
-- Service role
CREATE POLICY "service_role_all_enrollments"
  ON club_enrollments FOR ALL
  TO service_role
  USING (true);

-- Winery admins can manage enrollments for their customers
CREATE POLICY "winery_admins_own_enrollments"
  ON club_enrollments FOR ALL
  TO authenticated
  USING (
    customer_id IN (
      SELECT c.id FROM customers c
      JOIN winery_admins wa ON c.client_id = wa.client_id
      WHERE wa.id = auth.uid()
    )
  );

-- Wine club members can view their own enrollments
CREATE POLICY "customers_own_enrollments"
  ON club_enrollments FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM customer_users 
      WHERE id = auth.uid()
    )
  );
```

#### Example: `point_transactions` Table

```sql
-- Service role
CREATE POLICY "service_role_all_transactions"
  ON point_transactions FOR ALL
  TO service_role
  USING (true);

-- Winery admins can see all their customers' transactions
CREATE POLICY "winery_admins_customer_transactions"
  ON point_transactions FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT c.id FROM customers c
      JOIN winery_admins wa ON c.client_id = wa.client_id
      WHERE wa.id = auth.uid()
    )
  );

-- Wine club members can only see their own transactions
CREATE POLICY "customers_own_transactions"
  ON point_transactions FOR SELECT
  TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM customer_users 
      WHERE id = auth.uid()
    )
  );
```

## Authentication Setup

### For Winery Admins

```typescript
// Sign up a winery admin
async function createWineryAdmin(email: string, password: string, clientId: string) {
  // 1. Create auth user
  const { data: authUser, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: 'winery_admin',
      client_id: clientId
    }
  });
  
  if (error) throw error;
  
  // 2. Create winery_admin record
  await supabase
    .from('winery_admins')
    .insert({
      id: authUser.user.id,
      client_id: clientId,
      email,
      role: 'admin'
    });
  
  return authUser;
}

// Login
async function loginWineryAdmin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) throw error;
  
  // Get their client_id from winery_admins table
  const { data: admin } = await supabase
    .from('winery_admins')
    .select('client_id, role')
    .eq('id', data.user.id)
    .single();
  
  return { user: data.user, clientId: admin.client_id, role: admin.role };
}
```

### For Wine Club Members (Optional)

```typescript
// Sign up a wine club member
async function createCustomerUser(email: string, customerId: string) {
  // Send magic link (passwordless)
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      data: {
        role: 'customer',
        customer_id: customerId
      }
    }
  });
  
  if (error) throw error;
  
  return data;
}
```

## My Recommendation

### Start Simple (Phase 1 - MVP)

**Don't add RLS complexity yet:**

```sql
-- Keep current simple policies
CREATE POLICY "Allow all operations for service role" 
  ON [table_name] FOR ALL 
  USING (true);
```

**Why:**
- ✅ Faster development
- ✅ Easier debugging
- ✅ Sufficient security when all access is server-side
- ✅ Can add RLS later without breaking changes

**Security comes from:**
- Backend API routes validate access
- Service role key never exposed to client
- Application-level authorization checks

### Add RLS Later (Phase 2 - Admin Portal)

When you build the winery admin portal:

1. Create `winery_admins` table
2. Implement Supabase Auth for winery staff
3. Add RLS policies per the examples above
4. Optionally add customer portal with member auth

## Current Security Model

### Backend (Secure)
```
Client Browser → React Router (Server) → Supabase (Service Role)
                     ↑
                 Auth checks happen here
                 client_id validation
```

### What This Means

**You DON'T need:**
- ❌ User authentication right now
- ❌ Complex RLS policies
- ❌ Supabase Auth setup

**You DO have:**
- ✅ Server-side authorization
- ✅ API-level access control
- ✅ Clean separation of concerns

## When to Add RLS

Add RLS when you want to:
- Allow winery admins to directly query database from UI
- Build a winery admin portal with login
- Build a customer portal for wine club members
- Use Supabase Realtime features
- Enable direct client-side database access

## Summary

### Current (Good for MVP):
```
All DB access → Backend API → Service Role Key → No RLS needed
```

### Future (When Building Portals):
```
Winery Admin Login → Supabase Auth → RLS Policies → Only their data
Customer Login → Supabase Auth → RLS Policies → Only their data
Backend API → Service Role → Bypasses RLS → Full access
```

## Migration Changes Needed?

**For now: None!** 

The current RLS setup is perfect for your architecture. When you're ready to add authenticated portals, we'll add:

1. `winery_admins` table
2. `customer_users` table (optional)
3. Update RLS policies to be role-aware

Keep it simple for now! 👍

---

**TL;DR:** Current RLS setup is fine. All access goes through your backend API with service role key. No user registration needed yet. Add RLS policies later when building admin/customer portals.

