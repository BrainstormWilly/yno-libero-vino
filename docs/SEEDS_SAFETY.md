# Database Seeds - Production Safety Guide

## ⚠️ IMPORTANT: Dev vs Production

The seed export/import scripts work with **whichever database your `.env` points to**. This could be your local dev database OR production!

## Recommended Setup

### For Development (Default)

Your `.env` should point to your LOCAL or DEV database:

```env
# .env (for local development)
SUPABASE_URL=https://your-dev-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...dev-key...
SUPABASE_DB_URL=postgresql://postgres:password@db.dev-project.supabase.co:5432/postgres
NODE_ENV=development
```

With this setup, running `npm run db:export-seeds` is **SAFE** ✅

### For Production (Use with Caution!)

If your `.env` points to production:

```env
# .env.production (NEVER commit this!)
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...prod-key...
SUPABASE_DB_URL=postgresql://postgres:password@db.prod-project.supabase.co:5432/postgres
NODE_ENV=production
```

The export script will **BLOCK** and require explicit confirmation:

```bash
npm run db:export-seeds

# Output:
⚠️  WARNING: This appears to be a PRODUCTION database!
   URL: https://your-prod-project.supabase.co
   
   Exporting production data is generally NOT recommended.
   Production exports may contain sensitive customer data.

❌ Aborted. To export production data, set: EXPORT_PRODUCTION=yes
```

To override (if you really need to):

```bash
EXPORT_PRODUCTION=yes npm run db:export-seeds
```

## Safety Features

### 1. Production Detection

The script detects production databases by checking:
- `NODE_ENV === 'production'`
- URL contains "prod"
- `SUPABASE_ENV === 'production'`

### 2. Explicit Confirmation Required

Production exports require setting `EXPORT_PRODUCTION=yes` explicitly.

### 3. Import Warning (Coming Soon)

We'll add similar warnings for imports to prevent accidentally wiping production data.

## Best Practices

### ✅ DO

- **Use seeds for local development**
- **Export your dev database** to share with team
- **Commit seed files to git** (if they don't contain real customer data)
- **Keep multiple `.env` files** (`.env.local`, `.env.staging`, `.env.production`)
- **Use `.env.local` by default** for day-to-day dev

### ❌ DON'T

- **Don't export production databases** (contains real customer data!)
- **Don't commit `.env.production`** to git
- **Don't import seeds to production** (could wipe real data!)
- **Don't share production database URLs** in seed files

## Multiple Environment Setup

### Recommended Structure

```
yno-libero-vino/
├── .env                 # Gitignored, points to current env (usually dev)
├── .env.local           # Dev database, safe to commit (no secrets)
├── .env.staging         # Staging database (gitignored)
├── .env.production      # Production database (gitignored, NEVER commit!)
└── .env.example         # Template with placeholder values (committed)
```

### Switching Environments

```bash
# For local development (default)
cp .env.local .env

# For testing against staging
cp .env.staging .env

# For production access (rare!)
cp .env.production .env
```

Or use environment-specific commands:

```bash
# Export from dev
npm run db:export-seeds

# Export from staging (with env vars inline)
SUPABASE_URL=$STAGING_URL SUPABASE_SERVICE_ROLE_KEY=$STAGING_KEY npm run db:export-seeds
```

## What If I Accidentally Export Production?

### If you haven't committed:

```bash
# Delete the exported file
rm supabase/seeds/001_exported_data.sql

# Make sure it's not staged
git reset supabase/seeds/001_exported_data.sql
```

### If you committed but haven't pushed:

```bash
# Remove from git history
git reset --soft HEAD~1
rm supabase/seeds/001_exported_data.sql
git commit -m "Remove accidental production export"
```

### If you pushed to GitHub:

1. Delete the file
2. Force push (be careful!)
3. Consider rotating production credentials
4. Review who had access to that commit

## Production Backups

**Don't use seeds for production backups!** Use proper backup solutions:

### Supabase Backups

```bash
# Use Supabase's built-in backup features
# Dashboard → Project Settings → Backups
```

### pg_dump (Proper Production Backups)

```bash
# Full production backup
pg_dump $PRODUCTION_DB_URL > backups/prod_backup_$(date +%Y%m%d).sql

# Restore from backup
psql $PRODUCTION_DB_URL < backups/prod_backup_20241104.sql
```

## Testing the Safety Check

Want to verify the production blocker works?

```bash
# Temporarily set production flag
export NODE_ENV=production
npm run db:export-seeds

# You should see:
# ⚠️  WARNING: This appears to be a PRODUCTION database!
# ❌ Aborted. To export production data, set: EXPORT_PRODUCTION=yes

# Clean up
unset NODE_ENV
```

## Summary

| Command | Dev Database | Production Database |
|---------|-------------|---------------------|
| `npm run db:export-seeds` | ✅ Safe, works | ⚠️ Blocked, requires `EXPORT_PRODUCTION=yes` |
| `npm run db:import-seeds` | ✅ Safe, works | ⚠️ Dangerous! (Coming: will require confirmation) |

**Default recommendation**: Only use seeds with your **local development database**.

For production: Use Supabase backups or `pg_dump` instead.

