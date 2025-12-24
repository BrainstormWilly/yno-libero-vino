import invariant from 'tiny-invariant';
import type { Database } from '~/types/supabase';

import type { CommunicationConfig } from './communication-manager.server';

type ProviderDataJson =
  Database['public']['Tables']['communication_configs']['Insert']['provider_data'];

/**
 * Config data type that allows null values (from form data)
 */
export type CommunicationConfigInput = {
  emailProvider?: string;
  emailApiKey?: string | null;
  emailFromAddress?: string | null;
  emailFromName?: string | null;
  emailListId?: string | null;
  smsProvider?: string | null;
  smsApiKey?: string | null;
  smsFromNumber?: string | null;
  sendMonthlyStatus?: boolean;
  sendExpirationWarnings?: boolean;
  warningDaysBefore?: number;
  providerData?: ProviderDataJson | null;
};

/**
 * Config data type for createCommunicationConfig (doesn't accept null)
 */
export type CommunicationConfigForCreate = {
  emailProvider: string;
  emailApiKey?: string;
  emailFromAddress?: string;
  emailFromName?: string;
  emailListId?: string;
  smsProvider?: string;
  smsApiKey?: string;
  smsFromNumber?: string;
  sendMonthlyStatus?: boolean;
  sendExpirationWarnings?: boolean;
  warningDaysBefore?: number;
  providerData?: ProviderDataJson;
};

/**
 * Normalizes communication config data by converting null to undefined.
 * This is needed because createCommunicationConfig doesn't accept null values.
 */
export function normalizeConfigForCreate(
  config: CommunicationConfigInput,
  defaultEmailProvider: string = 'sendgrid'
): CommunicationConfigForCreate {
  return {
    emailProvider: config.emailProvider || defaultEmailProvider,
    emailApiKey: config.emailApiKey ?? undefined,
    emailFromAddress: config.emailFromAddress ?? undefined,
    emailFromName: config.emailFromName ?? undefined,
    emailListId: config.emailListId ?? undefined,
    smsProvider: config.smsProvider ?? undefined,
    smsApiKey: config.smsApiKey ?? undefined,
    smsFromNumber: config.smsFromNumber ?? undefined,
    sendMonthlyStatus: config.sendMonthlyStatus,
    sendExpirationWarnings: config.sendExpirationWarnings,
    warningDaysBefore: config.warningDaysBefore,
    providerData: config.providerData ?? ({} as ProviderDataJson),
  };
}

/**
 * Validates that a communication config exists and has an email provider configured.
 * Throws descriptive errors if validation fails.
 */
export function ensureConfigForEmail(config: CommunicationConfig | null | undefined): CommunicationConfig {
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

/**
 * Validates that a communication config exists.
 * SMS provider is automatically selected (Klaviyo if email is Klaviyo, otherwise Twilio fallback).
 * Throws descriptive errors if validation fails.
 */
export function ensureConfigForSMS(config: CommunicationConfig | null | undefined): CommunicationConfig {
  invariant(config, 'Communication settings are not configured for this client.');
  // SMS provider is automatically resolved, no need to validate sms_provider field
  return config;
}

/**
 * Determines which SMS provider will be used for a given communication config.
 * Returns 'klaviyo' if email provider is Klaviyo, otherwise 'twilio' (LiberoVino-managed fallback).
 * 
 * This matches the logic in CommunicationManager.resolveSMSProvider().
 */
export function getSMSProvider(config: CommunicationConfig | null | undefined): 'klaviyo' | 'twilio' {
  // If client has Klaviyo email configured, use Klaviyo SMS (integrated)
  if (config?.email_provider?.toLowerCase() === 'klaviyo') {
    return 'klaviyo';
  }

  // Otherwise, fall back to Twilio (LiberoVino-managed)
  return 'twilio';
}

