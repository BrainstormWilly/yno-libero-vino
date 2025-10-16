# Local Supabase Setup Guide

## Quick Start (You've Done This Before!)

### 1. Start Supabase Docker Containers

```bash
# In your yno-libero-vino directory
supabase start
```

This will:
- Pull Docker images if needed
- Start PostgreSQL, PostgREST, GoTrue, etc.
- Create local database
- Show you the local URLs and keys

**Expected output:**
```
Started supabase local development setup.

         API URL: http://localhost:54421
     GraphQL URL: http://localhost:54421/graphql/v1
          DB URL: postgresql://postgres:postgres@localhost:54422/postgres
      Studio URL: http://localhost:54423
    Inbucket URL: http://localhost:54424
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJ...
service_role key: eyJ...
```

### 2. Apply Your Migration

```bash
# Apply the 001_initial_schema.sql
supabase db reset

# Or just push migrations
supabase db push
```

This creates all 19 tables!

### 3. Access Supabase Studio

Open in your browser:
```
http://localhost:54423
```

You'll see:
- Table Editor
- SQL Editor  
- Database (19 tables!)
- Authentication
- Storage

### 4. Set Up Environment Variables

Create `.env.local`:

```bash
# Local Supabase (from supabase start output)
SUPABASE_URL=http://localhost:54421
SUPABASE_ANON_KEY=eyJhbGc...  # Copy from supabase start output
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  # Copy from supabase start output

# Development mode
NODE_ENV=development
PORT=3000

# Ngrok (for webhooks)
NGROK_URL=kindly-balanced-macaw.ngrok-free.app

# You can leave these empty for local dev
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
COMMERCE7_KEY=
```

### 5. Update Supabase Client

The app should read from `.env.local`:

```typescript
// Already configured in your app
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
```

## Port Configuration

Your local Supabase uses **different ports** than yno-neighborly so they don't conflict:

| Service | yno-neighborly | yno-libero-vino |
|---------|----------------|-----------------|
| API | 54321 | 54421 |
| DB | 54322 | 54422 |
| Studio | 54323 | 54423 |
| Inbucket | 54324 | 54424 |

Both can run simultaneously!

## Common Commands

### Start Supabase
```bash
supabase start
```

### Stop Supabase
```bash
supabase stop
```

### Reset Database (applies migrations fresh)
```bash
supabase db reset
```

### Check Status
```bash
supabase status
```

### View Logs
```bash
supabase logs
```

### Run Migrations
```bash
# Apply pending migrations
supabase db push

# Create new migration
supabase db diff -f new_migration_name
```

### Generate TypeScript Types
```bash
# Generate types from your schema
supabase gen types typescript --local > app/types/database.ts
```

## Accessing Local Database

### Via Studio UI
```
http://localhost:54423
```

### Via psql
```bash
psql postgresql://postgres:postgres@localhost:54422/postgres
```

### Via Any PostgreSQL Client
```
Host: localhost
Port: 54422
Database: postgres
User: postgres
Password: postgres
```

## Troubleshooting

### "Port already in use"
```bash
# Check what's running
supabase status

# Stop and restart
supabase stop
supabase start
```

### "Docker not running"
```bash
# Start Docker Desktop first
open -a Docker

# Then start Supabase
supabase start
```

### "Migration failed"
```bash
# Check the migration file
cat supabase/migrations/001_initial_schema.sql

# Check for syntax errors
supabase db lint

# View error details
supabase db reset --debug
```

### "Need to update CLI"
```bash
# Update Supabase CLI
brew upgrade supabase

# Or using npm
npm update -g supabase
```

## Development Workflow

### Typical Day:

```bash
# 1. Start Supabase (if not running)
supabase start

# 2. Start your app
npm run dev

# 3. Open Studio to view data
open http://localhost:54423

# 4. Make changes to schema in migrations

# 5. Apply changes
supabase db reset

# 6. Test your changes

# 7. When done for the day
supabase stop  # Optional - can leave running
```

## Seed Data (Optional)

### Create a seed file

```bash
# Create supabase/seed.sql
```

Example seed:

```sql
-- Insert test client
INSERT INTO clients (tenant_shop, crm_type, org_name, org_contact)
VALUES ('test-winery', 'commerce7', 'Test Winery', 'test@winery.com');

-- Insert test customer
INSERT INTO customers (client_id, email, first_name, last_name, is_club_member)
SELECT id, 'member@test.com', 'John', 'Doe', true
FROM clients WHERE tenant_shop = 'test-winery';
```

Then:
```bash
supabase db reset  # Runs migrations + seed
```

## Studio Features to Explore

### Table Editor
- Browse all 19 tables
- Add/edit rows manually
- View relationships

### SQL Editor
- Run custom queries
- Test complex joins
- Save favorite queries

### Database
- View schema
- See relationships diagram
- Monitor performance

### Logs
- Real-time query logs
- API request logs
- Error tracking

## Local vs. Production

### Local (Development)
```
URL: http://localhost:54421
DB: localhost:54422
Studio: localhost:54423
Data: Deleted when you run db reset
```

### Production (Future)
```
URL: https://your-project.supabase.co
DB: Connection string from dashboard
Studio: cloud.supabase.com
Data: Persistent
```

## Quick Reference

```bash
# One-time setup
supabase init                    # ✅ Already done!

# Daily use
supabase start                   # Start local DB
supabase db reset               # Apply migrations fresh
supabase db push                # Apply new migrations only
supabase status                 # Check what's running
supabase stop                   # Stop when done

# Development
supabase db diff -f my_changes  # Create migration from changes
supabase gen types typescript   # Generate TS types
supabase db lint                # Check migration syntax

# Troubleshooting
supabase doctor                 # Check health
supabase logs                   # View logs
```

## Ready to Go!

```bash
# Start everything
supabase start
```

Your local Supabase will be ready at:
- **API:** http://localhost:54421
- **Studio:** http://localhost:54423
- **DB:** postgresql://postgres:postgres@localhost:54422/postgres

All 19 tables will be created and ready to use!

