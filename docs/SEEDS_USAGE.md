# Database Seeds - Quick Start Guide

## Overview

We've added database seed export/import functionality to make it easy to capture and restore your database state.

## Usage

### Export Current Database → Seeds

When you want to save your current database state (for backup, sharing with team, or version control):

```bash
npm run db:export-seeds
```

This creates: `supabase/seeds/001_exported_data.sql`

### Import Seeds → Database

When you want to restore the database from seeds:

```bash
npm run db:import-seeds
```

## What Gets Exported?

The export includes all data from these tables (in order):

1. **clients** - Your organization/client records
2. **club_programs** - Club program configurations
3. **club_stages** - Membership tiers (Bronze, Silver, Gold, etc.)
4. **club_stage_promotions** - Promotions linked to tiers
5. **tier_loyalty_config** - Loyalty point configurations per tier
6. **customers** - Customer records
7. **club_enrollments** - Active/past memberships

## Common Workflows

### 1. Before Making Big Changes

```bash
# Save current state
npm run db:export-seeds

# Make your changes...
# If something goes wrong:
npm run db:import-seeds  # Restore to saved state
```

### 2. Setting Up New Development Environment

```bash
# Clone repo
git clone <repo-url>
cd yno-libero-vino

# Install dependencies
npm install

# Set up .env with database credentials

# Run migrations
# (migrations are separate from seeds)

# Import seed data
npm run db:import-seeds

# Start developing!
npm run dev
```

### 3. Sharing Data with Team

```bash
# Developer A: Export current state
npm run db:export-seeds
git add supabase/seeds/001_exported_data.sql
git commit -m "Add seed data with new tiers"
git push

# Developer B: Import shared state
git pull
npm run db:import-seeds
```

### 4. Testing New Features

```bash
# Export clean baseline
npm run db:export-seeds

# Test feature (creates test data)
# ...

# Reset to clean state
npm run db:import-seeds
```

## Important Notes

### Seeds vs Migrations

- **Migrations** = Schema changes (adding tables, columns, constraints)
- **Seeds** = Data (actual records in those tables)

Run migrations first, then seeds.

### ON CONFLICT Handling

The generated SQL uses `ON CONFLICT ... DO UPDATE`, which means:
- ✅ Safe to re-run multiple times
- ✅ Updates existing records with matching IDs
- ✅ Inserts new records that don't exist

### When NOT to Use Seeds

Don't export seeds if:
- Your database has sensitive production data
- You have thousands of customers (exports can be large)
- You're working with production database (use backups instead)

For large datasets, consider:
- Exporting only specific clients
- Using database backups
- Creating minimal test fixtures

## Customizing the Export

To export only specific data, modify `scripts/export-seeds.ts`:

```typescript
// Example: Only export one client's data
const { data: clients } = await supabase
  .from('clients')
  .select('*')
  .eq('tenant_shop', 'yno-fanbase');  // Filter to specific client
```

## Environment Variables Required

```env
# For exporting:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# For importing:
SUPABASE_DB_URL=postgresql://postgres:password@host:5432/postgres
```

**Note**: Put these in `.env.local` for development. The scripts automatically load from `.env.local` first, then fall back to `.env`.

## Troubleshooting

### Export/Import fails with "Missing SUPABASE_URL" or "Missing SUPABASE_DB_URL"

Make sure your `.env.local` (or `.env`) file has the required variables:
- Export needs: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Import needs: `SUPABASE_DB_URL`

### Scripts not loading .env.local

The scripts automatically try `.env.local` first, then `.env`. Make sure at least one of these files exists with the required variables.

### Import shows "duplicate key value"

This shouldn't happen with our `ON CONFLICT` handling, but if it does:
```sql
-- Clear all data first (⚠️ destructive!)
TRUNCATE clients CASCADE;
```

Then re-import.

## File Locations

```
yno-libero-vino/
├── scripts/
│   └── export-seeds.ts          # Export script (you run via npm)
├── supabase/
│   └── seeds/
│       ├── README.md            # Detailed seed documentation
│       └── 001_exported_data.sql  # Generated seed file (git-tracked)
└── package.json                 # Contains db:export-seeds and db:import-seeds scripts
```

## Best Practices

1. **Export after setup**: Once your club is configured nicely, export seeds
2. **Version control**: Commit seed files so team has consistent data
3. **Keep minimal**: Only export what's needed for development
4. **Use comments**: Add comments in the SQL file to explain test scenarios
5. **Regular updates**: Re-export when data structure changes

## Next Steps

1. Run migrations: `supabase migration up` (if using Supabase CLI)
2. Export your current data: `npm run db:export-seeds`
3. Review the generated SQL: `supabase/seeds/001_exported_data.sql`
4. Commit to git if it looks good
5. Test import: `npm run db:import-seeds`

