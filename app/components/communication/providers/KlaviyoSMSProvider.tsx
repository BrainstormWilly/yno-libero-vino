import { Card, BlockStack, Text, Banner } from '@shopify/polaris';
import type { SMSProviderComponentProps } from './types';

export default function KlaviyoSMSProvider({ existingConfig }: SMSProviderComponentProps) {
  return (
    <BlockStack gap="400">
      {/* Main Configuration Form */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            SMS Provider: Klaviyo SMS
          </Text>

          <Banner tone="info">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                Integrated with Klaviyo Email
              </Text>
              <Text as="p" variant="bodySm">
                SMS is integrated with your Klaviyo email setup. All Klaviyo flows are created with both email and SMS steps included.
              </Text>
              <Text as="p" variant="bodySm">
                You can test both email and SMS together from the Email setup page.
              </Text>
            </BlockStack>
          </Banner>

          <Banner tone="warning">
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                Not Using SMS?
              </Text>
              <Text as="p" variant="bodySm">
                If you don't want to use SMS for cost or other reasons, you'll need to manually remove the SMS steps from your flows in the Klaviyo UI. 
                The flows are created with SMS steps by default, but you can edit them in Klaviyo to remove SMS if needed.
              </Text>
            </BlockStack>
          </Banner>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

