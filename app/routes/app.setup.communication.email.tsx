import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, useActionData, useNavigate } from 'react-router';
import { Banner, Box } from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { sendClientTestEmail } from '~/lib/communication/communication.service.server';
import { getEmailProviderComponent } from '~/components/communication/providers';
import { normalizeConfigForCreate } from '~/lib/communication/communication-helpers';
import { seedKlaviyoResources } from '~/lib/communication/klaviyo-seeding.server';
import { addSessionToUrl } from '~/util/session';
import type { Database } from '~/types/supabase';

type ProviderDataJson =
  Database['public']['Tables']['communication_configs']['Insert']['provider_data'];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const client = await db.getClient(session.clientId);
  const existingConfig = await db.getCommunicationConfig(session.clientId);
  
  if (!client) {
    throw new Response('Client not found', { status: 404 });
  }
  
  return {
    session,
    client,
    existingConfig,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  // Handle test email - save config temporarily before testing
  if (intent === 'send_test') {
    const testEmail = formData.get('test_email') as string;
    const testPhone = formData.get('test_phone') as string | null;

    if (!testEmail) {
      return {
        success: false,
        message: 'Enter an email address to send a test message.',
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
        smsProvider?: string | null;
        sendMonthlyStatus?: boolean;
        sendExpirationWarnings?: boolean;
        warningDaysBefore?: number;
        providerData?: ProviderDataJson | null;
      }> = {};
      
      // Read config from form data
      const emailProvider = formData.get('email_provider') as string | null;
      if (emailProvider) configData.emailProvider = emailProvider;
      
      const smsProvider = formData.get('sms_provider') as string | null;
      if (smsProvider) configData.smsProvider = smsProvider;
      
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
        // Extract Klaviyo config from email fields and provider_data
        const apiKey = config.email_api_key;
        const fromEmail = config.email_from_address;
        const fromName = config.email_from_name;
        const providerData = config.provider_data as Record<string, unknown> | null;
        const includeMarketing = (providerData?.includeMarketing as boolean) ?? false;

        if (apiKey && fromEmail) {
          try {
            // Always include SMS when Klaviyo is the email provider
            const includeSMS = true;
            console.log('[Test Email] Seeding Klaviyo resources before test...');
            const seededData = await seedKlaviyoResources({
              apiKey,
              fromEmail,
              fromName: fromName ?? 'LiberoVino',
              includeMarketing,
              includeSMS,
            });
            console.log('[Test Email] Klaviyo resources seeded successfully:', {
              metrics: Object.keys(seededData.metrics || {}),
              templates: Object.keys(seededData.templates || {}),
              flows: Object.keys(seededData.flows || {}),
            });
            // Update config with seeded data
            await db.updateCommunicationConfig(session.clientId, {
              providerData: seededData as unknown as ProviderDataJson,
            });
            console.log('[Test Email] Config updated with seeded data');
          } catch (seedError) {
            console.error('[Test Email] Failed to seed Klaviyo resources before test:', seedError);
            if (seedError instanceof Error) {
              console.error('[Test Email] Error message:', seedError.message);
              console.error('[Test Email] Error stack:', seedError.stack);
            }
            // Continue with test anyway - flows might already exist
          }
        } else {
          console.warn('[Test Email] Missing Klaviyo config - API Key:', !!apiKey, 'From Email:', !!fromEmail);
        }
      }

      try {
        // For Klaviyo, if phone is provided, include it in the test email event
        // so both email and SMS steps in the flow can execute
        if (providerKey === 'klaviyo' && testPhone) {
          // Track event with both email and phone for Klaviyo flows with SMS
          const { trackClientEvent } = await import('~/lib/communication/communication.service.server');
          const { KLAVIYO_METRICS } = await import('~/lib/communication/klaviyo.constants');
          await trackClientEvent(session.clientId, {
            event: KLAVIYO_METRICS.TEST,
            customer: {
              email: testEmail,
              phone: testPhone,
              id: `test-${session.clientId}`,
              properties: {
                test_triggered_at: new Date().toISOString(),
                source: 'LiberoVino::send-test',
              },
            },
            properties: {
              subject: 'LiberoVino Test Email',
              text_preview: 'This is a test message triggered from your LiberoVino integration.',
              html_preview: 'This is a test message triggered from your LiberoVino integration.',
              source: 'LiberoVino::send-test',
            },
          });
        } else {
          // Standard test email (no phone or not Klaviyo)
          await sendClientTestEmail(session.clientId, testEmail);
        }
        
        let smsResult: { success: boolean; message?: string } | null = null;
        if (providerKey === 'klaviyo' && testPhone) {
          // SMS is already included in the event above, so mark as success
          smsResult = { success: true };
        }
        
        let message: string;
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
          message = `Sent test email to ${testEmail}. Check your inbox to confirm delivery.`;
        } else {
          message = `Sent test email to ${testEmail}.`;
        }
        
        // Save confirmation to database
        await db.updateCommunicationConfig(session.clientId, {
          emailProviderConfirmed: true,
        });
        
        return {
          success: true,
          message,
          testResult: {
            success: true,
            message,
          },
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
          testResult: {
            success: false,
            message: fallbackMessage,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save configuration for testing.',
        testResult: {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to save configuration for testing.',
        },
      };
    }
  }

  return {
    success: false,
    message: 'Invalid action',
  };
}

export default function EmailSetup() {
  const { session, existingConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  // Use the provider from config, defaulting to sendgrid only if truly not set
  const provider = (existingConfig?.email_provider as 'klaviyo' | 'mailchimp' | 'sendgrid' | null | undefined) || 'sendgrid';

  // Get the provider-specific component
  const ProviderComponent = getEmailProviderComponent(provider);

  return (
    <>
      {/* Error Messages */}
      {actionData && !actionData.success && actionData.testResult && (
        <Banner tone="critical" title={actionData.testResult.message} />
      )}

      {/* Success Messages */}
      {actionData && actionData.success && actionData.testResult && (
        <Banner tone="success" title={actionData.testResult.message} />
      )}

      {/* Provider-Specific Content (includes form and test email) */}
      <Box paddingBlockStart="400">
        <ProviderComponent 
          existingConfig={existingConfig}
          actionData={actionData ?? null}
          session={session}
          onBack={() => navigate(addSessionToUrl('/app/setup/communication', session.id))}
          onContinue={() => navigate(addSessionToUrl('/app/setup/review', session.id))}
          hasSms={!!existingConfig?.sms_provider}
        />
      </Box>
    </>
  );
}

