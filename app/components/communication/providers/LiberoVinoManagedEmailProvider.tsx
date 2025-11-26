import { useState } from 'react';
import { Form, useNavigation } from 'react-router';
import { Card, BlockStack, Text, Banner, TextField, InlineStack, Button } from '@shopify/polaris';
import EmailPreferencesForm from '../EmailPreferencesForm';
import type { EmailProviderComponentProps } from './types';

export default function LiberoVinoManagedEmailProvider({ existingConfig, actionData }: EmailProviderComponentProps) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  
  const config = existingConfig;
  
  const [warningDays, setWarningDays] = useState(
    (config?.warning_days_before || 7).toString()
  );
  const [testEmail, setTestEmail] = useState(config?.email_from_address || '');

  const handleWarningDaysChange = (value: string) => {
    setWarningDays(value);
  };

  return (
    <BlockStack gap="400">
      {/* Main Configuration Form */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Email Provider: LiberoVino Managed
          </Text>
          
          <Banner tone="success">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                No Configuration Needed
              </Text>
              <Text as="p" variant="bodySm">
                LiberoVino will handle all email sending using our managed SendGrid account. 
                You can always switch to Klaviyo or Mailchimp later for advanced features.
              </Text>
            </BlockStack>
          </Banner>
          
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
              Send a test email to verify your SendGrid configuration. This will send a simple transactional email via SendGrid using your current settings. Once confirmed, you can proceed to template setup.
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
              {config?.email_provider && (
                <input type="hidden" name="email_provider" value={config.email_provider} />
              )}
              {/* Transactional notifications are always enabled */}
              <input type="hidden" name="send_monthly_status" value="true" />
              <input type="hidden" name="send_expiration_warnings" value="true" />
              {config?.warning_days_before !== undefined && config.warning_days_before !== null && (
                <input type="hidden" name="warning_days_before" value={config.warning_days_before.toString()} />
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

