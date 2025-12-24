import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useNavigate, useLoaderData, useActionData, Form } from 'react-router';
import { useEffect , useState } from 'react';
import { 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  Checkbox,
  InlineStack,
  Box,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { addSessionToUrl } from '~/util/session';
import { normalizeConfigForCreate } from '~/lib/communication/communication-helpers';
import type { CommunicationConfig } from '~/lib/communication';

export async function loader({ request }: LoaderFunctionArgs) {
  // Re-export parent loader data (same as parent route)
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

  if (intent === 'save_providers') {
    const emailProvider = formData.get('email_provider') as string | null;
    const smsProvider = formData.get('sms_provider') as string | null;

    if (!emailProvider) {
      return {
        success: false,
        message: 'Email provider is required.',
      };
    }

    try {
      const existingConfig = await db.getCommunicationConfig(session.clientId);
      const previousEmailProvider = existingConfig?.email_provider?.toLowerCase();
      const previousSmsProvider = existingConfig?.sms_provider?.toLowerCase();
      const newEmailProvider = emailProvider?.toLowerCase();
      const isSwitchingFromSendGrid = previousEmailProvider === 'sendgrid' && newEmailProvider !== 'sendgrid';
      
      // Clear SMS provider when switching away from SendGrid (Mailchimp/Klaviyo handle SMS in their own accounts)
      let finalSmsProvider = smsProvider || null;
      if (isSwitchingFromSendGrid) {
        finalSmsProvider = null;
      } else if (newEmailProvider !== 'sendgrid') {
        // If not SendGrid, don't allow SMS provider selection (Mailchimp/Klaviyo handle SMS separately)
        finalSmsProvider = null;
      }

      // Reset confirmed flags when providers change
      const emailProviderChanged = previousEmailProvider !== newEmailProvider;
      const smsProviderChanged = previousSmsProvider !== finalSmsProvider?.toLowerCase();

      // Clear provider-specific data when switching providers
      const updateData: Parameters<typeof db.updateCommunicationConfig>[1] = {
        emailProvider,
        smsProvider: finalSmsProvider,
        emailProviderConfirmed: emailProviderChanged ? false : undefined,
        smsProviderConfirmed: smsProviderChanged ? false : undefined,
      };

      // Clear email_api_key when switching to SendGrid (uses env var)
      if (newEmailProvider === 'sendgrid') {
        updateData.emailApiKey = null;
      }
      
      // Clear provider_data when switching away from Klaviyo or Mailchimp
      if (emailProviderChanged) {
        if (previousEmailProvider === 'klaviyo' || previousEmailProvider === 'mailchimp') {
          updateData.providerData = {}; // provider_data is NOT NULL, use empty object
        }
        // Clear email_list_id when switching away from Mailchimp/Klaviyo
        if (previousEmailProvider === 'mailchimp' || previousEmailProvider === 'klaviyo') {
          updateData.emailListId = null;
        }
      }

      if (existingConfig) {
        // Update existing config
        await db.updateCommunicationConfig(session.clientId, updateData);
      } else {
        // Create new config
        await db.createCommunicationConfig(
          session.clientId,
          normalizeConfigForCreate(
            {
              emailProvider,
              smsProvider: finalSmsProvider || undefined,
            },
            'sendgrid'
          )
        );
      }

      console.log('[Communication Setup] Provider saved successfully:', { emailProvider, smsProvider });
      return {
        success: true,
        emailProvider,
        smsProvider,
      };
    } catch (error) {
      console.error('[Communication Setup] Error saving provider selection:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save provider selection.',
      };
    }
  }

  return {
    success: false,
    message: 'Invalid action',
  };
}


export default function CommunicationProviderSelection() {
  const { session, existingConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();

  // Use local state initialized from loader data to avoid hydration issues
  const [emailProvider, setEmailProvider] = useState<string | null>(
    existingConfig?.email_provider ?? null
  );
  const [smsProvider, setSmsProvider] = useState<string | null>(
    existingConfig?.sms_provider ?? null
  );
  const [isDirty, setIsDirty] = useState(false);

  // Sync state with loader data when navigating back
  // useEffect(() => {
  //   setEmailProvider(getDisplayEmailProvider(existingConfig?.email_provider));
  //   setSmsProvider(getDisplaySmsProvider(existingConfig?.sms_provider));
  // }, [existingConfig?.email_provider, existingConfig?.sms_provider]);

  const emailChoices = [
    {
      label: 'Klaviyo',
      value: 'klaviyo',
      helpText: 'Use your own Klaviyo account for advanced email marketing and automation',
    },
    {
      label: 'Mailchimp',
      value: 'mailchimp',
      helpText: 'Connect your Mailchimp account for audience management and automations',
    },
    {
      label: 'LiberoVino Managed',
      value: 'sendgrid',
      helpText: 'LiberoVino will handle all email sending. No setup or additional accounts needed.',
    },
  ];

  const smsChoices = [
    {
      label: 'LiberoVino Managed',
      value: 'twilio',
      helpText: 'LiberoVino will handle all SMS sending. No setup or additional accounts needed.',
    },
  ];

  // Normalize "none" to actual provider values
  // const getEmailProviderValue = () => {
  //   return emailProvider === 'none' ? 'sendgrid' : emailProvider || '';
  // };

  // const getSmsProviderValue = () => {
  //   return smsProvider === 'none' ? 'twilio' : smsProvider || '';
  // };

  const hasSelection = Boolean(emailProvider || smsProvider);
  const canProceed = hasSelection;
  const showWarning = isDirty && !hasSelection;

  // Navigate after successful save
  useEffect(() => {
    if (actionData?.success && actionData.emailProvider) {
      const targetUrl = addSessionToUrl(`/app/setup/communication/${actionData.emailProvider}`, session.id);
      console.log('[Communication Setup] Navigating to provider setup:', targetUrl);
      navigate(targetUrl);
    } else if (actionData && !actionData.success) {
      console.error('[Communication Setup] Action failed:', actionData.message || 'Unknown error');
    }
  }, [actionData, navigate, session.id]);

  return (
    <BlockStack gap="400">
      {/* Navigation Buttons at Top */}
      <Box paddingBlockEnd="400">
        <InlineStack align="space-between">
          <Button
            onClick={() => navigate(addSessionToUrl('/app/setup/tiers', session.id))}
          >
            ← Back to Tiers
          </Button>
          
          <Form method="post">
            <input type="hidden" name="intent" value="save_providers" />
            <input type="hidden" name="email_provider" value={emailProvider || ''} />
            <input type="hidden" name="sms_provider" value={smsProvider || ''} />
            <Button
              variant="primary"
              size="large"
              submit
              disabled={!emailProvider}
              onClick={() => {
                if (!emailProvider) {
                  console.warn('[Communication Setup] Button clicked but no email provider selected');
                  return;
                }
                console.log('[Communication Setup] Submitting form with provider:', emailProvider);
              }}
            >
              {emailProvider 
                ? `Continue to ${emailProvider === 'klaviyo' ? 'Klaviyo' : emailProvider === 'mailchimp' ? 'Mailchimp' : 'LiberoVino Managed'}` 
                : 'Select a Provider'} →
            </Button>
          </Form>
        </InlineStack>
      </Box>

      {/* Error Banner */}
      {actionData && !actionData.success && actionData.message && (
        <Banner tone="critical" title={actionData.message} />
      )}

      {/* Instructions */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h3">
            Choose Your Communication Providers
          </Text>
          <Text variant="bodyMd" as="p">
            Select your preferred providers for email and SMS communication. You must choose at least one channel.
            If you don't have a provider, select "LiberoVino Managed" to use LiberoVino's managed service.
          </Text>
          <Banner tone="info">
            At least one communication channel is required. Email is required for marketing communication like product suggestions. 
            Email and SMS can both be used for transactional notifications like signup, expiration warnings, etc.
          </Banner>
        </BlockStack>
      </Card>

      {/* Provider Selection */}
      <Card>
          <BlockStack gap="500">
            {/* Email Provider Selection */}
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">
                Email Provider
              </Text>
              
              <BlockStack gap="200">
                {emailChoices.map((choice) => (
                  <Checkbox
                    key={choice.value}
                    label={choice.label}
                    checked={choice.value === emailProvider}
                    onChange={(checked) => {
                      setIsDirty(true);
                      const newProvider = checked ? choice.value : null;
                      const previousProvider = emailProvider;
                      
                      // Update email provider
                      setEmailProvider(newProvider);
                      
                      // Clear SMS provider when switching away from SendGrid
                      // (Mailchimp and Klaviyo handle SMS in their own accounts)
                      if (previousProvider === 'sendgrid' && newProvider !== 'sendgrid') {
                        setSmsProvider(null);
                      }
                      
                      // Clear SMS provider if deselecting Klaviyo email
                      if (!newProvider && previousProvider === 'klaviyo' && smsProvider === 'klaviyo') {
                        setSmsProvider(null);
                      }
                    }}
                    helpText={choice.helpText}
                  />
                ))}
              </BlockStack>
            </BlockStack>

            {/* SMS Provider Selection - Only for LV-managed */}
            {emailProvider === 'sendgrid' && (
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  SMS Provider (Optional)
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  For Klaviyo and Mailchimp, SMS is controlled in your provider account. Only LiberoVino Managed offers SMS setup here.
                </Text>
                
                <BlockStack gap="200">
                  {smsChoices.map((choice) => (
                    <Checkbox
                      key={choice.value}
                      label={choice.label}
                      checked={choice.value === smsProvider}
                      onChange={(checked) => {
                        setIsDirty(true);
                        const newProvider = checked ? choice.value : null;
                        setSmsProvider(newProvider);
                      }}
                      helpText={choice.helpText}
                    />
                  ))}
                </BlockStack>
              </BlockStack>
            )}

            {/* Warning Banner */}
            {showWarning && (
              <Banner tone="warning">
                Please select at least one communication channel (email or SMS) to continue.
              </Banner>
            )}

          </BlockStack>
        </Card>
    </BlockStack>
  );
}

