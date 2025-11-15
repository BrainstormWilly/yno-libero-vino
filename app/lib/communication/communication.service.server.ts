import invariant from 'tiny-invariant';

import { getCommunicationConfig } from '~/lib/db/supabase.server';
import type {
  EmailParams,
  EmailResult,
  TrackEventParams,
  TrackEventResult,
} from '~/types/communication';

import { createCommunicationManager, type CommunicationConfig } from './communication-manager.server';
import { KLAVIYO_METRICS } from './klaviyo.constants';
import { MAILCHIMP_TAGS } from './mailchimp.constants';

const communicationManager = createCommunicationManager();

function ensureConfigForEmail(config: CommunicationConfig | null | undefined) {
  invariant(config, 'Communication settings are not configured for this client.');

  if (!config.email_provider) {
    throw new Error('Email provider is not configured.');
  }

  if (config.email_provider === 'klaviyo') {
    if (!config.email_api_key || !config.email_from_address) {
      throw new Error('Klaviyo provider requires API key and from email address.');
    }
  }

  return config;
}

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

export async function sendClientTestEmail(
  clientId: string,
  to: string,
  options?: { subject?: string; html?: string; text?: string }
) {
  const config = ensureConfigForEmail(await getCommunicationConfig(clientId));
  const subject = options?.subject ?? 'LiberoVino Test Email';
  const html =
    options?.html ??
    `<p>This is a test message triggered from your LiberoVino integration. 🎉</p><p>If you received the corresponding Klaviyo flow, your communication setup is working.</p>`;
  const text =
    options?.text ??
    'This is a test message triggered from your LiberoVino integration. If you received the corresponding Klaviyo flow, your communication setup is working.';

  const providerKey = config.email_provider?.toLowerCase();

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
