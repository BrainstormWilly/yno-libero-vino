import { useState } from 'react';
import { Form, useNavigation } from 'react-router';
import { Card, BlockStack, Text, Banner, TextField, InlineStack, Button } from '@shopify/polaris';
import EmailPreferencesForm from '../EmailPreferencesForm';
import type { EmailProviderComponentProps } from './types';

export default function KlaviyoEmailProvider({ existingConfig, actionData }: EmailProviderComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  // Use existingConfig from props (from route loader) for initial values
  const config = existingConfig;
  const providerData = (config?.provider_data as Record<string, unknown> | null) ?? null;
  
  const readProviderBoolean = (key: string, fallback = false) => {
    const value = providerData?.[key];
    return typeof value === 'boolean' ? (value as boolean) : fallback;
  };

  const [apiKey, setApiKey] = useState(
    config?.email_provider === 'klaviyo' ? config.email_api_key ?? '' : ''
  );
  const [fromEmail, setFromEmail] = useState(config?.email_from_address || '');
  const [fromName, setFromName] = useState(config?.email_from_name || '');
  const [listId, setListId] = useState(config?.email_list_id || '');
  const [warningDays, setWarningDays] = useState(
    (config?.warning_days_before || 7).toString()
  );
  const [testEmail, setTestEmail] = useState('');

  // Handlers
  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
  };

  const handleFromEmailChange = (value: string) => {
    setFromEmail(value);
  };

  const handleFromNameChange = (value: string) => {
    setFromName(value);
  };

  const handleListIdChange = (value: string) => {
    setListId(value);
  };

  const handleWarningDaysChange = (value: string) => {
    setWarningDays(value);
  };

  return (
    <BlockStack gap="400">
      {/* Main Configuration Form */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Email Provider: Klaviyo
          </Text>
          
          <BlockStack gap="400">
            <Banner tone="info">
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  Finding Your Klaviyo API Key
                </Text>
                <Text as="p" variant="bodySm">
                  1. Log in to your Klaviyo account
                </Text>
                <Text as="p" variant="bodySm">
                  2. Go to <strong>Account → Settings → API Keys</strong>
                </Text>
                <Text as="p" variant="bodySm">
                  3. Click <strong>"Create Private API Key"</strong> (if you don't have one)
                </Text>
                <Text as="p" variant="bodySm">
                  4. Copy the key (starts with <code>pk_</code>) and paste it below
                </Text>
              </BlockStack>
            </Banner>
            
            <TextField
              label="Klaviyo API Key"
              type="password"
              value={apiKey}
              onChange={handleApiKeyChange}
              autoComplete="off"
              requiredIndicator
              helpText="Your Klaviyo private API key (starts with 'pk_')"
            />
            
            <TextField
              label="From Email Address"
              type="email"
              value={fromEmail}
              onChange={handleFromEmailChange}
              autoComplete="email"
              requiredIndicator
              helpText="The email address members will see as the sender. Must be a verified sender in Klaviyo."
            />
            
            <TextField
              label="From Name"
              value={fromName}
              onChange={handleFromNameChange}
              autoComplete="off"
              requiredIndicator
              helpText="The name members will see as the sender (e.g., 'Napa Valley Wines')"
            />
            
            <TextField
              label="List ID (Optional)"
              value={listId}
              onChange={handleListIdChange}
              autoComplete="off"
              helpText="Your Klaviyo list ID for segmentation. Find this in Lists → [Your List] → Settings → List ID (optional)"
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
          <Text variant="bodyMd" as="p" tone="subdued">
            Send a test email to verify your Klaviyo configuration. This will trigger the LiberoVino Test Flow in Klaviyo using your current settings. Once confirmed, you can proceed to template setup.
          </Text>

          {/* Result Banner - Hide during submission to clear previous results */}
          {actionData && actionData.message && !isSubmitting && (
            <Banner 
              tone={actionData.success ? 'success' : 'critical'} 
              title={actionData.message}
            />
          )}

          <Form method="post">
            <input type="hidden" name="intent" value="confirm_provider" />
            {/* Include current config for temporary save before testing */}
            <input type="hidden" name="email_provider" value="klaviyo" />
            {config?.sms_provider && (
              <input type="hidden" name="sms_provider" value={config.sms_provider} />
            )}
            <input type="hidden" name="email_api_key" value={apiKey} />
            <input type="hidden" name="email_from_address" value={fromEmail} />
            <input type="hidden" name="email_from_name" value={fromName} />
            <input type="hidden" name="email_list_id" value={listId} />
            {/* Transactional notifications are always enabled */}
            <input type="hidden" name="send_monthly_status" value="true" />
            <input type="hidden" name="send_expiration_warnings" value="true" />
            <input type="hidden" name="warning_days_before" value={warningDays} />
            {/* Provider data (marketing flows will always be seeded) */}
            {config?.provider_data && (
              <input type="hidden" name="provider_data" value={JSON.stringify(config.provider_data)} />
            )}

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

              <InlineStack gap="200">
                <Button submit variant="primary" loading={isSubmitting} disabled={isSubmitting}>
                  {isSubmitting ? 'Sending test email...' : 'Confirm Provider'}
                </Button>
              </InlineStack>
            </BlockStack>
          </Form>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

