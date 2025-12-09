import { Card, BlockStack, Text, Badge, InlineStack, InlineGrid, Box, Divider, List } from '@shopify/polaris';

interface TierSummaryProps {
  tier: {
    id: string;
    name: string;
    duration_months: number;
    min_purchase_amount: number;
    min_ltv_amount?: number;
    c7_club_id?: string | null;
  };
  promotions: Array<{
    id: string;
    title: string;
    c7Data?: any;
  }>;
  loyalty: {
    earn_rate: number;
    initial_points_bonus: number;
  } | null;
}

export default function TierSummary({ tier, promotions, loyalty }: TierSummaryProps) {
  return (
    <BlockStack gap="400">
      {/* Tier Details Card */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                Tier Summary
              </Text>
              {tier.c7_club_id && (
                <Badge tone="success">Synced to C7</Badge>
              )}
            </InlineGrid>
          </Box>
          
          <dl className="onIndent">
            <dd>
              <Text as="span" variant="bodyMd">
                <strong>Name:</strong> {tier.name}
              </Text>
            </dd>
            <dd>
              <Text as="span" variant="bodyMd">
                <strong>Duration:</strong> {tier.duration_months} months
              </Text>
            </dd>
            <dd>
              <Text as="span" variant="bodyMd">
                <strong>Min Purchase:</strong> ${tier.min_purchase_amount}
              </Text>
            </dd>
            <dd>
              <Text as="span" variant="bodyMd">
                <strong>Min LTV:</strong> ${tier.min_ltv_amount || 0}
              </Text>
            </dd>
          </dl>
        </BlockStack>
      </Card>
      
      {/* Promotions Card */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                Promotions
              </Text>
              <Badge tone={promotions.length > 0 ? 'success' : 'attention'}>
                {promotions.length.toString()}
              </Badge>
            </InlineGrid>
          </Box>
          
          {promotions.length === 0 && (
            <Text as="p" variant="bodySm" tone="subdued">
              No promotions configured
            </Text>
          )}
          
          {promotions.length > 0 && (
            <BlockStack gap="300">
              {promotions.map((promo, index) => (
                <div key={promo.id}>
                  {index > 0 && <Divider />}
                  <Box paddingBlockStart={index > 0 ? "300" : undefined}>
                    <BlockStack gap="100">
                      <Text as="span" variant="headingSm">
                        {promo.title || promo.c7Data?.title || 'Untitled Promotion'}
                      </Text>
                      {promo.c7Data && (
                        <BlockStack gap="050">
                          <Text as="span" variant="bodySm" tone="subdued">
                            {promo.c7Data.type} · {promo.c7Data.discountType}
                          </Text>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {promo.c7Data.discountType === 'Percentage Off' 
                              ? `${(promo.c7Data.discount / 100).toFixed(0)}% off` 
                              : `$${promo.c7Data.discount} off`
                            }
                          </Text>
                          {promo.c7Data.appliesTo !== 'Store' && (
                            <Text as="span" variant="bodySm" tone="subdued">
                              Applies to: {promo.c7Data.appliesTo}
                            </Text>
                          )}
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Box>
                </div>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </Card>
      
      {/* Loyalty Card */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                Loyalty
              </Text>
              {loyalty && (
                <Badge tone="info">Enabled</Badge>
              )}
            </InlineGrid>
          </Box>
          
          {!loyalty && (
            <Text as="p" variant="bodySm" tone="subdued">
              No loyalty rewards configured
            </Text>
          )}
          
          {loyalty && (
            <dl className="onIndent">
              <dd>
                <Text as="span" variant="bodyMd">
                  <strong>Earn Rate:</strong> {(loyalty.earn_rate * 100).toFixed(0)}% per dollar
                </Text>
              </dd>
              {loyalty.initial_points_bonus > 0 && (
                <dd>
                  <Text as="span" variant="bodyMd">
                    <strong>Welcome Bonus:</strong> {loyalty.initial_points_bonus} points
                  </Text>
                </dd>
              )}
            </dl>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

