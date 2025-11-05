/**
 * Import seed data to database
 * 
 * This script reads the SQL seed file and executes it against
 * your Supabase database using the REST API.
 */

import { config } from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';

// Load environment variables from .env.local (preferred) or .env
config({ path: '.env.local' });
config(); // Fallback to .env if .env.local doesn't exist

// Support local Supabase (from supabase start)
const isLocalSupabase = process.env.USE_LOCAL_SUPABASE === 'true';
const dbUrl = isLocalSupabase
  ? 'postgresql://postgres:postgres@127.0.0.1:54422/postgres'
  : process.env.SUPABASE_DB_URL;

if (!dbUrl) {
  console.error('❌ Missing SUPABASE_DB_URL');
  console.error('\nFor local Supabase, set: USE_LOCAL_SUPABASE=true');
  console.error('For remote Supabase, add to .env.local:');
  console.error('  SUPABASE_DB_URL=postgresql://postgres:[password]@[host]:5432/postgres');
  process.exit(1);
}

// Show which database we're connecting to
if (isLocalSupabase) {
  console.log('🏠 Using LOCAL Supabase (postgres:postgres@127.0.0.1:54322)\n');
}

// Safety check: Warn if this looks like production
const isProduction = 
  process.env.NODE_ENV === 'production' ||
  dbUrl.includes('prod') ||
  process.env.SUPABASE_ENV === 'production';

if (isProduction) {
  console.warn('\n⚠️  WARNING: This appears to be a PRODUCTION database!');
  console.warn('   URL:', dbUrl.replace(/:[^:@]+@/, ':****@')); // Hide password
  console.warn('\n   Importing to production could overwrite real data!');
  console.warn('   This is EXTREMELY DANGEROUS!\n');
  
  // Require explicit confirmation
  if (process.env.IMPORT_PRODUCTION !== 'yes') {
    console.error('❌ Aborted. To import to production, set: IMPORT_PRODUCTION=yes');
    process.exit(1);
  }
  
  console.log('✅ IMPORT_PRODUCTION=yes confirmed, proceeding...\n');
}

async function importSeeds() {
  const seedFilePath = join(process.cwd(), 'supabase', 'seeds', '001_exported_data.sql');
  
  // Check if seed file exists
  if (!existsSync(seedFilePath)) {
    console.error('❌ Seed file not found:', seedFilePath);
    console.error('\nRun this first to create seeds:');
    console.error('   npm run db:export-seeds');
    process.exit(1);
  }

  console.log('📊 Importing seed data...\n');
  console.log('📁 File:', seedFilePath);
  console.log('🗄️  Database:', dbUrl.replace(/:[^:@]+@/, ':****@'), '\n');

  try {
    // Read the SQL file
    const sqlContent = readFileSync(seedFilePath, 'utf-8');
    
    // Connect to database using postgres client
    const sql = postgres(dbUrl, {
      max: 1,
      onnotice: () => {}, // Suppress notices
    });

    console.log('Executing SQL statements...');
    
    // Execute the SQL (the file is already wrapped in BEGIN/COMMIT)
    await sql.unsafe(sqlContent);
    
    await sql.end();

    console.log('\n✅ Seed data imported successfully!');
    console.log('\n📝 Your database has been restored from seeds.');

  } catch (error) {
    console.error('\n❌ Error importing seeds:', error);
    
    if (error instanceof Error) {
      console.error('\nError details:', error.message);
      
      // Provide helpful hints for common errors
      if (error.message.includes('connect')) {
        console.error('\n💡 Connection error. Check your SUPABASE_DB_URL is correct.');
      } else if (error.message.includes('duplicate key')) {
        console.error('\n💡 Duplicate key error. The seed file uses ON CONFLICT, but there may be an issue.');
        console.error('   Try resetting your database first (with caution!)');
      }
    }
    
    process.exit(1);
  }
}

importSeeds();

