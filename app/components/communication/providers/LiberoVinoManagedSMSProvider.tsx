import { useState } from 'react';
import { Form } from 'react-router';
import { Card, BlockStack, Text, Banner, TextField, InlineStack, Button } from '@shopify/polaris';
import type { SMSProviderComponentProps } from './types';

export default function LiberoVinoManagedSMSProvider({ existingConfig }: SMSProviderComponentProps) {
  const config = existingConfig;
  
  const [testPhone, setTestPhone] = useState('');

  return (
    <BlockStack gap="400">
      {/* Main Configuration Form */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            SMS Provider: LiberoVino Managed
          </Text>

          <Banner tone="success">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                No Configuration Needed
              </Text>
              <Text as="p" variant="bodySm">
                LiberoVino will handle all SMS sending using our managed Twilio account.
                You can always switch to Klaviyo, Mailchimp, or RedChirp later for advanced features.
              </Text>
            </BlockStack>
          </Banner>
        </BlockStack>
      </Card>

      {/* Test SMS Section */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h3">
            Send Test SMS
          </Text>
          <Text variant="bodyMd" as="p" tone="subdued">
            Sends a simple test SMS using your current settings. Use this to confirm configuration is correct.
          </Text>

          <Form method="post">
            <input type="hidden" name="intent" value="send_test_sms" />
            {/* Include current config for temporary save before testing */}
            {config?.sms_provider && (
              <input type="hidden" name="sms_provider" value={config.sms_provider} />
            )}
            {config?.email_provider && (
              <input type="hidden" name="email_provider" value={config.email_provider} />
            )}

            <BlockStack gap="200">
              <TextField
                label="Recipient phone"
                type="tel"
                value={testPhone}
                onChange={setTestPhone}
                autoComplete="tel"
                requiredIndicator
                helpText="Format: +1XXXXXXXXXX"
              />

              <input type="hidden" name="test_phone" value={testPhone} />

              <InlineStack gap="200">
                <Button submit>Send Test SMS</Button>
              </InlineStack>
            </BlockStack>
          </Form>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

