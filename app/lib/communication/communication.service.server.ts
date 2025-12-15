import { getCommunicationConfig } from '~/lib/db/supabase.server';
import type {
  EmailParams,
  EmailResult,
  TrackEventParams,
  TrackEventResult,
} from '~/types/communication';

import { createCommunicationManager } from './communication-manager.server';
import { KLAVIYO_METRICS } from './klaviyo.constants';
import { MAILCHIMP_TAGS } from './mailchimp.constants';
import { ensureConfigForEmail, ensureConfigForSMS } from './communication-helpers';
import type { SMSParams, SMSResult } from '~/types/communication';

const communicationManager = createCommunicationManager();

export async function getClientCommunicationConfig(clientId: string) {
  return getCommunicationConfig(clientId);
}

export async function sendClientEmail(clientId: string, params: EmailParams): Promise<EmailResult> {
  const config = ensureConfigForEmail(await getCommunicationConfig(clientId));
  const mergedParams = {
    ...params,
    fromEmail: params.fromEmail ?? config.email_from_address ?? undefined,
    fromName: params.fromName ?? config.email_from_name ?? undefined,
  } satisfies EmailParams;

  return communicationManager.sendEmail(config, mergedParams);
}

/**
 * Triggers a provider-specific SMS test.
 * Uses Klaviyo if SMS provider is explicitly set to Klaviyo, or if email provider is Klaviyo (integrated).
 * Otherwise uses Twilio (LiberoVino-managed).
 * For Klaviyo, this publishes the TEST metric; clients wire the SMS step in their flow.
 * For Twilio, this sends a direct SMS message.
 */
export async function sendClientTestSMS(clientId: string, toPhone: string): Promise<SMSResult> {
  const config = await getCommunicationConfig(clientId);
  const smsProvider = config?.sms_provider?.toLowerCase();
  const emailProvider = config?.email_provider?.toLowerCase();

  // If SMS provider is explicitly Klaviyo, or email provider is Klaviyo (integrated)
  if (smsProvider === 'klaviyo' || emailProvider === 'klaviyo') {
    // Use sendSMS with TEST metric tag for consistency
    const smsConfig = ensureConfigForSMS(config);
    const params: SMSParams = {
      to: toPhone,
      message: 'This is a test SMS from LiberoVino. If you received this, your SMS setup is working correctly.',
      tags: [KLAVIYO_METRICS.TEST],
    };
    return communicationManager.sendSMS(smsConfig, params);
  }

  // Otherwise, use Twilio (automatic fallback)
  const smsConfig = ensureConfigForSMS(config);
  const params: SMSParams = {
    to: toPhone,
    message: 'This is a test SMS from LiberoVino. If you received this, your SMS setup is working correctly.',
  };
  return communicationManager.sendSMS(smsConfig, params);
}

export async function sendClientTestEmail(
  clientId: string,
  to: string,
  options?: { subject?: string; html?: string; text?: string }
) {
  const config = ensureConfigForEmail(await getCommunicationConfig(clientId));
  const providerKey = config.email_provider?.toLowerCase();

  // Get provider-specific test email content
  const provider = communicationManager.resolveEmailProvider(config);
  const defaultContent = provider.getTestEmailContent?.() ?? {
    subject: 'LiberoVino Test Email',
    html: '<p>This is a test message from your LiberoVino integration.</p>',
    text: 'This is a test message from your LiberoVino integration.',
  };

  const subject = options?.subject ?? defaultContent.subject;
  const html = options?.html ?? defaultContent.html;
  const text = options?.text ?? defaultContent.text;

  if (providerKey === 'klaviyo') {
    const event: TrackEventParams = {
      event: KLAVIYO_METRICS.TEST,
      customer: {
        email: to,
        id: `test-${clientId}`,
        properties: {
          test_triggered_at: new Date().toISOString(),
          source: 'LiberoVino::send-test',
        },
      },
      properties: {
        subject,
        text_preview: text,
        html_preview: html,
        source: 'LiberoVino::send-test',
      },
    };

    await trackClientEvent(clientId, event);
    return { success: true } satisfies TrackEventResult;
  }

  if (providerKey === 'mailchimp') {
    const event: TrackEventParams = {
      event: MAILCHIMP_TAGS.TEST,
      customer: {
        email: to,
        id: `test-${clientId}`,
        properties: {
          test_triggered_at: new Date().toISOString(),
          source: 'LiberoVino::send-test',
        },
      },
      properties: {
        subject,
        text_preview: text,
        html_preview: html,
        source: 'LiberoVino::send-test',
      },
    };

    await trackClientEvent(clientId, event);
    return { success: true } satisfies TrackEventResult;
  }

  return sendClientEmail(clientId, {
    to,
    subject,
    html,
    text,
  });
}

export async function trackClientEvent(
  clientId: string,
  params: TrackEventParams
): Promise<TrackEventResult> {
  const config = ensureConfigForEmail(await getCommunicationConfig(clientId));
  return communicationManager.trackEvent(config, params);
}

/**
 * Send SMS message to customer
 * Uses the configured SMS provider for the client
 */
export async function sendClientSMS(clientId: string, params: SMSParams): Promise<SMSResult> {
  const config = await getCommunicationConfig(clientId);
  const smsConfig = ensureConfigForSMS(config);
  return communicationManager.sendSMS(smsConfig, params);
}
