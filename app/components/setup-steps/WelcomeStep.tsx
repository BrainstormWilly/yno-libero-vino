import { Card, BlockStack, Text, Divider, Box } from '@shopify/polaris';

export default function WelcomeStep() {
  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingLg" as="h2">
          Welcome to LiberoVino! 🍷
        </Text>
        
        <Text variant="bodyLg" as="p">
          You're about to set up a revolutionary wine club experience that liberates your members from traditional club constraints.
        </Text>
        
        <Divider />
        
        <BlockStack gap="300">
          <Text variant="headingMd" as="h3">
            What Makes LiberoVino Different?
          </Text>
          
          <BlockStack gap="200">
            <Box>
              <Text variant="bodyMd" as="p" fontWeight="semibold">✨ Member Freedom</Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                No forced shipments. Members buy when they're ready, within their duration window.
              </Text>
            </Box>
            
            <Box>
              <Text variant="bodyMd" as="p" fontWeight="semibold">📈 Tier Progression</Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Members advance through tiers by purchasing more, unlocking better discounts.
              </Text>
            </Box>
            
            <Box>
              <Text variant="bodyMd" as="p" fontWeight="semibold">⏰ Duration-Based Benefits</Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Members extend their duration with each purchase. No "expiration" pressure.
              </Text>
            </Box>
            
            <Box>
              <Text variant="bodyMd" as="p" fontWeight="semibold">🎁 Loyalty Rewards</Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                After 1 year, members earn points on every purchase for additional rewards.
              </Text>
            </Box>
          </BlockStack>
        </BlockStack>
        
        <Divider />
        
        <Text variant="bodyMd" as="p" tone="subdued">
          This setup will take about 5 minutes. Let's liberate your wine club!
        </Text>
      </BlockStack>
    </Card>
  );
}

