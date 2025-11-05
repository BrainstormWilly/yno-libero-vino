# Database Seeds

This directory contains seed data exported from your database. Use these seeds to restore your database to a known state during development.

## Exporting Current Database State

To export the current state of your database as seed data:

```bash
npm run db:export-seeds
```

This will:
1. Connect to your Supabase database using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Export all data from key tables:
   - clients
   - club_programs
   - club_stages (tiers)
   - club_stage_promotions
   - tier_loyalty_config
   - customers
   - club_enrollments
3. Create `supabase/seeds/001_exported_data.sql` with the exported data

## Importing Seeds

To restore the database from seed data:

```bash
npm run db:import-seeds
```

No additional tools needed - uses Node.js to execute the SQL directly!

## Requirements

Make sure you have these environment variables set in your `.env.local` (or `.env`):

```env
# For exporting:
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# For importing:
SUPABASE_DB_URL=postgresql://postgres:[password]@[host]:5432/postgres
```

**Note**: The scripts will automatically load from `.env.local` first, then fall back to `.env`.

## When to Use Seeds

- **Before major changes**: Export seeds before making significant database changes
- **Team onboarding**: New developers can quickly set up a working database
- **Testing**: Reset to a known state between test runs
- **Staging/Production parity**: Keep dev environments in sync with production data structure

## Notes

- Seeds use `ON CONFLICT ... DO UPDATE` to allow re-running without errors
- Timestamps are preserved from the original data
- All foreign key relationships are maintained
- Seeds are wrapped in a transaction (BEGIN/COMMIT) for safety

## File Structure

```
supabase/seeds/
├── README.md                  # This file
└── 001_exported_data.sql      # Generated seed data (auto-created)
```

## Workflow

### Typical Development Workflow

1. **Set up fresh database**:
   ```bash
   npm run db:import-seeds
   ```

2. **Work on features** (database changes accumulate)

3. **Export updated state**:
   ```bash
   npm run db:export-seeds
   ```

4. **Commit to git** (so team members get the updated seeds)
   ```bash
   git add supabase/seeds/001_exported_data.sql
   git commit -m "Update seed data with new tiers"
   ```

### After Pulling Updates

If a teammate updates the seeds:

```bash
git pull
npm run db:import-seeds
```

## Troubleshooting

### "Connection refused" error

Make sure `SUPABASE_DB_URL` is correct and your database is running.

### "Permission denied" error

You need the `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) to export data.

### Duplicate key errors

The seed file uses `ON CONFLICT ... DO UPDATE`, but if you've changed primary keys, you may need to clear the database first.

### Import shows "command not found: tsx"

Run `npm install` to install dependencies.

