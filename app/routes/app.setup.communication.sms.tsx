import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, useActionData, useNavigate } from 'react-router';
import { Banner, Box } from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { sendClientTestSMS } from '~/lib/communication/communication.service.server';
import { getSMSProviderComponent } from '~/components/communication/providers';
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

// Handle test SMS - save config temporarily before testing
export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'send_test_sms') {
    const testPhone = formData.get('test_phone') as string;
    if (!testPhone) {
      return {
        success: false,
        message: 'Enter a phone number to send a test SMS.',
      };
    }

    // Save config from form data before testing (temporary save for testing)
    try {
      const existingConfig = await db.getCommunicationConfig(session.clientId);
      
      const configData: Partial<{
        smsProvider?: string | null;
        smsApiKey?: string | null;
        smsFromNumber?: string | null;
        emailProvider?: string;
        emailApiKey?: string | null;
        emailFromAddress?: string | null;
        emailFromName?: string | null;
        providerData?: ProviderDataJson | null;
        smsProviderConfirmed?: boolean;
      }> = {};
      
      // Read SMS config from form data
      const smsProvider = formData.get('sms_provider') as string | null;
      const previousSmsProvider = existingConfig?.sms_provider?.toLowerCase();
      const newSmsProvider = smsProvider?.toLowerCase();
      const isSmsProviderChanging = existingConfig && previousSmsProvider !== newSmsProvider;
      
      if (smsProvider) configData.smsProvider = smsProvider;
      
      // Reset confirmed flag when SMS provider changes
      if (isSmsProviderChanging) {
        configData.smsProviderConfirmed = false;
      }
      
      const smsApiKey = formData.get('sms_api_key') as string | null;
      if (smsApiKey !== null) configData.smsApiKey = smsApiKey || null;
      
      const smsFromNumber = formData.get('sms_from_number') as string | null;
      if (smsFromNumber !== null) configData.smsFromNumber = smsFromNumber || null;
      
      // Also preserve email provider and fields if they exist (needed for Klaviyo SMS)
      const emailProvider = formData.get('email_provider') as string | null;
      if (emailProvider) configData.emailProvider = emailProvider;
      
      const emailApiKey = formData.get('email_api_key') as string | null;
      if (emailApiKey !== null) configData.emailApiKey = emailApiKey || null;
      
      const emailFromAddress = formData.get('email_from_address') as string | null;
      if (emailFromAddress !== null) configData.emailFromAddress = emailFromAddress || null;
      
      const emailFromName = formData.get('email_from_name') as string | null;
      if (emailFromName !== null) configData.emailFromName = emailFromName || null;
      
      // Preserve provider_data if it exists
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
      } else if (smsProvider) {
        await db.createCommunicationConfig(
          session.clientId,
          normalizeConfigForCreate(
            {
              emailProvider: emailProvider || 'sendgrid',
              ...configData,
            },
            'sendgrid'
          )
        );
      }
      
      // Now run the test with the saved config
      const config = await db.getCommunicationConfig(session.clientId);
      const smsProviderKey = config?.sms_provider?.toLowerCase();

      // Update Klaviyo flows to include SMS if email provider is Klaviyo
      // (Klaviyo SMS is integrated with email, so if email is Klaviyo, we can use Klaviyo SMS)
      console.log('[SMS Test] Checking if Klaviyo flow update needed...');
      console.log('[SMS Test] Email provider:', config?.email_provider);
      console.log('[SMS Test] SMS provider:', smsProviderKey);
      
      if (config?.email_provider?.toLowerCase() === 'klaviyo') {
        console.log('[SMS Test] Email provider is Klaviyo, updating flows to include SMS...');
        
        // Extract Klaviyo config from email fields and provider_data
        const apiKey = config.email_api_key;
        const fromEmail = config.email_from_address;
        const fromName = config.email_from_name;
        
        // Get includeMarketing from provider_data if available
        const providerData = config.provider_data as Record<string, unknown> | null;
        const includeMarketing = (providerData?.includeMarketing as boolean) ?? false;
        
        console.log('[SMS Test] Klaviyo config - API Key:', apiKey ? '***' : 'missing');
        console.log('[SMS Test] Klaviyo config - From Email:', fromEmail);
        console.log('[SMS Test] Klaviyo config - From Name:', fromName);
        console.log('[SMS Test] Klaviyo config - Include Marketing:', includeMarketing);

        if (apiKey && fromEmail) {
          console.log('[SMS Test] Klaviyo config found, calling seedKlaviyoResources with includeSMS=true');
          try {
            const seededData = await seedKlaviyoResources({
              apiKey,
              fromEmail,
              fromName: fromName ?? 'LiberoVino',
              includeMarketing,
              includeSMS: true, // Always include SMS since we're testing SMS
            });

            console.log('[SMS Test] seedKlaviyoResources completed, updating config...');
            // Update config with seeded data
            await db.updateCommunicationConfig(session.clientId, {
              providerData: seededData as unknown as ProviderDataJson,
            });
            console.log('[SMS Test] Config updated with seeded data');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.warn('[SMS Test] Note: Klaviyo API does not support updating existing flows.');
            console.warn('[SMS Test] Flows must be manually updated in Klaviyo UI to add SMS steps.');
            console.warn('[SMS Test] Error details:', errorMessage);
            // Continue with test anyway - flows might already have SMS steps added manually
          }
        } else {
          console.log('[SMS Test] Klaviyo config incomplete - API Key:', !!apiKey, 'From Email:', !!fromEmail);
        }
      } else {
        console.log('[SMS Test] Skipping flow update - email provider:', config?.email_provider, 'SMS provider:', smsProviderKey);
      }

      try {
        await sendClientTestSMS(session.clientId, testPhone);
        
        // Save confirmation to database
        await db.updateCommunicationConfig(session.clientId, {
          smsProviderConfirmed: true,
        });
        
        let message: string;
        if (smsProviderKey === 'klaviyo') {
          message =
            'Triggered the Klaviyo test SMS. Note: Klaviyo API does not support updating flows automatically. If your TEST flow does not have an SMS step, please add it manually in the Klaviyo UI.';
        } else {
          message = `Sent test SMS to ${testPhone} via LiberoVino Managed.`;
        }
        return {
          success: true,
          message,
          testResult: {
            success: true,
            message,
          },
        };
      } catch (error) {
        return {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Failed to send test SMS. Please check your configuration.',
          testResult: {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : 'Failed to send test SMS. Please check your configuration.',
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

export default function SMSSetup() {
  const { session, existingConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  const smsProvider = existingConfig?.sms_provider || 'twilio';

  // Get the provider-specific component
  const ProviderComponent = getSMSProviderComponent(smsProvider as 'klaviyo' | 'mailchimp' | 'redchirp' | 'twilio');

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

      {/* Provider-Specific Content (includes form and test SMS) */}
      <Box paddingBlockStart="400">
        <ProviderComponent 
          existingConfig={existingConfig}
          actionData={actionData ?? null}
          session={session}
          onBack={() => navigate(addSessionToUrl('/app/setup/communication', session.id))}
          onContinue={() => navigate(addSessionToUrl('/app/setup/review', session.id))}
          hasEmail={!!existingConfig?.email_provider}
        />
      </Box>
    </>
  );
}

