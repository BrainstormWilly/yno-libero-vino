import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate, useParams } from 'react-router';
import { useState, useEffect } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  TextField,
  InlineStack,
  Select,
  Divider,
  Icon,
  Box,
  Checkbox,
  Badge,
} from '@shopify/polaris';
import { SearchIcon, DeleteIcon } from '@shopify/polaris-icons';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import TierSummary from '~/components/TierSummary';
import { useCrmProvider } from '~/hooks/useCrmProvider';
import { useDebounce } from '~/hooks/useDebounce';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const tier = await db.getClubStageWithDetails(tierId);
  if (!tier) {
    throw new Response('Tier not found', { status: 404 });
  }
  
  const promotions = await db.getStagePromotions(tierId);
  const loyalty = await db.getTierLoyaltyConfig(tierId);
  
  // Enrich promotions with C7 data
  let enrichedPromotions = promotions;
  if (session.crmType === 'commerce7' && tier.c7_club_id) {
    const provider = new Commerce7Provider(session.tenantShop);
    enrichedPromotions = await Promise.all(
      promotions.map(async (promo) => {
        try {
          const c7Promo = await provider.getPromotion(promo.crm_id);
          return { ...promo, c7Data: c7Promo };
        } catch (error) {
          return promo;
        }
      })
    );
  }
  
  return {
    session,
    tier,
    promotions: enrichedPromotions,
    loyalty,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const formData = await request.formData();
  
  try {
    const title = formData.get('title') as string;
    const discountTarget = formData.get('discount_target') as 'product' | 'shipping';
    const discountType = formData.get('discount_type') as string;
    const discountAmount = parseFloat(formData.get('discount_amount') as string);
    const appliesTo = formData.get('applies_to') as string;
    const selectedIdsJson = formData.get('selected_ids') as string;
    const selectedIds = selectedIdsJson ? JSON.parse(selectedIdsJson) : [];
    const minCartAmount = formData.get('min_cart_amount') as string;
    
    if (!title || !discountAmount) {
      return {
        success: false,
        message: 'Title and discount amount are required',
      };
    }
    
    const tier = await db.getClubStageWithDetails(tierId);
    if (!tier?.c7_club_id) {
      return {
        success: false,
        message: 'Tier must be synced to C7 first. Save tier details to create C7 club.',
      };
    }
    
    // Create promotion in C7
    const provider = new Commerce7Provider(session.tenantShop);
    
    const promoData: any = {
      title,
      type: discountTarget === 'product' ? 'Product' : 'Shipping',
      discountType,
      discount: discountType === 'Percentage Off' ? discountAmount * 100 : discountAmount,
      dollarOffDiscountApplies: "Once Per Order",
      appliesTo: appliesTo || 'Store',
      appliesToObjectIds: selectedIds,
      excludes: null,
      excludeObjectIds: [],
      cartRequirementType: "None",
      cartRequirement: null,
      cartRequirementMaximum: null,
      cartRequirementCountType: "All Items",
      usageLimitType: "Unlimited",
      usageLimit: null,
      status: "Enabled",
      availableTo: "Club",
      availableToObjectIds: [tier.c7_club_id],
      clubFrequencies: [],
      promotionSets: [],
      startDate: new Date().toISOString(),
    };
    
    if (minCartAmount) {
      promoData.cartRequirementType = "Minimum Amount";
      promoData.cartRequirement = parseFloat(minCartAmount) * 100;
    }
    
    const c7Promotion = await provider.createPromotion(promoData);
    
    // Save to DB
    await db.createStagePromotions(tierId, [{
      crmId: c7Promotion.id,
      crmType: 'commerce7',
      title: c7Promotion.title,
    }]);
    
    return {
      success: true,
      redirect: addSessionToUrl(`/app/setup/tiers/${tierId}`, session.id),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create promotion',
    };
  }
}

export default function NewPromotion() {
  const { tier, promotions, loyalty, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const crm = useCrmProvider(session);
  
  const [title, setTitle] = useState('');
  const [discountTarget, setDiscountTarget] = useState<'product' | 'shipping'>('product');
  const [discountType, setDiscountType] = useState('Percentage Off');
  const [discountAmount, setDiscountAmount] = useState('10');
  const [appliesTo, setAppliesTo] = useState('Store');
  const [minCartAmount, setMinCartAmount] = useState('');
  
  // Product/Collection selection
  const [selectedProducts, setSelectedProducts] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCollections, setSelectedCollections] = useState<Array<{ id: string; title: string }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductList, setShowProductList] = useState(false);
  const [showCollectionList, setShowCollectionList] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  // Auto-load products/collections when search query changes
  useEffect(() => {
    if (showProductList && appliesTo === 'Product') {
      crm.getProducts({ q: debouncedSearchQuery.trim() || undefined, limit: 25 });
    }
  }, [debouncedSearchQuery, appliesTo, showProductList]);
  
  useEffect(() => {
    if (showCollectionList && appliesTo === 'Collection') {
      crm.getCollections({ q: debouncedSearchQuery.trim() || undefined, limit: 25 });
    }
  }, [debouncedSearchQuery, appliesTo, showCollectionList]);
  
  // Handle redirect
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);
  
  // Compute selected IDs based on appliesTo
  const selectedIds = appliesTo === 'Product' 
    ? selectedProducts.map(p => p.id)
    : appliesTo === 'Collection'
    ? selectedCollections.map(c => c.id)
    : [];
  
  const handleToggleProduct = (product: { id: string; title: string }) => {
    const isSelected = selectedProducts.some(p => p.id === product.id);
    setSelectedProducts(isSelected 
      ? selectedProducts.filter(p => p.id !== product.id)
      : [...selectedProducts, product]
    );
  };
  
  const handleToggleCollection = (collection: { id: string; title: string }) => {
    const isSelected = selectedCollections.some(c => c.id === collection.id);
    setSelectedCollections(isSelected 
      ? selectedCollections.filter(c => c.id !== collection.id)
      : [...selectedCollections, collection]
    );
  };
  
  const filteredProducts = (crm.products || []).filter((product: any) =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredCollections = (crm.collections || []).filter((collection: any) =>
    collection.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <Page
      title="New Promotion"
      backAction={{ 
        content: 'Back to Tier', 
        onAction: () => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}`, session.id)) 
      }}
    >
      <Layout>
        {/* Main Content */}
        <Layout.Section>
          <main>
            <Form method="post">
              <input type="hidden" name="selected_ids" value={JSON.stringify(selectedIds)} />
              
              <BlockStack gap="500">
                {actionData && !actionData.success && (
                  <Banner tone="critical" title={actionData.message} />
                )}
                
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
                      helpText="e.g., 'Silver - 20% Off', 'Silver - Free Shipping'"
                    />
                    
                    <Divider />
                    
                    <Select
                      label="Discount Applies To"
                      options={[
                        { label: 'Products (e.g., 20% off)', value: 'product' },
                        { label: 'Shipping (e.g., free shipping)', value: 'shipping' },
                      ]}
                      value={discountTarget}
                      onChange={(val) => setDiscountTarget(val as 'product' | 'shipping')}
                      name="discount_target"
                      helpText="Each promotion can discount either products OR shipping (not both)"
                    />
                    
                    <InlineStack gap="300">
                      <div style={{ flex: 1 }}>
                        <Select
                          label="Discount Type"
                          options={[
                            { label: 'Percentage Off', value: 'Percentage Off' },
                            { label: 'Dollar Off', value: 'Dollar Off' },
                          ]}
                          value={discountType}
                          onChange={setDiscountType}
                          name="discount_type"
                        />
                      </div>
                      
                      <div style={{ flex: 1 }}>
                        <TextField
                          label={discountType === 'Percentage Off' ? 'Percentage' : 'Amount ($)'}
                          value={discountAmount}
                          onChange={setDiscountAmount}
                          name="discount_amount"
                          type="number"
                          autoComplete="off"
                          suffix={discountType === 'Percentage Off' ? '%' : undefined}
                        />
                      </div>
                    </InlineStack>
                    
                    <Divider />
                    
                    <Select
                      label="Applies To"
                      options={[
                        { label: 'Store', value: 'Store' },
                        { label: 'Specific Products', value: 'Product' },
                        { label: 'Specific Collections', value: 'Collection' },
                      ]}
                      value={appliesTo}
                      onChange={(val) => {
                        setAppliesTo(val);
                        setSearchQuery('');
                        setShowProductList(false);
                        setShowCollectionList(false);
                      }}
                      name="applies_to"
                      helpText="Store applies to all products"
                    />
                    
                    {/* Product Selection */}
                    {appliesTo === 'Product' && (
                      <>
                        {selectedProducts.length > 0 && (
                          <Box>
                            <BlockStack gap="200">
                              <Text variant="bodyMd" as="p" tone="subdued">
                                Selected Products
                              </Text>
                              <InlineStack gap="200" wrap>
                                {selectedProducts.map((product) => (
                                  <InlineStack key={product.id} gap="100" blockAlign="center">
                                    <Badge tone="info">{product.title}</Badge>
                                    <Button
                                      icon={DeleteIcon}
                                      variant="plain"
                                      size="micro"
                                      onClick={() => handleToggleProduct(product)}
                                      accessibilityLabel={`Remove ${product.title}`}
                                    />
                                  </InlineStack>
                                ))}
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        )}
                        
                        <InlineStack gap="300" blockAlign="center">
                          <div style={{ flex: 1 }}>
                            <TextField
                              label=""
                              value={searchQuery}
                              onChange={(value) => {
                                setSearchQuery(value);
                                if (!showProductList) setShowProductList(true);
                              }}
                              placeholder="Search products..."
                              prefix={<Icon source={SearchIcon} />}
                              autoComplete="off"
                              clearButton
                              onClearButtonClick={() => setSearchQuery('')}
                              loading={crm.productsLoading}
                            />
                          </div>
                          <Button 
                            onClick={() => {
                              if (showProductList) {
                                setShowProductList(false);
                                setSearchQuery('');
                              } else {
                                setShowProductList(true);
                                crm.getProducts({ limit: 25 });
                              }
                            }}
                            loading={crm.productsLoading}
                          >
                            {showProductList ? 'Clear' : 'Browse'}
                          </Button>
                        </InlineStack>
                        
                        {showProductList && filteredProducts.length > 0 && (
                          <Box>
                            <BlockStack gap="200">
                              {filteredProducts.map((product: any) => {
                                const isSelected = selectedProducts.some(p => p.id === product.id);
                                return (
                                  <Box
                                    key={product.id}
                                    padding="200"
                                    background={isSelected ? "bg-surface-selected" : "bg-surface"}
                                    borderRadius="100"
                                  >
                                    <InlineStack align="space-between" blockAlign="center">
                                      <Text variant="bodyMd" as="p">
                                        {product.title}
                                      </Text>
                                      <Checkbox
                                        label=""
                                        checked={isSelected}
                                        onChange={() => handleToggleProduct({ id: product.id, title: product.title })}
                                      />
                                    </InlineStack>
                                  </Box>
                                );
                              })}
                            </BlockStack>
                          </Box>
                        )}
                      </>
                    )}
                    
                    {/* Collection Selection */}
                    {appliesTo === 'Collection' && (
                      <>
                        {selectedCollections.length > 0 && (
                          <Box>
                            <BlockStack gap="200">
                              <Text variant="bodyMd" as="p" tone="subdued">
                                Selected Collections
                              </Text>
                              <InlineStack gap="200" wrap>
                                {selectedCollections.map((collection) => (
                                  <InlineStack key={collection.id} gap="100" blockAlign="center">
                                    <Badge tone="success">{collection.title}</Badge>
                                    <Button
                                      icon={DeleteIcon}
                                      variant="plain"
                                      size="micro"
                                      onClick={() => handleToggleCollection(collection)}
                                      accessibilityLabel={`Remove ${collection.title}`}
                                    />
                                  </InlineStack>
                                ))}
                              </InlineStack>
                            </BlockStack>
                          </Box>
                        )}
                        
                        <InlineStack gap="300" blockAlign="center">
                          <div style={{ flex: 1 }}>
                            <TextField
                              label=""
                              value={searchQuery}
                              onChange={(value) => {
                                setSearchQuery(value);
                                if (!showCollectionList) setShowCollectionList(true);
                              }}
                              placeholder="Search collections..."
                              prefix={<Icon source={SearchIcon} />}
                              autoComplete="off"
                              clearButton
                              onClearButtonClick={() => setSearchQuery('')}
                              loading={crm.collectionsLoading}
                            />
                          </div>
                          <Button 
                            onClick={() => {
                              if (showCollectionList) {
                                setShowCollectionList(false);
                                setSearchQuery('');
                              } else {
                                setShowCollectionList(true);
                                crm.getCollections({ limit: 25 });
                              }
                            }}
                            loading={crm.collectionsLoading}
                          >
                            {showCollectionList ? 'Clear' : 'Browse'}
                          </Button>
                        </InlineStack>
                        
                        {showCollectionList && filteredCollections.length > 0 && (
                          <Box>
                            <BlockStack gap="200">
                              {filteredCollections.map((collection: any) => {
                                const isSelected = selectedCollections.some(c => c.id === collection.id);
                                return (
                                  <Box
                                    key={collection.id}
                                    padding="200"
                                    background={isSelected ? "bg-surface-selected" : "bg-surface"}
                                    borderRadius="100"
                                  >
                                    <InlineStack align="space-between" blockAlign="center">
                                      <Text variant="bodyMd" as="p">
                                        {collection.title}
                                      </Text>
                                      <Checkbox
                                        label=""
                                        checked={isSelected}
                                        onChange={() => handleToggleCollection({ id: collection.id, title: collection.title })}
                                      />
                                    </InlineStack>
                                  </Box>
                                );
                              })}
                            </BlockStack>
                          </Box>
                        )}
                      </>
                    )}
                    
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
                      helpText="Leave blank for no minimum"
                    />
                    
                    <InlineStack align="space-between">
                      <Button
                        onClick={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}`, session.id))}
                      >
                        Cancel
                      </Button>
                      
                      <Button submit variant="primary">
                        Create Promotion
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>
              </BlockStack>
            </Form>
          </main>
        </Layout.Section>

        {/* Summary Panel */}
        <Layout.Section variant="oneThird">
          <aside>
            <TierSummary tier={tier} promotions={promotions} loyalty={loyalty} />
          </aside>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

