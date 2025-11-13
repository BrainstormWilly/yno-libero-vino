import invariant from 'tiny-invariant';

import { getCommunicationConfig } from '~/lib/db/supabase.server';
import type {
  EmailParams,
  EmailResult,
  TrackEventParams,
  TrackEventResult,
} from '~/types/communication';

import { createCommunicationManager, type CommunicationConfig } from './communication-manager.server';

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
  const subject = options?.subject ?? 'LiberoVino Test Email';
  const html =
    options?.html ??
    `<p>This is a test email sent from your LiberoVino/Klaviyo integration. 🎉</p><p>If you received this, your communication setup is working.</p>`;
  const text =
    options?.text ??
    'This is a test email sent from your LiberoVino/Klaviyo integration. If you received this, your communication setup is working.';

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
