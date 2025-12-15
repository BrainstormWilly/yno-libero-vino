/**
 * SMS Opt-In Service
 * Handles sending opt-in requests and confirming opt-ins for TCPA compliance
 */

import * as db from '~/lib/db/supabase.server';
import { sendClientSMS } from './communication.service.server';
import type { CommunicationPreferences } from './preferences';

/**
 * Send SMS opt-in confirmation request to customer
 * Called during club signup if customer has phone and SMS preferences enabled
 */
export async function sendSMSOptInRequest(
  clientId: string,
  customerId: string,
  phone: string,
  clientName?: string | null
): Promise<void> {
  try {
    const wineryName = clientName || 'Your winery';
    
    // TCPA-compliant opt-in message
    const message = `${wineryName}: Thanks for joining! Reply YES to receive SMS updates about your membership. Msg & data rates may apply. Reply STOP to opt-out anytime.`;

    // Send the opt-in request SMS
    await sendClientSMS(clientId, {
      to: phone,
      message,
      tags: ['sms-opt-in-request'],
    });

    // Update preferences to track that we sent the request
    const preferences = await db.getCommunicationPreferences(customerId);
    await db.upsertCommunicationPreferences(customerId, {
      ...preferences,
      smsOptInRequestSentAt: new Date().toISOString(),
    });

    console.info(`SMS opt-in request sent to ${phone} for customer ${customerId}`);
  } catch (error) {
    // Log but don't fail enrollment if SMS opt-in request fails
    console.warn(`Failed to send SMS opt-in request to ${phone}:`, error);
  }
}

/**
 * Confirm SMS opt-in (called when customer replies YES or confirms via web)
 * Enables transactional SMS (monthly status and expiration warnings)
 */
export async function confirmSMSOptIn(
  customerId: string,
  method: 'text_reply' | 'web_form' = 'text_reply'
): Promise<void> {
  const preferences = await db.getCommunicationPreferences(customerId);
  
  await db.upsertCommunicationPreferences(customerId, {
    ...preferences,
    smsTransactional: true, // Enable transactional SMS (monthly status and expiration warnings)
    smsOptedInAt: preferences.smsOptedInAt || new Date().toISOString(),
    smsOptInMethod: method,
    smsOptInConfirmedAt: new Date().toISOString(),
  });
}

/**
 * Check if we should send SMS opt-in request during signup
 */
export function shouldSendSMSOptIn(
  phone: string | null | undefined,
  preferences: { smsTransactional?: boolean; smsMarketing?: boolean }
): boolean {
  if (!phone) return false;
  
  // Send if any SMS preference is enabled
  return !!(
    preferences.smsTransactional ||
    preferences.smsMarketing
  );
}

