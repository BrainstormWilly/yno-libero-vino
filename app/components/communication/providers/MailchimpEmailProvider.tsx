import { useState } from 'react';
import { Form, useNavigation } from 'react-router';
import { Card, BlockStack, Text, Banner, TextField, InlineStack, Button, Checkbox, Box } from '@shopify/polaris';
import EmailPreferencesForm from '../EmailPreferencesForm';
import type { EmailProviderComponentProps } from './types';

export default function MailchimpEmailProvider({ existingConfig, actionData, hasSms = false }: EmailProviderComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  const config = existingConfig;
  const providerData = (config?.provider_data as Record<string, unknown> | null) ?? null;
  
  const readProviderString = (key: string) => {
    const value = providerData?.[key];
    return typeof value === 'string' ? value : '';
  };

  // Extract server prefix from API key (format: XXXXX-usX)
  const extractServerPrefix = (apiKey: string): string | null => {
    if (!apiKey) return null;
    const match = apiKey.match(/-([a-z]{2}\d+)$/i);
    return match ? match[1] : null;
  };

  const [marketingAccessToken, setMarketingAccessToken] = useState(
    readProviderString('marketingAccessToken')
  );
  const [fromEmail, setFromEmail] = useState(config?.email_from_address || '');
  const [fromName, setFromName] = useState(config?.email_from_name || '');
  const [audienceName, setAudienceName] = useState(readProviderString('audienceName'));
  const [checklistAcknowledged, setChecklistAcknowledged] = useState(
    Boolean(config?.provider_data && config?.email_provider === 'mailchimp')
  );
  const [warningDays, setWarningDays] = useState(
    (config?.warning_days_before || 7).toString()
  );
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');

  // Handlers
  const handleMarketingAccessTokenChange = (value: string) => {
    setMarketingAccessToken(value);
  };

  const handleFromEmailChange = (value: string) => {
    setFromEmail(value);
  };

  const handleFromNameChange = (value: string) => {
    setFromName(value);
  };

  const handleAudienceNameChange = (value: string) => {
    setAudienceName(value);
  };

  const handleChecklistAcknowledgedChange = (value: boolean) => {
    setChecklistAcknowledged(value);
  };

  const handleWarningDaysChange = (value: string) => {
    setWarningDays(value);
  };

  // Compute provider data with extracted server prefix
  const serverPrefix = extractServerPrefix(marketingAccessToken);
  const providerDataObj: Record<string, unknown> = {
    marketingAccessToken,
    audienceName: audienceName || null,
  };
  if (serverPrefix) {
    providerDataObj.serverPrefix = serverPrefix;
  }
  const providerDataValue = config?.provider_data
    ? JSON.stringify({
        ...(config.provider_data as Record<string, unknown>),
        ...providerDataObj,
      })
    : JSON.stringify(providerDataObj);

  return (
    <BlockStack gap="400">
      {/* Main Configuration Form */}
      <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">
              Email Provider: Mailchimp
            </Text>
            
            <Card>
              <BlockStack gap="200">
                <Banner tone="warning">
                  Mailchimp needs your marketing access token and verified sender info.
                  Set up your flows in Mailchimp before turning on automations here.
                </Banner>
                <Text variant="headingMd" as="h3">
                  Mailchimp Automations Checklist
                </Text>
                <Text variant="bodyMd" tone="subdued" as="p">
                  LiberoVino applies tags and updates merge fields to trigger your Mailchimp flows. You must create and activate flows in Mailchimp that respond to these triggers.
                </Text>
                <BlockStack gap="100">
                  <InlineStack align="space-between">
                    <Text as="p">Audience</Text>
                    <Text as="p" tone="subdued">`LiberoVino Members`</Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" fontWeight="semibold">
                    Tags (for all events):
                  </Text>
                  <ul>
                    <li><strong>LiberoVino::Test</strong> – Test email using the seeded "LiberoVino – Test" template. Trigger: "Tag added".</li>
                    <li><strong>LiberoVino::ClubSignup</strong> – Welcome members immediately after enrollment. Trigger: "Tag added".</li>
                    <li><strong>LiberoVino::MonthlyStatus</strong> – Monthly status update automation. Trigger: "Tag added".</li>
                    <li><strong>LiberoVino::ExpirationWarning</strong> – Warn members before duration end. Trigger: "Tag added".</li>
                  </ul>
                  <Box paddingBlockStart="200">
                    <Text as="p" variant="bodySm" fontWeight="semibold">
                      Merge Fields (for tracking):
                    </Text>
                  </Box>
                  <ul>
                    <li><strong>LVTEST</strong> – Updated each time a test is sent (YYYY-MM-DD format). Used for tracking when events were last sent.</li>
                    <li><strong>LVMONTH</strong> – Updated monthly with current date (YYYY-MM-DD format). Used for tracking.</li>
                    <li><strong>LVWARN</strong> – Updated when warning is sent (YYYY-MM-DD format). Used for tracking.</li>
                  </ul>
                  <Box paddingBlockStart="200">
                    <Text as="p" variant="bodySm" tone="subdued">
                      <strong>Note:</strong> LiberoVino automatically removes and re-adds tags for recurring events, which allows "Tag added" triggers to fire multiple times. Configure your flows to trigger on "Tag added" with the exact tag name. Merge fields are updated for tracking purposes and can be used in flow conditions if needed.
                    </Text>
                  </Box>
                </BlockStack>
                <Checkbox
                  label="Flows created and activated"
                  helpText="Required: LiberoVino applies tags and updates merge fields, but you must configure flows in Mailchimp to respond to these triggers. Templates are seeded automatically and can be used in your flows."
                  checked={checklistAcknowledged}
                  onChange={setChecklistAcknowledged}
                />
              </BlockStack>
            </Card>

            <BlockStack gap="400">
              <Banner tone="info">
                <BlockStack gap="200">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    Getting Your Mailchimp Marketing Access Token
                  </Text>
                  <Text as="p" variant="bodySm">
                    1. Log in to your Mailchimp account
                  </Text>
                  <Text as="p" variant="bodySm">
                    2. Go to <strong>Account → Extras → API keys</strong>
                  </Text>
                  <Text as="p" variant="bodySm">
                    3. Click <strong>"Create A Key"</strong> (if you don't have one)
                  </Text>
                  <Text as="p" variant="bodySm">
                    4. Copy the API key and paste it below
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Note: You can also use an OAuth access token if you've set up OAuth integration.
                  </Text>
                </BlockStack>
              </Banner>

              <TextField
                label="Marketing access token or API key"
                type="password"
                value={marketingAccessToken}
                onChange={handleMarketingAccessTokenChange}
                autoComplete="off"
                requiredIndicator
                helpText="OAuth access token or classic API key for Marketing API calls. The server prefix (e.g., us21) will be automatically extracted from the API key."
              />

              <TextField
                label="From Email Address"
                type="email"
                value={fromEmail}
                onChange={handleFromEmailChange}
                autoComplete="email"
                requiredIndicator
                helpText="Must match a verified domain in Mailchimp. Check Account → Settings → Verified domains."
              />

              <TextField
                label="From Name"
                value={fromName}
                onChange={handleFromNameChange}
                autoComplete="off"
                requiredIndicator
                helpText="Displayed sender name"
              />

              <TextField
                label="Audience name (optional)"
                value={audienceName}
                onChange={handleAudienceNameChange}
                autoComplete="off"
                helpText="Used as the default audience when seeding resources. Leave blank to use 'LiberoVino Members'."
              />
            </BlockStack>
            
            <EmailPreferencesForm
              warningDays={warningDays}
              onWarningDaysChange={handleWarningDaysChange}
            />

          </BlockStack>
        </Card>

      {/* Confirm Provider Section */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h3">
            Confirm Provider
          </Text>
          <BlockStack gap="200">
            <Text variant="bodyMd" as="p" tone="subdued">
              Be sure to make a live automation with a "Tag Added" trigger for tag <strong>LiberoVino::Test</strong> with a "Send Email" action prior to confirming provider.
            </Text>
            <Text variant="bodyMd" as="p" tone="subdued">
              When you click "Confirm Provider", this will send a test {hasSms ? 'email and SMS' : 'email'}:
            </Text>
            <ul>
              <li>Create or update the member in your Mailchimp audience</li>
              <li>Apply the <strong>LiberoVino::Test</strong> tag</li>
              <li>Update the <strong>LVTEST</strong> merge field with today's date</li>
            </ul>
            <Text variant="bodyMd" as="p" tone="subdued">
              LiberoVino automatically removes and re-adds the tag each time, allowing you to test multiple times. The <strong>LVTEST</strong> merge field is also updated for tracking purposes. Once confirmed, you can proceed to template setup.
            </Text>
          </BlockStack>

          {/* Result Banner - Hide during submission to clear previous results */}
          {actionData && actionData.message && !isSubmitting && (
            <Banner 
              tone={actionData.success ? 'success' : 'critical'} 
              title={actionData.message}
            />
          )}

          {!checklistAcknowledged && (
            <Banner tone="warning">
              Please acknowledge that flows are created and activated before confirming the provider.
            </Banner>
          )}

          <Form method="post">
            <input type="hidden" name="intent" value="confirm_provider" />
            {/* Include current config for temporary save before testing */}
            <input type="hidden" name="email_provider" value="mailchimp" />
            {config?.sms_provider && (
              <input type="hidden" name="sms_provider" value={config.sms_provider} />
            )}
            <input type="hidden" name="email_from_address" value={fromEmail} />
            <input type="hidden" name="email_from_name" value={fromName} />
            {/* Transactional notifications are always enabled */}
            <input type="hidden" name="send_monthly_status" value="true" />
            <input type="hidden" name="send_expiration_warnings" value="true" />
            <input type="hidden" name="warning_days_before" value={warningDays} />
            {/* Provider data - server prefix extracted from API key */}
            <input type="hidden" name="provider_data" value={providerDataValue} />

            <BlockStack gap="200">
              <TextField
                label="Recipient email"
                type="email"
                value={testEmail}
                onChange={setTestEmail}
                autoComplete="email"
                requiredIndicator
                disabled={isSubmitting}
                helpText="Enter an email address to receive a test message"
              />

              <input type="hidden" name="test_email" value={testEmail} />

              {/* Always show SMS field for Mailchimp - SMS is integrated with email provider */}
              <TextField
                label="Recipient phone (optional)"
                type="tel"
                value={testPhone}
                onChange={setTestPhone}
                autoComplete="tel"
                placeholder="+15551234567"
                disabled={isSubmitting}
                helpText="Test SMS will be sent via Mailchimp SMS (requires SMS API key to be configured)"
              />

              <input type="hidden" name="test_phone" value={testPhone} />

              <InlineStack gap="200">
                <Button submit variant="primary" loading={isSubmitting} disabled={isSubmitting || !checklistAcknowledged}>
                  {isSubmitting 
                    ? (testPhone ? 'Sending test email and SMS...' : 'Sending test email...')
                    : 'Confirm Provider'}
                </Button>
              </InlineStack>
            </BlockStack>
          </Form>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

