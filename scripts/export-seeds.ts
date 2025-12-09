/**
 * Export current database data to seed files
 * 
 * This script reads the current state of the database and generates
 * SQL seed files that can be used to restore this state.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from .env.local (preferred) or .env
config({ path: '.env.local' });
config(); // Fallback to .env if .env.local doesn't exist

// Support local Supabase (from supabase start)
const isLocalSupabase = process.env.USE_LOCAL_SUPABASE === 'true';
const supabaseUrl = isLocalSupabase 
  ? 'http://127.0.0.1:54321'
  : process.env.SUPABASE_URL!;
const supabaseServiceKey = isLocalSupabase
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  : process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nFor local Supabase, set: USE_LOCAL_SUPABASE=true');
  console.error('For remote Supabase, add to .env.local:');
  console.error('  SUPABASE_URL=your_url');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your_key');
  process.exit(1);
}

// Show which database we're connecting to
if (isLocalSupabase) {
  console.log('🏠 Using LOCAL Supabase (127.0.0.1:54321)\n');
}

// Safety check: Warn if this looks like production
const isProduction = 
  process.env.NODE_ENV === 'production' ||
  supabaseUrl.includes('prod') ||
  process.env.SUPABASE_ENV === 'production';

if (isProduction) {
  console.warn('\n⚠️  WARNING: This appears to be a PRODUCTION database!');
  console.warn('   URL:', supabaseUrl);
  console.warn('\n   Exporting production data is generally NOT recommended.');
  console.warn('   Production exports may contain sensitive customer data.\n');
  
  // Require explicit confirmation
  if (process.env.EXPORT_PRODUCTION !== 'yes') {
    console.error('❌ Aborted. To export production data, set: EXPORT_PRODUCTION=yes');
    process.exit(1);
  }
  
  console.log('✅ EXPORT_PRODUCTION=yes confirmed, proceeding...\n');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function exportSeeds() {
  console.log('📊 Exporting database data...\n');

  const seeds: string[] = [
    '-- ============================================================',
    '-- LiberoVino Seed Data',
    '-- Generated: ' + new Date().toISOString(),
    '-- ============================================================',
    '',
    'BEGIN;',
    '',
  ];

  try {
    // 1. Export Clients
    console.log('Exporting clients...');
    const { data: clients } = await supabase.from('clients').select('*');
    if (clients && clients.length > 0) {
      seeds.push('-- Clients');
      for (const client of clients) {
        seeds.push(
          `INSERT INTO clients (id, tenant_shop, crm_type, org_name, org_contact, user_email, setup_complete, created_at, updated_at)`,
          `VALUES (${sqlValue(client.id)}, ${sqlValue(client.tenant_shop)}, ${sqlValue(client.crm_type)}, ${sqlValue(client.org_name)}, ${sqlValue(client.org_contact)}, ${sqlValue(client.user_email)}, ${client.setup_complete}, ${sqlValue(client.created_at)}, ${sqlValue(client.updated_at)})`,
          `ON CONFLICT (id) DO UPDATE SET`,
          `  tenant_shop = EXCLUDED.tenant_shop,`,
          `  crm_type = EXCLUDED.crm_type,`,
          `  org_name = EXCLUDED.org_name,`,
          `  org_contact = EXCLUDED.org_contact,`,
          `  user_email = EXCLUDED.user_email,`,
          `  setup_complete = EXCLUDED.setup_complete;`,
          ''
        );
      }
      console.log(`  ✓ ${clients.length} client(s)`);
    }

    // 2. Export Club Programs
    console.log('Exporting club programs...');
    const { data: programs } = await supabase.from('club_programs').select('*');
    if (programs && programs.length > 0) {
      seeds.push('-- Club Programs');
      for (const program of programs) {
        seeds.push(
          `INSERT INTO club_programs (id, client_id, name, description, is_active, created_at, updated_at)`,
          `VALUES (${sqlValue(program.id)}, ${sqlValue(program.client_id)}, ${sqlValue(program.name)}, ${sqlValue(program.description)}, ${program.is_active}, ${sqlValue(program.created_at)}, ${sqlValue(program.updated_at)})`,
          `ON CONFLICT (id) DO UPDATE SET`,
          `  name = EXCLUDED.name,`,
          `  description = EXCLUDED.description,`,
          `  is_active = EXCLUDED.is_active;`,
          ''
        );
      }
      console.log(`  ✓ ${programs.length} club program(s)`);
    }

    // 3. Export Club Stages (Tiers)
    console.log('Exporting club stages...');
    const { data: stages } = await supabase.from('club_stages').select('*').order('stage_order');
    if (stages && stages.length > 0) {
      seeds.push('-- Club Stages (Tiers)');
      for (const stage of stages) {
        seeds.push(
          `INSERT INTO club_stages (id, club_program_id, name, duration_months, min_purchase_amount, min_ltv_amount, stage_order, is_active, c7_club_id, created_at, updated_at)`,
          `VALUES (${sqlValue(stage.id)}, ${sqlValue(stage.club_program_id)}, ${sqlValue(stage.name)}, ${stage.duration_months}, ${stage.min_purchase_amount}, ${stage.min_ltv_amount || 0}, ${stage.stage_order}, ${stage.is_active}, ${sqlValue(stage.c7_club_id)}, ${sqlValue(stage.created_at)}, ${sqlValue(stage.updated_at)})`,
          `ON CONFLICT (id) DO UPDATE SET`,
          `  name = EXCLUDED.name,`,
          `  duration_months = EXCLUDED.duration_months,`,
          `  min_purchase_amount = EXCLUDED.min_purchase_amount,`,
          `  min_ltv_amount = EXCLUDED.min_ltv_amount,`,
          `  stage_order = EXCLUDED.stage_order,`,
          `  is_active = EXCLUDED.is_active,`,
          `  c7_club_id = EXCLUDED.c7_club_id;`,
          ''
        );
      }
      console.log(`  ✓ ${stages.length} tier(s)`);
    }

    // 4. Export Club Stage Promotions
    console.log('Exporting club stage promotions...');
    const { data: promotions } = await supabase.from('club_stage_promotions').select('*');
    if (promotions && promotions.length > 0) {
      seeds.push('-- Club Stage Promotions');
      for (const promo of promotions) {
        seeds.push(
          `INSERT INTO club_stage_promotions (id, club_stage_id, crm_id, crm_type, title, description, created_at, updated_at)`,
          `VALUES (${sqlValue(promo.id)}, ${sqlValue(promo.club_stage_id)}, ${sqlValue(promo.crm_id)}, ${sqlValue(promo.crm_type)}, ${sqlValue(promo.title)}, ${sqlValue(promo.description)}, ${sqlValue(promo.created_at)}, ${sqlValue(promo.updated_at)})`,
          `ON CONFLICT (id) DO UPDATE SET`,
          `  title = EXCLUDED.title,`,
          `  description = EXCLUDED.description;`,
          ''
        );
      }
      console.log(`  ✓ ${promotions.length} promotion(s)`);
    }

    // 5. Export Tier Loyalty Config
    console.log('Exporting tier loyalty configs...');
    const { data: loyalty } = await supabase.from('tier_loyalty_config').select('*');
    if (loyalty && loyalty.length > 0) {
      seeds.push('-- Tier Loyalty Config');
      for (const config of loyalty) {
        seeds.push(
          `INSERT INTO tier_loyalty_config (id, club_stage_id, c7_loyalty_tier_id, tier_title, earn_rate, initial_points_bonus, is_active, created_at, updated_at)`,
          `VALUES (${sqlValue(config.id)}, ${sqlValue(config.club_stage_id)}, ${sqlValue(config.c7_loyalty_tier_id)}, ${sqlValue(config.tier_title)}, ${config.earn_rate}, ${config.initial_points_bonus || 0}, ${config.is_active}, ${sqlValue(config.created_at)}, ${sqlValue(config.updated_at)})`,
          `ON CONFLICT (id) DO UPDATE SET`,
          `  tier_title = EXCLUDED.tier_title,`,
          `  earn_rate = EXCLUDED.earn_rate,`,
          `  initial_points_bonus = EXCLUDED.initial_points_bonus,`,
          `  is_active = EXCLUDED.is_active;`,
          ''
        );
      }
      console.log(`  ✓ ${loyalty.length} loyalty config(s)`);
    }

    // 6. Export Customers
    console.log('Exporting customers...');
    const { data: customers } = await supabase.from('customers').select('*');
    if (customers && customers.length > 0) {
      seeds.push('-- Customers');
      for (const customer of customers) {
        seeds.push(
          `INSERT INTO customers (id, client_id, email, first_name, last_name, phone, crm_id, is_club_member, current_club_stage_id, created_at, updated_at)`,
          `VALUES (${sqlValue(customer.id)}, ${sqlValue(customer.client_id)}, ${sqlValue(customer.email)}, ${sqlValue(customer.first_name)}, ${sqlValue(customer.last_name)}, ${sqlValue(customer.phone)}, ${sqlValue(customer.crm_id)}, ${customer.is_club_member}, ${sqlValue(customer.current_club_stage_id)}, ${sqlValue(customer.created_at)}, ${sqlValue(customer.updated_at)})`,
          `ON CONFLICT (id) DO UPDATE SET`,
          `  email = EXCLUDED.email,`,
          `  first_name = EXCLUDED.first_name,`,
          `  last_name = EXCLUDED.last_name,`,
          `  phone = EXCLUDED.phone,`,
          `  is_club_member = EXCLUDED.is_club_member,`,
          `  current_club_stage_id = EXCLUDED.current_club_stage_id;`,
          ''
        );
      }
      console.log(`  ✓ ${customers.length} customer(s)`);
    }

    // 7. Export Club Enrollments
    console.log('Exporting club enrollments...');
    const { data: enrollments } = await supabase.from('club_enrollments').select('*');
    if (enrollments && enrollments.length > 0) {
      seeds.push('-- Club Enrollments');
      for (const enrollment of enrollments) {
        seeds.push(
          `INSERT INTO club_enrollments (id, customer_id, club_stage_id, enrolled_at, expires_at, status, c7_membership_id, qualifying_order_id, created_at, updated_at)`,
          `VALUES (${sqlValue(enrollment.id)}, ${sqlValue(enrollment.customer_id)}, ${sqlValue(enrollment.club_stage_id)}, ${sqlValue(enrollment.enrolled_at)}, ${sqlValue(enrollment.expires_at)}, ${sqlValue(enrollment.status)}, ${sqlValue(enrollment.c7_membership_id)}, ${sqlValue(enrollment.qualifying_order_id)}, ${sqlValue(enrollment.created_at)}, ${sqlValue(enrollment.updated_at)})`,
          `ON CONFLICT (id) DO UPDATE SET`,
          `  status = EXCLUDED.status,`,
          `  expires_at = EXCLUDED.expires_at;`,
          ''
        );
      }
      console.log(`  ✓ ${enrollments.length} enrollment(s)`);
    }

    seeds.push('COMMIT;');
    seeds.push('');
    seeds.push('-- ============================================================');
    seeds.push('-- Seed data exported successfully');
    seeds.push('-- ============================================================');

    // Write to file
    const seedFilePath = join(process.cwd(), 'supabase', 'seeds', '001_exported_data.sql');
    const seedDir = join(process.cwd(), 'supabase', 'seeds');
    
    // Create seeds directory if it doesn't exist
    try {
      const fs = await import('fs');
      if (!fs.existsSync(seedDir)) {
        fs.mkdirSync(seedDir, { recursive: true });
      }
    } catch (e) {
      // Directory might already exist
    }

    writeFileSync(seedFilePath, seeds.join('\n'));

    console.log('\n✅ Seed data exported successfully!');
    console.log(`📁 File: ${seedFilePath}`);
    console.log('\n📝 To restore this data, run:');
    console.log('   npm run db:import-seeds');
    console.log('\n   Or manually with psql (shell expansion required):');
    console.log('   psql "$SUPABASE_DB_URL" -f supabase/seeds/001_exported_data.sql');

  } catch (error) {
    console.error('❌ Error exporting seeds:', error);
    process.exit(1);
  }
}

// Helper function to format SQL values
function sqlValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}

exportSeeds();

