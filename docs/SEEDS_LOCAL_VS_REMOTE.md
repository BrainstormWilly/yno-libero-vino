# Seeds: Local vs Remote Supabase

## Quick Reference

### Local Supabase (Development)

When using `supabase start` locally:

```bash
# Export from local database
npm run db:export-seeds:local

# Import to local database
npm run db:import-seeds:local
```

**Connection Details (Auto-configured)**:
- URL: `http://127.0.0.1:54321`
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Port 54321: API
- Port 54322: PostgreSQL direct connection

### Remote Supabase (Hosted/Production)

When using hosted Supabase:

```bash
# Export from remote database
npm run db:export-seeds

# Import to remote database
npm run db:import-seeds
```

**Required in `.env.local`**:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-key...
SUPABASE_DB_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres
```

## How It Works

### Local Supabase
- No environment variables needed!
- Uses default local credentials: `postgres:postgres`
- Uses default local ports: 54321 (API), 54322 (DB)
- Just set `USE_LOCAL_SUPABASE=true` (done automatically with `:local` scripts)

### Remote Supabase
- Requires environment variables in `.env.local`
- Uses your hosted Supabase project
- Includes production safety checks

## Common Workflows

### Local Development Workflow

```bash
# 1. Start local Supabase
supabase start

# 2. Run migrations (if needed)
supabase db reset

# 3. Work on your app...
npm run dev

# 4. Export your data when you want to save it
npm run db:export-seeds:local

# 5. Commit the seed file
git add supabase/seeds/001_exported_data.sql
git commit -m "Update seed data"
```

### Team Member Setup

```bash
# 1. Clone repo
git clone <repo-url>

# 2. Install dependencies
npm install

# 3. Start local Supabase
supabase start

# 4. Import team's seed data
npm run db:import-seeds:local

# 5. Start developing!
npm run dev
```

### Export from Local, Import to Remote (Testing)

```bash
# Export from local
npm run db:export-seeds:local

# Review the SQL file
cat supabase/seeds/001_exported_data.sql

# Import to remote (be careful!)
npm run db:import-seeds
# Will warn if production detected
```

## Environment Variables Summary

### For Local (None needed!)
```bash
# Optional: Can set explicitly
USE_LOCAL_SUPABASE=true
```

The `:local` scripts set this automatically.

### For Remote (Required in `.env.local`)
```env
# Get these from Supabase Dashboard → Settings → API
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Get from Supabase Dashboard → Settings → Database
# Click "Connection String" → "URI"
SUPABASE_DB_URL=postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres
```

## Port Reference

| Service | Local | Remote |
|---------|-------|--------|
| Supabase API | 54321 | 443 (HTTPS) |
| PostgreSQL | 54322 | 5432 |
| Studio UI | 54323 | (dashboard.supabase.com) |
| Inbucket (Email) | 54324 | N/A |
| Kong (API Gateway) | 8000 | N/A |

## Tips

### Check What's Running
```bash
# See local Supabase status
supabase status

# Example output:
#         API URL: http://127.0.0.1:54321
#          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
#      Studio URL: http://127.0.0.1:54323
```

### Switch Between Local and Remote
```bash
# Use local
npm run db:export-seeds:local

# Use remote (from .env.local)
npm run db:export-seeds
```

### Verify Connection
```bash
# Test local connection
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT version();"

# Test remote connection (use your URL)
# Note: In shell, use quotes to ensure variable expansion: psql "$SUPABASE_DB_URL" -c "SELECT version();"
# Or use the npm script which handles this automatically: npm run db:import-seeds
psql "$SUPABASE_DB_URL" -c "SELECT version();"
```

## Troubleshooting

### "Connection refused" on local
```bash
# Make sure Supabase is running
supabase status

# If not running, start it
supabase start
```

### "Connection refused" on remote
- Check your `SUPABASE_DB_URL` is correct
- Verify your database is running (check Supabase dashboard)
- Ensure you're using the connection string (not just the DB password)

### Wrong database port
- Local: Use port **54322** (not 5432!)
- Remote: Use port **5432** (or 6543 for connection pooler)

## Default Recommendation

**For day-to-day development**: Use local Supabase with `:local` scripts

```bash
supabase start
npm run db:export-seeds:local
npm run db:import-seeds:local
```

This is:
- ✅ Faster (no network latency)
- ✅ Safer (can't accidentally touch production)
- ✅ Easier (no environment variables needed)
- ✅ Free (no API usage limits)

