import { type LoaderFunctionArgs } from 'react-router';
import { useNavigate, useLoaderData } from 'react-router';
import { useState } from 'react';
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

// No action needed - config is managed via context, saved at review step


export default function CommunicationProviderSelection() {
  const { session, existingConfig } = useLoaderData<typeof loader>();
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
          
          <Button
            variant="primary"
            size="large"
            onClick={() => {
              if (emailProvider) {
                navigate(addSessionToUrl(`/app/setup/communication/${emailProvider}`, session.id));
              }
            }}
            disabled={!emailProvider}
          >
            {emailProvider 
              ? `Continue to ${emailProvider === 'klaviyo' ? 'Klaviyo' : emailProvider === 'mailchimp' ? 'Mailchimp' : 'LiberoVino Managed'}` 
              : 'Select a Provider'} →
          </Button>
        </InlineStack>
      </Box>

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
                      
                      // Update email provider
                      setEmailProvider(newProvider);
                      
                      // Clear SMS provider if deselecting Klaviyo email
                      if (!newProvider && emailProvider === 'klaviyo' && smsProvider === 'klaviyo') {
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

