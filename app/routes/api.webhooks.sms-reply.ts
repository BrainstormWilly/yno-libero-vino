/**
 * SMS Reply Webhook Endpoint
 * Handles incoming SMS replies from SendGrid, Klaviyo, and Mailchimp
 * POST /api/webhooks/sms-reply
 * 
 * Provider-specific webhook formats:
 * - SendGrid: Uses Twilio webhook format (if SendGrid SMS is via Twilio)
 * - Klaviyo: Klaviyo SMS webhook format
 * - Mailchimp: Mailchimp SMS webhook format (if applicable)
 */

import type { ActionFunctionArgs } from 'react-router';
import * as db from '~/lib/db/supabase.server';
import { getSupabaseClient } from '~/lib/db/supabase.server';
import { confirmSMSOptIn } from '~/lib/communication/sms-opt-in.server';
import { normalizePhoneNumber } from '~/util/phone.utils';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    
    // Determine provider from headers or payload
    const provider = detectProvider(request, body);
    
    // Parse webhook based on provider
    const smsData = parseSMSWebhook(provider, body, request);
    
    if (!smsData) {
      console.warn('Could not parse SMS webhook:', { provider, body });
      return Response.json({ success: false, error: 'Invalid webhook format' }, { status: 400 });
    }

    // Normalize phone number
    const normalizedPhone = normalizePhoneNumber(smsData.from);
    
    // Find customer by phone number
    const customer = await findCustomerByPhone(normalizedPhone);
    
    if (!customer) {
      console.warn(`No customer found for phone: ${normalizedPhone}`);
      return Response.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    // Process the reply
    const message = smsData.message.trim().toUpperCase();
    
    if (message === 'YES' || message === 'Y' || message.startsWith('YES')) {
      // Confirm opt-in
      await confirmSMSOptIn(customer.id, 'text_reply');
      console.info(`SMS opt-in confirmed for customer ${customer.id} via ${provider}`);
      
      return Response.json({ 
        success: true, 
        message: 'Opt-in confirmed',
        customerId: customer.id 
      });
    } else if (message === 'STOP' || message === 'UNSUBSCRIBE' || message === 'QUIT') {
      // Handle opt-out - disable both transactional and marketing SMS
      await db.upsertCommunicationPreferences(customer.id, {
        smsTransactional: false,
        smsMarketing: false,
      });
      console.info(`SMS opt-out processed for customer ${customer.id} via ${provider}`);
      
      return Response.json({ 
        success: true, 
        message: 'Opt-out processed',
        customerId: customer.id 
      });
    } else {
      // Unknown command - log but don't error
      console.info(`Unknown SMS command from ${normalizedPhone}: ${message}`);
      return Response.json({ 
        success: true, 
        message: 'Message received',
        note: 'Unknown command' 
      });
    }

  } catch (error) {
    console.error('SMS webhook error:', error);
    return Response.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Detect which provider sent the webhook
 */
function detectProvider(request: Request, body: any): 'sendgrid' | 'klaviyo' | 'mailchimp' {
  // Check headers first
  const userAgent = request.headers.get('user-agent') || '';
  
  // Klaviyo webhooks
  if (userAgent.includes('Klaviyo') || body.data?.type === 'sms-received') {
    return 'klaviyo';
  }
  
  // Mailchimp webhooks
  if (userAgent.includes('Mailchimp') || body.type === 'sms') {
    return 'mailchimp';
  }
  
  // SendGrid/Twilio webhooks (SendGrid SMS typically uses Twilio)
  if (body.MessageSid || body.SmsSid || body.AccountSid) {
    return 'sendgrid';
  }
  
  // Default to SendGrid if we can't determine
  return 'sendgrid';
}

/**
 * Parse webhook payload based on provider
 */
function parseSMSWebhook(
  provider: 'sendgrid' | 'klaviyo' | 'mailchimp',
  body: any,
  request: Request
): { from: string; message: string; provider: string } | null {
  switch (provider) {
    case 'sendgrid':
      // SendGrid/Twilio webhook format
      return {
        from: body.From || body.from,
        message: body.Body || body.message || body.MessageText || '',
        provider: 'sendgrid',
      };
      
    case 'klaviyo':
      // Klaviyo SMS webhook format
      // Klaviyo sends webhooks in their standard format
      const attributes = body.data?.attributes || body.attributes || {};
      return {
        from: attributes.phone_number || attributes.from || body.phone || '',
        message: attributes.message || attributes.body || body.message || '',
        provider: 'klaviyo',
      };
      
    case 'mailchimp':
      // Mailchimp SMS webhook format
      // Note: Mailchimp SMS may use different format - adjust based on actual webhook
      return {
        from: body.phone || body.from || body.data?.phone || '',
        message: body.message || body.text || body.data?.message || '',
        provider: 'mailchimp',
      };
      
    default:
      return null;
  }
}

/**
 * Find customer by phone number
 */
async function findCustomerByPhone(phone: string) {
  const supabase = getSupabaseClient();
  
  // Try exact match first
  const { data: customer } = await supabase
    .from('customers')
    .select('id, phone, client_id')
    .eq('phone', phone)
    .maybeSingle();
  
  if (customer) return customer;
  
  // Try with + prefix
  const phoneWithPlus = phone.startsWith('+') ? phone : `+${phone}`;
  const { data: customer2 } = await supabase
    .from('customers')
    .select('id, phone, client_id')
    .eq('phone', phoneWithPlus)
    .maybeSingle();
  
  return customer2 || null;
}

