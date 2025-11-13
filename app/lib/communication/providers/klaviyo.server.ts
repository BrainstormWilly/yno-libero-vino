import type {
  CommunicationProvider,
  EmailParams,
  EmailResult,
  SMSParams,
  SMSResult,
  TrackEventParams,
  TrackEventResult,
  UpdateProfileParams,
} from '~/types/communication';
import type {
  KlaviyoFlowSeedResult,
  KlaviyoMetricSeedResult,
  KlaviyoTemplateSeedInput,
  KlaviyoTemplateSeedResult,
} from '~/types/communication-klaviyo';

interface KlaviyoListResponse<T> {
  data?: Array<{
    id: string;
    type: string;
    attributes: T;
  }>;
}

type MetadataRecord = Record<string, unknown>;

interface KlaviyoProviderOptions {
  apiKey: string;
  defaultFromEmail?: string | null;
  defaultFromName?: string | null;
  revision?: string;
}

const DEFAULT_REVISION = '2025-10-15';

const sleep = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class KlaviyoProvider implements CommunicationProvider {
  public readonly name = 'Klaviyo';
  public readonly supportsEmail = true;
  public readonly supportsSMS = true; // Klaviyo supports SMS, but we stub implementation for now

  private readonly apiKey: string;
  private readonly defaultFromEmail?: string | null;
  private readonly defaultFromName?: string | null;
  private readonly revision: string;

  constructor(options: KlaviyoProviderOptions) {
    if (!options.apiKey) {
      throw new Error('Klaviyo provider requires an API key.');
    }

    this.apiKey = options.apiKey;
    this.defaultFromEmail = options.defaultFromEmail;
    this.defaultFromName = options.defaultFromName;
    this.revision = options.revision ?? DEFAULT_REVISION;
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    const fromEmail = params.fromEmail ?? this.defaultFromEmail;
    const fromName = params.fromName ?? this.defaultFromName ?? undefined;

    if (!fromEmail) {
      throw new Error('Klaviyo sendEmail requires a fromEmail value.');
    }

    const response = await this.request('email-sends/', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'email-send',
          attributes: {
            channel: 'email',
            from: {
              email: fromEmail,
              name: fromName,
            },
            subject: params.subject,
            content: {
              html: params.html,
              text: params.text ?? '',
            },
            to: [
              {
                email: params.to,
                name: params.toName ?? params.to,
              },
            ],
          },
        },
      }),
    });

    const data = await response.json();

    return {
      success: response.ok,
      messageId: data?.data?.id,
      response: data,
    };
  }

  async sendSMS(_params: SMSParams): Promise<SMSResult> {
    throw new Error('Klaviyo SMS support is not implemented yet.');
  }

  async trackEvent(params: TrackEventParams): Promise<TrackEventResult> {
    const metricAttributes: Record<string, unknown> = {
      name: params.event,
    };

    if (params.properties?.metric_seed_service && typeof params.properties.metric_seed_service === 'string') {
      metricAttributes.service = params.properties.metric_seed_service;
    }

    const response = await this.request('events/', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'event',
          attributes: {
            metric: {
              data: {
                type: 'metric',
                attributes: metricAttributes,
              },
            },
            properties: params.properties ?? {},
            time:
              (params.time instanceof Date ? params.time.toISOString() : params.time) ??
              new Date().toISOString(),
            profile: {
              data: {
                type: 'profile',
                attributes: {
                  email: params.customer.email,
                  phone_number: params.customer.phone,
                  external_id: params.customer.id,
                  properties: params.customer.properties ?? {},
                },
              },
            },
          },
        },
      }),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch (error) {
      // Some Klaviyo endpoints (e.g., events) return 202 with an empty body.
      payload = null;
    }

    return {
      success: response.ok,
      response: payload,
    };
  }

  async updateProfile(params: UpdateProfileParams): Promise<void> {
    await this.request('profiles/', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'profile',
          attributes: {
            email: params.email,
            phone_number: params.phone,
            first_name: params.firstName,
            last_name: params.lastName,
            properties: params.properties ?? {},
          },
        },
      }),
    });
  }

  async ensureMetric(metricName: string): Promise<KlaviyoMetricSeedResult> {
    const existing = await this.findMetricByName(metricName);
    if (existing) {
      return existing;
    }

    await this.trackEvent({
      event: metricName,
      time: new Date().toISOString(),
      customer: {
        email: `seed-${metricName.toLowerCase()}@example.org`,
        id: `seed-${metricName}`,
        properties: {
          first_name: 'LiberoVino',
          last_name: 'Seed',
        },
      },
      properties: {
        source: 'LiberoVino::seed',
        seeded_at: new Date().toISOString(),
        metric_seed_service: 'liberovino-seeding',
        metric_seed_name: metricName,
      },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sleep(500 * (attempt + 1));
      const metric = await this.findMetricByName(metricName);
      if (metric) {
        return metric;
      }
    }

    throw new Error(`Failed to seed Klaviyo metric "${metricName}" after retries.`);
  }

  async ensureTemplate(
    template: KlaviyoTemplateSeedInput
  ): Promise<KlaviyoTemplateSeedResult> {
    const existing = await this.findTemplateByName(template.name);
    if (existing) {
      await this.updateTemplate(existing.id, template);
      return { ...existing, updated: true };
    }

    const created = await this.createTemplate(template);
    return created;
  }

  async ensureFlow(params: {
    name: string;
    metricId: string;
    template: KlaviyoTemplateSeedResult;
    subject: string;
    fromEmail: string;
    fromName?: string | null;
    isTransactional: boolean;
    metadata?: MetadataRecord;
  }): Promise<KlaviyoFlowSeedResult> {
    const existing = await this.findFlowByName(params.name);
    if (existing) {
      return existing;
    }

    const flow = await this.createFlow({
      name: params.name,
      metricId: params.metricId,
      templateId: params.template.id,
      subject: params.subject,
      fromEmail: params.fromEmail,
      fromName: params.fromName ?? undefined,
      isTransactional: params.isTransactional,
      metadata: params.metadata,
    });

    return flow;
  }

  private async findMetricByName(metricName: string): Promise<KlaviyoMetricSeedResult | null> {
    const resource = await this.findResourceByName('metrics', metricName, (attributes: { name: string; created: string | null }) => ({
      name: attributes.name,
      createdAt: attributes.created ?? null,
      seededAt: new Date().toISOString(),
    }));

    if (!resource) return null;

    return resource;
  }

  private async findTemplateByName(
    name: string
  ): Promise<KlaviyoTemplateSeedResult | null> {
    const resource = await this.findResourceByName('templates', name, (attributes: {
      name: string;
      subject: string | null;
      editor_type: string;
      created: string | null;
      updated: string | null;
    }) => ({
      name: attributes.name,
      subject: attributes.subject ?? '',
      editorType: attributes.editor_type,
      createdAt: attributes.created ?? null,
      updatedAt: attributes.updated ?? null,
    }));

    if (!resource) return null;

    return resource;
  }

  private async createTemplate(
    template: KlaviyoTemplateSeedInput
  ): Promise<KlaviyoTemplateSeedResult> {
    const response = await this.request('templates/', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'template',
          attributes: {
            name: template.name,
            editor_type: 'CODE',
            html: template.html,
            text: template.text ?? '',
          },
        },
      }),
    });

    const payload = await response.json();
    const resource = payload?.data;

    return {
      id: resource?.id,
      name: resource?.attributes?.name ?? template.name,
      subject: template.subject,
      editorType: resource?.attributes?.editor_type ?? 'CODE',
      createdAt: resource?.attributes?.created ?? null,
      updatedAt: resource?.attributes?.updated ?? null,
      seededAt: new Date().toISOString(),
    };
  }

  private async updateTemplate(
    templateId: string,
    template: KlaviyoTemplateSeedInput
  ): Promise<void> {
    await this.request(`templates/${templateId}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          id: templateId,
          type: 'template',
          attributes: {
            name: template.name,
            html: template.html,
            text: template.text ?? '',
          },
        },
      }),
    });
  }

  private async findFlowByName(name: string): Promise<KlaviyoFlowSeedResult | null> {
    const resource = await this.findResourceByName('flows', name, (attributes: {
      name: string;
      status: string;
      channel: string | null;
      created: string | null;
      updated: string | null;
    }) => ({
      name: attributes.name,
      status: (attributes.status ?? 'draft') as KlaviyoFlowSeedResult['status'],
      channel: (attributes.channel ?? 'email') as KlaviyoFlowSeedResult['channel'],
      createdAt: attributes.created ?? null,
      updatedAt: attributes.updated ?? null,
    }));

    if (!resource) return null;

    return resource;
  }

  private async createFlow(params: {
    name: string;
    metricId: string;
    templateId: string;
    subject: string;
    fromEmail: string;
    fromName?: string;
    isTransactional: boolean;
    metadata?: MetadataRecord;
  }): Promise<KlaviyoFlowSeedResult> {
    const response = await this.request('flows/', {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'flow',
          attributes: {
            name: params.name,
            definition: {
              entry_action_id: 'send_email_action',
              triggers: [
                {
                  type: 'metric',
                  id: params.metricId,
                },
              ],
              actions: [
                {
                  type: 'send-email',
                  temporary_id: 'send_email_action',
                  links: {
                    next: null,
                  },
                  data: {
                    status: 'draft',
                    message: {
                      name: `${params.name} Email`,
                      from_email: params.fromEmail,
                      from_label: params.fromName ?? 'LiberoVino',
                      reply_to_email: params.fromEmail,
                      cc_email: null,
                      bcc_email: null,
                      subject_line: params.subject,
                      preview_text: params.metadata?.previewText ?? params.subject,
                      template_id: params.templateId,
                      smart_sending_enabled: params.metadata?.smartSendingEnabled ?? true,
                      transactional: params.isTransactional,
                      add_tracking_params: false,
                      custom_tracking_params: params.metadata?.customTrackingParams ?? [],
                    },
                  },
                },
              ],
              profile_filter: {
                condition_groups: [],
              },
            },
          },
        },
      }),
    });

    const payload = await response.json();
    const flowId = payload?.data?.id;
    if (!flowId) {
      throw new Error(`Klaviyo flow response missing id when creating "${params.name}"`);
    }

    return {
      id: flowId,
      name: params.name,
      status: 'draft',
      channel: 'email',
      messageId: null,
      templateId: params.templateId,
      metricId: params.metricId,
      createdAt: payload?.data?.attributes?.created ?? null,
      updatedAt: payload?.data?.attributes?.updated ?? null,
      seededAt: new Date().toISOString(),
    };
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const response = await fetch(`https://a.klaviyo.com/api/${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Klaviyo-API-Key ${this.apiKey}`,
        Revision: this.revision,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Klaviyo API error (${response.status} ${response.statusText}): ${errorBody}`
      );
    }

    return response;
  }

  private async findResourceByName<TAttributes, TResult extends { name: string }>(
    path: string,
    name: string,
    mapper: (attributes: TAttributes) => TResult
  ): Promise<(Omit<TResult, 'name'> & { name: string; id: string }) | null> {
    const normalizedPath = path.endsWith('/') ? path : `${path}/`;
    let nextUrl: string | null = normalizedPath;

    while (nextUrl) {
      const response = await this.request(nextUrl, { method: 'GET' });
      const payload = (await response.json()) as KlaviyoListResponse<TAttributes> & {
        links?: { next?: string | null };
      };

      const found = payload.data?.find((item) =>
        item.attributes && (item.attributes as any).name === name
      );
      if (found) {
        return {
          id: found.id,
          ...mapper(found.attributes as TAttributes),
        };
      }

      const nextLink = payload.links?.next ?? null;
      if (!nextLink) {
        nextUrl = null;
      } else if (nextLink.startsWith('http')) {
        const parsed = new URL(nextLink);
        nextUrl = `${parsed.pathname}${parsed.search}`;
      } else {
        nextUrl = nextLink;
      }
    }

    return null;
  }
}
