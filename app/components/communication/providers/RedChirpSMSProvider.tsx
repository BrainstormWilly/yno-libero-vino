import { useState } from 'react';
import { Form } from 'react-router';
import { Card, BlockStack, Text, Banner, TextField, InlineStack, Button } from '@shopify/polaris';
import type { SMSProviderComponentProps } from './types';

export default function RedChirpSMSProvider({ existingConfig }: SMSProviderComponentProps) {
  const [smsApiKey, setSmsApiKey] = useState(existingConfig?.sms_api_key || '');
  const [smsFromNumber, setSmsFromNumber] = useState(existingConfig?.sms_from_number || '');
  const [testPhone, setTestPhone] = useState('');

  return (
    <BlockStack gap="400">
      {/* Main Configuration Form */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            SMS Provider: RedChirp
          </Text>

          <Banner tone="info">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                Finding Your RedChirp API Credentials
              </Text>
              <Text as="p" variant="bodySm">
                1. Log in to your RedChirp account
              </Text>
              <Text as="p" variant="bodySm">
                2. Go to <strong>Settings → API Keys</strong>
              </Text>
              <Text as="p" variant="bodySm">
                3. Generate a new API key (if you don't have one)
              </Text>
              <Text as="p" variant="bodySm">
                4. Copy the API key and paste it below
              </Text>
            </BlockStack>
          </Banner>

          <TextField
            label="RedChirp API Key"
            type="password"
            value={smsApiKey}
            onChange={setSmsApiKey}
            autoComplete="off"
            requiredIndicator
            helpText="Your RedChirp API key"
          />

          <TextField
            label="From Phone Number"
            type="tel"
            value={smsFromNumber}
            onChange={setSmsFromNumber}
            autoComplete="tel"
            requiredIndicator
            helpText="The phone number members will see as the sender (E.164 format: +1XXXXXXXXXX)"
          />
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
            {existingConfig?.sms_provider && (
              <input type="hidden" name="sms_provider" value={existingConfig.sms_provider} />
            )}
            <input type="hidden" name="sms_api_key" value={smsApiKey} />
            <input type="hidden" name="sms_from_number" value={smsFromNumber} />
            {existingConfig?.email_provider && (
              <input type="hidden" name="email_provider" value={existingConfig.email_provider} />
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

