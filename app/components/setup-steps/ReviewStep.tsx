import { Card, BlockStack, Text, Divider, Box, Banner } from '@shopify/polaris';
import type { Discount } from '~/types/discount';

interface TierFormData {
  id: string;
  name: string;
  durationMonths: string;
  minPurchaseAmount: string;
  description?: string;
  
  // NEW ARCHITECTURE: Multiple promotions per tier
  promotions: Array<{
    id: string;
    title: string;
    productDiscountType?: string;
    productDiscount?: number;
    shippingDiscountType?: string;
    shippingDiscount?: number;
    minimumCartAmount?: number;
  }>;
  
  // NEW ARCHITECTURE: Optional loyalty configuration
  loyalty?: {
    enabled: boolean;
    earnRate: number;
    initialPointsBonus?: number;
  };
  
  // OLD FIELDS (deprecated, for backwards compatibility)
  discountPercentage?: string;
  discount?: Discount;
}

interface ReviewStepProps {
  clubName: string;
  clubDescription: string;
  tiers: TierFormData[];
  pointsPerDollar: string;
  minMembershipDays: string;
  pointDollarValue: string;
  minPointsRedemption: string;
}

export default function ReviewStep({
  clubName,
  clubDescription,
  tiers,
  pointsPerDollar,
  minMembershipDays,
  pointDollarValue,
  minPointsRedemption,
}: ReviewStepProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingLg" as="h2">
          Review & Launch
        </Text>
        
        <Text variant="bodyMd" as="p" tone="subdued">
          Review your club configuration below. You can edit these settings later from your dashboard.
        </Text>
        
        <Divider />
        
        {/* Club Overview */}
        <BlockStack gap="200">
          <Text variant="headingMd" as="h3">Club Details</Text>
          <Box background="bg-surface-secondary" padding="300" borderRadius="200">
            <BlockStack gap="100">
              <Text variant="bodyMd" as="p" fontWeight="semibold">{clubName}</Text>
              <Text variant="bodyMd" as="p" tone="subdued">{clubDescription}</Text>
            </BlockStack>
          </Box>
        </BlockStack>
        
        {/* Tiers Overview */}
        <BlockStack gap="200">
          <Text variant="headingMd" as="h3">Membership Tiers ({tiers.length})</Text>
          {tiers.map((tier, index) => (
            <Box key={tier.id} background="bg-surface-secondary" padding="300" borderRadius="200">
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  {index + 1}. {tier.name}
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {tier.discountPercentage}% discount • {tier.durationMonths} months duration • ${tier.minPurchaseAmount} min purchase
                </Text>
                {tier.discount && (
                  <>
                    <Text variant="bodySm" as="p" tone="subdued">
                      💳 Discount Code: <strong>{tier.discount.code || '(auto-generated)'}</strong>
                    </Text>
                    {(tier.discount.appliesTo.scope === "all" || tier.discount.appliesTo.all === true) && (
                      <Text variant="bodySm" as="p" tone="subdued">
                        ✅ Applies to all products
                      </Text>
                    )}
                    {tier.discount.appliesTo.scope !== "all" && tier.discount.appliesTo.all !== true && (
                      <>
                        {tier.discount.appliesTo.products.length > 0 && (
                          <Text variant="bodySm" as="p" tone="subdued">
                            📦 {tier.discount.appliesTo.products.length} product(s) selected
                          </Text>
                        )}
                        {tier.discount.appliesTo.collections.length > 0 && (
                          <Text variant="bodySm" as="p" tone="subdued">
                            📚 {tier.discount.appliesTo.collections.length} collection(s) selected
                          </Text>
                        )}
                      </>
                    )}
                  </>
                )}
                {tier.description && (
                  <Text variant="bodySm" as="p" tone="subdued">
                    {tier.description}
                  </Text>
                )}
              </BlockStack>
            </Box>
          ))}
        </BlockStack>
        
        {/* Loyalty Points Overview */}
        <BlockStack gap="200">
          <Text variant="headingMd" as="h3">Loyalty Points</Text>
          <Box background="bg-surface-secondary" padding="300" borderRadius="200">
            <BlockStack gap="100">
              <Text variant="bodyMd" as="p">
                {pointsPerDollar} point(s) per dollar after {minMembershipDays} days
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Point value: ${pointDollarValue} • Min redemption: {minPointsRedemption} points
              </Text>
            </BlockStack>
          </Box>
        </BlockStack>
        
        <Banner tone="success">
          <BlockStack gap="200">
            <Text as="p" fontWeight="semibold">
              Ready to Liberate Your Wine Club! 🎉
            </Text>
            <Text as="p">
              Click "Complete Setup" below to activate your LiberoVino club. Your members will experience wine buying freedom like never before.
            </Text>
          </BlockStack>
        </Banner>
      </BlockStack>
    </Card>
  );
}

