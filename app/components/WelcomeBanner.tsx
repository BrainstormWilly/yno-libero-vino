import { Banner, BlockStack, Text } from '@shopify/polaris';

interface WelcomeBannerProps {
  orgName: string;
  crmName: string;
}

export function WelcomeBanner({ orgName, crmName }: WelcomeBannerProps) {
  return (
    <Banner tone="success" title={`Welcome to Libero Vino, ${orgName}!`}>
      <BlockStack gap="200">
        <Text variant="bodyMd" as="p">
          Your {crmName} account has been successfully connected. Let's get your wine club and loyalty programs set up!
        </Text>
        <Text variant="bodyMd" as="p">
          Complete the setup steps below to start using Libero Vino. All settings are optional and can be configured later from your dashboard.
        </Text>
      </BlockStack>
    </Banner>
  );
}

