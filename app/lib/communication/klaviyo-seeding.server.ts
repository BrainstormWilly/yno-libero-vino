import {
  KLAVIYO_FLOWS,
  KLAVIYO_METRICS,
  KLAVIYO_TEMPLATES,
  MARKETING_METRICS,
  TRANSACTIONAL_METRICS,
  type KlaviyoFlowKey,
  type KlaviyoMetricKey,
  type KlaviyoTemplateKey,
} from '~/lib/communication/klaviyo.constants';
import { KlaviyoProvider } from '~/lib/communication/providers/klaviyo.server';
import type {
  KlaviyoProviderData,
  KlaviyoTemplateSeedInput,
} from '~/types/communication-klaviyo';

interface SeedKlaviyoOptions {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  includeMarketing?: boolean;
  includeSMS?: boolean;
}

interface TemplateConfig {
  subject: string;
  previewText: string;
  headline: string;
  intro: string;
  cta: string;
  marketing?: boolean;
}

const TEMPLATE_CONFIG: Record<KlaviyoTemplateKey, TemplateConfig> = {
  CLUB_SIGNUP: {
    subject: 'Welcome to {{ winery_name }} – your membership is liberated',
    previewText: 'Take control of your wine journey right away.',
    headline: 'Your LiberoVino membership is live!',
    intro:
      'You choose what ships and when. Jump in with these need-to-know details and stay liberated.',
    cta: 'Plan your first liberated order',
  },
  MONTHLY_STATUS: {
    subject: '{{ first_name }}, your {{ current_stage }} benefits remain wide open',
    previewText: 'See how many liberated days are left and what’s next.',
    headline: 'Monthly status update',
    intro:
      'Here is the latest on your membership progress so you always know the next winning move.',
    cta: 'Review your status dashboard',
  },
  MONTHLY_STATUS_PROMO: {
    subject: 'Unlock extra liberation with this month’s spotlight release',
    previewText: 'Curated picks that keep your progress on track.',
    headline: 'Monthly spotlight wines',
    intro:
      'We matched these bottles to your current tier so you can stay flexible and keep advancing.',
    cta: 'Explore spotlight wines',
    marketing: true,
  },
  EXPIRATION_WARNING: {
    subject: '{{ days_remaining }} days to extend your {{ current_stage }} freedom',
    previewText: 'No forced shipments—just one purposeful purchase.',
    headline: 'Membership duration is winding down',
    intro:
      'Stay liberated by making a purchase before your duration lapses. Your benefits stay on your timeline.',
    cta: 'Keep my benefits unlocked',
  },
  EXPIRATION_NOTICE: {
    subject: 'Final call to keep your LiberoVino perks unlocked',
    previewText: 'Act now to stay in control of your membership.',
    headline: 'Benefits expiring soon',
    intro:
      'Make a quick purchase to keep your liberation rolling. No auto ship, no minimum cases—just your pace.',
    cta: 'Stay a liberated member',
  },
  TIER_UPGRADE: {
    subject: 'Congratulations! You\'ve unlocked {{ current_stage }}',
    previewText: 'Your membership tier has been upgraded.',
    headline: 'Tier upgrade unlocked',
    intro:
      'Your recent purchase elevated you to a higher tier. Enjoy enhanced benefits and greater savings.',
    cta: 'Explore your new benefits',
  },
  ANNUAL_RESIGN: {
    subject: 'Ready for another liberated year with {{ winery_name }}?',
    previewText: 'Renew on your own terms and keep the perks flowing.',
    headline: 'Let’s continue the liberation',
    intro:
      'Renewing keeps your loyalty points and tier benefits intact without ever forcing a shipment.',
    cta: 'Renew your membership',
    marketing: true,
  },
  SALES_BLAST: {
    subject: 'Spotlight releases curated for liberated members',
    previewText: 'Limited finds that reward your loyalty.',
    headline: 'Featured releases for you',
    intro:
      'Choose from these spotlight wines whenever you are ready—no cadence, no pressure, all liberation.',
    cta: 'Shop spotlight releases',
    marketing: true,
  },
  TEST: {
    subject: 'Test – confirm your LiberoVino automation',
    previewText: 'A friendly diagnostic to confirm delivery.',
    headline: 'Integration test',
    intro: 'If you can read this, your LiberoVino email automation is ready.',
    cta: 'View your dashboard',
  },
};

const TRANSACTIONAL_SET = new Set<KlaviyoMetricKey>(TRANSACTIONAL_METRICS);

const TEMPLATE_LOOKUP: Record<KlaviyoMetricKey, KlaviyoTemplateKey> = {
  CLUB_SIGNUP: 'CLUB_SIGNUP',
  MONTHLY_STATUS: 'MONTHLY_STATUS',
  MONTHLY_STATUS_PROMO: 'MONTHLY_STATUS_PROMO',
  EXPIRATION_WARNING: 'EXPIRATION_WARNING',
  EXPIRATION_NOTICE: 'EXPIRATION_NOTICE',
  TIER_UPGRADE: 'TIER_UPGRADE',
  ANNUAL_RESIGN: 'ANNUAL_RESIGN',
  SALES_BLAST: 'SALES_BLAST',
  TEST: 'TEST',
};

// Map Klaviyo template keys to base template file names (where applicable)
// Templates not in this map will use the hardcoded HTML in renderHtml
const KLAVIYO_TO_BASE_TEMPLATE_MAP: Record<KlaviyoTemplateKey, string> = {
  CLUB_SIGNUP: 'welcome',
  MONTHLY_STATUS: 'monthly-status',
  // MONTHLY_STATUS_PROMO shares the same base template but injects promotional content
  // (see renderHtml lines 238-245 for differentiation)
  MONTHLY_STATUS_PROMO: 'monthly-status',
  EXPIRATION_WARNING: 'expiration-warning',
  EXPIRATION_NOTICE: 'expiration',
  TIER_UPGRADE: 'upgrade',
  ANNUAL_RESIGN: 'annual-resign',
  SALES_BLAST: 'sales-blast',
  TEST: 'test',
};

export async function seedKlaviyoResources(
  options: SeedKlaviyoOptions
): Promise<KlaviyoProviderData> {
  const provider = new KlaviyoProvider({
    apiKey: options.apiKey,
    defaultFromEmail: options.fromEmail,
    defaultFromName: options.fromName,
  });

  const metricKeys: KlaviyoMetricKey[] = [
    ...TRANSACTIONAL_METRICS,
    ...(options.includeMarketing ? MARKETING_METRICS : []),
    'TEST',
  ];

  const metrics: KlaviyoProviderData['metrics'] = {};
  const templates: KlaviyoProviderData['templates'] = {};
  const flows: KlaviyoProviderData['flows'] = {};

  for (const metricKey of metricKeys) {
    const metricName = KLAVIYO_METRICS[metricKey];
    const templateKey = TEMPLATE_LOOKUP[metricKey];
    const templateSeed = await buildTemplateSeed(templateKey);
    const flowKey = templateKey as KlaviyoFlowKey;

    const metric = await provider.ensureMetric(metricName);
    metrics[metricKey] = metric;

    const template = await provider.ensureTemplate(templateSeed);
    templates[templateKey] = withSeedTimestamp(template);

    const flow = await provider.ensureFlow({
      name: KLAVIYO_FLOWS[flowKey],
      metricId: metric.id,
      template,
      subject: templateSeed.subject,
      fromEmail: options.fromEmail,
      fromName: options.fromName,
      isTransactional: TRANSACTIONAL_SET.has(metricKey),
      includeSMS: options.includeSMS ?? false,
      metadata: {
        source: 'LiberoVino::auto-seed',
        metric_key: metricKey,
        template_key: templateKey,
        flow_key: flowKey,
        category: TRANSACTIONAL_SET.has(metricKey) ? 'transactional' : 'marketing',
        smsBody: getSMSBody(templateKey),
      },
    });

    flows[flowKey] = withSeedTimestamp(flow);
  }

  return {
    seededAt: new Date().toISOString(),
    includeMarketing: Boolean(options.includeMarketing),
    metrics,
    templates,
    flows,
  };
}

export async function buildTemplateSeed(
  templateKey: KlaviyoTemplateKey
): Promise<KlaviyoTemplateSeedInput> {
  const config = TEMPLATE_CONFIG[templateKey];
  const html = await renderHtml(templateKey, config);
  return {
    name: KLAVIYO_TEMPLATES[templateKey],
    subject: config.subject,
    previewText: config.previewText,
    html,
    text: renderText(templateKey, config),
    editorType: 'HTML',
  };
}

async function renderHtml(key: KlaviyoTemplateKey, config: TemplateConfig): Promise<string> {
  // All templates now load from base HTML files
  const baseTemplateName = KLAVIYO_TO_BASE_TEMPLATE_MAP[key];
  
  // Load from base template file
  const { loadBaseTemplate, convertTemplateForKlaviyo } = await import('~/lib/communication/templates.server');
  const { getDefaultHeaderImageUrl, getDefaultFooterImageUrl } = await import('~/lib/storage/sendgrid-images.server');
  
  let html = loadBaseTemplate(baseTemplateName);
  
  // Get default branding image URLs
  const headerUrl = await getDefaultHeaderImageUrl();
  const footerUrl = await getDefaultFooterImageUrl();
  
  // Replace image blocks with actual URLs (they're placeholders in base templates)
  const headerImageBlock = `<div style="width: 100%; text-align: center; margin-bottom: 20px;"><img src="${headerUrl}" alt="LiberoVino Header" style="max-width: 600px; height: auto;" /></div>`;
  const footerImageBlock = `<div style="width: 100%; text-align: center; margin-top: 40px;"><img src="${footerUrl}" alt="LiberoVino Footer" style="max-width: 600px; height: auto;" /></div>`;
  
  html = html.replace('{{header_image_block}}', headerImageBlock);
  html = html.replace('{{footer_image_block}}', footerImageBlock);
  html = html.replace('{{custom_content_block}}', ''); // Klaviyo templates don't use custom content
  
  // Inject config values (headline, intro, etc.) for templates that use them
  html = html.replace('{{headline}}', config.headline);
  html = html.replace('{{intro}}', config.intro);
  
  // Inject highlight and secondary content (convert class-based styles to inline styles)
  let highlightContent = renderHighlight(key);
  // Convert .highlight class to inline styles to match base template styling
  highlightContent = highlightContent.replace(
    'class="highlight"',
    'style="background-color: #161f30; color: #ffffff; padding: 20px; border-radius: 10px; margin: 24px 0;"'
  );
  
  const secondaryContent = renderSecondaryCopy(key);
  
  html = html.replace('{{highlight_content}}', highlightContent);
  html = html.replace('{{secondary_content}}', secondaryContent ? `<div style="margin-top:16px;">${secondaryContent}</div>` : '');
  
  // For templates that need dynamic content sections, inject them
  if (key === 'MONTHLY_STATUS_PROMO') {
    // Replace upgrade_message with promotional content
    const promoContent = renderSecondaryCopy(key);
    html = html.replace('{{upgrade_message}}', promoContent ? `<div style="margin-top:24px; padding:16px; background-color:#f8f9fa; border-left:4px solid #0066cc;">${promoContent}</div>` : '');
  } else if (key === 'MONTHLY_STATUS') {
    // Replace upgrade_message with upgrade opportunity if available
    const upgradeContent = renderSecondaryCopy(key);
    html = html.replace('{{upgrade_message}}', upgradeContent ? `<div style="margin-top:24px; padding:16px; background-color:#f8f9fa; border-left:4px solid #0066cc;">${upgradeContent}</div>` : '');
  } else if (key === 'CLUB_SIGNUP') {
    // Replace upgrade_message with upgrade opportunity
    const upgradeContent = renderSecondaryCopy(key);
    html = html.replace('{{upgrade_message}}', upgradeContent ? `<div style="margin-top:24px; padding:16px; background-color:#f8f9fa; border-left:4px solid #0066cc;">${upgradeContent}</div>` : '');
  } else {
    html = html.replace('{{upgrade_message}}', '');
  }
  
  // Convert {{variable}} to {{person.variable}} for Klaviyo
  html = convertTemplateForKlaviyo(html);
  
  return html;
}

function renderHighlight(key: KlaviyoTemplateKey): string {
  switch (key) {
    case 'CLUB_SIGNUP':
      return `<div class="highlight">
  <p><strong>Tier:</strong> {{ person.current_stage }} • {{ person.discount_percentage }}% off</p>
  <p><strong>Duration remaining:</strong> {{ person.days_remaining }} days</p>
  <p><strong>Loyalty balance:</strong> {{ person.points_balance }} points</p>
</div>`;
    case 'MONTHLY_STATUS':
    case 'MONTHLY_STATUS_PROMO':
      return `<div class="highlight">
  <p><strong>Tier:</strong> {{ person.current_stage }} • {{ person.discount_percentage }}% off</p>
  <p><strong>Renew with:</strong> {{ person.min_purchase_amount }} before {{ person.expires_at }}</p>
</div>`;
    case 'EXPIRATION_WARNING':
      return `<div class="highlight">
  <p><strong>{{ person.days_remaining }} days left.</strong> Purchase {{ person.min_purchase_amount }} to stay liberated.</p>
</div>`;
    case 'EXPIRATION_NOTICE':
      return `<div class="highlight">
  <p><strong>Last chance:</strong> Make a purchase now to keep your benefits active.</p>
</div>`;
    case 'TIER_UPGRADE':
      return `<div class="highlight">
  <p><strong>Upgraded to:</strong> {{ person.current_stage }} • {{ person.discount_percentage }}% off</p>
  <p><strong>Previous tier:</strong> {{ person.previous_tier_name }}</p>
</div>`;
    case 'ANNUAL_RESIGN':
      return `<div class="highlight">
  <p><strong>Keep the liberation going.</strong> Renew to protect your loyalty balance of {{ person.points_balance }} points.</p>
</div>`;
    case 'SALES_BLAST':
      return `<div class="highlight">
  <p><strong>Spotlight:</strong> {{ person.suggested_wines.0.name }} • {{ person.suggested_wines.0.price }}</p>
  <p>Redeem with {{ person.discount_percentage }}% and loyalty points.</p>
</div>`;
    case 'TEST':
    default:
      return `<div class="highlight">
  <p>This is a LiberoVino diagnostic message.</p>
</div>`;
  }
}

function renderSecondaryCopy(key: KlaviyoTemplateKey): string {
  switch (key) {
    case 'CLUB_SIGNUP':
      return `<p>Upgrade opportunity: reach {{ person.next_stage_amount }} to unlock {{ person.next_stage_discount }}% and exclusive drops.</p>`;
    case 'MONTHLY_STATUS':
      return `<p>Need momentum? Purchasing {{ person.next_stage_amount }} elevates you to {{ person.next_stage }} for {{ person.next_stage_discount }}% savings.</p>`;
    case 'MONTHLY_STATUS_PROMO':
      return `<p>Spotlight pick: {{ person.suggested_wines.0.name }} – ideal for maintaining your liberated pace.</p>`;
    case 'EXPIRATION_WARNING':
    case 'EXPIRATION_NOTICE':
      return `<p>LiberoVino members never face forced shipments—just purchase the wines you want before {{ person.expires_at }}.</p>`;
    case 'TIER_UPGRADE':
      return `<p>Your upgrade unlocks enhanced benefits and greater savings. Enjoy your new tier status!</p>`;
    case 'ANNUAL_RESIGN':
      return `<p>Renew to protect your loyalty streak and keep choosing shipments only when you are ready.</p>`;
    case 'SALES_BLAST':
      return `<p>Inventory is intentionally limited for liberated members. Choose what inspires you—no shipment schedule.</p>`;
    case 'TEST':
    default:
      return `<p>If you triggered this, your Klaviyo automation is wired correctly.</p>`;
  }
}

function renderText(key: KlaviyoTemplateKey, config: TemplateConfig): string {
  return [
    `Hi {{ first_name }},`,
    '',
    config.headline,
    config.intro,
    '',
    stripHtml(renderHighlight(key)),
    stripHtml(renderSecondaryCopy(key)),
    '',
    `${config.cta}: {{ person.shop_url }}`,
    '',
    'Stay liberated,',
    '{{ person.winery_name }} × LiberoVino',
  ].join('\n');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+\n/g, '\n').trim();
}

function withSeedTimestamp<T extends { seededAt?: string }>(resource: T): T {
  return {
    ...resource,
    seededAt: resource.seededAt ?? new Date().toISOString(),
  };
}

function getSMSBody(templateKey: KlaviyoTemplateKey): string {
  const config = TEMPLATE_CONFIG[templateKey];
  // Create a concise SMS version of the message
  const baseMessage = `${config.headline}. ${config.intro} ${config.cta}: {{ person.shop_url }}`;
  
  // Add opt-out instructions for club signup (entry point message)
  if (templateKey === 'CLUB_SIGNUP') {
    return `${baseMessage} Reply STOP to opt out. Msg & data rates may apply.`;
  }
  
  return baseMessage;
}
