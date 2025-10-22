# Routing Refactor Summary

## Overview
Refactored the `/app` routing structure to follow a cleaner, nested route pattern where authorization is handled once at the parent level.

## New Routing Structure

### Public Routes (Unauthorized)
- `(www).liberovino.wine` → General homepage (unauthorized)
- `c7.liberovino.wine` (`_index`) → C7-specific homepage (unauthorized)

### Protected Routes (Authorized)
- `c7.liberovino.wine/app` → Parent layout route (handles auth + setup check)
  - `/app/_index` → Dashboard (default nested route)
  - `/app/setup` → Setup wizard (accessible when `setup_complete = false`)
  - `/app/settings` → Settings page
  - `/app/*` → All other app routes (future expansion)

## Key Changes

### 1. Parent Route: `/app` (app.tsx)
**Location:** `app/routes/app.tsx`

**Responsibilities:**
- **Authorization Check ONLY**: Validates session or processes new auth requests (account token from C7)
- **Layout**: Provides header with navigation + `<Outlet/>` for nested routes
- **Does NOT handle**: Setup checks or business logic - that's delegated to child routes

**Authorization Flow:**
1. **New Auth** (embedded app launch): `?tenantId=xxx&account=xxx`
   - Verifies account token with Commerce7 API
   - Creates session
   - Redirects to `/app` with session in URL
   
2. **Existing Session**: `?session=xxx`
   - Validates session from URL parameter
   - Loads client data
   - Continues to nested route

3. **No Auth**: Redirects to `/` (homepage)

### 2. Nested Routes
Each nested route has its own loader that runs AFTER the parent loader:

- **`/app/_index`** (app._index.tsx) → Dashboard
  - Checks if `setup_complete`, redirects to `/app/setup` if not
  - Displays dashboard content
  
- **`/app/setup`** (app.setup.tsx) → Setup wizard  
  - Handles club configuration
  - Marks `setup_complete = true` on completion
  
- **`/app/settings`** (app.settings.tsx) → Settings
  - Checks if `setup_complete`, redirects to `/app/setup` if not
  - Manages org details

All child routes **trust** that the parent already validated authorization

**Child Route Loader Pattern:**
```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  
  // Get client data
  const client = await getClient(session.clientId);
  
  // Child route handles its own logic (e.g., setup check)
  if (!client.setup_complete && !request.url.includes('/setup')) {
    throw redirect('/app/setup');
  }
  
  // Continue with route-specific logic...
  return { client, session };
}
```

### 3. File Moves
- `app/routes/setup.tsx` → `app/routes/app.setup.tsx`
- `app/routes/settings.tsx` → `app/routes/app.settings.tsx`
- Created: `app/routes/app._index.tsx` (dashboard content)

### 4. Background Styling
- Parent layout (`app.tsx`) provides: `bg-gradient-to-br from-purple-50 to-violet-100`
- Nested routes wrap content in: `<div className="container mx-auto px-4">`
- Removed duplicate background styling from nested routes

## Authorization Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Commerce7 Launches Embedded App                            │
│  c7.liberovino.wine/app?tenantId=xxx&account=xxx           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  /app Loader (Parent Route)                                 │
│  ✓ Detects account token                                   │
│  ✓ Calls Commerce7Provider.authorizeUse()                  │
│  ✓ Creates session                                          │
│  ✓ Redirects to /app?session=xxx                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  /app Loader (with session)                                 │
│  ✓ Validates session                                        │
│  ✓ Loads client data                                        │
│  ✓ Returns data for layout (header)                        │
│  ✓ Renders layout + <Outlet/>                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Child Route Loader (e.g., app._index.tsx)                 │
│  ✓ Trusts parent handled auth                              │
│  ✓ Gets session via getAppSession(request)                 │
│  ✓ Loads own data (client, etc.)                           │
│  ✓ Checks setup_complete (redirects if needed)             │
│  ✓ Returns data for child component                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  Child Component Renders in <Outlet/>                      │
│  ✓ Uses its own loader data                                │
│  ✓ Displays within parent layout                           │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

1. **Single Point of Auth**: Authorization logic lives in one place (`/app`)
2. **Simpler Nested Routes**: Child routes don't duplicate auth checks
3. **Embedded App Safe**: Only entry point is through embedded flow (no direct deep linking)
4. **Clean URLs**: After initial auth, all navigation uses session parameter
5. **Easy to Extend**: New `/app/*` routes automatically inherit auth

## Session Management

Sessions are managed via URL parameters (not cookies):
- Session ID is appended to URLs: `/app?session=commerce7:tenant-id:hash`
- Helper functions:
  - `createAppSession()` - Creates new session
  - `getAppSession(request)` - Retrieves session from URL
  - `redirectWithSession(url, sessionId)` - Redirects with session preserved

## Testing

### Dev Mode: Unembedded Commerce7 Testing

**Why needed:** Commerce7 embedded app testing has friction - requires navigating through C7 admin panel. Shopify doesn't have this issue.

**Setup:**
Set `EMBEDDED_APP=no` in `.env`:
```bash
NODE_ENV=development
EMBEDDED_APP=no
```

**What happens:**
When you access `/app` in unembedded dev mode, the parent route automatically:
1. ✅ Upserts a fake C7 client (`Fake C7 Client`)
2. ✅ Creates a fake session with that client ID
3. ✅ Returns client + session data to all nested routes
4. ✅ You can now test all `/app/*` routes without C7 embedded app

**Code:**
```typescript
// app/routes/app.tsx
if (process.env.NODE_ENV === 'development' && process.env.EMBEDDED_APP === 'no') {
  console.log('🔓 DEV MODE: Upsert fake C7 client and create fake session');
  
  // Upsert fake C7 client (Yno Fanbase equivalent)
  const fakeClient = await upsertFakeClient('commerce7');
  const fakeSession = getFakeAppSession('commerce7');
  
  // Override with actual client ID
  fakeSession.clientId = fakeClient.id;
  fakeSession.tenantShop = fakeClient.tenant_shop;
  
  return { 
    client: fakeClient,
    session: fakeSession,
    isDev: true 
  };
}
```

**Nested routes:** All nested routes (setup, settings, dashboard) now just retrieve the session and client - they don't need to re-create the fake client.

### Embedded Testing

For testing the actual embedded flow:
1. Set `EMBEDDED_APP=yes` in `.env`
2. Use ngrok to expose local server
3. Configure C7 app to point to ngrok URL
4. Launch from C7 admin panel

## Future Shopify Support

The structure is ready for Shopify:
- Add Shopify authorization logic in `/app` loader
- Use similar pattern: `?shop=xxx&auth=xxx`
- Nested routes remain unchanged (they trust parent auth)

