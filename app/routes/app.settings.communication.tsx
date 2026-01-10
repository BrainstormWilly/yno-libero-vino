/**
 * Communication Settings Page
 * 
 * Allows clients to view and manage their communication configuration,
 * including email/SMS providers and email settings.
 */

import { type LoaderFunctionArgs, type ActionFunctionArgs, Form, useLoaderData, useActionData, useLocation, useSubmit } from 'react-router';
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
import { sendClientTestEmail, sendClientTestSMS } from '~/lib/communication/communication.service.server';
import { normalizeConfigForCreate } from '~/lib/communication/communication-helpers';

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
  

  // Sync state with loader data
  useEffect(() => {
    setEmailProvider(communicationConfig?.email_provider ?? null);
    setWarningDaysBefore(String(communicationConfig?.warning_days_before || 7));
    setSmsActivated(!!communicationConfig?.sms_provider);
  }, [communicationConfig]);

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
  }, [actionData]);

  // Handle SMS activated checkbox change
  const handleSmsActivatedChange = (checked: boolean) => {
    setSmsActivated(checked);
    const formData = new FormData();
    formData.append('intent', 'update_sms_activated');
    formData.append('sms_activated', checked.toString());
    submit(formData, { method: 'post' });
  };

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
                <Text variant="headingMd" as="h3">
                  Email Provider
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Choose your preferred email provider for sending communications to members.
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

                <InlineStack gap="200">
                  <Button submit variant="primary">
                    Save Provider
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

                            <Button submit variant="primary">
                              Save
                            </Button>
                        </InlineStack>
                      </BlockStack>
                    </Form>

                    <InlineStack gap="200">
                      {emailProvider === 'sendgrid' ? (
                        <Button 
                          url={addSessionToUrl('/app/settings/communication/email_templates', session.id)}
                          variant="secondary"
                        >
                          Manage Templates
                        </Button>
                      ) : (
                        <Button 
                          variant="secondary"
                          disabled
                        >
                          Download Templates
                        </Button>
                      )}
                      <Button onClick={() => setShowTestEmailModal(true)}>
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
                  label="Activated"
                  checked={smsActivated}
                  onChange={handleSmsActivatedChange}
                  disabled={emailProvider !== 'sendgrid'}
                  helpText={
                    emailProvider !== 'sendgrid' 
                      ? "SMS is only available with LiberoVino Managed email provider"
                      : smsActivated 
                        ? "SMS is activated and ready to send messages" 
                        : "Enable SMS to send messages to members"
                  }
                />

                <InlineStack gap="200">
                  <Button 
                    onClick={() => setShowTestSmsModal(true)}
                    disabled={!smsActivated}
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
