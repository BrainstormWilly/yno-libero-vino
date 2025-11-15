import type { Database } from '~/types/supabase';
import type {
  EmailParams,
  EmailResult,
  SMSParams,
  SMSResult,
  TrackEventParams,
  TrackEventResult,
  UpdateProfileParams,
} from '~/types/communication';

import { KlaviyoProvider } from './providers/klaviyo.server';
import { MailchimpProvider } from './providers/mailchimp.server';
import { SendGridProvider } from './providers/sendgrid.server';

export type CommunicationConfig = Database['public']['Tables']['communication_configs']['Row'];

interface CommunicationManagerOptions {
  defaultSendgridApiKey?: string;
  defaultSendgridFromEmail?: string;
  defaultSendgridFromName?: string;
  defaultKlaviyoApiKey?: string;
  defaultKlaviyoFromEmail?: string;
  defaultKlaviyoFromName?: string;
  defaultMailchimpServerPrefix?: string;
  defaultMailchimpMarketingToken?: string;
  defaultMailchimpAudienceId?: string;
  defaultMailchimpFromEmail?: string;
  defaultMailchimpFromName?: string;
}

export class CommunicationManager {
  constructor(private readonly options: CommunicationManagerOptions = {}) {}

  resolveEmailProvider(config?: CommunicationConfig | null) {
    const providerKey = (config?.email_provider ?? 'sendgrid').toLowerCase();

    if (providerKey === 'klaviyo') {
      const apiKey = config?.email_api_key ?? this.options.defaultKlaviyoApiKey;
      if (!apiKey) {
        throw new Error('Klaviyo email provider selected but no API key is configured.');
      }

      return new KlaviyoProvider({
        apiKey,
        defaultFromEmail: config?.email_from_address ?? this.options.defaultKlaviyoFromEmail ?? null,
        defaultFromName: config?.email_from_name ?? this.options.defaultKlaviyoFromName ?? null,
      });
    }

    if (providerKey === 'mailchimp') {
      const providerData = MailchimpProvider.parseProviderData(config?.provider_data ?? null);
      const serverPrefix =
        providerData.serverPrefix ??
        this.options.defaultMailchimpServerPrefix ??
        process.env.MAILCHIMP_SERVER_PREFIX ??
        null;
      const marketingToken =
        providerData.marketingAccessToken ??
        this.options.defaultMailchimpMarketingToken ??
        process.env.MAILCHIMP_ACCESS_TOKEN ??
        null;
      const audienceId =
        config?.email_list_id ??
        providerData.audienceId ??
        this.options.defaultMailchimpAudienceId ??
        null;

      if (!serverPrefix) {
        throw new Error('Mailchimp provider selected but no data center/server prefix is configured.');
      }

      return new MailchimpProvider({
        serverPrefix,
        defaultFromEmail:
          config?.email_from_address ??
          this.options.defaultMailchimpFromEmail ??
          this.options.defaultSendgridFromEmail ??
          '',
        defaultFromName:
          config?.email_from_name ??
          this.options.defaultMailchimpFromName ??
          this.options.defaultSendgridFromName ??
          undefined,
        marketingAccessToken: marketingToken,
        audienceId,
      });
    }

    const sendgridApiKey =
      config?.email_api_key ?? process.env.SENDGRID_API_KEY ?? this.options.defaultSendgridApiKey;
    const sendgridFromEmail = config?.email_from_address ?? this.options.defaultSendgridFromEmail;
    const sendgridFromName = config?.email_from_name ?? this.options.defaultSendgridFromName;

    if (!sendgridApiKey) {
      throw new Error('SendGrid fallback selected but no API key is configured.');
    }

    if (!sendgridFromEmail) {
      throw new Error('SendGrid fallback selected but no from email address is configured.');
    }

    return new SendGridProvider({
      apiKey: sendgridApiKey,
      defaultFromEmail: sendgridFromEmail,
      defaultFromName: sendgridFromName,
    });
  }

  async sendEmail(
    config: CommunicationConfig | null | undefined,
    params: EmailParams
  ): Promise<EmailResult> {
    const provider = this.resolveEmailProvider(config);
    return provider.sendEmail(params);
  }

  async sendSMS(
    config: CommunicationConfig | null | undefined,
    params: SMSParams
  ): Promise<SMSResult> {
    const provider = this.resolveEmailProvider(config);

    if (!provider.supportsSMS || !provider.sendSMS) {
      throw new Error(`${provider.name} does not support SMS.`);
    }

    return provider.sendSMS(params);
  }

  async trackEvent(
    config: CommunicationConfig | null | undefined,
    params: TrackEventParams
  ): Promise<TrackEventResult> {
    const provider = this.resolveEmailProvider(config);
    if (!provider.trackEvent) {
      return { success: false };
    }
    return provider.trackEvent(params);
  }

  async updateProfile(
    config: CommunicationConfig | null | undefined,
    params: UpdateProfileParams
  ): Promise<void> {
    const provider = this.resolveEmailProvider(config);
    if (!provider.updateProfile) {
      return;
    }
    await provider.updateProfile(params);
  }
}

export function createCommunicationManager() {
  return new CommunicationManager({
    defaultSendgridApiKey: process.env.SENDGRID_API_KEY,
    defaultSendgridFromEmail: process.env.SENDGRID_FROM_EMAIL,
    defaultSendgridFromName: process.env.SENDGRID_FROM_NAME,
    defaultKlaviyoApiKey: process.env.KLAVIYO_API_KEY,
    defaultMailchimpServerPrefix: process.env.MAILCHIMP_SERVER_PREFIX,
    defaultMailchimpMarketingToken: process.env.MAILCHIMP_ACCESS_TOKEN,
    defaultMailchimpFromEmail: process.env.MAILCHIMP_FROM_EMAIL,
    defaultMailchimpFromName: process.env.MAILCHIMP_FROM_NAME,
  });
}
