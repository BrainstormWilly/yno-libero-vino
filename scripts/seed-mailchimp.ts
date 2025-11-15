import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv({ path: '.env' });

const db = await import('~/lib/db/supabase.server');
const { MailchimpProvider } = await import('~/lib/communication/providers/mailchimp.server');
const { seedMailchimpResources } = await import('~/lib/communication/mailchimp-seeding.server');
import type { MailchimpProviderData } from '~/types/communication-mailchimp';
import type { Database } from '~/types/supabase';

type ProviderDataJson =
  Database['public']['Tables']['communication_configs']['Insert']['provider_data'];

const [, , clientId, ...flags] = process.argv;

if (!clientId) {
  console.error('❌ Missing client ID.');
  console.error('Usage:');
  console.error('  npx tsx scripts/seed-mailchimp.ts <client-id> [--marketing] [--audience="Custom Audience Name"]');
  process.exit(1);
}

const includeMarketing = flags.includes('--marketing');
const audienceOverride = flags.find((flag) => flag.startsWith('--audience='));
const audienceName = audienceOverride ? audienceOverride.split('=')[1] : undefined;

try {
  const [config, client] = await Promise.all([
    db.getCommunicationConfig(clientId),
    db.getClient(clientId),
  ]);

  if (!config) {
    throw new Error(`Client ${clientId} does not have communication settings yet.`);
  }

  if (config.email_provider !== 'mailchimp') {
    throw new Error('Mailchimp seeding requires the client to use Mailchimp for email.');
  }

  const providerData = MailchimpProvider.parseProviderData(config.provider_data ?? null);

  const serverPrefix =
    providerData.serverPrefix ??
    process.env.MAILCHIMP_SERVER_PREFIX ??
    process.env.MAILCHIMP_DC ??
    null;
  if (!serverPrefix) {
    throw new Error('Missing Mailchimp server prefix (set MAILCHIMP_SERVER_PREFIX env var).');
  }

  const marketingToken =
    providerData.marketingAccessToken ??
    process.env.MAILCHIMP_ACCESS_TOKEN ??
    process.env.MAILCHIMP_API_KEY ??
    null;
  if (!marketingToken) {
    throw new Error('Missing Mailchimp marketing access token or API key.');
  }

  const fromEmail = config.email_from_address ?? process.env.MAILCHIMP_FROM_EMAIL;
  const fromName = config.email_from_name ?? process.env.MAILCHIMP_FROM_NAME;

  if (!fromEmail || !fromName) {
    throw new Error('Communication config must include from email and from name for Mailchimp seeding.');
  }

  const contact = buildContactAddress(client);
  const permissionReminder =
    process.env.MAILCHIMP_PERMISSION_REMINDER ??
    'You are receiving this email because you opted into LiberoVino membership updates.';

  console.log(`🚚 Seeding Mailchimp resources for client ${clientId}...`);
  console.log(`   Include marketing journeys: ${includeMarketing ? 'yes' : 'no'}`);

  const seededData = (await seedMailchimpResources({
    serverPrefix,
    marketingAccessToken: marketingToken,
    marketingApiKey: process.env.MAILCHIMP_API_KEY ?? undefined,
    fromEmail,
    fromName,
    includeMarketing,
    audienceName: audienceName ?? providerData.audienceName ?? undefined,
    permissionReminder,
    contact,
  })) as MailchimpProviderData;

  await db.updateCommunicationConfig(clientId, {
    emailListId: seededData.audienceId ?? config.email_list_id,
    providerData: ({
      ...seededData,
      marketingAccessToken: seededData.marketingAccessToken ?? marketingToken,
      serverPrefix,
    } as unknown) as ProviderDataJson,
  });

  console.log('✅ Mailchimp audience and templates seeded successfully.');
  if (seededData.audience) {
    console.log(`   Audience: ${seededData.audience.name} (${seededData.audience.id})`);
  }

  const templates = seededData.templates ?? {};
  console.log(`\n   Templates: ${Object.keys(templates).length}`);
  Object.entries(templates).forEach(([key, value]) => {
    if (!value) return;
    console.log(`      • ${key} → ${value.id}`);
  });

  console.log('\nRe-run this script to refresh templates or add marketing journeys.');
} catch (error) {
  console.error('❌ Mailchimp seeding failed.');
  if (error instanceof Error) {
    console.error(`   ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
}

function buildContactAddress(client: Awaited<ReturnType<typeof db.getClient>> | null) {
  return {
    company: process.env.MAILCHIMP_CONTACT_COMPANY ?? client?.org_name ?? 'LiberoVino Client',
    address1: process.env.MAILCHIMP_CONTACT_ADDRESS1 ?? '123 Winery Way',
    address2: process.env.MAILCHIMP_CONTACT_ADDRESS2 ?? '',
    city: process.env.MAILCHIMP_CONTACT_CITY ?? 'Napa',
    state: process.env.MAILCHIMP_CONTACT_STATE ?? 'CA',
    zip: process.env.MAILCHIMP_CONTACT_ZIP ?? '94558',
    country: process.env.MAILCHIMP_CONTACT_COUNTRY ?? 'US',
    phone: process.env.MAILCHIMP_CONTACT_PHONE ?? undefined,
  };
}

