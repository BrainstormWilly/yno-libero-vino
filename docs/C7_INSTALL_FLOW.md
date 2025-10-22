# Commerce7 Install Flow

This document describes the complete installation and authorization flow for Commerce7 integration.

## Flow Overview

```
┌─────────────┐
│   User      │
│  installs   │
│  C7 App     │
└──────┬──────┘
       │
       │ POST /install/c7
       │ (Basic Auth)
       v
┌─────────────────┐
│  Install Route  │
│  Validates Auth │
│  Creates Client │
│  Returns 200 OK │
└─────────┬───────┘
          │
          │ C7 redirects to
          │ c7.ngrok_url?tenantId=xxx&account=xxx
          v
┌─────────────────┐
│  c7/auth Route  │
│  Looks up       │
│  Client by      │
│  tenantId       │
└─────────┬───────┘
          │
          v
    ┌─────────┐
    │ Welcome │
    │ Screen  │
    └─────────┘
```

## Implementation Details

### 1. Install Webhook (`/install/c7`)

**File:** `app/routes/install.c7.tsx`

**Purpose:** Receives install request from Commerce7 and creates a client record in the database.

**Authentication:** 
- Basic Auth with username/password
- Set in Commerce7 app settings
- Validates using `COMMERCE7_USER` and `COMMERCE7_PASSWORD` env vars

**Request Payload:**
```typescript
{
  tenantId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  "organization-name"?: string;
  "organization-address"?: string;
  "organization-website"?: string;
  "organization-phone"?: string;
}
```

**Database Operation:**
- Checks if client exists by `tenant_shop` (tenantId)
- If not, creates new client with:
  - `tenant_shop`: tenantId
  - `crm_type`: 'commerce7'
  - `org_name`: organization-name or tenantId
  - `org_contact`: firstName + lastName
  - `user_id`: user.id
  - `user_email`: user.email

**Response:**
- 200 OK: Success (returns `{ success: true, clientId: uuid }`)
- 401 Unauthorized: Invalid credentials
- 400 Bad Request: Missing required fields
- 500 Internal Server Error: Database error

### 2. Authorization Route (`/c7/auth`)

**File:** `app/routes/c7.auth.tsx`

**Purpose:** Handles Commerce7 redirect after install and shows welcome screen.

**Query Parameters:**
- `tenantId`: The Commerce7 tenant identifier (required for auth)
- `account`: User account info from Commerce7
- `adminUITheme`: Theme setting from Commerce7 admin UI

**Flow:**
1. Extract `tenantId` from query params
2. Look up client in database by `tenant_shop` = tenantId
3. If found → Show welcome screen
4. If not found → Show error screen
5. If no tenantId → Show default install instructions

**Welcome Screen Displays:**
- Organization name
- Contact name
- User email
- Tenant ID
- Next steps for setup
- Link to dashboard

### 3. Database Schema

**Migration:** `002_add_user_to_clients.sql`

**Changes:**
```sql
ALTER TABLE clients 
  ADD COLUMN user_id VARCHAR(255),
  ADD COLUMN user_email VARCHAR(255);

CREATE INDEX idx_clients_user_id ON clients(user_id);
```

**Purpose:**
- Store Commerce7 user ID for future RLS support
- Store user email for communication
- Index on user_id for performance

### 4. Type Definitions

**File:** `app/types/commerce7.ts`

**Types:**
- `Commerce7InstallPayload`: Install webhook payload
- `Commerce7AuthParams`: Query params from C7 redirect

## Environment Variables

Required in `.env.local` and production:

```bash
# Commerce7 API Key (for API calls)
COMMERCE7_KEY=your_api_key

# Install Webhook Authentication
# Set these in Commerce7 app settings
COMMERCE7_USER=your_username
COMMERCE7_PASSWORD=your_password

# Webhook Secret (for webhook validation)
COMMERCE7_WEBHOOK_SECRET=your_webhook_secret
```

## Testing Locally

### 1. Set up Ngrok
```bash
ngrok http 3000 --domain=c7-kindly-balanced-macaw.ngrok-free.app
```

### 2. Configure Commerce7 App
In Commerce7 app settings:
- **Install Webhook URL:** `https://c7-kindly-balanced-macaw.ngrok-free.app/install/c7`
- **Redirect URL:** `https://c7-kindly-balanced-macaw.ngrok-free.app/c7/auth`
- **Basic Auth:**
  - Username: (set in COMMERCE7_USER)
  - Password: (set in COMMERCE7_PASSWORD)

### 3. Test Install Flow

```bash
# Start local dev server
npm run dev

# In another terminal, start ngrok
./scripts/start-ngrok.sh c7

# Test install webhook
curl -X POST https://c7-kindly-balanced-macaw.ngrok-free.app/install/c7 \
  -H "Authorization: Basic $(echo -n 'username:password' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "test-tenant",
    "user": {
      "id": "user-123",
      "email": "test@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "organization-name": "Test Winery"
  }'

# Expected: 200 OK with { success: true, clientId: "uuid" }

# Test auth redirect
open "https://c7-kindly-balanced-macaw.ngrok-free.app/c7/auth?tenantId=test-tenant&account=user-123"

# Expected: Welcome screen with client info
```

## Production Deployment

### 1. Set Heroku Config Vars
```bash
heroku config:set COMMERCE7_USER=your_username -a yno-libero-vino
heroku config:set COMMERCE7_PASSWORD=your_password -a yno-libero-vino
heroku config:set COMMERCE7_KEY=your_api_key -a yno-libero-vino
```

### 2. Run Migration on Production
```bash
# Connect to production Supabase
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

### 3. Update Commerce7 App Settings
- **Install Webhook URL:** `https://c7.liberovino.wine/install/c7`
- **Redirect URL:** `https://c7.liberovino.wine/c7/auth`

## Next Steps

After successful installation:

1. **Sync Customer Data:** Implement customer sync from C7 API
2. **Set Up Webhooks:** Register webhooks for orders, customers, etc.
3. **Configure Club Programs:** Create wine club tiers and rules
4. **Set Up Loyalty Rules:** Configure point earning and redemption
5. **Customize Communications:** Set up email/SMS templates

## Troubleshooting

### Install Webhook Returns 401
- Check COMMERCE7_USER and COMMERCE7_PASSWORD in env vars
- Verify Basic Auth header format: `Basic base64(username:password)`
- Check Commerce7 app settings for correct credentials

### Auth Route Shows "Authorization Failed"
- Verify client was created in database (check `clients` table)
- Confirm `tenant_shop` matches the `tenantId` from query param
- Check Supabase connection and credentials

### Welcome Screen Not Showing
- Check browser console for errors
- Verify `tenantId` is in URL query params
- Confirm client exists in database with correct `tenant_shop` value

## Security Notes

1. **Basic Auth:** Commerce7 install webhook uses Basic Auth. Keep credentials secure.
2. **User Data:** User ID and email stored for future RLS support.
3. **Tenant Isolation:** All client data isolated by `client_id` foreign key.
4. **Service Role:** Install route uses service role key for database access (no RLS).

## Related Files

- `app/routes/install.c7.tsx` - Install webhook handler
- `app/routes/c7.auth.tsx` - Authorization and welcome screen
- `app/types/commerce7.ts` - Type definitions
- `supabase/migrations/002_add_user_to_clients.sql` - Database migration
- `docs/C7_INSTALL_FLOW.md` - This document

