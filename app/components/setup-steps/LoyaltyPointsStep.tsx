import { Card, BlockStack, Text, TextField, Banner, Divider, InlineStack, Box } from '@shopify/polaris';

interface LoyaltyPointsStepProps {
  pointsPerDollar: string;
  minMembershipDays: string;
  pointDollarValue: string;
  minPointsRedemption: string;
  onPointsPerDollarChange: (value: string) => void;
  onMinMembershipDaysChange: (value: string) => void;
  onPointDollarValueChange: (value: string) => void;
  onMinPointsRedemptionChange: (value: string) => void;
}

export default function LoyaltyPointsStep({
  pointsPerDollar,
  minMembershipDays,
  pointDollarValue,
  minPointsRedemption,
  onPointsPerDollarChange,
  onMinMembershipDaysChange,
  onPointDollarValueChange,
  onMinPointsRedemptionChange,
}: LoyaltyPointsStepProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingLg" as="h2">
          Loyalty Points Configuration
        </Text>
        
        <Text variant="bodyMd" as="p" tone="subdued">
          After members reach 1 year of cumulative membership, they'll start earning loyalty points on every purchase.
        </Text>
        
        <Banner tone="info">
          <Text as="p">
            <strong>Why 1 Year?</strong> This creates a compound incentive - members get tier benefits immediately, then unlock points after showing loyalty. It encourages long-term engagement.
          </Text>
        </Banner>
        
        <Divider />
        
        <InlineStack gap="400">
          <Box minWidth="200px">
            <TextField
              label="Points Per Dollar"
              type="number"
              value={pointsPerDollar}
              onChange={onPointsPerDollarChange}
              helpText="Points earned per $1 spent"
              autoComplete="off"
            />
          </Box>
          
          <Box minWidth="200px">
            <TextField
              label="Days to Start Earning"
              type="number"
              value={minMembershipDays}
              onChange={onMinMembershipDaysChange}
              helpText="Cumulative membership days"
              autoComplete="off"
            />
          </Box>
        </InlineStack>
        
        <InlineStack gap="400">
          <Box minWidth="200px">
            <TextField
              label="Point Dollar Value"
              type="number"
              value={pointDollarValue}
              onChange={onPointDollarValueChange}
              prefix="$"
              helpText="Value of each point ($0.01 = 100 pts = $1)"
              autoComplete="off"
            />
          </Box>
          
          <Box minWidth="200px">
            <TextField
              label="Min Points for Redemption"
              type="number"
              value={minPointsRedemption}
              onChange={onMinPointsRedemptionChange}
              helpText="Minimum points needed to redeem"
              autoComplete="off"
            />
          </Box>
        </InlineStack>
        
        <Banner>
          <Text as="p">
            <strong>Example:</strong> With these defaults, a member spending $100 earns 100 points worth $1. They need 100 points minimum to redeem.
          </Text>
        </Banner>
      </BlockStack>
    </Card>
  );
}

