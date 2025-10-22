# Commerce7 Complete Application Flow

## Overview

This document describes the complete user journey from installation to daily use of the Libero Vino app for Commerce7.

## Flow Diagram

```
┌─────────────────────┐
│  User installs app  │
│  in Commerce7 admin │
└──────────┬──────────┘
           │
           │ POST c7.domain.com/install
           │ (creates client record)
           │
           v
┌─────────────────────┐
│  C7 redirects to:   │
│  c7.domain.com/auth │
│  ?tenantId=xxx      │
└──────────┬──────────┘
           │
           │ (shows welcome screen)
           │
           v
┌─────────────────────┐
│ c7.domain.com       │
│    /settings        │
│  ?tenantId=xxx      │
│                     │
│ - Club programs     │
│ - Loyalty rules     │
│ - Communications    │
│                     │
│ [Complete Setup]    │
└──────────┬──────────┘
           │
           │ (sets setup_complete = true)
           │
           v
┌─────────────────────┐
│ c7.domain.com       │
│    /app             │
│  ?tenantId=xxx      │
│                     │
│ - Dashboard         │
│ - Quick stats       │
│ - Actions           │
└─────────────────────┘
           │
           │ (subsequent visits go directly here)
           │
           v
┌─────────────────────┐
│  Daily usage of     │
│  Libero Vino app    │
└─────────────────────┘
```

## Route Files

### 1. `/install` → `c7.install.tsx`

**URL:** `https://c7.domain.com/install`

**Purpose:** Receives Commerce7 install webhook

**Commerce7 Config:** Set as "Install Webhook URL"

**Flow:**
1. Validates Basic Auth from C7
2. Receives install payload with tenantId and user info
3. Creates `clients` record with `setup_complete = false`
4. Returns success to C7
5. C7 then redirects user to auth URL

**Key Fields Created:**
- `tenant_shop`: tenantId from C7
- `crm_type`: 'commerce7'
- `org_name`: organization name or tenantId
- `org_contact`: user's full name
- `user_id`: C7 user ID
- `user_email`: user email
- `setup_complete`: false (default)

---

### 2. `/auth` → `c7.auth.tsx`

**URL:** `https://c7.domain.com/auth?tenantId=xxx&account=xxx`

**Purpose:** Post-install landing page, shows welcome message

**Commerce7 Config:** Not explicitly configured (C7 auto-redirects here after install)

**Flow:**
1. Extracts `tenantId` from query params
2. Looks up client in database
3. **If found:** Shows welcome screen with "Continue to Setup" button
4. **If not found:** Shows error (installation failed)
5. **If no tenantId:** Shows instructions to install from C7

**UI Components:**
- ✅ Success icon
- Organization details
- Next steps checklist
- "Continue to Setup" button → `/settings`

---

### 3. `/settings` → `c7.settings.tsx`

**URL:** `https://c7.domain.com/settings?tenantId=xxx`

**Purpose:** Initial setup wizard for configuring app features

**Commerce7 Config:** Set as "Settings URL"

**Flow:**
1. Checks if client exists (redirects to auth if not)
2. Shows setup checklist:
   - Wine Club Programs (optional)
   - Loyalty Point Rules (optional)
   - Communication Settings (optional)
3. User clicks "Complete Setup & Launch App"
4. Sets `setup_complete = true` in database
5. Redirects to `/app`

**Access:**
- First-time users: Automatically sent here from `/auth`
- Returning users: Accessible via link in `/app` dashboard
- C7 Admin: "Settings" button in app listing

**UI Components:**
- Organization info card
- Setup checklist with 3 sections
- "Complete Setup & Launch App" button
- Cancel button (returns to `/auth`)

---

### 4. `/app` → `c7.app.tsx`

**URL:** `https://c7.domain.com/app?tenantId=xxx`

**Purpose:** Main application dashboard for daily use

**Commerce7 Config:** Set as "Use URL"

**Flow:**
1. Checks if client exists (redirects to auth if not)
2. **If `setup_complete = false`:** Redirects to `/settings`
3. **If `setup_complete = true`:** Shows dashboard
4. Displays stats, quick actions, and configuration links

**Access:**
- After completing setup: Automatic redirect from `/settings`
- Returning users: Clicked from C7 admin "Use App" button
- Direct URL visits with tenantId

**UI Components:**
- Welcome banner
- Quick stats (club members, loyalty points, customers)
- Quick actions (sync, view members, manage rewards)
- Settings link (to reconfigure)
- Organization details

---

## Database Schema

### `clients` Table

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  tenant_shop VARCHAR(255) UNIQUE NOT NULL,  -- C7 tenantId
  crm_type VARCHAR(50) NOT NULL,             -- 'commerce7'
  org_name VARCHAR(255),
  org_contact VARCHAR(255),                  -- Full name
  user_id VARCHAR(255),                      -- C7 user ID
  user_email VARCHAR(255),                   -- C7 user email
  setup_complete BOOLEAN DEFAULT false,      -- ← NEW
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Migration:** `003_add_setup_complete.sql`

---

## Commerce7 Partner Configuration

### App Settings

| Field | Value | Notes |
|-------|-------|-------|
| **Install Webhook URL** | `https://c7.domain.com/install` | Receives POST with Basic Auth |
| **Settings URL** | `https://c7.domain.com/settings?tenantId={tenantId}` | First-time setup wizard |
| **Use URL** | `https://c7.domain.com/app?tenantId={tenantId}` | Main dashboard |
| **Basic Auth Username** | Set in `COMMERCE7_USER` | For install webhook |
| **Basic Auth Password** | Set in `COMMERCE7_PASSWORD` | For install webhook |

### URL Parameters

Commerce7 automatically appends these query params:

- `tenantId`: The winery's unique identifier
- `account`: User account info
- `adminUITheme`: UI theme preference (light/dark)

**Important:** All URLs must use the subdomain determined by the C7 platform: `c7.yourdomain.com`

---

## Testing Flow

### Local Development

1. **Start Supabase:**
   ```bash
   supabase start
   ```

2. **Start Dev Server:**
   ```bash
   npm run dev
   ```

3. **Start Ngrok:**
   ```bash
   ./scripts/start-ngrok.sh c7
   # URL: c7-kindly-balanced-macaw.ngrok-free.app
   ```

4. **Configure C7 Partner Settings:**
   - Install: `https://c7-kindly-balanced-macaw.ngrok-free.app/install`
   - Settings: `https://c7-kindly-balanced-macaw.ngrok-free.app/settings?tenantId={tenantId}`
   - Use: `https://c7-kindly-balanced-macaw.ngrok-free.app/app?tenantId={tenantId}`

### Test Install Webhook

```bash
curl -X POST https://c7-kindly-balanced-macaw.ngrok-free.app/install \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)" \
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

Expected: `{ success: true, clientId: "uuid" }`

### Test Full Flow

1. **Visit Auth:**
   ```
   https://c7-kindly-balanced-macaw.ngrok-free.app/auth?tenantId=test-winery
   ```
   - Should show welcome screen
   - Click "Continue to Setup"

2. **Visit Settings:**
   ```
   https://c7-kindly-balanced-macaw.ngrok-free.app/settings?tenantId=test-winery
   ```
   - Shows setup checklist
   - Click "Complete Setup & Launch App"

3. **Visit App:**
   ```
   https://c7-kindly-balanced-macaw.ngrok-free.app/app?tenantId=test-winery
   ```
   - Shows dashboard
   - Stats all at 0
   - Can click "Go to Settings" to reconfigure

4. **Test Redirect:**
   ```
   https://c7-kindly-balanced-macaw.ngrok-free.app/app?tenantId=new-tenant
   ```
   - Should redirect to `/settings` (setup incomplete)

---

## Environment Variables

Required in `.env.local` and production:

```bash
# Supabase
SUPABASE_URL=http://127.0.0.1:54421
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Commerce7
COMMERCE7_KEY=your_api_key
COMMERCE7_USER=install_webhook_username
COMMERCE7_PASSWORD=install_webhook_password
COMMERCE7_WEBHOOK_SECRET=webhook_signature_secret

# Domain
BASE_DOMAIN=liberovino.wine
NGROK_URL=kindly-balanced-macaw.ngrok-free.app  # dev only
```

---

## Production Deployment

### 1. Run Migrations

```bash
# Connect to production Supabase
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 2. Set Heroku Config

```bash
heroku config:set COMMERCE7_USER=your_username -a yno-libero-vino
heroku config:set COMMERCE7_PASSWORD=your_password -a yno-libero-vino
heroku config:set BASE_DOMAIN=liberovino.wine -a yno-libero-vino
```

### 3. Update C7 Partner Settings

- Install: `https://c7.liberovino.wine/install`
- Settings: `https://c7.liberovino.wine/settings?tenantId={tenantId}`
- Use: `https://c7.liberovino.wine/app?tenantId={tenantId}`

---

## User Experience Summary

### First-Time User

1. **Install:** Clicks "Install" in C7 → webhook creates account
2. **Welcome:** Sees welcome screen with org info
3. **Setup:** Completes optional configuration
4. **Launch:** Clicks "Complete Setup" → sees dashboard
5. **Future:** Clicks "Use App" in C7 → goes directly to dashboard

### Returning User

1. **Use App:** Clicks "Use App" in C7
2. **Dashboard:** Sees stats and quick actions immediately
3. **Settings:** Can reconfigure via "Go to Settings" link

### Admin User

1. **Settings:** Clicks "Settings" in C7 app listing
2. **Configure:** Updates club programs, loyalty rules, etc.
3. **Save:** Changes persist for all users

---

## Next Steps

1. **Implement Club Programs UI** in `/settings`
2. **Implement Loyalty Rules UI** in `/settings`
3. **Implement Communication Templates UI** in `/settings`
4. **Add Real Stats** to `/app` dashboard
5. **Add Customer Sync** functionality
6. **Add Webhooks** for real-time data updates

---

## File Reference

| Route | File | URL Pattern |
|-------|------|-------------|
| Install | `app/routes/c7.install.tsx` | `c7.domain.com/install` |
| Auth | `app/routes/c7.auth.tsx` | `c7.domain.com/auth` |
| Settings | `app/routes/c7.settings.tsx` | `c7.domain.com/settings` |
| App | `app/routes/c7.app.tsx` | `c7.domain.com/app` |

| Migration | File | Purpose |
|-----------|------|---------|
| 001 | `001_initial_schema.sql` | Base schema |
| 002 | `002_add_user_to_clients.sql` | Add user_id, user_email |
| 003 | `003_add_setup_complete.sql` | Add setup_complete flag |

| Type | File | Contents |
|------|------|----------|
| Commerce7 | `app/types/commerce7.ts` | Install payload, auth params |

