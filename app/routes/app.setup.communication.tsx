import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  TextField,
  ChoiceList,
  Checkbox,
  InlineStack,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import type { Database } from '~/types/supabase';

type ProviderDataJson =
  Database['public']['Tables']['communication_configs']['Insert']['provider_data'];
import { sendClientTestEmail } from '~/lib/communication/communication.service.server';
import { seedKlaviyoResources } from '~/lib/communication/klaviyo-seeding.server';
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
  const intent = (formData.get('intent') as string) ?? 'save';

  if (intent === 'send_test') {
    const testEmail = formData.get('test_email') as string;

    if (!testEmail) {
      return {
        success: false,
        message: 'Enter an email address to send a test message.',
      };
    }

    const config = await db.getCommunicationConfig(session.clientId);
    const providerKey = config?.email_provider?.toLowerCase();

    try {
      await sendClientTestEmail(session.clientId, testEmail);
      let message: string;
      if (providerKey === 'klaviyo') {
        message = `Triggered the Klaviyo test flow for ${testEmail}. Make sure "LiberoVino – Test Flow" is set to Live in Klaviyo to see the message.`;
      } else if (providerKey === 'mailchimp') {
        message = `Triggered the Mailchimp test tag for ${testEmail}. Check the "LiberoVino – Test" journey to confirm delivery.`;
      } else {
        message = `Sent test email to ${testEmail}.`;
      }
      return {
        success: true,
        message,
      };
    } catch (error) {
      let fallbackMessage: string;
      if (providerKey === 'klaviyo') {
        fallbackMessage =
          'Unable to trigger the Klaviyo test flow. Confirm the "LiberoVino – Test Flow" exists and is set to Live, then try again.';
      } else if (providerKey === 'mailchimp') {
        fallbackMessage =
          'Unable to trigger the Mailchimp test automation. Confirm the audience and templates are seeded and that the "LiberoVino – Test" journey is active.';
      } else {
        fallbackMessage =
          error instanceof Error ? error.message : 'Failed to send test email. Please check your configuration.';
      }
      return {
        success: false,
        message: fallbackMessage,
      };
    }
  }

  const provider = formData.get('provider') as string;
  const apiKey = formData.get('api_key') as string;
  const fromEmail = formData.get('from_email') as string;
  const fromName = formData.get('from_name') as string;
  const listId = formData.get('list_id') as string;
  const serverPrefix = formData.get('server_prefix') as string;
  const marketingAccessToken = formData.get('marketing_access_token') as string;
  const audienceName = formData.get('audience_name') as string;
  const mailchimpAck = formData.get('mailchimp_ack') === 'true';
  const sendMonthlyStatus = formData.get('send_monthly_status') === 'true';
  const sendExpirationWarnings = formData.get('send_expiration_warnings') === 'true';
  const warningDays = formData.get('warning_days') as string;
  const includeMarketing = formData.get('include_marketing') === 'true';
  
  if (!provider) {
    return {
      success: false,
      message: 'Email provider is required',
    };
  }
  
  // Validate Klaviyo requires API key and from email
  if (provider === 'klaviyo') {
    if (!apiKey || !fromEmail || !fromName) {
      return {
        success: false,
        message: 'Klaviyo requires API Key, From Email, and From Name',
      };
    }
  }
  
  if (provider === 'mailchimp') {
    if (!fromEmail || !fromName || !serverPrefix) {
      return {
        success: false,
        message: 'Mailchimp requires server prefix plus From Email/Name.',
      };
    }

    if (!marketingAccessToken) {
      return {
        success: false,
        message: 'Provide a Mailchimp Marketing access token or API key so we can manage audiences.',
      };
    }

    if (!mailchimpAck) {
      return {
        success: false,
        message: 'Confirm that journeys/flows are created for the LiberoVino tags before continuing.',
      };
    }
  }
  
  try {
    const existingConfig = await db.getCommunicationConfig(session.clientId);
    
    const needsApiKey = provider === 'klaviyo';
    const needsIdentity = provider === 'klaviyo' || provider === 'mailchimp';

    const configData = {
      emailProvider: provider,
      emailApiKey: needsApiKey ? apiKey : undefined,
      emailFromAddress: needsIdentity ? fromEmail : undefined,
      emailFromName: needsIdentity ? fromName : undefined,
      emailListId:
        provider === 'klaviyo' && listId
          ? listId
          : provider === 'mailchimp' && listId
            ? listId
            : undefined,
      sendMonthlyStatus,
      sendExpirationWarnings,
      warningDaysBefore: parseInt(warningDays) || 7,
    };
    
    let savedConfig;
    if (existingConfig) {
      savedConfig = await db.updateCommunicationConfig(session.clientId, configData);
    } else {
      savedConfig = await db.createCommunicationConfig(session.clientId, configData);
    }

    if (provider === 'klaviyo') {
      try {
        const providerData = await seedKlaviyoResources({
          apiKey,
          fromEmail,
          fromName,
          includeMarketing,
        });

        savedConfig = await db.updateCommunicationConfig(session.clientId, {
          providerData: providerData as unknown as ProviderDataJson,
        });
      } catch (error) {
        console.error('Klaviyo seeding failed', error);
        return {
          success: false,
          message:
            error instanceof Error
              ? `Klaviyo setup failed: ${error.message}`
              : 'Failed to initialize Klaviyo automations.',
        };
      }
    } else if (provider === 'mailchimp') {
      const previousProviderData =
        (savedConfig?.provider_data && typeof savedConfig.provider_data === 'object' && !Array.isArray(savedConfig.provider_data)
          ? (savedConfig.provider_data as Record<string, unknown>)
          : {}) ?? {};

      const nextProviderData = {
        ...previousProviderData,
        serverPrefix,
        marketingAccessToken,
        audienceName: audienceName || null,
      };

      await db.updateCommunicationConfig(session.clientId, {
        providerData: nextProviderData as unknown as ProviderDataJson,
      });
    } else if (provider === 'sendgrid') {
      await db.updateCommunicationConfig(session.clientId, {
        emailApiKey: null,
        emailFromAddress: null,
        emailFromName: null,
      });
    } else if (savedConfig?.provider_data && provider !== 'klaviyo') {
      await db.updateCommunicationConfig(session.clientId, {
        providerData: {} as ProviderDataJson,
      });
    }
    
    // Redirect to review page
    return {
      success: true,
      redirect: addSessionToUrl('/app/setup/review', session.id),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to save communication config',
    };
  }
}

export default function SetupCommunication() {
  const { session, existingConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
 
  const providerData = (existingConfig?.provider_data as Record<string, unknown> | null) ?? null;

  const readProviderString = (key: string) => {
    const value = providerData?.[key];
    return typeof value === 'string' ? value : '';
  };

  const readProviderBoolean = (key: string, fallback = false) => {
    const value = providerData?.[key];
    return typeof value === 'boolean' ? (value as boolean) : fallback;
  };

  const [provider, setProvider] = useState(
    existingConfig?.email_provider || 'sendgrid'
  );
  const initialApiKey =
    existingConfig?.email_provider === 'klaviyo' ? existingConfig.email_api_key ?? '' : '';
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [fromEmail, setFromEmail] = useState(existingConfig?.email_from_address || '');
  const [fromName, setFromName] = useState(existingConfig?.email_from_name || '');
  const [listId, setListId] = useState(existingConfig?.email_list_id || '');
  const [sendMonthlyStatus, setSendMonthlyStatus] = useState(
    existingConfig?.send_monthly_status !== false
  );
  const [sendExpirationWarnings, setSendExpirationWarnings] = useState(
    existingConfig?.send_expiration_warnings !== false
  );
  const [warningDays, setWarningDays] = useState(
    (existingConfig?.warning_days_before || 7).toString()
  );
  const [testEmail, setTestEmail] = useState(existingConfig?.email_from_address || '');
  const [includeMarketing, setIncludeMarketing] = useState(readProviderBoolean('includeMarketing'));
  const [mailchimpServerPrefix, setMailchimpServerPrefix] = useState(readProviderString('serverPrefix'));
  const [mailchimpMarketingToken, setMailchimpMarketingToken] = useState(
    readProviderString('marketingAccessToken')
  );
  const [mailchimpAudienceName, setMailchimpAudienceName] = useState(readProviderString('audienceName'));
  const [mailchimpChecklistAcknowledged, setMailchimpChecklistAcknowledged] = useState(
    Boolean(existingConfig?.provider_data && provider === 'mailchimp')
  );
  
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  // Handle redirect from action
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);
  
  const isKlaviyo = provider === 'klaviyo';
  const isMailchimp = provider === 'mailchimp';
  
  return (
    <Page
      title="Email Communication Setup"
      backAction={{ 
        content: 'Back to Tiers', 
        onAction: () => navigate(addSessionToUrl('/app/setup/tiers', session.id)) 
      }}
    >
      <Layout>
        {/* Error Messages */}
        {actionData && !actionData.success && (
          <Layout.Section>
            <Banner tone="critical" title={actionData.message} />
          </Layout.Section>
        )}
        
        {/* Instructions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h3">
                Configure Email Communication
              </Text>
              <Text variant="bodyMd" as="p">
                LiberoVino sends automated emails to members for monthly status updates and membership expiration warnings. 
                Choose your preferred email provider below.
              </Text>
              <Banner tone="info">
                Email communication is required for member notifications. SMS support coming soon.
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>
        
        {/* Success Messages */}
        {actionData && actionData.success && actionData.message && !actionData.redirect && (
          <Layout.Section>
            <Banner tone="success" title={actionData.message} />
          </Layout.Section>
        )}

        {/* Provider Selection & Configuration */}
        <Layout.Section>
          <Form method="post">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">
                  Email Provider
                </Text>
                
                <ChoiceList
                  title="Select your email provider"
                  choices={[
                    {
                      label: 'Klaviyo (Recommended)',
                      value: 'klaviyo',
                      helpText: 'Use your own Klaviyo account for advanced email marketing and automation',
                    },
                    {
                      label: 'Mailchimp',
                      value: 'mailchimp',
                      helpText: 'Connect your Mailchimp account for audience management and automations',
                    },
                    {
                      label: 'SendGrid (LiberoVino Managed)',
                      value: 'sendgrid',
                      helpText: 'Default option - uses LiberoVino\'s SendGrid account (no configuration needed)',
                    },
                  ]}
                  selected={[provider]}
                  onChange={(selected) => setProvider(selected[0])}
                />
                
                {/* Klaviyo Configuration */}
                {isKlaviyo && (
                  <BlockStack gap="400">
                    <Banner tone="warning">
                      You'll need a Klaviyo account and API key. Visit your Klaviyo account settings to generate a private API key.
                    </Banner>
                    
                    <TextField
                      label="Klaviyo API Key"
                      type="password"
                      value={apiKey}
                      onChange={setApiKey}
                      autoComplete="off"
                      requiredIndicator
                      helpText="Your Klaviyo private API key (starts with 'pk_')"
                    />
                    
                    <TextField
                      label="From Email Address"
                      type="email"
                      value={fromEmail}
                      onChange={setFromEmail}
                      autoComplete="email"
                      requiredIndicator
                      helpText="The email address members will see as the sender"
                    />
                    
                    <TextField
                      label="From Name"
                      value={fromName}
                      onChange={setFromName}
                      autoComplete="off"
                      requiredIndicator
                      helpText="The name members will see as the sender (e.g., 'Napa Valley Wines')"
                    />
                    
                    <TextField
                      label="List ID (Optional)"
                      value={listId}
                      onChange={setListId}
                      autoComplete="off"
                      helpText="Your Klaviyo list ID for segmentation (optional)"
                    />
                  </BlockStack>
                )}
                
                {isMailchimp && (
                  <Card>
                    <BlockStack gap="200">
                      <Banner tone="warning">
                        Mailchimp needs your data-center prefix, marketing access token, and verified sender info.
                        Set up your journeys/flows in Mailchimp before turning on automations here.
                      </Banner>
                      <Text variant="headingMd" as="h3">
                        Mailchimp Automations Checklist
                      </Text>
                      <Text variant="bodyMd" tone="subdued" as="p">
                        LiberoVino will only trigger tags—Journeys/Flows must be created and activated in Mailchimp.
                      </Text>
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text as="p">Audience</Text>
                          <Text as="p" tone="subdued">`LiberoVino Members`</Text>
                        </InlineStack>
                        <ul>
                          <li><strong>LiberoVino::Test</strong> – Send the seeded “LiberoVino – Test” template.</li>
                          <li><strong>LiberoVino::ClubSignup</strong> – Welcome members immediately after enrollment.</li>
                          <li><strong>LiberoVino::MonthlyStatus</strong> – Monthly status update automation.</li>
                          <li><strong>LiberoVino::ExpirationWarning</strong> – Warn members 7 days before duration end.</li>
                        </ul>
                      </BlockStack>
                      <Checkbox
                        label="Journeys/flows created and activated"
                        helpText="Required: the app only publishes tags; you must wire each tag to an active automation."
                        checked={mailchimpChecklistAcknowledged}
                        onChange={setMailchimpChecklistAcknowledged}
                      />
                    </BlockStack>
                  </Card>
                )}

                {/* Mailchimp Configuration */}
                {isMailchimp && (
                  <BlockStack gap="400">
                    <TextField
                      label="Server Prefix (data center)"
                      value={mailchimpServerPrefix}
                      onChange={setMailchimpServerPrefix}
                      autoComplete="off"
                      requiredIndicator
                      helpText="Found in your Mailchimp API URL (e.g., us21)"
                    />

                    <TextField
                      label="Marketing access token or API key"
                      type="password"
                      value={mailchimpMarketingToken}
                      onChange={setMailchimpMarketingToken}
                      autoComplete="off"
                      requiredIndicator
                      helpText="OAuth access token or classic API key for Marketing API calls"
                    />

                    <TextField
                      label="From Email Address"
                      type="email"
                      value={fromEmail}
                      onChange={setFromEmail}
                      autoComplete="email"
                      requiredIndicator
                      helpText="Must match a verified domain in Mailchimp"
                    />

                    <TextField
                      label="From Name"
                      value={fromName}
                      onChange={setFromName}
                      autoComplete="off"
                      requiredIndicator
                      helpText="Displayed sender name"
                    />

                    <TextField
                      label="Audience name (optional)"
                      value={mailchimpAudienceName}
                      onChange={setMailchimpAudienceName}
                      autoComplete="off"
                      helpText="Used as the default audience when seeding resources"
                    />
                  </BlockStack>
                )}

                {/* SendGrid Info */}
                {provider === 'sendgrid' && (
                  <Banner tone="success">
                    No configuration needed. LiberoVino will handle email sending using our managed SendGrid account. 
                    You can always switch to Klaviyo later for advanced features.
                  </Banner>
                )}
                
                {/* Email Settings */}
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">
                    Email Preferences
                  </Text>
                  
                  <Checkbox
                    label="Send monthly status emails"
                    checked={sendMonthlyStatus}
                    onChange={setSendMonthlyStatus}
                    helpText="Automatically send members their tier status and benefits each month"
                  />
                  
                  <Checkbox
                    label="Send expiration warnings"
                    checked={sendExpirationWarnings}
                    onChange={setSendExpirationWarnings}
                    helpText="Notify members when their membership duration is ending soon"
                  />

                  {isKlaviyo && (
                    <Checkbox
                      label="Enable promotional Klaviyo flows"
                      checked={includeMarketing}
                      onChange={setIncludeMarketing}
                      helpText="Seeds optional marketing automations (promo, annual re-sign, sales spotlight)."
                    />
                  )}
 
                   {sendExpirationWarnings && (
                    <TextField
                      label="Warning days before duration end"
                      type="number"
                      value={warningDays}
                      onChange={setWarningDays}
                      autoComplete="off"
                      min={1}
                      max={30}
                      helpText="How many days before duration ends to send warning email (1-30 days)"
                    />
                  )}
                </BlockStack>
                
                {/* Hidden Inputs */}
                <input type="hidden" name="intent" value="save" />
                <input type="hidden" name="provider" value={provider} />
                <input
                  type="hidden"
                  name="api_key"
                  value={provider === 'klaviyo' ? apiKey : ''}
                />
                <input type="hidden" name="from_email" value={fromEmail} />
                <input type="hidden" name="from_name" value={fromName} />
                <input type="hidden" name="list_id" value={listId} />
                <input type="hidden" name="send_monthly_status" value={sendMonthlyStatus.toString()} />
                <input type="hidden" name="send_expiration_warnings" value={sendExpirationWarnings.toString()} />
                <input type="hidden" name="warning_days" value={warningDays} />
                <input type="hidden" name="include_marketing" value={includeMarketing.toString()} />
                <input type="hidden" name="server_prefix" value={mailchimpServerPrefix} />
                <input type="hidden" name="marketing_access_token" value={mailchimpMarketingToken} />
                <input type="hidden" name="audience_name" value={mailchimpAudienceName} />
                <input
                  type="hidden"
                  name="mailchimp_ack"
                  value={mailchimpChecklistAcknowledged ? 'true' : 'false'}
                />
                
                <InlineStack align="space-between">
                  <Button
                    onClick={() => navigate(addSessionToUrl('/app/setup/tiers', session.id))}
                  >
                    ← Back
                  </Button>
                  
                  <Button
                    variant="primary"
                    submit
                    size="large"
                  >
                    Continue to Review →
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>

        {/* Test Email */}
        {(provider === 'klaviyo' ||
          provider === 'sendgrid' ||
          (provider === 'mailchimp' && mailchimpChecklistAcknowledged)) && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">
                  Send Test Email
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {provider === 'klaviyo'
                    ? 'Triggers the LiberoVino Test Flow in Klaviyo using your current settings. Use this to confirm API keys, sender info, and that the flow is set to Live.'
                    : provider === 'mailchimp'
                      ? 'Applies the LiberoVino::Test tag in Mailchimp. Make sure the “LiberoVino – Test” journey is active to receive the email.'
                      : 'Sends a simple transactional email via SendGrid using your current settings. Use this to confirm API keys and domain settings are correct.'}
                </Text>

                <Form method="post">
                  <input type="hidden" name="intent" value="send_test" />
                  <input type="hidden" name="provider" value={provider} />

                  <BlockStack gap="200">
                    <TextField
                      label="Recipient email"
                      type="email"
                      value={testEmail}
                      onChange={setTestEmail}
                      autoComplete="email"
                      requiredIndicator
                    />

                    <input type="hidden" name="test_email" value={testEmail} />

                    <InlineStack gap="200">
                      <Button submit>Send Test Email</Button>
                    </InlineStack>
                  </BlockStack>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

