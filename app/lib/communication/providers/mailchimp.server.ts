import { createHash } from 'node:crypto';

import type {
  CommunicationProvider,
  EmailParams,
  EmailResult,
  TrackEventParams,
  TrackEventResult,
  UpdateProfileParams,
} from '~/types/communication';

interface MailchimpProviderOptions {
  serverPrefix: string;
  defaultFromEmail: string;
  defaultFromName?: string;
  marketingAccessToken?: string | null;
  audienceId?: string | null;
}

interface MailchimpProviderData {
  marketingAccessToken?: string | null;
  serverPrefix?: string | null;
  audienceId?: string | null;
  audienceName?: string | null;
}

export class MailchimpProvider implements CommunicationProvider {
  public readonly name = 'Mailchimp';
  public readonly supportsEmail = true;
  public readonly supportsSMS = false;

  private readonly serverPrefix: string;
  private readonly defaultFromEmail: string;
  private readonly defaultFromName?: string;
  private readonly marketingAccessToken?: string | null;
  private readonly audienceId?: string | null;

  constructor(options: MailchimpProviderOptions) {
    if (!options.serverPrefix) {
      throw new Error('Mailchimp provider requires a data center/server prefix (e.g., us21).');
    }

    if (!options.defaultFromEmail) {
      throw new Error('Mailchimp provider requires a default from email address.');
    }

    this.serverPrefix = options.serverPrefix;
    this.defaultFromEmail = options.defaultFromEmail;
    this.defaultFromName = options.defaultFromName;
    this.marketingAccessToken = options.marketingAccessToken;
    this.audienceId = options.audienceId;
  }

  static parseProviderData(data: unknown): MailchimpProviderData {
    if (!data || typeof data !== 'object') return {};
    const parsed = data as Record<string, unknown>;
    return {
      marketingAccessToken: typeof parsed.marketingAccessToken === 'string' ? parsed.marketingAccessToken : null,
      serverPrefix: typeof parsed.serverPrefix === 'string' ? parsed.serverPrefix : null,
      audienceId: typeof parsed.audienceId === 'string' ? parsed.audienceId : null,
      audienceName: typeof parsed.audienceName === 'string' ? parsed.audienceName : null,
    };
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    throw new Error(
      'Mailchimp direct sends are not supported. Configure journeys/flows to deliver email automations.'
    );
  }

  async trackEvent(params: TrackEventParams): Promise<TrackEventResult> {
    if (!params.customer.email) {
      return { success: false, response: 'Mailchimp trackEvent requires customer.email' };
    }

    if (!this.marketingAccessToken) {
      return { success: false, response: 'Mailchimp marketing access token not configured.' };
    }

    if (!this.audienceId) {
      return { success: false, response: 'Mailchimp audience/list ID not configured.' };
    }

    const body: Record<string, unknown> = {
      email_address: params.customer.email,
      status_if_new: 'subscribed',
      status: 'subscribed',
      merge_fields: this.buildMergeFields(params.customer.properties),
    };

    await this.requestMarketing(
      `/lists/${this.audienceId}/members/${this.hashEmail(params.customer.email)}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );

    if (params.event) {
      await this.applyTag(params.customer.email, params.event);
    }

    return { success: true };
  }

  async updateProfile(params: UpdateProfileParams): Promise<void> {
    if (!this.marketingAccessToken || !this.audienceId) return;

    const body: Record<string, unknown> = {
      email_address: params.email,
      status_if_new: 'subscribed',
      status: 'subscribed',
      merge_fields: this.buildMergeFields({
        first_name: params.firstName,
        last_name: params.lastName,
        ...params.properties,
      }),
    };

    await this.requestMarketing(
      `/lists/${this.audienceId}/members/${this.hashEmail(params.email)}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );
  }

  private async applyTag(email: string, tag: string) {
    await this.requestMarketing(
      `/lists/${this.audienceId}/members/${this.hashEmail(email)}/tags`,
      {
        method: 'POST',
        body: JSON.stringify({
          tags: [
            {
              name: tag,
              status: 'active',
            },
          ],
        }),
      }
    );
  }

  private buildMergeFields(properties?: Record<string, unknown>) {
    if (!properties) return {};

    const mergeFields: Record<string, unknown> = {};
    const firstName =
      (properties.firstName as string) ||
      (properties.first_name as string) ||
      (properties.FNAME as string);
    const lastName =
      (properties.lastName as string) ||
      (properties.last_name as string) ||
      (properties.LNAME as string);

    if (firstName) mergeFields.FNAME = firstName;
    if (lastName) mergeFields.LNAME = lastName;

    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined || value === null) continue;
      if (['firstName', 'first_name', 'FNAME', 'lastName', 'last_name', 'LNAME'].includes(key)) {
        continue;
      }
      mergeFields[key.toUpperCase()] = value;
    }

    return mergeFields;
  }

  private hashEmail(email: string) {
    return createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  }

  private async requestMarketing(path: string, init: RequestInit) {
    if (!this.marketingAccessToken) {
      throw new Error('Mailchimp marketing access token is not configured.');
    }

    const url = `https://${this.serverPrefix}.api.mailchimp.com/3.0${path}`;
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.marketingAccessToken}`,
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Mailchimp Marketing API error (${response.status} ${response.statusText}): ${errorBody}`);
    }

    return response;
  }
}

