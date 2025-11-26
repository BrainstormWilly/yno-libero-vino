import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, useActionData, useNavigate } from 'react-router';
import { Banner, Box, Button, InlineStack, BlockStack } from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { sendClientTestEmail } from '~/lib/communication/communication.service.server';
import { getEmailProviderComponent } from '~/components/communication/providers';
import { normalizeConfigForCreate } from '~/lib/communication/communication-helpers';
import { seedKlaviyoResources } from '~/lib/communication/klaviyo-seeding.server';
import { seedMailchimpResources } from '~/lib/communication/mailchimp-seeding.server';
import { addSessionToUrl } from '~/util/session';
import type { Database } from '~/types/supabase';

type ProviderDataJson =
  Database['public']['Tables']['communication_configs']['Insert']['provider_data'];

const VALID_PROVIDERS = ['klaviyo', 'mailchimp', 'sendgrid'] as const;
type ValidProvider = typeof VALID_PROVIDERS[number];

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const provider = params.provider as string;
  if (!VALID_PROVIDERS.includes(provider as ValidProvider)) {
    throw new Response('Invalid provider', { status: 404 });
  }
  
  const client = await db.getClient(session.clientId);
  const existingConfig = await db.getCommunicationConfig(session.clientId);
  
  if (!client) {
    throw new Response('Client not found', { status: 404 });
  }
  
  return {
    session,
    client,
    provider: provider as ValidProvider,
    existingConfig,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }

  const provider = params.provider as string;
  if (!VALID_PROVIDERS.includes(provider as ValidProvider)) {
    throw new Response('Invalid provider', { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  // Handle confirm provider - save config temporarily before testing
  if (intent === 'confirm_provider') {
    const testEmail = formData.get('test_email') as string;
    const testPhone = formData.get('test_phone') as string | null;

    if (!testEmail) {
      return {
        success: false,
        message: 'Enter an email address to confirm your provider.',
      };
    }

    // Save config from form data before testing (temporary save for testing)
    try {
      const existingConfig = await db.getCommunicationConfig(session.clientId);
      
      const configData: Partial<{
        emailProvider: string;
        emailApiKey?: string | null;
        emailFromAddress?: string | null;
        emailFromName?: string | null;
        emailListId?: string | null;
        sendMonthlyStatus?: boolean;
        sendExpirationWarnings?: boolean;
        warningDaysBefore?: number;
        providerData?: ProviderDataJson | null;
      }> = {};
      
      // Read config from form data
      const emailProvider = formData.get('email_provider') as string | null;
      const previousProvider = existingConfig?.email_provider?.toLowerCase();
      const newProvider = emailProvider?.toLowerCase();
      const isProviderChanging = existingConfig && previousProvider !== newProvider;
      
      if (emailProvider) configData.emailProvider = emailProvider;

      // If switching providers, clear provider-specific data
      if (isProviderChanging) {
        // Clear Mailchimp-specific fields when switching away
        if (previousProvider === 'mailchimp') {
          configData.emailListId = null;
          configData.providerData = {}; // provider_data is NOT NULL, use empty object
        }
        // Clear Klaviyo-specific fields when switching away
        if (previousProvider === 'klaviyo') {
          configData.providerData = {}; // provider_data is NOT NULL, use empty object
        }
        // Clear API keys when switching to SendGrid (uses env vars)
        if (newProvider === 'sendgrid') {
          configData.emailApiKey = null;
        }
      }

      const emailApiKey = formData.get('email_api_key') as string | null;
      if (emailApiKey !== null) configData.emailApiKey = emailApiKey || null;

      const emailFromAddress = formData.get('email_from_address') as string | null;
      if (emailFromAddress !== null) configData.emailFromAddress = emailFromAddress || null;

      const emailFromName = formData.get('email_from_name') as string | null;
      if (emailFromName !== null) configData.emailFromName = emailFromName || null;

      const emailListId = formData.get('email_list_id') as string | null;
      if (emailListId !== null) configData.emailListId = emailListId || null;

      const sendMonthlyStatus = formData.get('send_monthly_status');
      if (sendMonthlyStatus !== null) configData.sendMonthlyStatus = sendMonthlyStatus === 'true';

      const sendExpirationWarnings = formData.get('send_expiration_warnings');
      if (sendExpirationWarnings !== null) configData.sendExpirationWarnings = sendExpirationWarnings === 'true';

      const warningDaysBefore = formData.get('warning_days_before');
      if (warningDaysBefore !== null) configData.warningDaysBefore = parseInt(warningDaysBefore as string, 10) || 7;

      // Provider data (JSON string)
      const providerDataStr = formData.get('provider_data') as string | null;
      if (providerDataStr) {
        try {
          configData.providerData = JSON.parse(providerDataStr) as ProviderDataJson;
        } catch (e) {
          // Invalid JSON, skip
        }
      }
      
      // Save config temporarily for testing
      if (existingConfig) {
        await db.updateCommunicationConfig(session.clientId, configData);
      } else if (emailProvider) {
        await db.createCommunicationConfig(
          session.clientId,
          normalizeConfigForCreate(
            {
              emailProvider,
              ...configData,
            },
            'sendgrid'
          )
        );
      }
      
      // Now run the test with the saved config
      const config = await db.getCommunicationConfig(session.clientId);
      const providerKey = config?.email_provider?.toLowerCase();

      // If Klaviyo, ensure flows are created before testing
      if (providerKey === 'klaviyo' && config) {
        const apiKey = config.email_api_key;
        const fromEmail = config.email_from_address;
        const fromName = config.email_from_name;
        const providerData = config.provider_data as Record<string, unknown> | null;
        const includeMarketing = (providerData?.includeMarketing as boolean) ?? false;

        if (apiKey && fromEmail) {
          try {
            // Always include SMS when Klaviyo is the email provider
            const includeSMS = true;
            const seededData = await seedKlaviyoResources({
              apiKey,
              fromEmail,
              fromName: fromName ?? 'LiberoVino',
              includeMarketing,
              includeSMS,
            });
            // Update config with seeded data
            await db.updateCommunicationConfig(session.clientId, {
              providerData: seededData as unknown as ProviderDataJson,
            });
          } catch (seedError) {
            console.error('[Confirm Provider] Failed to seed Klaviyo resources:', seedError);
            return {
              success: false,
              message: `Failed to prepare Klaviyo flows: ${seedError instanceof Error ? seedError.message : String(seedError)}`,
            };
          }
        }
      }

      // If Mailchimp, ensure audience and templates are created before testing
      if (providerKey === 'mailchimp' && config) {
        const providerData = config.provider_data as Record<string, unknown> | null;
        const serverPrefix = providerData?.serverPrefix as string | null | undefined;
        const marketingAccessToken = providerData?.marketingAccessToken as string | null | undefined;
        const fromEmail = config.email_from_address;
        const fromName = config.email_from_name;
        const audienceName = providerData?.audienceName as string | null | undefined;
        const includeMarketing = (providerData?.includeMarketing as boolean) ?? false;

        if (serverPrefix && marketingAccessToken && fromEmail) {
          try {
            // Get client for contact address
            const client = await db.getClient(session.clientId);
            
            // Build contact address (use defaults if client doesn't have address info)
            const contact = {
              company: client?.org_name ?? 'LiberoVino Client',
              address1: '123 Winery Way',
              address2: '',
              city: 'Napa',
              state: 'CA',
              zip: '94558',
              country: 'US',
              phone: undefined as string | undefined,
            };

            const seededData = await seedMailchimpResources({
              serverPrefix,
              marketingAccessToken,
              fromEmail,
              fromName: fromName ?? 'LiberoVino',
              includeMarketing,
              audienceName: audienceName && audienceName.trim() ? audienceName.trim() : undefined,
              permissionReminder: 'You are receiving this email because you opted into the LiberoVino membership updates.',
              contact,
            });
            
            // Update config with seeded data including audienceId
            await db.updateCommunicationConfig(session.clientId, {
              emailListId: seededData.audienceId ?? config.email_list_id,
              providerData: seededData as unknown as ProviderDataJson,
            });
          } catch (seedError) {
            console.error('[Confirm Provider] Failed to seed Mailchimp resources:', seedError);
            return {
              success: false,
              message: `Failed to prepare Mailchimp resources: ${seedError instanceof Error ? seedError.message : String(seedError)}`,
            };
          }
        }
      }

      try {
        await sendClientTestEmail(session.clientId, testEmail);
        
        // Save confirmation to database
        await db.updateCommunicationConfig(session.clientId, {
          emailProviderConfirmed: true,
        });
        
        let message: string;
        let smsResult: { success: boolean; message?: string } | null = null;
        
        // Send SMS test if phone number is provided
        if (testPhone) {
          const { sendClientTestSMS } = await import('~/lib/communication/communication.service.server');
          try {
            smsResult = await sendClientTestSMS(session.clientId, testPhone);
          } catch (smsError) {
            smsResult = {
              success: false,
              message: smsError instanceof Error ? smsError.message : 'Failed to send test SMS',
            };
          }
        }
        
        if (providerKey === 'klaviyo') {
          if (testPhone && smsResult?.success) {
            message = `Triggered the Klaviyo test flow for ${testEmail} and ${testPhone}. The flow includes both email and SMS steps. Make sure "LiberoVino – Test Flow" is set to Live in Klaviyo to see the messages.`;
          } else if (testPhone && !smsResult?.success) {
            message = `Triggered the Klaviyo test flow for ${testEmail}. SMS test failed: ${smsResult?.message || 'Unknown error'}. Make sure "LiberoVino – Test Flow" is set to Live in Klaviyo.`;
          } else {
            message = `Triggered the Klaviyo test flow for ${testEmail}. Make sure "LiberoVino – Test Flow" is set to Live in Klaviyo to see the message.`;
          }
        } else if (providerKey === 'mailchimp') {
          message = `Triggered the Mailchimp test tag for ${testEmail}. Check your LiberoVino test flow to confirm delivery.`;
        } else if (providerKey === 'sendgrid') {
          if (testPhone && smsResult?.success) {
            message = `Sent test email to ${testEmail} and test SMS to ${testPhone}. Check your inbox and phone to confirm delivery. Allow 5-10 minutes.`;
          } else if (testPhone && !smsResult?.success) {
            message = `Sent test email to ${testEmail}. SMS test failed: ${smsResult?.message || 'Unknown error'}. Check your inbox to confirm email delivery. Allow 5-10 minutes.`;
          } else {
            message = `Sent test email to ${testEmail}. Check your inbox to confirm delivery. Allow 5-10 minutes.`;
          }
        } else {
          message = `Sent test email to ${testEmail}.`;
        }
        return {
          success: true,
          message,
          confirmed: true,
        };
      } catch (error) {
        let fallbackMessage: string;
        if (providerKey === 'klaviyo') {
          fallbackMessage =
            'Unable to trigger the Klaviyo test flow. Confirm the "LiberoVino – Test Flow" exists and is set to Live, then try again.';
        } else if (providerKey === 'mailchimp') {
          fallbackMessage =
            'Unable to trigger the Mailchimp test automation. Confirm the audience and templates are seeded and that your LiberoVino test flow is active.';
        } else if (providerKey === 'sendgrid') {
          fallbackMessage =
            error instanceof Error ? `Error: ${error.message}` : 'Failed to send test email. Please check your configuration.';
        } else {
          fallbackMessage =
            error instanceof Error ? error.message : 'Failed to send test email. Please check your configuration.';
        }
        return {
          success: false,
          message: fallbackMessage,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save configuration for testing.',
      };
    }
  }

  return {
    success: false,
    message: 'Invalid action',
  };
}

export default function ProviderSetup() {
  const { session, provider, existingConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  // Initialize from database - check if provider is already confirmed
  const isConfirmedFromDB = existingConfig?.email_provider_confirmed ?? false;
  const isConfirmedFromAction = actionData?.success && actionData.confirmed === true;
  const isConfirmed = isConfirmedFromDB || isConfirmedFromAction;

  // Handle navigation to templates
  const handleContinue = () => {
    const url = addSessionToUrl('/app/setup/communication/templates', session.id);
    navigate(url);
  };

  // Get the provider-specific component
  const EmailProviderComponent = getEmailProviderComponent(provider);
  
  // For LV-managed, also show SMS option if configured
  const showSMS = provider === 'sendgrid' && existingConfig?.sms_provider === 'twilio';

  return (
    <>
      {/* Navigation Buttons at Top */}
      <Box paddingBlockEnd="400">
        <InlineStack align="space-between">
          <Button
            onClick={() => navigate(addSessionToUrl('/app/setup/communication', session.id))}
          >
            ← Back to Providers
          </Button>
          
          <Button
            variant="primary"
            size="large"
            onClick={handleContinue}
            disabled={!isConfirmed}
          >
            Continue to Templates →
          </Button>
        </InlineStack>
      </Box>

      {/* Provider-Specific Content */}
      <Box paddingBlockStart="400">
        <EmailProviderComponent 
          existingConfig={existingConfig}
          actionData={actionData ?? null}
          session={session}
          onBack={() => {}}
          onContinue={() => navigate(addSessionToUrl('/app/setup/communication/templates', session.id))}
          hasSms={showSMS}
        />
      </Box>
    </>
  );
}

