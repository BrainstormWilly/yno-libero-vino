import { MAILCHIMP_SEQUENCE_ORDER, MAILCHIMP_TEMPLATE_NAMES, type MailchimpTemplateKey } from '~/lib/communication/mailchimp.constants';
import { buildTemplateSeed } from '~/lib/communication/klaviyo-seeding.server';
import type { KlaviyoMetricKey } from '~/lib/communication/klaviyo.constants';
import type {
  MailchimpAudienceSeedResult,
  MailchimpProviderData,
  MailchimpTemplateSeedResult,
} from '~/types/communication-mailchimp';

interface MailchimpContactAddress {
  company: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
}

interface SeedMailchimpOptions {
  serverPrefix: string;
  marketingAccessToken?: string | null;
  marketingApiKey?: string | null;
  fromEmail: string;
  fromName: string;
  includeMarketing?: boolean;
  audienceName?: string;
  permissionReminder?: string;
  contact: MailchimpContactAddress;
}

interface MailchimpTemplatePayload {
  name: string;
  html?: string;
  text?: string;
}

export async function seedMailchimpResources(options: SeedMailchimpOptions): Promise<MailchimpProviderData> {
  if (!options.marketingAccessToken && !options.marketingApiKey) {
    throw new Error(
      'Mailchimp seeding requires either an OAuth marketing access token or a classic API key.'
    );
  }

  const client = new MailchimpSeedClient({
    serverPrefix: options.serverPrefix,
    accessToken: options.marketingAccessToken ?? undefined,
    apiKey: options.marketingApiKey ?? undefined,
  });

  const audience = await client.ensureAudience({
    name: options.audienceName ?? 'LiberoVino Members',
    contact: options.contact,
    fromEmail: options.fromEmail,
    fromName: options.fromName,
    permissionReminder:
      options.permissionReminder ??
      'You are receiving this email because you opted into the LiberoVino membership updates.',
  });

  const templates: Record<string, MailchimpTemplateSeedResult | undefined> = {};

  const templateKeys = filterMarketingSequences(
    MAILCHIMP_SEQUENCE_ORDER,
    Boolean(options.includeMarketing)
  );

  for (const sequenceKey of templateKeys) {
    const templateKey = sequenceKey as MailchimpTemplateKey;
    const templateSeed = buildTemplateSeed(templateKey);
    const payload: MailchimpTemplatePayload = {
      name: MAILCHIMP_TEMPLATE_NAMES[templateKey],
      html: convertMergeTags(templateSeed.html),
      text: convertMergeTags(templateSeed.text ?? ''),
    };

    const template = await client.ensureTemplate(payload);
    templates[templateKey] = {
      ...template,
      seededAt: template.seededAt ?? new Date().toISOString(),
    };
  }

  return {
    seededAt: new Date().toISOString(),
    includeMarketing: Boolean(options.includeMarketing),
    serverPrefix: options.serverPrefix,
    marketingAccessToken: options.marketingAccessToken ?? null,
    audienceId: audience?.id ?? null,
    audienceName: audience?.name ?? null,
    audience: audience
      ? {
          ...audience,
          seededAt: audience.seededAt ?? new Date().toISOString(),
        }
      : undefined,
    templates,
  };
}

function filterMarketingSequences(
  sequences: KlaviyoMetricKey[],
  includeMarketing: boolean
): KlaviyoMetricKey[] {
  if (includeMarketing) return sequences;
  return sequences.filter((key) => key !== 'MONTHLY_STATUS_PROMO' && key !== 'ANNUAL_RESIGN' && key !== 'SALES_BLAST');
}

class MailchimpSeedClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(private readonly options: { serverPrefix: string; accessToken?: string; apiKey?: string }) {
    this.baseUrl = `https://${options.serverPrefix}.api.mailchimp.com/3.0`;
    this.headers = {
      'Content-Type': 'application/json',
      ...this.buildAuthHeader(),
    };
  }

  async ensureAudience(options: {
    name: string;
    contact: MailchimpContactAddress;
    fromEmail: string;
    fromName: string;
    permissionReminder: string;
  }): Promise<MailchimpAudienceSeedResult> {
    const existing = await this.findAudienceByName(options.name);
    if (existing) {
      return existing;
    }

    const response = await this.request('/lists', {
      method: 'POST',
      body: JSON.stringify({
        name: options.name,
        contact: {
          company: options.contact.company,
          address1: options.contact.address1,
          address2: options.contact.address2 ?? '',
          city: options.contact.city,
          state: options.contact.state,
          zip: options.contact.zip,
          country: options.contact.country,
          phone: options.contact.phone ?? '',
        },
        permission_reminder: options.permissionReminder,
        campaign_defaults: {
          from_name: options.fromName,
          from_email: options.fromEmail,
          subject: 'LiberoVino Membership Update',
          language: 'en',
        },
        email_type_option: false,
      }),
    });

    const data = (await response.json()) as MailchimpAudienceSeedResult;
    return data;
  }

  async ensureTemplate(payload: MailchimpTemplatePayload): Promise<MailchimpTemplateSeedResult> {
    const existing = await this.findTemplateByName(payload.name);
    if (existing) {
      return existing;
    }

    const response = await this.request('/templates', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        html: payload.html,
        plain_text: payload.text,
        type: 'classic',
      }),
    });

    const template = (await response.json()) as MailchimpTemplateSeedResult;

    return template;
  }

  private async findAudienceByName(name: string) {
    const response = await this.request(`/lists?fields=lists.id,lists.name,lists.web_id&count=1000`, {
      method: 'GET',
    });

    const data = await response.json();
    const list = data?.lists?.find((entry: { name: string }) => entry.name === name);
    if (!list) return null;
    return list as MailchimpAudienceSeedResult;
  }

  private async findTemplateByName(name: string) {
    const response = await this.request(`/templates?fields=templates.id,templates.name,templates.type&count=1000`, {
      method: 'GET',
    });
    const data = await response.json();
    const template = data?.templates?.find((entry: { name: string }) => entry.name === name);
    if (!template) return null;
    return template as MailchimpTemplateSeedResult;
  }

  private buildAuthHeader(): Record<string, string> {
    if (this.options.accessToken) {
      return {
        Authorization: `Bearer ${this.options.accessToken}`,
      };
    }

    if (this.options.apiKey) {
      const encoded = Buffer.from(`anystring:${this.options.apiKey}`).toString('base64');
      return {
        Authorization: `Basic ${encoded}`,
      };
    }

    throw new Error('Mailchimp client requires either an access token or API key for authentication.');
  }

  private async request(path: string, init: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers,
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Mailchimp API error (${response.status} ${response.statusText}): ${errorBody}`);
    }

    return response;
  }
}

function convertMergeTags(content: string): string {
  return content.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, token) => {
    const cleaned = token.replace(/['"]/g, '').trim();
    const mapped = mapMergeTag(cleaned);
    return `*|${mapped}|*`;
  });
}

function mapMergeTag(token: string): string {
  switch (token) {
    case 'first_name':
      return 'FNAME';
    case 'last_name':
      return 'LNAME';
    case 'winery_name':
      return 'WINERY_NAME';
    default:
      return token
        .replace(/\./g, '_')
        .replace(/\W+/g, '_')
        .toUpperCase();
  }
}

