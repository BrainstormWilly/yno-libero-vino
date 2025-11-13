import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const db = await import('~/lib/db/supabase.server');
const { seedKlaviyoResources } = await import('~/lib/communication/klaviyo-seeding.server');
import type { KlaviyoProviderData } from '~/types/communication-klaviyo';

const [, , clientId, ...flags] = process.argv;

if (!clientId) {
  console.error('❌ Missing client ID.');
  console.error('Usage:');
  console.error('  npx tsx scripts/seed-klaviyo.ts <client-id> [--marketing]');
  process.exit(1);
}

const includeMarketing = flags.includes('--marketing');

try {
  const config = await db.getCommunicationConfig(clientId);

  if (!config) {
    throw new Error(`Client ${clientId} does not have communication settings yet.`);
  }

  if (config.email_provider !== 'klaviyo') {
    throw new Error('Klaviyo seeding requires the client to use Klaviyo for email.');
  }

  const apiKey = config.email_api_key ?? process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    throw new Error('Missing Klaviyo API key (set in config or KLAVIYO_API_KEY env var).');
  }

  if (!config.email_from_address || !config.email_from_name) {
    throw new Error('Communication config must include from email and from name for Klaviyo seeding.');
  }

  console.log(`🚚 Seeding Klaviyo resources for client ${clientId}...`);
  console.log(`   Include marketing flows: ${includeMarketing ? 'yes' : 'no'}`);

  const providerData = (await seedKlaviyoResources({
    apiKey,
    fromEmail: config.email_from_address,
    fromName: config.email_from_name,
    includeMarketing,
  })) as KlaviyoProviderData;

  await db.updateCommunicationConfig(clientId, {
    providerData: providerData as unknown as Record<string, unknown>,
  });

  console.log('✅ Klaviyo metrics, flows, and templates seeded successfully.');
  const metrics = providerData.metrics ?? {};
  const templates = providerData.templates ?? {};
  const flows = providerData.flows ?? {};

  console.log(`   Metrics: ${Object.keys(metrics).length}`);
  Object.entries(metrics).forEach(([key, value]) => {
    console.log(`      • ${key} → ${value?.id ?? 'unknown'}`);
  });

  console.log(`\n   Templates: ${Object.keys(templates).length}`);
  Object.entries(templates).forEach(([key, value]) => {
    console.log(`      • ${key} → ${value?.id ?? 'unknown'}`);
  });

  console.log(`\n   Flows: ${Object.keys(flows).length}`);
  Object.entries(flows).forEach(([key, value]) => {
    console.log(`      • ${key} → ${value?.id ?? 'unknown'}`);
  });

  console.log('\nRe-run this script to refresh templates or add marketing flows.');
} catch (error) {
  console.error('❌ Klaviyo seeding failed.');
  if (error instanceof Error) {
    console.error(`   ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
}
