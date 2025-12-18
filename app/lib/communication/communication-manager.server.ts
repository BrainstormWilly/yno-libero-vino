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
import { TwilioProvider } from './providers/twilio.server';

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
  defaultTwilioAccountSid?: string;
  defaultTwilioAuthToken?: string;
  defaultTwilioFromNumber?: string;
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

    // For SendGrid, prefer env var unless explicitly set in database
    // Empty strings should fall back to env var
    const dbApiKey = config?.email_api_key?.trim();
    const envApiKey = process.env.SENDGRID_API_KEY;
    const sendgridApiKey = dbApiKey && dbApiKey !== '' ? dbApiKey : envApiKey ?? this.options.defaultSendgridApiKey;
    
    // Debug logging to help diagnose API key issues
    if (!sendgridApiKey) {
      console.error('[SendGrid] No API key found:', {
        hasDbKey: !!dbApiKey,
        dbKeyLength: dbApiKey?.length,
        hasEnvKey: !!envApiKey,
        envKeyLength: envApiKey?.length,
        hasDefaultKey: !!this.options.defaultSendgridApiKey,
      });
      throw new Error('SendGrid fallback selected but no API key is configured.');
    }
    
    // Log which source is being used (without exposing the key)
    if (dbApiKey && dbApiKey !== '') {
      console.info('[SendGrid] Using API key from database (length:', dbApiKey.length, ')');
    } else if (envApiKey) {
      console.info('[SendGrid] Using API key from environment variable (length:', envApiKey.length, ')');
    } else {
      console.info('[SendGrid] Using default API key from options (length:', this.options.defaultSendgridApiKey?.length, ')');
    }
    
    const sendgridFromEmail = config?.email_from_address ?? this.options.defaultSendgridFromEmail;
    const sendgridFromName = config?.email_from_name ?? this.options.defaultSendgridFromName;

    if (!sendgridFromEmail) {
      throw new Error('SendGrid fallback selected but no from email address is configured.');
    }

    return new SendGridProvider({
      apiKey: sendgridApiKey,
      defaultFromEmail: sendgridFromEmail,
      defaultFromName: sendgridFromName,
    });
  }

  resolveSMSProvider(config?: CommunicationConfig | null) {
    const smsProvider = config?.sms_provider?.toLowerCase();
    const emailProvider = config?.email_provider?.toLowerCase();

    // If SMS provider is explicitly set to Klaviyo, or if email provider is Klaviyo (integrated)
    if (smsProvider === 'klaviyo' || emailProvider === 'klaviyo') {
      const apiKey = config?.email_api_key ?? config?.sms_api_key ?? this.options.defaultKlaviyoApiKey;
      if (apiKey) {
        return new KlaviyoProvider({
          apiKey,
          defaultFromEmail: config?.email_from_address ?? this.options.defaultKlaviyoFromEmail ?? null,
          defaultFromName: config?.email_from_name ?? this.options.defaultKlaviyoFromName ?? null,
        });
      }
      throw new Error('Klaviyo SMS provider selected but no API key is configured.');
    }

    // Otherwise, fall back to Twilio using LiberoVino's account (automatic)
    const accountSid = this.options.defaultTwilioAccountSid ?? process.env.TWILIO_ACCOUNT_SID ?? null;
    const authToken = this.options.defaultTwilioAuthToken ?? process.env.TWILIO_AUTH_TOKEN ?? null;
    const fromNumber = this.options.defaultTwilioFromNumber ?? process.env.TWILIO_FROM_NUMBER ?? null;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('SMS is not available. Twilio fallback is not configured in LiberoVino settings.');
    }

    return new TwilioProvider({
      accountSid,
      authToken,
      defaultFromNumber: fromNumber,
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
    const provider = this.resolveSMSProvider(config);

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
  ): Promise<string | null> {
    const provider = this.resolveEmailProvider(config);
    if (!provider.updateProfile) {
      return null;
    }
    return provider.updateProfile(params);
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
    defaultTwilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    defaultTwilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    defaultTwilioFromNumber: process.env.TWILIO_FROM_NUMBER,
  });
}
