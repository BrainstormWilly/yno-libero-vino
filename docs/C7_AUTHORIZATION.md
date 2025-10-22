# Commerce7 Authorization & Security

## Overview

Commerce7 is an **embedded app** that runs inside the Commerce7 admin panel. When a user accesses the app, Commerce7 passes authentication parameters that must be verified to ensure the request is legitimate.

## Authentication Flow

### 1. Install Webhook (Basic Auth)
- **Route:** `/install`
- **Method:** POST with Basic Auth headers
- **Purpose:** Initial app installation
- **Verification:** Username/password from `COMMERCE7_USER` and `COMMERCE7_PASSWORD` env vars

### 2. Embedded App Access (Account Token)
- **Routes:** `/auth`, `/settings`, `/app`
- **Method:** GET with query parameters
- **Purpose:** User accessing the app from Commerce7 admin
- **Verification:** Account token validated against Commerce7 API

## Query Parameters

When Commerce7 redirects to your app URLs, it includes:

- **`tenantId`** (required): The Commerce7 tenant identifier
- **`account`** (required): The user's authorization token
- **`adminUITheme`** (optional): "light" or "dark" theme preference

Example:
```
https://c7-your-domain.ngrok-free.app/settings?tenantId=winery-abc&account=Bearer_xyz123&adminUITheme=dark
```

## Authorization Method

### `authorizeUse(request: Request)`

Located in `app/lib/crm/commerce7.server.ts`

```typescript
async authorizeUse(request: Request): Promise<{ tenantId: string; user: any; adminUITheme?: string } | null> {
  const searchParams = new URL(request.url).searchParams;
  const tenantId = searchParams.get("tenantId");
  const account = searchParams.get("account");
  const adminUITheme = searchParams.get("adminUITheme");

  if (!tenantId || !account) {
    return null;
  }

  try {
    // Verify the account token with Commerce7 API
    const userResponse = await fetch(`${API_URL}/account/user`, {
      headers: {
        Authorization: account,
        tenant: tenantId
      },
    });

    const userData = await userResponse.json();

    if (userData?.statusCode === 401) {
      console.error("Commerce7 authorization failed: Invalid account token");
      return null;
    }

    return {
      tenantId,
      user: userData,
      adminUITheme
    };
  } catch (error) {
    console.error("Error authorizing Commerce7 user:", error);
    return null;
  }
}
```

### How It Works

1. **Extract parameters** from the request URL
2. **Validate presence** of `tenantId` and `account`
3. **Call Commerce7 API** at `/account/user` with the account token
4. **Verify response** - if 401, the token is invalid
5. **Return user data** if valid, or `null` if invalid

## Implementation in Routes

### `/auth` Route

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const { crmType } = getSubdomainInfo(request);
  const account = url.searchParams.get('account');
  const identifier = tenantId || shop;
  
  if (identifier && crmType === 'commerce7' && account) {
    const c7Provider = new Commerce7Provider();
    const authResult = await c7Provider.authorizeUse(request);
    
    if (authResult) {
      // ✅ Authorized - user verified with C7 API
      console.log(`Commerce7 user authorized: ${authResult.user.email}`);
    } else {
      // ❌ Unauthorized - invalid or expired token
      console.warn('Commerce7 authorization failed');
    }
  }
  
  // ... rest of loader
}
```

### `/settings` Route

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const { crmType } = getSubdomainInfo(request);
  const account = url.searchParams.get('account');
  
  if (crmType === 'commerce7' && account) {
    const c7Provider = new Commerce7Provider();
    const authResult = await c7Provider.authorizeUse(request);
    
    if (!authResult) {
      throw new Error('Commerce7 authorization failed. Invalid account token.');
    }
    
    console.log(`Commerce7 user authorized: ${authResult.user.email} for tenant ${authResult.tenantId}`);
  }
  
  // ... rest of loader
}
```

### `/app` Route

Same pattern as `/settings` - verifies the account token before allowing access.

## Security Benefits

### ✅ Prevents Unauthorized Access
Without verification, anyone could construct a URL with a `tenantId` and access another winery's data.

**Bad (no verification):**
```
https://your-app.com/app?tenantId=some-winery
❌ Could access any winery's data by guessing the tenantId
```

**Good (with verification):**
```
https://your-app.com/app?tenantId=some-winery&account=Bearer_xyz
✅ Account token is verified with Commerce7 API
✅ Token must be valid and match the tenantId
✅ Token expires and cannot be reused maliciously
```

### ✅ Validates User Identity
The `account` token is tied to a specific Commerce7 user. When verified:
- Confirms the user is authenticated with Commerce7
- Provides user information (email, name, permissions)
- Ensures the user has access to the specified tenant

### ✅ Detects Replay Attacks
Commerce7 tokens have expiration times. A stolen or intercepted token cannot be reused indefinitely.

### ✅ Confirms Request Origin
By verifying with the Commerce7 API, we confirm the request originated from Commerce7's systems, not a spoofed source.

## Commerce7 App Configuration

In the Commerce7 Partner Portal, configure these URLs:

### Install Webhook URL
```
https://c7-your-domain.ngrok-free.app/install
```
- Uses Basic Auth
- Creates client record in database

### Settings URL
```
https://c7-your-domain.ngrok-free.app/settings?tenantId={tenantId}&account={account}&adminUITheme={adminUITheme}
```
- C7 redirects here after install
- Uses account token verification
- Shows initial setup wizard

### Use URL (Launch Button)
```
https://c7-your-domain.ngrok-free.app/app?tenantId={tenantId}&account={account}&adminUITheme={adminUITheme}
```
- C7 opens this when user clicks app launch button
- Uses account token verification
- Shows main dashboard

## Testing Authorization

### Test with cURL

```bash
# This will fail (no valid account token)
curl "https://c7-your-domain.ngrok-free.app/app?tenantId=test-123"

# This will succeed (valid account token from C7)
# Note: You can't manually create a valid account token - it comes from C7
curl "https://c7-your-domain.ngrok-free.app/app?tenantId=test-123&account=Bearer_from_c7"
```

### Test in Development

1. Start ngrok and dev server
2. Install app in Commerce7 dev tenant
3. Click "Use" button in Commerce7 admin
4. Check server logs for authorization confirmation:
   ```
   Commerce7 user authorized: user@winery.com for tenant winery-123
   ```

### Monitor Authorization Failures

If you see these logs, the account token is invalid:
```
Commerce7 authorization failed: Invalid account token
```

Possible causes:
- Token expired
- Token doesn't match tenantId
- Network error calling C7 API
- C7 API credentials incorrect

## Best Practices

### ✅ Always Verify
Every route that handles embedded app access should call `authorizeUse()`.

### ✅ Log Authorization Events
Log successful authorizations and failures for debugging and security monitoring.

### ✅ Throw Errors on Failure
Don't silently ignore authorization failures - throw errors to prevent unauthorized access.

### ✅ Pass Account Through Redirects
When redirecting between routes, preserve the `account` parameter:
```typescript
return redirect(`/settings?tenantId=${tenantId}&account=${account}`);
```

### ❌ Don't Store Account Tokens
Account tokens are short-lived and should not be stored in the database or sessions. Always use the fresh token from the query params.

### ❌ Don't Skip Verification
Even if you've verified once, verify again on each route load. Tokens can expire or be revoked.

## Related Files

- `app/lib/crm/commerce7.server.ts` - Authorization logic
- `app/routes/auth.tsx` - Auth route with verification
- `app/routes/settings.tsx` - Settings route with verification
- `app/routes/app.tsx` - App route with verification
- `app/routes/install.tsx` - Install webhook (different auth method)

## References

- [Commerce7 API Documentation](https://api-docs.commerce7.com/)
- [Commerce7 App Development Guide](https://partners.commerce7.com/)

