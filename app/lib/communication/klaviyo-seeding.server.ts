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
  KlaviyoTemplateSeedResult,
} from '~/types/communication-klaviyo';

interface SeedKlaviyoOptions {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  includeMarketing?: boolean;
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
    subject: 'Test – confirm your LiberoVino Klaviyo integration',
    previewText: 'A friendly diagnostic to confirm delivery.',
    headline: 'Integration test',
    intro: 'If you can read this in Klaviyo, the integration is ready.',
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
  ANNUAL_RESIGN: 'ANNUAL_RESIGN',
  SALES_BLAST: 'SALES_BLAST',
  TEST: 'TEST',
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
  ];

  const metrics: KlaviyoProviderData['metrics'] = {};
  const templates: KlaviyoProviderData['templates'] = {};
  const flows: KlaviyoProviderData['flows'] = {};

  for (const metricKey of metricKeys) {
    const metricName = KLAVIYO_METRICS[metricKey];
    const templateKey = TEMPLATE_LOOKUP[metricKey];
    const templateSeed = buildTemplateSeed(templateKey);
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
      metadata: {
        source: 'LiberoVino::auto-seed',
        metric_key: metricKey,
        template_key: templateKey,
        flow_key: flowKey,
        category: TRANSACTIONAL_SET.has(metricKey) ? 'transactional' : 'marketing',
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

export function buildTemplateSeed(
  templateKey: KlaviyoTemplateKey
): KlaviyoTemplateSeedInput {
  const config = TEMPLATE_CONFIG[templateKey];
  return {
    name: KLAVIYO_TEMPLATES[templateKey],
    subject: config.subject,
    previewText: config.previewText,
    html: renderHtml(templateKey, config),
    text: renderText(templateKey, config),
    editorType: 'HTML',
  };
}

function renderHtml(key: KlaviyoTemplateKey, config: TemplateConfig): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${KLAVIYO_TEMPLATES[key]}</title>
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #f8f9fa; margin: 0; padding: 24px; color: #202124; }
      .card { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; }
      h1 { font-size: 28px; margin-bottom: 16px; }
      p { font-size: 16px; line-height: 1.6; margin-bottom: 16px; }
      .highlight { background: #161f30; color: #ffffff; padding: 20px; border-radius: 10px; margin: 24px 0; }
      .cta { display: inline-block; padding: 14px 24px; background: #ff4f45; color: #ffffff; border-radius: 6px; font-weight: 600; text-decoration: none; }
      .footer { margin-top: 32px; font-size: 14px; color: #5f6368; }
    </style>
  </head>
  <body>
    <div class="card">
      <p>Hi {{ first_name }},</p>
      <h1>${config.headline}</h1>
      <p>${config.intro}</p>
      ${renderHighlight(key)}
      ${renderSecondaryCopy(key)}
      <a class="cta" href="{{ shop_url }}">${config.cta}</a>
      <div class="footer">
        <p>Stay liberated, stay curious.</p>
        <p>{{ winery_name }} × LiberoVino</p>
        <p><a href="{{ unsubscribe_url }}">Update preferences</a></p>
      </div>
    </div>
  </body>
</html>`;
}

function renderHighlight(key: KlaviyoTemplateKey): string {
  switch (key) {
    case 'CLUB_SIGNUP':
      return `<div class="highlight">
  <p><strong>Tier:</strong> {{ current_stage }} • {{ discount_percentage }}% off</p>
  <p><strong>Duration remaining:</strong> {{ days_remaining }} days</p>
  <p><strong>Loyalty balance:</strong> {{ points_balance }} points</p>
</div>`;
    case 'MONTHLY_STATUS':
    case 'MONTHLY_STATUS_PROMO':
      return `<div class="highlight">
  <p><strong>Tier:</strong> {{ current_stage }} • {{ discount_percentage }}% off</p>
  <p><strong>Renew with:</strong> ${'{{ min_purchase_amount }}'} before {{ expires_at }}</p>
</div>`;
    case 'EXPIRATION_WARNING':
      return `<div class="highlight">
  <p><strong>${'{{ days_remaining }}'} days left.</strong> Purchase ${'{{ min_purchase_amount }}'} to stay liberated.</p>
</div>`;
    case 'EXPIRATION_NOTICE':
      return `<div class="highlight">
  <p><strong>Last chance:</strong> Make a purchase now to keep your benefits active.</p>
</div>`;
    case 'ANNUAL_RESIGN':
      return `<div class="highlight">
  <p><strong>Keep the liberation going.</strong> Renew to protect your loyalty balance of {{ points_balance }} points.</p>
</div>`;
    case 'SALES_BLAST':
      return `<div class="highlight">
  <p><strong>Spotlight:</strong> {{ suggested_wines.0.name }} • ${'{{ suggested_wines.0.price }}'}</p>
  <p>Redeem with {{ discount_percentage }}% and loyalty points.</p>
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
      return `<p>Upgrade opportunity: reach ${'{{ next_stage_amount }}'} to unlock ${'{{ next_stage_discount }}'}% and exclusive drops.</p>`;
    case 'MONTHLY_STATUS':
      return `<p>Need momentum? Purchasing ${'{{ next_stage_amount }}'} elevates you to ${'{{ next_stage }}'} for ${'{{ next_stage_discount }}'}% savings.</p>`;
    case 'MONTHLY_STATUS_PROMO':
      return `<p>Spotlight pick: {{ suggested_wines.0.name }} – ideal for maintaining your liberated pace.</p>`;
    case 'EXPIRATION_WARNING':
    case 'EXPIRATION_NOTICE':
      return `<p>LiberoVino members never face forced shipments—just purchase the wines you want before ${'{{ expires_at }}'}.</p>`;
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
    `${config.cta}: {{ shop_url }}`,
    '',
    'Stay liberated,',
    '{{ winery_name }} × LiberoVino',
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
