# Session Management Strategy

This app uses **two different types of sessions** for different purposes. Understanding the distinction is critical for proper implementation.

## 📋 Table of Contents
- [Overview](#overview)
- [App Sessions](#app-sessions)
- [Platform Sessions](#platform-sessions)
- [Implementation Guide](#implementation-guide)
- [Security Considerations](#security-considerations)
- [Maintenance](#maintenance)

---

## Overview

### Why Two Types of Sessions?

1. **App Sessions** - For maintaining authenticated state as users navigate through routes
2. **Platform Sessions** - For storing OAuth tokens to access Commerce7/Shopify APIs

These serve completely different purposes and should not be confused!

---

## App Sessions

### Purpose
Maintain user authentication state across routes **without** requiring re-authorization on every page.

### Database Table: `app_sessions`

```sql
CREATE TABLE app_sessions (
  id TEXT PRIMARY KEY,              -- Session ID (stored in cookie)
  client_id UUID NOT NULL,          -- References clients table
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  theme VARCHAR(20),                -- 'light' or 'dark'
  ip_address INET,
  user_agent TEXT,
  last_activity_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,  -- 8 hours from creation
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Storage Strategy
- **Cookie**: Stores only the session ID (`__libero_session`)
- **Database**: Stores all session data
- **Duration**: 8 hours (configurable)

### Usage Examples

#### Create Session (on login/install)
```typescript
import { createAppSession, createSessionCookie } from '~/lib/sessions.server';

const sessionId = await createAppSession({
  clientId: client.id,
  tenantShop: 'winery-123',
  crmType: 'commerce7',
  userName: 'John Doe',
  userEmail: 'john@winery.com',
  theme: 'light',
}, request);

const sessionCookie = await createSessionCookie(sessionId);

return {
  success: true,
  headers: {
    'Set-Cookie': sessionCookie,
  }
};
```

#### Require Session (protected routes)
```typescript
import { requireAppSession } from '~/lib/sessions.server';

export async function loader({ request }: LoaderFunctionArgs) {
  // This will redirect to / if no valid session exists
  const session = await requireAppSession(request);
  
  // Now you have session.clientId, session.userName, etc.
  const client = await getClient(session.clientId);
  
  return { client, session };
}
```

#### Optional Session (public routes with auth enhancement)
```typescript
import { getAppSession } from '~/lib/sessions.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  
  if (session) {
    // User is logged in
    return { authenticated: true, user: session };
  } else {
    // Guest user
    return { authenticated: false };
  }
}
```

#### Destroy Session (logout)
```typescript
import { destroyAppSession } from '~/lib/sessions.server';

export async function action({ request }: ActionFunctionArgs) {
  const destroyCookie = await destroyAppSession(request);
  
  return redirect('/', {
    headers: {
      'Set-Cookie': destroyCookie,
    },
  });
}
```

---

## Platform Sessions

### Purpose
Store OAuth **access tokens** and **refresh tokens** for making API calls to Commerce7/Shopify.

### Database Table: `platform_sessions`

```sql
CREATE TABLE platform_sessions (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,          -- References clients table
  access_token TEXT NOT NULL,       -- OAuth access token
  refresh_token TEXT,               -- OAuth refresh token (if applicable)
  scope TEXT,                       -- OAuth scopes granted
  expires_at TIMESTAMPTZ NOT NULL,  -- Token expiration
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Usage Examples

#### Store Platform Tokens (during OAuth flow)
```typescript
import { createClient } from '@supabase/supabase-js';

// After successful OAuth exchange
const { data, error } = await supabase
  .from('platform_sessions')
  .insert({
    client_id: clientId,
    access_token: oauthResponse.access_token,
    refresh_token: oauthResponse.refresh_token,
    scope: oauthResponse.scope,
    expires_at: new Date(Date.now() + oauthResponse.expires_in * 1000),
  });
```

#### Retrieve Platform Token (for API calls)
```typescript
// Get the latest active platform session for a client
const { data: platformSession } = await supabase
  .from('platform_sessions')
  .select('access_token, expires_at')
  .eq('client_id', clientId)
  .gte('expires_at', new Date().toISOString())
  .order('created_at', { ascending: false })
  .limit(1)
  .single();

// Use the token to call Commerce7/Shopify API
const response = await fetch('https://api.commerce7.com/v1/customers', {
  headers: {
    'Authorization': `Bearer ${platformSession.access_token}`,
    'tenant': tenantId,
  },
});
```

---

## Implementation Guide

### Route Protection Pattern

Most routes should follow this pattern:

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const account = url.searchParams.get('account'); // C7 auth token
  
  // 1. Try existing session first (fast path)
  const existingSession = await getAppSession(request);
  if (existingSession && !account) {
    // User has valid session, load data from session
    const client = await getClientById(existingSession.clientId);
    return { client, session: existingSession };
  }
  
  // 2. No session - need fresh authorization
  if (crmType === 'commerce7' && account) {
    // Verify C7 authorization
    const authResult = await c7Provider.authorizeUse(request);
    
    // Create new app session
    const sessionId = await createAppSession({
      clientId: client.id,
      tenantShop: authResult.tenantId,
      crmType: 'commerce7',
      userName: authResult.user.firstName,
      userEmail: authResult.user.email,
    }, request);
    
    const sessionCookie = await createSessionCookie(sessionId);
    
    return {
      client,
      headers: { 'Set-Cookie': sessionCookie }
    };
  }
  
  // 3. No session and no auth - redirect to login
  throw redirect('/');
}
```

### Key Benefits

✅ **Performance**: Session check is faster than OAuth validation  
✅ **User Experience**: No re-authorization on every navigation  
✅ **Security**: Sessions expire after 8 hours  
✅ **Scalability**: Database-backed sessions work across multiple servers  
✅ **Auditability**: Track IP addresses, user agents, last activity  

---

## Security Considerations

### App Sessions
- ✅ **HttpOnly cookies** - JavaScript cannot access session ID
- ✅ **Secure flag** - Only sent over HTTPS in production
- ✅ **SameSite** - Protection against CSRF
- ✅ **8 hour expiration** - Automatic timeout
- ✅ **Activity tracking** - Updates `last_activity_at` on each request
- ✅ **IP/User Agent logging** - Detect session hijacking

### Platform Sessions
- ✅ **Encrypted at rest** - Supabase handles encryption
- ✅ **Row Level Security** - Only service role can access
- ✅ **Token expiration** - Respect OAuth token TTL
- ⚠️ **Refresh tokens** - Handle securely, never expose to client

### Best Practices

1. **Never send platform tokens to the client** - They're for server-side API calls only
2. **Validate app sessions on protected routes** - Use `requireAppSession()`
3. **Clean up expired sessions** - Run cleanup job periodically
4. **Log security events** - Track failed auth attempts
5. **Monitor session activity** - Alert on suspicious patterns

---

## Maintenance

### Cleanup Expired Sessions

Run this periodically (e.g., daily cron job):

```typescript
import { cleanupExpiredSessions } from '~/lib/sessions.server';

// In a cron job or background worker
const deletedCount = await cleanupExpiredSessions();
console.log(`Deleted ${deletedCount} expired sessions`);
```

Or use the Supabase function directly:

```sql
SELECT cleanup_expired_app_sessions();
```

### Monitoring Queries

```sql
-- Active sessions by client
SELECT 
  c.org_name,
  COUNT(s.id) as active_sessions,
  MAX(s.last_activity_at) as last_activity
FROM app_sessions s
JOIN clients c ON c.id = s.client_id
WHERE s.expires_at > NOW()
GROUP BY c.id, c.org_name
ORDER BY active_sessions DESC;

-- Sessions expiring soon (< 1 hour)
SELECT 
  s.*,
  c.org_name,
  (s.expires_at - NOW()) as time_remaining
FROM app_sessions s
JOIN clients c ON c.id = s.client_id
WHERE s.expires_at BETWEEN NOW() AND NOW() + INTERVAL '1 hour'
ORDER BY s.expires_at;

-- Inactive sessions (> 1 hour no activity)
SELECT 
  s.*,
  c.org_name,
  (NOW() - s.last_activity_at) as idle_time
FROM app_sessions s
JOIN clients c ON c.id = s.client_id
WHERE s.last_activity_at < NOW() - INTERVAL '1 hour'
  AND s.expires_at > NOW()
ORDER BY s.last_activity_at;
```

---

## Summary

| Feature | App Sessions | Platform Sessions |
|---------|-------------|------------------|
| **Purpose** | User authentication state | OAuth API tokens |
| **Storage** | ID in cookie, data in DB | All data in DB |
| **Table** | `app_sessions` | `platform_sessions` |
| **Duration** | 8 hours | Varies (OAuth TTL) |
| **When Created** | Login/Authorization | OAuth flow |
| **Used For** | Route protection, user context | API calls to C7/Shopify |
| **Client Access** | Session ID only (cookie) | Never exposed to client |

**Remember**: App sessions are for YOUR app's authentication. Platform sessions are for THEIR API's authentication.

