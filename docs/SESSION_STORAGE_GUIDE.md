# LiberoVino Session Storage Guide

> **Database-Based Sessions for Commerce7 & Shopify (No Cookies)**

---

## 🎯 Overview

LiberoVino uses **database session storage** instead of cookies for both Commerce7 and Shopify. This unified approach is required because Shopify's iframe restrictions don't allow cookies.

### **Key Principles:**

1. ✅ **NO COOKIES** - Session data stored in Supabase
2. ✅ **URL-Based** - Session ID passed via `?session=xxx` parameter
3. ✅ **Unified** - Same approach for both C7 and Shopify
4. ✅ **Secure** - Session data encrypted in database

---

## 🏗️ Architecture

### **Session Flow:**

```
1. User authenticates (C7 or Shopify OAuth)
2. Create session in database → Get session ID
3. Redirect to app with ?session=xxx in URL
4. All subsequent navigation includes ?session=xxx
5. Loader functions read session from DB using session ID
```

### **Tables:**

- **`app_sessions`** - Web app sessions (user navigation)
- **`platform_sessions`** - OAuth tokens (API access) [future use]

---

## 📁 File Structure

```
app/lib/
├── session-storage.server.ts      # Core DB session functions
├── sessions.server.ts              # High-level session management
└── shopify-session-storage.server.ts  # Shopify SDK adapter
```

### **`session-storage.server.ts`**
Low-level database operations:
- `storeSession()` - Save/update session
- `loadSession()` - Load session by ID
- `deleteSession()` - Remove session
- `findSessionsByShop()` - Get all sessions for shop/tenant
- `createSessionId()` - Generate unique session ID
- `getSessionIdFromRequest()` - Extract session ID from URL

### **`sessions.server.ts`**
High-level helpers for route loaders/actions:
- `getAppSession()` - Get current session (returns null if none)
- `requireAppSession()` - Get session or redirect to login
- `createAppSession()` - Create new session
- `updateAppSession()` - Update session data
- `destroyAppSession()` - Logout
- `withSession()` - Add session to URL
- `redirectWithSession()` - Redirect with session preserved

### **`shopify-session-storage.server.ts`**
Shopify SDK adapter (implements `SessionStorage` interface)

---

## 🔧 Usage in Routes

### **Basic Loader (Read Session):**

```typescript
import { getAppSession } from '~/lib/sessions.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  
  if (!session) {
    throw redirect('/'); // Not logged in
  }
  
  // Use session data
  const { clientId, tenantShop, crmType, userName } = session;
  
  return { session };
}
```

### **Protected Route (Require Session):**

```typescript
import { requireAppSession } from '~/lib/sessions.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireAppSession(request); // Auto-redirects if no session
  
  // Guaranteed to have session here
  const { clientId } = session;
  
  return { data };
}
```

### **Creating a Session (Auth Flow):**

```typescript
import { createAppSession, redirectWithSession } from '~/lib/sessions.server';

export async function action({ request }: ActionFunctionArgs) {
  // After successful C7/Shopify auth...
  
  const sessionId = await createAppSession({
    clientId: 'client-uuid',
    tenantShop: 'tenant-id-or-shop-domain',
    crmType: 'commerce7', // or 'shopify'
    userName: 'John Doe',
    userEmail: 'john@example.com',
    theme: 'light',
  });
  
  // Redirect with session
  return redirectWithSession('/app', sessionId);
}
```

### **Updating Session:**

```typescript
import { getSessionId, updateAppSession } from '~/lib/sessions.server';

export async function action({ request }: ActionFunctionArgs) {
  const sessionId = getSessionId(request);
  if (!sessionId) throw new Error('No session');
  
  await updateAppSession(sessionId, {
    theme: 'dark', // Update theme preference
    userName: 'Updated Name',
  });
  
  return { success: true };
}
```

### **Logout:**

```typescript
import { getSessionId, destroyAppSession } from '~/lib/sessions.server';

export async function action({ request }: ActionFunctionArgs) {
  const sessionId = getSessionId(request);
  if (sessionId) {
    await destroyAppSession(sessionId);
  }
  
  throw redirect('/'); // Back to home
}
```

### **Creating Links with Session:**

```typescript
import { withSession, getSessionId } from '~/lib/sessions.server';

export default function MyComponent() {
  const { session } = useLoaderData<typeof loader>();
  
  return (
    <nav>
      <Link to={withSession('/app', session.id)}>Dashboard</Link>
      <Link to={withSession('/settings', session.id)}>Settings</Link>
    </nav>
  );
}
```

---

## 🔐 Session Data Structure

### **AppSessionData Interface:**

```typescript
interface AppSessionData {
  id: string;              // Session ID (in URL)
  clientId: string;        // UUID of client (winery)
  tenantShop: string;      // Tenant ID (C7) or shop domain (Shopify)
  crmType: 'commerce7' | 'shopify';
  
  // User info (optional)
  userName?: string;
  userEmail?: string;
  theme?: 'light' | 'dark';
  
  // Shopify-specific
  accessToken?: string;    // OAuth access token
  scope?: string;          // OAuth scope
  expiresAt?: Date;        // Token expiration
  
  // Commerce7-specific
  accountToken?: string;   // C7 account token from URL
}
```

### **Database Schema:**

```sql
CREATE TABLE app_sessions (
  id TEXT PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  theme VARCHAR(20),
  
  -- CRM-specific data stored as JSON
  metadata JSONB DEFAULT '{}'::jsonb,
  
  ip_address INET,
  user_agent TEXT,
  last_activity_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

The `metadata` column stores CRM-specific data:
```json
{
  "tenantShop": "my-tenant",
  "crmType": "commerce7",
  "accessToken": "token123",
  "scope": "read_write",
  "accountToken": "c7-account-token"
}
```

---

## 🔄 Commerce7 vs Shopify

### **Commerce7 Session Flow:**

```
1. User opens C7 admin → Clicks app
2. C7 redirects to: /app?tenantId=xxx&account=yyy
3. App validates account token via C7 API
4. Creates session → Redirects to /app?session=zzz
5. User navigates: /settings?session=zzz
```

**Session ID Format:** `commerce7_{tenantId}_{random}`

**Example:** `commerce7_myWinery_a1b2c3d4e5f6`

### **Shopify Session Flow:**

```
1. User installs app → OAuth flow
2. Shopify redirects with code
3. Exchange code for access token
4. Create session with token → Redirect to /app?session=zzz
5. User navigates: /settings?session=zzz
```

**Session ID Format:** `shopify_{shop.myshopify.com}_{random}`

**Example:** `shopify_my-shop.myshopify.com_a1b2c3d4e5f6`

---

## 🧪 Development Mode

### **Bypass Auth for Testing:**

```bash
# .env
NODE_ENV=development
IN_COMMERCE7=no
```

When enabled, `getAppSession()` and `requireAppSession()` return fake session:

```typescript
{
  id: 'dev-session-id',
  clientId: 'dev-test-client-id',
  tenantShop: 'dev-test-tenant',
  crmType: 'commerce7',
  userName: 'Dev Tester',
  userEmail: 'dev@test.com',
  theme: 'light',
}
```

**URLs in Dev Mode:**
```
http://localhost:3000/app
http://localhost:3000/setup
http://localhost:3000/settings
```

No `?session=xxx` needed! The fake session is automatically provided.

---

## ⚠️ Common Pitfalls

### **❌ DON'T: Use cookies**

```typescript
// ❌ BAD - Shopify doesn't allow cookies
const cookie = await cookieSessionStorage.getSession();
```

### **✅ DO: Use URL parameters**

```typescript
// ✅ GOOD
const session = await getAppSession(request);
```

### **❌ DON'T: Forget session in links**

```tsx
// ❌ BAD - Session will be lost
<Link to="/settings">Settings</Link>
```

### **✅ DO: Include session in all navigation**

```tsx
// ✅ GOOD
<Link to={withSession('/settings', session.id)}>Settings</Link>

// ✅ ALSO GOOD (Polaris Button)
<Button url={withSession('/setup', session.id)}>Setup</Button>
```

### **❌ DON'T: Hard-code redirects without session**

```typescript
// ❌ BAD
throw redirect('/app');
```

### **✅ DO: Use redirectWithSession**

```typescript
// ✅ GOOD
return redirectWithSession('/app', sessionId);
```

---

## 🔒 Security Considerations

### **Session Expiration:**
- Default: 8 hours
- Auto-cleanup via cron job
- Extended on each request (last_activity_at)

### **Session ID Format:**
- Format: `{crm}_{identifier}_{32-char-random}`
- Cryptographically random
- Easily debuggable (includes CRM type)

### **Data Storage:**
- Sensitive tokens stored in encrypted `metadata` JSONB
- IP address and user agent tracked
- RLS enabled on `app_sessions` table

### **Best Practices:**
1. ✅ Always validate session on protected routes
2. ✅ Expire sessions after inactivity
3. ✅ Clean up expired sessions regularly
4. ✅ Use `requireAppSession()` for protected routes
5. ✅ Never expose session IDs in logs

---

## 📊 Monitoring & Debugging

### **Check Active Sessions:**

```sql
SELECT 
  id,
  client_id,
  user_name,
  metadata->>'crmType' as crm_type,
  metadata->>'tenantShop' as tenant_shop,
  last_activity_at,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - NOW())) / 3600 as hours_until_expire
FROM app_sessions
WHERE expires_at > NOW()
ORDER BY last_activity_at DESC;
```

### **Clean Up Expired Sessions:**

```sql
SELECT cleanup_expired_app_sessions();
```

Or programmatically:
```typescript
import { cleanupExpiredSessions } from '~/lib/session-storage.server';

const deletedCount = await cleanupExpiredSessions();
console.log(`Cleaned up ${deletedCount} expired sessions`);
```

### **Debug Session Issues:**

```typescript
import { loadSession } from '~/lib/session-storage.server';

const sessionId = 'commerce7_myWinery_abc123';
const session = await loadSession(sessionId);

if (!session) {
  console.log('Session not found or expired');
} else {
  console.log('Session data:', session);
}
```

---

## 🚀 Migration Guide

### **Old Approach (Cookies):**

```typescript
// OLD - Don't use this
import { createCookieSessionStorage } from 'react-router';

const sessionStorage = createCookieSessionStorage({...});
const session = await sessionStorage.getSession(request.headers.get('Cookie'));
```

### **New Approach (Database):**

```typescript
// NEW - Use this
import { getAppSession, withSession } from '~/lib/sessions.server';

const session = await getAppSession(request);
const linkUrl = withSession('/app', session.id);
```

### **Steps to Migrate:**

1. ✅ Update loaders to use `getAppSession()` or `requireAppSession()`
2. ✅ Replace all `redirect()` with `redirectWithSession()`
3. ✅ Add `withSession()` to all navigation links
4. ✅ Remove any cookie-related code
5. ✅ Test session persistence across navigation
6. ✅ Run database migration `004_add_session_metadata.sql`

---

## 📝 Checklist

Before deploying:

- [ ] Database migration `004_add_session_metadata.sql` applied
- [ ] All routes use `getAppSession()` or `requireAppSession()`
- [ ] All redirects use `redirectWithSession()`
- [ ] All links use `withSession()`
- [ ] No cookie storage code remains
- [ ] Session cleanup cron job configured
- [ ] Tested both C7 and Shopify flows
- [ ] Dev mode bypass works (`IN_COMMERCE7=no`)

---

## 🎯 Summary

**DO:**
- ✅ Use database sessions (no cookies)
- ✅ Pass session ID via URL (`?session=xxx`)
- ✅ Use `withSession()` for all navigation
- ✅ Use `requireAppSession()` for protected routes
- ✅ Clean up expired sessions regularly

**DON'T:**
- ❌ Use cookie storage
- ❌ Forget session in links/redirects
- ❌ Hard-code navigation URLs
- ❌ Expose session IDs in client code
- ❌ Skip session validation

---

**Questions?** See:
- `app/lib/session-storage.server.ts` - Core implementation
- `app/lib/sessions.server.ts` - High-level helpers
- `DEVELOPMENT_TESTING.md` - Dev mode setup

---

*Last Updated: October 19, 2025*

