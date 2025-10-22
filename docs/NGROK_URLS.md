# Ngrok URLs for Commerce7 Partner Configuration

## 🎯 URLs for C7 App Admin

Use these URLs when configuring your app in the Commerce7 Partner Portal:

### Development (Ngrok)

```
Install Webhook URL:
https://c7-kindly-balanced-macaw.ngrok-free.app/install

Settings URL:
https://c7-kindly-balanced-macaw.ngrok-free.app/settings?tenantId={tenantId}

Use URL:
https://c7-kindly-balanced-macaw.ngrok-free.app/app?tenantId={tenantId}
```

### Production

```
Install Webhook URL:
https://c7.liberovino.wine/install

Settings URL:
https://c7.liberovino.wine/settings?tenantId={tenantId}

Use URL:
https://c7.liberovino.wine/app?tenantId={tenantId}
```

---

## 📝 Changes Made

### Refactored to Shared Routes (Option B)

**File Structure:**
```
app/routes/
  install.tsx   → /install (handles both C7 & Shopify)
  auth.tsx      → /auth (handles both C7 & Shopify)
  settings.tsx  → /settings (handles both C7 & Shopify)
  app.tsx       → /app (handles both C7 & Shopify)
```

**Routes Configuration** (`app/routes.ts`):
```typescript
export default [
  index("routes/_index.tsx"),
  route("install", "routes/install.tsx"),
  route("auth", "routes/auth.tsx"),
  route("settings", "routes/settings.tsx"),
  route("app", "routes/app.tsx"),
  route("home", "routes/home.tsx"),
] satisfies RouteConfig;
```

### Key Features

1. **CRM Detection**: Each route uses `getSubdomainInfo(request)` to detect C7 vs Shopify
2. **Normalized Data**: Uses `identifier` (tenantId for C7, shop for Shopify)
3. **Shared UI**: Same Polaris components for both CRMs
4. **Dynamic Branching**: Loader/action methods branch based on `crmType`
5. **Clean URLs**: No redundant `/c7/` or `/shp/` prefixes

### URL Patterns

| CRM | Subdomain | Route | Full URL |
|-----|-----------|-------|----------|
| Commerce7 | c7 | /install | `c7.domain.com/install` |
| Commerce7 | c7 | /auth | `c7.domain.com/auth?tenantId=xxx` |
| Commerce7 | c7 | /settings | `c7.domain.com/settings?tenantId=xxx` |
| Commerce7 | c7 | /app | `c7.domain.com/app?tenantId=xxx` |
| Shopify | shp | /install | `shp.domain.com/install` |
| Shopify | shp | /auth | `shp.domain.com/auth?shop=xxx` |
| Shopify | shp | /settings | `shp.domain.com/settings?shop=xxx` |
| Shopify | shp | /app | `shp.domain.com/app?shop=xxx` |

---

## 🚀 Testing Locally

### 1. Start Ngrok
```bash
cd /Users/willysair/Documents/Yno/LiberoVino/yno-libero-vino
./scripts/start-ngrok.sh c7
```

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Test Install Webhook
```bash
curl -X POST https://c7-kindly-balanced-macaw.ngrok-free.app/install \
  -H "Authorization: Basic $(echo -n 'your_username:your_password' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-winery",
    "user": {
      "id": "user-123",
      "email": "owner@testwinery.com",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    "organization-name": "Test Winery"
  }'
```

### 4. Test Auth Flow
```bash
# Open in browser
open "https://c7-kindly-balanced-macaw.ngrok-free.app/auth?tenantId=test-winery&account=user-123"
```

### 5. Complete Full Flow
1. Visit `/auth` → See welcome screen
2. Click "Continue to Setup" → Go to `/settings`
3. Click "Complete Setup & Launch App" → Go to `/app`
4. See dashboard with stats

---

## 🔑 Environment Variables Required

Make sure these are set in your `.env.local`:

```bash
# Supabase
SUPABASE_URL=http://127.0.0.1:54421
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Commerce7
COMMERCE7_KEY=your_api_key
COMMERCE7_USER=install_webhook_username
COMMERCE7_PASSWORD=install_webhook_password

# Domain
NGROK_URL=kindly-balanced-macaw.ngrok-free.app
```

---

## 📊 Flow Diagram

```
┌─────────────────────────────────┐
│  Install in C7 Admin            │
└───────────────┬─────────────────┘
                │
                │ POST c7.domain.com/install
                │ (creates client with setup_complete=false)
                │
                v
┌─────────────────────────────────┐
│  C7 redirects to:               │
│  c7.domain.com/auth?tenantId=x  │
│                                 │
│  Shows welcome screen           │
│  "Continue to Setup" button     │
└───────────────┬─────────────────┘
                │
                v
┌─────────────────────────────────┐
│  c7.domain.com/settings         │
│                                 │
│  - Club programs (optional)     │
│  - Loyalty rules (optional)     │
│  - Communications (optional)    │
│                                 │
│  "Complete Setup & Launch App"  │
└───────────────┬─────────────────┘
                │
                │ (sets setup_complete=true)
                │
                v
┌─────────────────────────────────┐
│  c7.domain.com/app              │
│                                 │
│  Dashboard with:                │
│  - Quick stats                  │
│  - Quick actions                │
│  - Settings link                │
└─────────────────────────────────┘
```

---

## ✅ Benefits of Shared Route Approach

1. **No URL Redundancy**: `c7.domain.com/auth` instead of `c7.domain.com/c7/auth`
2. **Code Reuse**: Same Polaris UI components for both CRMs
3. **Easy Maintenance**: Update one route file instead of two
4. **Flexible**: Can still add CRM-specific routes if needed (e.g., `c7.special.tsx`)
5. **Type Safety**: TypeScript enforces correct data handling

---

## 🎨 UI Consistency

Both Commerce7 and Shopify users see:
- Same welcome screens
- Same setup wizard
- Same dashboard layout
- Only difference: Labels ("Tenant ID" vs "Shop Domain")

This provides a consistent user experience across both platforms! ✨

