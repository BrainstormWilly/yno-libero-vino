import { Card, BlockStack, Text, TextField, Banner, Divider, InlineStack, Button, Box } from '@shopify/polaris';
import { useMemo } from 'react';
import ProductCollectionSelector from '~/components/ProductCollectionSelector';
import type { Discount } from '~/types/discount';
import type { CrmProduct, CrmCollection } from '~/types/crm';

interface TierFormData {
  id: string;
  name: string;
  durationMonths: string;
  minPurchaseAmount: string;
  minLtvAmount?: string;
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
  showDiscountForm?: boolean;
}

interface TiersStepProps {
  tiers: TierFormData[];
  sessionCrmType: string;
  availableProducts: CrmProduct[];
  availableCollections: CrmCollection[];
  isLoading: boolean;
  onAddTier: () => void;
  onRemoveTier: (id: string) => void;
  onMoveTier: (index: number, direction: 'up' | 'down') => void;
  onUpdateTier: (id: string, field: keyof TierFormData, value: string) => void;
  onUpdateTierDiscount: (id: string, discount: Discount) => void;
  onToggleDiscountForm: (id: string) => void;
  onLoadProducts?: (q?: string) => void | Promise<void>;
  onLoadCollections?: (q?: string) => void | Promise<void>;
}

export default function TiersStep({
  tiers,
  sessionCrmType,
  availableProducts,
  availableCollections,
  isLoading,
  onAddTier,
  onRemoveTier,
  onMoveTier,
  onUpdateTier,
  onUpdateTierDiscount,
  onToggleDiscountForm,
  onLoadProducts,
  onLoadCollections,
}: TiersStepProps) {
  // Memoize calculated min purchase amounts for all tiers
  const tiersWithCalculatedPurchase = useMemo(() => {
    return tiers.map((tier) => {
      const minLtv = parseFloat(tier.minLtvAmount || '0');
      const duration = parseFloat(tier.durationMonths || '0');
      const calculatedMinPurchase = minLtv > 0 && duration > 0
        ? (minLtv * (duration / 12)).toFixed(2)
        : '0.00';
      
      return {
        ...tier,
        calculatedMinPurchase: `$${calculatedMinPurchase}`,
      };
    });
  }, [tiers]);

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingLg" as="h2">
          Create Your Tiers
        </Text>
        
        <Text variant="bodyMd" as="p" tone="subdued">
          Define membership tiers with different benefits. Members advance by purchasing more wine. You can create as many tiers as you like!
        </Text>
        
        <Banner tone="info">
          <Text as="p">
            <strong>Flexibility:</strong> Create parallel tiers (e.g., "6-Month Standard" and "6-Month Premium + Free Shipping") or progressive tiers (Bronze → Silver → Gold).
          </Text>
        </Banner>
        
        <Divider />
        
        {tiersWithCalculatedPurchase.map((tier, index) => (
          <Card key={tier.id}>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  Tier {index + 1}
                </Text>
                <InlineStack gap="200">
                  {index > 0 && (
                    <Button size="slim" onClick={() => onMoveTier(index, 'up')}>
                      ↑ Move Up
                    </Button>
                  )}
                  {index < tiers.length - 1 && (
                    <Button size="slim" onClick={() => onMoveTier(index, 'down')}>
                      ↓ Move Down
                    </Button>
                  )}
                  {tiers.length > 1 && (
                    <Button 
                      size="slim" 
                      tone="critical" 
                      onClick={() => onRemoveTier(tier.id)}
                    >
                      Remove
                    </Button>
                  )}
                </InlineStack>
              </InlineStack>
              
              <TextField
                label="Tier Name"
                value={tier.name}
                onChange={(value) => onUpdateTier(tier.id, 'name', value)}
                placeholder="e.g., Bronze, Premium, VIP"
                autoComplete="off"
              />
              
              <InlineStack gap="400">
                <Box minWidth="150px">
                  <TextField
                    label="Discount %"
                    type="number"
                    value={tier.discountPercentage}
                    onChange={(value) => onUpdateTier(tier.id, 'discountPercentage', value)}
                    suffix="%"
                    autoComplete="off"
                  />
                </Box>
                <Box minWidth="150px">
                  <TextField
                    label="Duration"
                    type="number"
                    value={tier.durationMonths}
                    onChange={(value) => onUpdateTier(tier.id, 'durationMonths', value)}
                    suffix="months"
                    autoComplete="off"
                  />
                </Box>
                <Box minWidth="200px">
                  <TextField
                    label="Min Purchase"
                    type="text"
                    value={tier.calculatedMinPurchase}
                    prefix=""
                    autoComplete="off"
                    disabled={true}
                    helpText="Calculated from Min LTV and Duration"
                  />
                </Box>
                <Box minWidth="200px">
                  <TextField
                    label="Min Annual LTV"
                    type="number"
                    value={tier.minLtvAmount || '0'}
                    onChange={(value) => onUpdateTier(tier.id, 'minLtvAmount', value)}
                    prefix="$"
                    autoComplete="off"
                    helpText="Minimum annualized lifetime value"
                  />
                </Box>
              </InlineStack>
              
              <TextField
                label="Benefits Description (Optional)"
                value={tier.description}
                onChange={(value) => onUpdateTier(tier.id, 'description', value)}
                placeholder="e.g., Free shipping, exclusive access to library wines"
                autoComplete="off"
              />
              
              <Divider />
              
              {/* Discount Configuration */}
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h4">
                      Discount Settings
                    </Text>
                    {tier.discount && !tier.showDiscountForm && (
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Code: <strong>{tier.discount.code || '(auto-generated)'}</strong> • 
                        {' '}{tier.discount.value?.percentage || 0}% off
                        {tier.discount.minimumRequirement?.type === 'amount' && 
                          ` • $${((tier.discount.minimumRequirement.amount || 0) / 100).toFixed(2)} minimum`}
                      </Text>
                    )}
                  </BlockStack>
                  <Button 
                    size="slim"
                    onClick={() => onToggleDiscountForm(tier.id)}
                  >
                    {tier.showDiscountForm ? 'Hide Details' : 'Configure Discount'}
                  </Button>
                </InlineStack>
                
                {tier.showDiscountForm && tier.discount && (
                  <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                    <BlockStack gap="400">
                      <BlockStack gap="300">
                        <TextField
                          label="Discount Code"
                          value={tier.discount.code}
                          onChange={(value) => {
                            const updated = { ...tier.discount!, code: value.toUpperCase().replace(/\s/g, '') };
                            onUpdateTierDiscount(tier.id, updated);
                          }}
                          helpText="Code customers will use (automatically uppercase, no spaces)"
                          autoComplete="off"
                        />
                        
                        <TextField
                          label="Internal Title"
                          value={tier.discount.title}
                          onChange={(value) => {
                            const updated = { ...tier.discount!, title: value };
                            onUpdateTierDiscount(tier.id, updated);
                          }}
                          helpText="Internal name for tracking"
                          autoComplete="off"
                        />
                        
                        <Text variant="bodyMd" as="p" tone="subdued">
                          <strong>Note:</strong> Discount percentage is synced with the tier discount above. 
                          Minimum purchase requirement is also synced with tier minimum.
                        </Text>
                      </BlockStack>
                      
                      <Divider />
                      
                      {/* Product & Collection Selector */}
                      <ProductCollectionSelector
                        discount={tier.discount}
                        onUpdateDiscount={(updatedDiscount) => onUpdateTierDiscount(tier.id, updatedDiscount)}
                        availableProducts={availableProducts}
                        availableCollections={availableCollections}
                        onLoadProducts={onLoadProducts}
                        onLoadCollections={onLoadCollections}
                        isLoading={isLoading}
                      />
                      
                      <Divider />
                      
                      <Banner tone="info">
                        <Text as="p">
                          This discount will be created in your {sessionCrmType === 'commerce7' ? 'Commerce7' : 'Shopify'} account when you complete setup. 
                          Customers will be added to the discount as they join this tier.
                        </Text>
                      </Banner>
                    </BlockStack>
                  </Box>
                )}
              </BlockStack>
            </BlockStack>
          </Card>
        ))}
        
        <Button onClick={onAddTier} fullWidth>
          + Add Another Tier
        </Button>
      </BlockStack>
    </Card>
  );
}

