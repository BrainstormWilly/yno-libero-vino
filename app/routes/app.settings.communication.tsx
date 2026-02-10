/**
 * Communication Settings Page
 * 
 * Allows clients to view and manage their communication configuration,
 * including email/SMS providers and email settings.
 */

import { type LoaderFunctionArgs, type ActionFunctionArgs, Form, useLoaderData, useActionData, useLocation, useSubmit, useNavigation, redirect } from 'react-router';
import { useState, useEffect } from 'react';
import { 
  Page,
  Card, 
  BlockStack, 
  Text, 
  Button, 
  InlineStack, 
  Box, 
  Banner,
  Checkbox,
  TextField,
  InlineGrid,
  Divider,
  useBreakpoints,
  Modal,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { getMainNavigationActions } from '~/util/navigation';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import { recalculateAndUpdateSetupComplete, getClient } from '~/lib/db/supabase.server';
import { sendClientTestEmail, sendClientTestSMS } from '~/lib/communication/communication.service.server';
import { normalizeConfigForCreate } from '~/lib/communication/communication-helpers';
import { seedKlaviyoResources } from '~/lib/communication/klaviyo-seeding.server';
import { seedMailchimpResourcesFindOnly } from '~/lib/communication/mailchimp-seeding.server';
import type { Database } from '~/types/supabase';

type ProviderDataJson =
  Database['public']['Tables']['communication_configs']['Insert']['provider_data'];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }
  
  const client = await db.getClient(session.clientId);
  if (!client) {
    throw new Response('Client not found', { status: 404 });
  }

  const communicationConfig = await db.getCommunicationConfig(session.clientId);

  return {
    session,
    client,
    communicationConfig,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent') as string;

  if (intent === 'update_providers') {
    const emailProvider = formData.get('email_provider') as string | null;

    if (!emailProvider) {
      return { success: false, error: 'Email provider is required' };
    }

    try {
      const existingConfig = await db.getCommunicationConfig(session.clientId);
      const previousEmailProvider = existingConfig?.email_provider?.toLowerCase();
      const newEmailProvider = emailProvider.toLowerCase();
      const isSwitchingFromSendGrid = previousEmailProvider === 'sendgrid' && newEmailProvider !== 'sendgrid';
      
      // Clear SMS provider when switching away from SendGrid
      let finalSmsProvider = existingConfig?.sms_provider || null;
      if (isSwitchingFromSendGrid) {
        finalSmsProvider = null;
      } else if (newEmailProvider !== 'sendgrid') {
        // If not SendGrid, don't allow SMS provider selection
        finalSmsProvider = null;
      }

      // Reset confirmed flags when providers change
      const emailProviderChanged = previousEmailProvider !== newEmailProvider;
      const updateData: Parameters<typeof db.updateCommunicationConfig>[1] = {
        emailProvider,
        smsProvider: finalSmsProvider,
        emailProviderConfirmed: emailProviderChanged ? false : undefined,
        smsProviderConfirmed: emailProviderChanged ? false : undefined,
      };

      // Handle provider-specific fields
      if (newEmailProvider === 'klaviyo') {
        const apiKey = formData.get('email_api_key') as string | null;
        const fromEmail = formData.get('email_from_address') as string | null;
        const fromName = formData.get('email_from_name') as string | null;
        const listId = formData.get('email_list_id') as string | null;
        
        if (apiKey !== null) updateData.emailApiKey = apiKey || null;
        if (fromEmail !== null) updateData.emailFromAddress = fromEmail || null;
        if (fromName !== null) updateData.emailFromName = fromName || null;
        if (listId !== null) updateData.emailListId = listId || null;
      } else if (newEmailProvider === 'mailchimp') {
        const providerDataStr = formData.get('provider_data') as string | null;
        if (providerDataStr) {
          try {
            updateData.providerData = JSON.parse(providerDataStr) as ProviderDataJson;
          } catch (e) {
            console.error('Error parsing provider_data:', e);
          }
        }
      } else if (newEmailProvider === 'sendgrid') {
        // Clear email_api_key when switching to SendGrid (uses env var)
        updateData.emailApiKey = null;
      }
      
      // Clear provider_data when switching away from Klaviyo or Mailchimp
      if (emailProviderChanged) {
        if (previousEmailProvider === 'klaviyo' || previousEmailProvider === 'mailchimp') {
          // Only clear if we're not updating it above
          if (newEmailProvider !== 'klaviyo' && newEmailProvider !== 'mailchimp') {
            updateData.providerData = {}; // provider_data is NOT NULL, use empty object
          }
        }
        // Clear email_list_id when switching away from Mailchimp/Klaviyo
        if (previousEmailProvider === 'mailchimp' || previousEmailProvider === 'klaviyo') {
          if (newEmailProvider !== 'mailchimp' && newEmailProvider !== 'klaviyo') {
            updateData.emailListId = null;
          }
        }
      }

      if (existingConfig) {
        await db.updateCommunicationConfig(session.clientId, updateData);
      } else {
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

      // Seed Klaviyo or Mailchimp resources when provider is Klaviyo/Mailchimp with valid credentials
      const configAfterSave = await db.getCommunicationConfig(session.clientId);

      if (newEmailProvider === 'klaviyo' && configAfterSave) {
        const apiKey = configAfterSave.email_api_key;
        const fromEmail = configAfterSave.email_from_address;
        const fromName = configAfterSave.email_from_name;
        const providerData = configAfterSave.provider_data as Record<string, unknown> | null;
        const includeMarketing = (providerData?.includeMarketing as boolean) ?? false;

        if (apiKey && fromEmail) {
          try {
            const seededData = await seedKlaviyoResources({
              apiKey,
              fromEmail,
              fromName: fromName ?? 'LiberoVino',
              includeMarketing,
              includeSMS: true,
            });
            await db.updateCommunicationConfig(session.clientId, {
              providerData: seededData as unknown as ProviderDataJson,
              emailProviderConfirmed: true,
            });
          } catch (seedError) {
            console.error('[Settings] Failed to seed Klaviyo resources:', seedError);
            return {
              success: false,
              error: `Failed to create Klaviyo flows: ${seedError instanceof Error ? seedError.message : String(seedError)}`,
            };
          }
        }
      }

      if (newEmailProvider === 'mailchimp' && configAfterSave) {
        const providerData = configAfterSave.provider_data as Record<string, unknown> | null;
        const serverPrefix = providerData?.serverPrefix as string | null | undefined;
        const marketingAccessToken = providerData?.marketingAccessToken as string | null | undefined;
        const audienceName = (providerData?.audienceName as string | null | undefined)?.trim();

        if (!serverPrefix || !marketingAccessToken) {
          return {
            success: false,
            error:
              'Mailchimp requires a valid API key (e.g. xxxxx-us1) with server prefix. Please use a key that includes the server prefix (e.g. us1).',
          };
        }
        if (!audienceName) {
          return {
            success: false,
            error: 'Audience name is required. Enter the name of an existing audience in your Mailchimp account.',
          };
        }
        try {
          const seededData = await seedMailchimpResourcesFindOnly({
            serverPrefix,
            marketingAccessToken,
            audienceName,
            includeMarketing: false,
          });
          await db.updateCommunicationConfig(session.clientId, {
            emailListId: seededData.audienceId ?? configAfterSave.email_list_id,
            providerData: seededData as unknown as ProviderDataJson,
            emailProviderConfirmed: true,
          });
        } catch (seedError) {
          console.error('[Settings] Failed to seed Mailchimp resources:', seedError);
          return {
            success: false,
            error: seedError instanceof Error ? seedError.message : String(seedError),
          };
        }
      }

      // Recalculate setup progress - if it drops below 100%, setup_complete will be set to false
      await recalculateAndUpdateSetupComplete(session.clientId);

      // Check if setup is now incomplete - if so, redirect to setup instead of staying in settings
      const client = await getClient(session.clientId);
      if (!client?.setup_complete) {
        throw redirect(addSessionToUrl('/app/setup/communication', session.id));
      }

      return { success: true, message: 'Provider settings updated successfully' };
    } catch (error) {
      console.error('Error updating provider settings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update provider settings' 
      };
    }
  }

  if (intent === 'update_email_settings') {
    const warningDaysBefore = formData.get('warning_days_before') ? parseInt(formData.get('warning_days_before') as string, 10) : undefined;

    try {
      await db.updateCommunicationConfig(session.clientId, {
        warningDaysBefore,
      });

      return { success: true, message: 'Email settings updated successfully' };
    } catch (error) {
      console.error('Error updating email settings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update email settings' 
      };
    }
  }

  if (intent === 'update_sms_activated') {
    const smsActivated = formData.get('sms_activated') === 'true';
    const smsProvider = smsActivated ? 'twilio' : null;

    try {
      await db.updateCommunicationConfig(session.clientId, {
        smsProvider,
      });

      return { success: true, message: 'SMS settings updated successfully' };
    } catch (error) {
      console.error('Error updating SMS settings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update SMS settings' 
      };
    }
  }

  if (intent === 'send_test_email') {
    const testEmail = formData.get('test_email') as string;

    if (!testEmail) {
      return { success: false, error: 'Email address is required' };
    }

    try {
      await sendClientTestEmail(session.clientId, testEmail);
      return { success: true, message: `Test email sent to ${testEmail}`, testType: 'email' };
    } catch (error) {
      console.error('Error sending test email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send test email',
        testType: 'email',
      };
    }
  }

  if (intent === 'send_test_sms') {
    const testPhone = formData.get('test_phone') as string;

    if (!testPhone) {
      return { success: false, error: 'Phone number is required' };
    }

    try {
      await sendClientTestSMS(session.clientId, testPhone);
      return { success: true, message: `Test SMS sent to ${testPhone}`, testType: 'sms' };
    } catch (error) {
      console.error('Error sending test SMS:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send test SMS',
        testType: 'sms',
      };
    }
  }

  return { success: false, error: 'Invalid action' };
}

export default function CommunicationSettings() {
  const { session, communicationConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const { smUp } = useBreakpoints();
  const submit = useSubmit();

  const [emailProvider, setEmailProvider] = useState<string | null>(
    communicationConfig?.email_provider ?? null
  );
  const [warningDaysBefore, setWarningDaysBefore] = useState(String(communicationConfig?.warning_days_before || 7));
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [showTestEmailModal, setShowTestEmailModal] = useState(false);
  const [showTestSmsModal, setShowTestSmsModal] = useState(false);
  const [smsActivated, setSmsActivated] = useState(!!communicationConfig?.sms_provider);
  const [emailTestResponse, setEmailTestResponse] = useState(false);
  const [smsTestResponse, setSmsTestResponse] = useState(false);
  // const [smsTestResult, setSmsTestResult] = useState(actionData?.testType === 'sms' ? actionData : null);
  const [emailSettingsSaveResponse, setEmailSettingsSaveResponse] = useState(false);
  const [providerSaveResponse, setProviderSaveResponse] = useState(false);
  
  const navigation = useNavigation();
  const isSubmittingProvider = navigation.state === 'submitting' && navigation.formData?.get('intent') === 'update_providers';
  const isSubmittingEmailSettings =
    navigation.state === 'submitting' && navigation.formData?.get('intent') === 'update_email_settings';
  const isEmailSettingsDirty =
    warningDaysBefore !== String(communicationConfig?.warning_days_before || 7);

  // Provider API key fields (for Klaviyo and Mailchimp)
  const providerData = (communicationConfig?.provider_data as Record<string, unknown> | null) ?? null;
  // Klaviyo SMS: we seed flows with includeSMS true, so if provider_data has flows, SMS is available
  const klaviyoSmsAvailable =
    emailProvider === 'klaviyo' && providerData != null && typeof providerData.flows === 'object';
  // Mailchimp: no in-app SMS Send Test; they test SMS in their LiberoVino::Test flow in Mailchimp.
  const mailchimpSmsAvailable = false;
  const smsTestEnabled = smsActivated || klaviyoSmsAvailable;

  const [klaviyoApiKey, setKlaviyoApiKey] = useState(communicationConfig?.email_provider === 'klaviyo' ? communicationConfig.email_api_key ?? '' : '');
  const [klaviyoFromEmail, setKlaviyoFromEmail] = useState(communicationConfig?.email_provider === 'klaviyo' ? communicationConfig.email_from_address ?? '' : '');
  const [klaviyoFromName, setKlaviyoFromName] = useState(communicationConfig?.email_provider === 'klaviyo' ? communicationConfig.email_from_name ?? '' : '');
  const [klaviyoListId, setKlaviyoListId] = useState(communicationConfig?.email_provider === 'klaviyo' ? communicationConfig.email_list_id ?? '' : '');
  
  const [mailchimpAccessToken, setMailchimpAccessToken] = useState(
    communicationConfig?.email_provider === 'mailchimp' ? (providerData?.marketingAccessToken as string ?? '') : ''
  );
  const [mailchimpAudienceName, setMailchimpAudienceName] = useState(
    communicationConfig?.email_provider === 'mailchimp' ? (providerData?.audienceName as string ?? '') : ''
  );
  const [mailchimpCheckboxAudienceCreated, setMailchimpCheckboxAudienceCreated] = useState(false);
  const [mailchimpCheckboxTestMember, setMailchimpCheckboxTestMember] = useState(false);
  const [mailchimpCheckboxFlowCreated, setMailchimpCheckboxFlowCreated] = useState(false);

  // Mailchimp Send Test (email): only when we have audience id and user confirmed (b) + (c).
  const mailchimpAudienceId =
    communicationConfig?.email_list_id ??
    (providerData as { audienceId?: string } | null)?.audienceId;
  const mailchimpEmailTestEnabled =
    emailProvider === 'mailchimp' &&
    typeof (providerData as { serverPrefix?: string } | null)?.serverPrefix === 'string' &&
    !!mailchimpAudienceId &&
    mailchimpCheckboxTestMember &&
    mailchimpCheckboxFlowCreated;

  // Sync state with loader data
  useEffect(() => {
    setEmailProvider(communicationConfig?.email_provider ?? null);
    setWarningDaysBefore(String(communicationConfig?.warning_days_before || 7));
    setSmsActivated(!!communicationConfig?.sms_provider);
    
    // Sync provider-specific fields
    const config = communicationConfig;
    const pd = (config?.provider_data as Record<string, unknown> | null) ?? null;
    
    if (config?.email_provider === 'klaviyo') {
      setKlaviyoApiKey(config.email_api_key ?? '');
      setKlaviyoFromEmail(config.email_from_address ?? '');
      setKlaviyoFromName(config.email_from_name ?? '');
      setKlaviyoListId(config.email_list_id ?? '');
    } else if (config?.email_provider === 'mailchimp') {
      setMailchimpAccessToken((pd?.marketingAccessToken as string) ?? '');
      setMailchimpAudienceName((pd?.audienceName as string) ?? '');
    }
  }, [communicationConfig]);

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

  // Get test result banner for email
  const emailTestResult = actionData?.testType === 'email' ? actionData : null;
  // Get test result banner for SMS
  const smsTestResult = actionData?.testType === 'sms' ? actionData : null;
  // Get email settings save result (for expiration days)
  const emailSettingsSaveResult = actionData && 
    !actionData.testType && 
    (actionData.message?.includes('Email settings') || actionData.error?.includes('Email settings'))
    ? actionData 
    : null;
  // Get provider save result - show any error/success from update_providers intent that isn't a test or email settings
  // Check for provider-related errors or success messages
  const providerSaveResult = actionData && 
    !actionData.testType && 
    !emailSettingsSaveResult &&
    (actionData.message?.includes('Provider settings') || 
     actionData.error?.includes('Provider settings') || 
     actionData.error?.includes('Email provider is required') ||
     actionData.error?.includes('Audience name') ||
     actionData.error?.includes('No audience named') ||
     actionData.error?.includes('Mailchimp requires') ||
     actionData.error?.includes('Klaviyo') ||
     actionData.error?.includes('API key') ||
     (actionData.success && actionData.message?.includes('successfully')))
    ? actionData 
    : null;

  // Handle test results - close modal on success
  useEffect(() => {
    if (actionData?.success && actionData.testType === 'email') {
      setShowTestEmailModal(false);
      setTestEmail('');
    }
    if (actionData?.success && actionData.testType === 'sms') {
      setShowTestSmsModal(false);
      setTestPhone('');
    }
    // Reset provider save response when new action data arrives
    if (providerSaveResult) {
      setProviderSaveResponse(false);
    }
  }, [actionData, providerSaveResult]);

  // Handle SMS activated checkbox change
  const handleSmsActivatedChange = (checked: boolean) => {
    setSmsActivated(checked);
    const formData = new FormData();
    formData.append('intent', 'update_sms_activated');
    formData.append('sms_activated', checked.toString());
    submit(formData, { method: 'post' });
  };

  return (
    <Page 
      title="Communication"
      backAction={{
        content: 'Settings',
        url: addSessionToUrl('/app/settings', session.id),
      }}
      secondaryActions={getMainNavigationActions({
        sessionId: session.id,
        currentPath: location.pathname,
      })}
    >
      <BlockStack gap="400">
        {/* Global banner for non-test actions (excluding email settings saves) */}
        {emailSettingsSaveResult && !emailSettingsSaveResponse && (
          <Banner
            tone={emailSettingsSaveResult.success ? 'success' : 'critical'}
            onDismiss={() => setEmailSettingsSaveResponse(true)}
          >
            {emailSettingsSaveResult.success ? emailSettingsSaveResult.message : emailSettingsSaveResult.error}
          </Banner>
        )}

        {/* Provider Section */}
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Provider
              </Text>
              <Text as="p" variant="bodyMd">
                Select your email provider for member communications. Each provider offers different features and integration options.
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <Form method="post">
              <input type="hidden" name="intent" value="update_providers" />
              <BlockStack gap="400">
                {/* Provider save result banner */}
                {providerSaveResult && !providerSaveResponse && (
                  <Banner
                    tone={providerSaveResult.success ? 'success' : 'critical'}
                    onDismiss={() => setProviderSaveResponse(true)}
                  >
                    {providerSaveResult.success ? providerSaveResult.message : providerSaveResult.error}
                  </Banner>
                )}
                
                <Text variant="headingMd" as="h3">
                  Communication Provider
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Choose your preferred communication provider for sending emails to members.
                </Text>
                
                <BlockStack gap="300">
                  {emailChoices.map((choice) => (
                    <Checkbox
                      key={choice.value}
                      label={choice.label}
                      checked={choice.value === emailProvider}
                      onChange={(checked) => {
                        if (checked) {
                          setEmailProvider(choice.value);
                        } else if (choice.value === emailProvider) {
                          // Don't allow unchecking the selected provider
                          setEmailProvider(null);
                        }
                      }}
                      helpText={choice.helpText}
                    />
                  ))}
                </BlockStack>

                <input type="hidden" name="email_provider" value={emailProvider || ''} />

                {/* Klaviyo API Key Fields */}
                {emailProvider === 'klaviyo' && (
                  <BlockStack gap="300">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Klaviyo Configuration
                    </Text>
                    <TextField
                      label="Klaviyo API Key"
                      type="password"
                      value={klaviyoApiKey}
                      onChange={setKlaviyoApiKey}
                      autoComplete="off"
                      requiredIndicator
                      helpText="Your Klaviyo private API key (starts with 'pk_')"
                    />
                    <input type="hidden" name="email_api_key" value={klaviyoApiKey} />
                    
                    <TextField
                      label="From Email Address"
                      type="email"
                      value={klaviyoFromEmail}
                      onChange={setKlaviyoFromEmail}
                      autoComplete="email"
                      requiredIndicator
                      helpText="The email address members will see as the sender. Must be a verified sender in Klaviyo."
                    />
                    <input type="hidden" name="email_from_address" value={klaviyoFromEmail} />
                    
                    <TextField
                      label="From Name"
                      value={klaviyoFromName}
                      onChange={setKlaviyoFromName}
                      autoComplete="off"
                      requiredIndicator
                      helpText="The name members will see as the sender (e.g., 'Napa Valley Wines')"
                    />
                    <input type="hidden" name="email_from_name" value={klaviyoFromName} />
                    
                    <TextField
                      label="List ID (Optional)"
                      value={klaviyoListId}
                      onChange={setKlaviyoListId}
                      autoComplete="off"
                      helpText="Your Klaviyo list ID for segmentation (optional)"
                    />
                    <input type="hidden" name="email_list_id" value={klaviyoListId} />
                  </BlockStack>
                )}

                {/* Mailchimp API Key Fields */}
                {emailProvider === 'mailchimp' && (
                  <BlockStack gap="300">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Mailchimp Configuration
                    </Text>
                    <TextField
                      label="Marketing Access Token or API Key"
                      type="password"
                      value={mailchimpAccessToken}
                      onChange={setMailchimpAccessToken}
                      autoComplete="off"
                      requiredIndicator
                      helpText="OAuth access token or classic API key for Marketing API calls"
                    />
                    <TextField
                      label="Audience Name"
                      value={mailchimpAudienceName}
                      onChange={setMailchimpAudienceName}
                      autoComplete="off"
                      requiredIndicator
                      helpText="Must match an existing audience (list) in your Mailchimp account. We'll verify and save its id; we don't create audiences."
                    />
                    <input type="hidden" name="provider_data" value={JSON.stringify({
                      marketingAccessToken: mailchimpAccessToken,
                      audienceName: mailchimpAudienceName || null,
                      ...(mailchimpAccessToken ? (() => {
                        const match = mailchimpAccessToken.match(/-([a-z]{2}\d+)$/i);
                        return match ? { serverPrefix: match[1] } : {};
                      })() : {}),
                    })} />
                  </BlockStack>
                )}

                <InlineStack gap="200">
                  <Button 
                    submit 
                    variant="primary"
                    loading={isSubmittingProvider}
                    disabled={isSubmittingProvider}
                  >
                    {isSubmittingProvider ? 'Saving...' : 'Save Provider'}
                  </Button>
                </InlineStack>
              </BlockStack>
            </Form>
          </Card>
        </InlineGrid>
        {smUp ? <Divider /> : null}

        {/* Email Section */}
        {emailProvider && (
          <>
            <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
              <Box
                as="section"
                paddingInlineStart={{ xs: "400", sm: "0" }}
                paddingInlineEnd={{ xs: "400", sm: "0" }}
              >
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Email
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Configure email settings for member communications, including expiration warnings and test functionality.
                  </Text>
                </BlockStack>
              </Box>
              <Card roundedAbove="sm">
                <BlockStack gap="400">
                  {/* Test result banner at top */}
                  { emailTestResult && !emailTestResponse && (
                    <Banner
                      tone={emailTestResult.success ? 'success' : 'critical'}
                      onDismiss={() => setEmailTestResponse(true)}
                    >
                      {emailTestResult.success ? emailTestResult.message : emailTestResult.error}
                    </Banner>
                  )}
                  
                  {/* Email settings save result banner */}
                  {emailSettingsSaveResult && !emailSettingsSaveResponse && (
                    <Banner
                      tone={emailSettingsSaveResult.success ? 'success' : 'critical'}
                      onDismiss={() => setEmailSettingsSaveResponse(true)}
                    >
                      {emailSettingsSaveResult.success ? emailSettingsSaveResult.message : emailSettingsSaveResult.error}
                    </Banner>
                  )}

                  <Text variant="headingMd" as="h3">
                    Email Settings
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    Manage email notifications and test your configuration.
                  </Text>

                  <BlockStack gap="400">
                    <Checkbox
                      label="Activated"
                      checked={true}
                      disabled={true}
                      helpText="Email is always activated when a provider is selected"
                    />
                    
                    <Form method="post">
                      <input type="hidden" name="intent" value="update_email_settings" />
                      <BlockStack gap="200">
                        <Text variant="bodyMd" as="p" tone="subdued">Number of days before membership expiration to send warning emails</Text>
                        <InlineStack gap="200" align="start" blockAlign="center">
                          <Box minWidth="200px">
                            <TextField
                              label={null}
                              type="number"
                              value={warningDaysBefore}
                              onChange={setWarningDaysBefore}
                              autoComplete="off"
                              min="1"
                              max="365"
                            />
                          </Box>
                          <input type="hidden" name="warning_days_before" value={warningDaysBefore} />

                            <Button
                              submit
                              variant="primary"
                              loading={isSubmittingEmailSettings}
                              disabled={!isEmailSettingsDirty || isSubmittingEmailSettings}
                            >
                              Save
                            </Button>
                        </InlineStack>
                      </BlockStack>
                    </Form>

                    {emailProvider === 'mailchimp' && (
                      <BlockStack gap="200">
                        <Text variant="bodyMd" as="p" tone="subdued" fontWeight="semibold">
                          Test Setup
                        </Text>
                        <Checkbox
                          label="I've created an audience in Mailchimp with the name above."
                          checked={mailchimpCheckboxAudienceCreated}
                          onChange={setMailchimpCheckboxAudienceCreated}
                        />
                        <Checkbox
                          label="I have a test member in that audience (email subscribed; SMS subscribed if I use SMS in my flow)."
                          checked={mailchimpCheckboxTestMember}
                          onChange={setMailchimpCheckboxTestMember}
                        />
                        <Checkbox
                          label="I created a flow in Mailchimp triggered by tag LiberoVino::Test that sends a test email (and optionally SMS)."
                          checked={mailchimpCheckboxFlowCreated}
                          onChange={setMailchimpCheckboxFlowCreated}
                        />
                      </BlockStack>
                    )}

                    <InlineStack gap="200">
                      <Button 
                        url={addSessionToUrl('/app/settings/communication/templates', session.id)}
                        variant="secondary"
                      >
                        Manage Templates
                      </Button>
                      <Button
                        onClick={() => setShowTestEmailModal(true)}
                        disabled={emailProvider === 'mailchimp' && !mailchimpEmailTestEnabled}
                      >
                        Send Test
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </InlineGrid>
            {smUp ? <Divider /> : null}
          </>
        )}

        {/* SMS Section */}
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                SMS
              </Text>
              <Text as="p" variant="bodyMd">
                Configure SMS settings for member communications. Enable SMS to send messages to members.
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              {/* Test result banner at top */}
              {smsTestResult && !smsTestResponse && (
                <Banner
                  tone={smsTestResult.success ? 'success' : 'critical'}
                  onDismiss={() => setSmsTestResponse(true)}
                >
                  {smsTestResult.success ? smsTestResult.message : smsTestResult.error}
                </Banner>
              )}

              <Text variant="headingMd" as="h3">
                SMS Settings
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Manage SMS notifications and test your configuration.
              </Text>

              <BlockStack gap="400">
                <Checkbox
                  label={
                    emailProvider === 'klaviyo' && klaviyoSmsAvailable
                      ? 'SMS via Klaviyo'
                      : emailProvider === 'mailchimp' && mailchimpSmsAvailable
                        ? 'SMS via Mailchimp'
                        : 'Activated'
                  }
                  checked={smsActivated || klaviyoSmsAvailable || mailchimpSmsAvailable}
                  onChange={handleSmsActivatedChange}
                  disabled={emailProvider !== 'sendgrid'}
                  helpText={
                    emailProvider === 'klaviyo' && klaviyoSmsAvailable
                      ? 'SMS is sent through your Klaviyo Test flow. Send a test to verify.'
                      : emailProvider === 'klaviyo'
                        ? 'Complete Klaviyo setup and save to enable SMS test.'
                        : emailProvider === 'mailchimp'
                          ? 'SMS cannot be tested from this page. Test SMS using a contact with SMS subscribed in your LiberoVino::Test flow in Mailchimp.'
                          : emailProvider !== 'sendgrid'
                              ? 'SMS is only available with LiberoVino Managed email provider'
                              : smsActivated
                                ? 'SMS is activated and ready to send messages'
                                : 'Enable SMS to send messages to members'
                  }
                />

                <InlineStack gap="200">
                  <Button 
                    onClick={() => setShowTestSmsModal(true)}
                    disabled={!smsTestEnabled}
                  >
                    Send Test
                  </Button>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>

      {/* Test Email Modal */}
      <Modal
        open={showTestEmailModal}
        onClose={() => {
          setShowTestEmailModal(false);
          setTestEmail('');
        }}
        title="Send Test Email"
        primaryAction={{
          content: 'Send Test',
          onAction: () => {
            if (!testEmail.trim()) {
              return;
            }
            setEmailTestResponse(false);
            const formData = new FormData();
            formData.append('intent', 'send_test_email');
            formData.append('test_email', testEmail);
            submit(formData, { method: 'post' });
          },
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => {
            setShowTestEmailModal(false);
            setTestEmail('');
          },
        }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Test email address"
              type="email"
              value={testEmail}
              onChange={setTestEmail}
              placeholder="your@email.com"
              autoComplete="off"
              helpText="Enter an email address to send a test message"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* Test SMS Modal */}
      <Modal
        open={showTestSmsModal}
        onClose={() => {
          setShowTestSmsModal(false);
          setTestPhone('');
        }}
        title="Send Test SMS"
        primaryAction={{
          content: 'Send Test',
          onAction: () => {
            if (!testPhone.trim()) {
              return;
            }
            setSmsTestResponse(false);
            const formData = new FormData();
            formData.append('intent', 'send_test_sms');
            formData.append('test_phone', testPhone);
            submit(formData, { method: 'post' });
          },
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => {
            setShowTestSmsModal(false);
            setTestPhone('');
          },
        }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <TextField
              label="Test phone number"
              type="tel"
              value={testPhone}
              onChange={setTestPhone}
              placeholder="+1234567890"
              autoComplete="off"
              helpText="Enter a phone number to send a test message"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
