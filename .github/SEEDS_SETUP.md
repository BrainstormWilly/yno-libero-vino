# ✅ Database Seeds Setup Complete

## What Was Created

### 1. Export Script
**File**: `scripts/export-seeds.ts`

Connects to your Supabase database and exports all data to SQL format.

### 2. NPM Scripts
**Added to `package.json`**:

```json
"db:export-seeds": "tsx scripts/export-seeds.ts",
"db:import-seeds": "psql $SUPABASE_DB_URL -f supabase/seeds/001_exported_data.sql"
```

### 3. Seeds Directory
**Location**: `supabase/seeds/`

- `README.md` - Detailed documentation
- `001_exported_data.sql` - Generated seed file (created when you run export)

### 4. Documentation
- `supabase/seeds/README.md` - Technical reference
- `docs/SEEDS_USAGE.md` - Quick start guide

### 5. Dependencies
Added `tsx` to `devDependencies` for running the TypeScript export script.

## Quick Start

### Export Your Current Database

```bash
npm run db:export-seeds
```

This will:
1. Connect to your database
2. Export all data from key tables
3. Create `supabase/seeds/001_exported_data.sql`

### Import Seeds to Database

```bash
npm run db:import-seeds
```

This restores your database from the seed file.

## First Time Setup

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Make sure your `.env` has**:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_DB_URL=postgresql://postgres:password@host:5432/postgres
   ```

3. **Export your current data**:
   ```bash
   npm run db:export-seeds
   ```

4. **Review the generated file**:
   ```bash
   cat supabase/seeds/001_exported_data.sql
   ```

5. **Commit to git** (optional but recommended):
   ```bash
   git add supabase/seeds/001_exported_data.sql
   git commit -m "Add database seeds"
   ```

## What Gets Exported

The script exports data from these tables (in order):

1. `clients` - Organization records
2. `club_programs` - Club configurations
3. `club_stages` - Tiers (Bronze, Silver, Gold, etc.)
4. `club_stage_promotions` - Tier promotions
5. `tier_loyalty_config` - Loyalty configurations
6. `customers` - Customer records
7. `club_enrollments` - Membership records

## Key Features

✅ **Safe to re-run**: Uses `ON CONFLICT ... DO UPDATE`  
✅ **Preserves relationships**: Foreign keys maintained  
✅ **Transaction-wrapped**: All-or-nothing import  
✅ **Timestamps preserved**: Keeps original created/updated dates  
✅ **No duplicates**: Updates existing records with same ID  

## Workflow Examples

### Save Before Breaking Changes
```bash
npm run db:export-seeds  # Backup current state
# Make changes...
npm run db:import-seeds  # Restore if needed
```

### Share Data with Team
```bash
npm run db:export-seeds
git add supabase/seeds/001_exported_data.sql
git commit -m "Update seeds with new tiers"
git push
```

### Set Up New Dev Environment
```bash
git clone <repo>
npm install
npm run db:import-seeds
npm run dev
```

## Support

- **Technical details**: See `supabase/seeds/README.md`
- **Usage guide**: See `docs/SEEDS_USAGE.md`
- **Modify export**: Edit `scripts/export-seeds.ts`

## Next Steps

1. Run `npm install` to get tsx dependency
2. Run `npm run db:export-seeds` to create your first seed file
3. Review the generated SQL
4. Test import with `npm run db:import-seeds`
5. Commit the seed file to git (optional)

---

**Need help?** Check the documentation files or modify `scripts/export-seeds.ts` to customize the export.

