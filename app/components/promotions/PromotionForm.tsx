/**
 * Promotion Form Component
 * Shared form UI for creating and editing promotions
 */

import { useState, useEffect } from 'react';
import { Form } from 'react-router';
import {
  Card,
  Button,
  Text,
  BlockStack,
  Banner,
  TextField,
  InlineStack,
  Select,
  Divider,
} from '@shopify/polaris';
import { ProductCollectionPicker } from './ProductCollectionPicker';
import type { Discount } from '~/types';
import type { AppSessionData } from '~/lib/session-storage.server';

type PromotionFormMode = 'create' | 'edit';

type PromotionFormProps = {
  mode: PromotionFormMode;
  initialDiscount?: Discount;
  session: AppSessionData;
  onCancel: () => void;
  onDelete?: () => void;
  actionData?: {
    success?: boolean;
    message?: string;
  };
};

export function PromotionForm({
  mode,
  initialDiscount,
  session,
  onCancel,
  onDelete,
  actionData,
}: PromotionFormProps) {
  // Initialize state from initialDiscount if in edit mode
  const [title, setTitle] = useState(initialDiscount?.title || '');
  
  const [discountTarget, setDiscountTarget] = useState<'product' | 'shipping'>(
    initialDiscount?.appliesTo.target || 'product'
  );
  
  const [discountType, setDiscountType] = useState(() => {
    if (!initialDiscount) return 'Percentage Off';
    
    // Check for shipping-specific types
    if (initialDiscount.appliesTo.target === 'shipping') {
      if (initialDiscount.value.type === 'percentage' && initialDiscount.value.percentage === 100) {
        return 'Free Shipping';
      }
      if (initialDiscount.value.type === 'fixed-amount') {
        return 'Flat Rate';
      }
    }
    
    // Standard types
    return initialDiscount.value.type === 'percentage' ? 'Percentage Off' : 'Dollar Off';
  });
  
  const [discountAmount, setDiscountAmount] = useState(() => {
    if (!initialDiscount) return '10';
    
    // Don't show amount for Free Shipping
    if (initialDiscount.appliesTo.target === 'shipping' && 
        initialDiscount.value.type === 'percentage' && 
        initialDiscount.value.percentage === 100) {
      return '0';
    }
    
    if (initialDiscount.value.type === 'percentage') {
      return initialDiscount.value.percentage?.toString() || '10';
    }
    return (initialDiscount.value.amount ? initialDiscount.value.amount / 100 : 10).toString();
  });
  
  const [appliesTo, setAppliesTo] = useState(() => {
    if (!initialDiscount) return 'Store';
    if (initialDiscount.appliesTo.target === 'shipping') return 'Shipping';
    if (initialDiscount.appliesTo.scope === 'all') return 'Store';
    if (initialDiscount.appliesTo.products.length > 0) return 'Product';
    if (initialDiscount.appliesTo.collections.length > 0) return 'Collection';
    return 'Store';
  });
  
  const [minCartAmount, setMinCartAmount] = useState(() => {
    if (!initialDiscount?.minimumRequirement.amount) return '';
    return (initialDiscount.minimumRequirement.amount / 100).toString();
  });
  
  // Usage limits
  const [usageLimitType, setUsageLimitType] = useState<'Unlimited' | 'Customer' | 'Store'>(() => {
    // Check platformData first, then default to Unlimited
    if (initialDiscount?.platformData?.usageLimitType) {
      return initialDiscount.platformData.usageLimitType;
    }
    return 'Unlimited';
  });
  
  const [usageLimit, setUsageLimit] = useState(() => {
    // Check platformData first
    if (initialDiscount?.platformData?.usageLimit) {
      return initialDiscount.platformData.usageLimit.toString();
    }
    return '';
  });
  
  // Product/Collection selection
  const [selectedProducts, setSelectedProducts] = useState<Array<{ id: string; title: string }>>(
    initialDiscount?.appliesTo.products.map(p => ({ id: p.id, title: p.title || '' })) || []
  );
  
  const [selectedCollections, setSelectedCollections] = useState<Array<{ id: string; title: string }>>(
    initialDiscount?.appliesTo.collections.map(c => ({ id: c.id, title: c.title || '' })) || []
  );
  
  // Import CRM provider hook
  const crm = useCrmProvider(session);
  
  // Compute selected IDs for hidden form field
  const selectedIds = appliesTo === 'Product' 
    ? selectedProducts.map(p => p.id)
    : appliesTo === 'Collection'
    ? selectedCollections.map(c => c.id)
    : [];
  
  // Update discountTarget when appliesTo changes
  useEffect(() => {
    if (appliesTo === 'Shipping') {
      setDiscountTarget('shipping');
    } else {
      setDiscountTarget('product');
    }
  }, [appliesTo]);
  
  return (
    <>
      {actionData && !actionData.success && (
        <Banner tone="critical" title={actionData.message} />
      )}
      
      <Form method="post">
        {mode === 'edit' && (
          <input type="hidden" name="action" value="update_promotion" />
        )}
        <input type="hidden" name="selected_ids" value={JSON.stringify(selectedIds)} />
        <input type="hidden" name="discount_target" value={discountTarget} />
        <input type="hidden" name="usage_limit_type" value={usageLimitType} />
        <input type="hidden" name="usage_limit" value={usageLimitType === 'Unlimited' ? '' : usageLimit} />
        
        <BlockStack gap="500">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Promotion Details
              </Text>
              
              <TextField
                label="Promotion Title"
                value={title}
                onChange={setTitle}
                name="title"
                autoComplete="off"
                helpText={mode === 'create' ? "e.g., 'Silver - 20% Off', 'Silver - Free Shipping'" : undefined}
              />
              
              <Divider />
              
              <Select
                label="Applies To"
                options={[
                  { label: 'Entire Store', value: 'Store' },
                  { label: 'Specific Products', value: 'Product' },
                  { label: 'Specific Collections', value: 'Collection' },
                  { label: 'Shipping', value: 'Shipping' },
                ]}
                value={appliesTo}
                onChange={(val) => {
                  setAppliesTo(val);
                }}
                name="applies_to"
                helpText={
                  appliesTo === 'Store' ? 'Applies to all products in the store' :
                  appliesTo === 'Shipping' ? 'Applies to shipping costs' :
                  'Select specific items below'
                }
              />
              
              {/* Product Selection */}
              {appliesTo === 'Product' && (
                <ProductCollectionPicker
                  type="product"
                  selected={selectedProducts}
                  onChange={setSelectedProducts}
                  crm={crm}
                />
              )}
              
              {/* Collection Selection */}
              {appliesTo === 'Collection' && (
                <ProductCollectionPicker
                  type="collection"
                  selected={selectedCollections}
                  onChange={setSelectedCollections}
                  crm={crm}
                />
              )}
              
              <Divider />
              
              <InlineStack gap="300">
                <div style={{ flex: 1 }}>
                  <Select
                    label="Discount Type"
                    options={
                      appliesTo === 'Shipping'
                        ? [
                            { label: 'Free Shipping', value: 'Free Shipping' },
                            { label: 'Flat Rate', value: 'Flat Rate' },
                            { label: 'Percentage Off', value: 'Percentage Off' },
                            { label: 'Dollar Off', value: 'Dollar Off' },
                          ]
                        : [
                            { label: 'Percentage Off', value: 'Percentage Off' },
                            { label: 'Dollar Off', value: 'Dollar Off' },
                          ]
                    }
                    value={discountType}
                    onChange={setDiscountType}
                    name="discount_type"
                  />
                </div>
                
                {discountType !== 'Free Shipping' && (
                  <div style={{ flex: 1 }}>
                    <TextField
                      label={
                        discountType === 'Percentage Off' ? 'Percentage' :
                        discountType === 'Flat Rate' ? 'Flat Rate Amount ($)' :
                        'Amount ($)'
                      }
                      value={discountAmount}
                      onChange={setDiscountAmount}
                      name="discount_amount"
                      type="number"
                      autoComplete="off"
                      suffix={discountType === 'Percentage Off' ? '%' : undefined}
                    />
                  </div>
                )}
              </InlineStack>
              
              {/* Cart Requirements - Only for Shipping */}
              {appliesTo === 'Shipping' && (
                <>
                  <Divider />
                  
                  <Text variant="headingSm" as="h5">
                    Cart Requirements
                  </Text>
                  
                  <TextField
                    label="Minimum Cart Amount (optional)"
                    value={minCartAmount}
                    onChange={setMinCartAmount}
                    name="min_cart_amount"
                    type="number"
                    prefix="$"
                    autoComplete="off"
                    helpText={mode === 'create' ? "Leave blank for no minimum" : undefined}
                  />
                </>
              )}
              
              <Divider />
              
              <Text variant="headingSm" as="h5">
                Usage Limits
              </Text>
              
              <Select
                label=""
                options={[
                  { label: 'Unlimited', value: 'Unlimited' },
                  { label: 'Customer', value: 'Customer' },
                  { label: 'Store', value: 'Store' },
                ]}
                value={usageLimitType}
                onChange={(val) => {
                  setUsageLimitType(val as 'Unlimited' | 'Customer' | 'Store');
                  // Clear usage limit when switching to Unlimited
                  if (val === 'Unlimited') {
                    setUsageLimit('');
                  }
                }}
                name="usage_limit_type"
                helpText={
                  usageLimitType === 'Unlimited' ? 'No limit on usage' :
                  usageLimitType === 'Customer' ? 'Limit applies per customer' :
                  'Limit applies store-wide'
                }
              />
              
              {usageLimitType !== 'Unlimited' && (
                <TextField
                  label="Limit Quantity"
                  value={usageLimit}
                  onChange={setUsageLimit}
                  name="usage_limit"
                  type="number"
                  min={1}
                  autoComplete="off"
                  helpText={`Maximum number of times this promotion can be used ${usageLimitType === 'Customer' ? 'per customer' : 'store-wide'}`}
                />
              )}
              
              <InlineStack align="space-between">
                {mode === 'edit' && onDelete ? (
                  <Button onClick={onDelete} tone="critical">
                    Delete Promotion
                  </Button>
                ) : (
                  <Button onClick={onCancel}>
                    Cancel
                  </Button>
                )}
                
                <Button submit variant="primary">
                  {mode === 'create' ? 'Create Promotion' : 'Save Promotion'}
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Form>
    </>
  );
}

// Import hook at the bottom to avoid circular dependency issues
import { useCrmProvider } from '~/hooks/useCrmProvider';

