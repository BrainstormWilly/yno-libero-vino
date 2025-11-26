import { Card, BlockStack, Text, Badge, InlineGrid, Box } from '@shopify/polaris';

interface CommunicationSummaryProps {
  emailProvider?: string | null;
  smsProvider?: string | null;
  emailTestResult?: {
    success: boolean;
    message: string;
  } | null;
  smsTestResult?: {
    success: boolean;
    message: string;
  } | null;
}

export default function CommunicationSummary({
  emailProvider,
  smsProvider,
  emailTestResult,
  smsTestResult,
}: CommunicationSummaryProps) {
  const getProviderDisplayName = (provider: string | null | undefined) => {
    if (!provider) return 'Not selected';
    if (provider === 'sendgrid') return 'LiberoVino Managed';
    if (provider === 'twilio') return 'LiberoVino Managed';
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  return (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h2">
        Summary
      </Text>
      
      {/* Email Provider Card */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                Email Provider
              </Text>
              {emailProvider && (
                <Badge tone="success">Configured</Badge>
              )}
            </InlineGrid>
          </Box>
          
          <Text as="p" variant="bodyMd">
            <strong>Provider:</strong> {getProviderDisplayName(emailProvider)}
          </Text>

          {emailTestResult && (
            <Box paddingBlockStart="200">
              <Text
                as="p"
                variant="bodySm"
                tone={emailTestResult.success ? 'success' : 'critical'}
              >
                <strong>Test Result:</strong> {emailTestResult.message}
              </Text>
            </Box>
          )}
        </BlockStack>
      </Card>

      {/* SMS Provider Card */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                SMS Provider
              </Text>
              {smsProvider && (
                <Badge tone="success">Configured</Badge>
              )}
            </InlineGrid>
          </Box>
          
          <Text as="p" variant="bodyMd">
            <strong>Provider:</strong> {getProviderDisplayName(smsProvider)}
          </Text>

          {smsTestResult && (
            <Box paddingBlockStart="200">
              <Text
                as="p"
                variant="bodySm"
                tone={smsTestResult.success ? 'success' : 'critical'}
              >
                <strong>Test Result:</strong> {smsTestResult.message}
              </Text>
            </Box>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

