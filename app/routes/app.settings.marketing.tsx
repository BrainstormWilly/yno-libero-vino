/**
 * Marketing Settings Page
 * 
 * Allows clients to manage "showcase" products for email marketing recommendations.
 * These products will be included in monthly status emails for customers who have opted into marketing.
 */

import { type LoaderFunctionArgs, type ActionFunctionArgs, Form, useLoaderData, useActionData, useLocation, useFetcher } from 'react-router';
import { useState, useEffect, useCallback } from 'react';
import { 
  Page,
  Card, 
  BlockStack, 
  Text, 
  Button, 
  InlineStack, 
  Box, 
  TextField,
  EmptyState,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Badge,
  Spinner,
  Banner,
} from '@shopify/polaris';
import { MinusIcon } from '@shopify/polaris-icons';

import { getAppSession } from '~/lib/sessions.server';
import { getMainNavigationActions } from '~/util/navigation';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import type { CrmProduct } from '~/types/crm';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }
  
  const client = await db.getClient(session.clientId);
  if (!client) {
    throw new Response('Client not found', { status: 404 });
  }

  // Load existing showcase products
  const showcaseProducts = await db.getShowcaseProducts(session.clientId, { activeOnly: false });

  return {
    session,
    client,
    showcaseProducts,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'add_showcase_product') {
    const crmProductId = formData.get('crmProductId') as string | null;
    const crmVariantId = formData.get('crmVariantId') as string | null;
    const title = formData.get('title') as string;
    const imageUrl = formData.get('imageUrl') as string;
    const price = formData.get('price') ? parseFloat(formData.get('price') as string) : null;
    const productUrl = formData.get('productUrl') as string;

    if (!title || !imageUrl || !productUrl) {
      return { success: false, error: 'Missing required fields' };
    }

    try {
      await db.createShowcaseProduct(session.clientId, {
        crmProductId: crmProductId || null,
        crmVariantId: crmVariantId || null,
        title,
        imageUrl,
        price,
        productUrl,
      });

      return { success: true, message: 'Product added to showcase' };
    } catch (error) {
      console.error('Error adding showcase product:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to add product' 
      };
    }
  }

  if (intent === 'remove_showcase_product') {
    const productId = formData.get('productId') as string;
    
    if (!productId) {
      return { success: false, error: 'Product ID required' };
    }

    try {
      await db.deleteShowcaseProduct(productId, session.clientId);
      return { success: true, message: 'Product removed from showcase' };
    } catch (error) {
      console.error('Error removing showcase product:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to remove product' 
      };
    }
  }

  if (intent === 'toggle_showcase_product') {
    const productId = formData.get('productId') as string;
    const isActive = formData.get('isActive') === 'true';

    try {
      await db.updateShowcaseProduct(productId, session.clientId, {
        isActive: !isActive,
      });
      return { success: true, message: 'Product status updated' };
    } catch (error) {
      console.error('Error updating showcase product:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update product' 
      };
    }
  }

  return { success: false, error: 'Invalid action' };
}

export default function MarketingSettings() {
  const { session, client, showcaseProducts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const fetcher = useFetcher();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CrmProduct[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Handle action responses
  useEffect(() => {
    if (actionData) {
      if (actionData.success) {
        setActionMessage({ type: 'success', text: actionData.message || 'Action completed successfully' });
      } else {
        setActionMessage({ type: 'error', text: actionData.error || 'An error occurred' });
      }
    }
  }, [actionData]);

  // Search products using fetcher
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    fetcher.load(`/api/products?session=${session.id}&q=${encodeURIComponent(searchQuery)}&limit=25`);
  }, [searchQuery, fetcher, session.id]);

  // Handle search results
  useEffect(() => {
    if (fetcher.data?.products) {
      setSearchResults(fetcher.data.products);
      setIsSearching(false);
    } else if (fetcher.data?.error) {
      setActionMessage({ type: 'error', text: fetcher.data.error });
      setIsSearching(false);
    }
  }, [fetcher.data]);

  // Format price for display
  const formatPrice = (price?: number): string => {
    if (!price) return 'Price varies';
    return `$${(price / 100).toFixed(2)}`; // Assuming price is in cents
  };

  // Get product URL using {website_url}/product/{slug} format
  const getProductUrl = (product: CrmProduct): string => {
    if (!product.slug) {
      return `#product-${product.id}`;
    }
    const baseUrl = client?.website_url || '';
    if (!baseUrl) {
      return `#product-${product.id}`;
    }
    return `${baseUrl}/product/${product.slug}`;
  };

  // Handle adding product to showcase
  const handleAddProduct = (product: CrmProduct) => {
    const variantTitle = product.variantTitle || (product.variants && product.variants.length > 0 ? product.variants[0].title : '');
    const variantId = product.variants && product.variants.length > 0 ? product.variants[0].id : null;
    const fullTitle = variantTitle ? `${product.title} - ${variantTitle}` : product.title;
    
    const form = document.createElement('form');
    form.method = 'POST';
    form.innerHTML = `
      <input type="hidden" name="intent" value="add_showcase_product" />
      <input type="hidden" name="crmProductId" value="${product.id}" />
      <input type="hidden" name="crmVariantId" value="${variantId || ''}" />
      <input type="hidden" name="title" value="${fullTitle}" />
      <input type="hidden" name="imageUrl" value="${product.image || ''}" />
      <input type="hidden" name="price" value="${product.price || ''}" />
      <input type="hidden" name="productUrl" value="${getProductUrl(product)}" />
    `;
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <Page 
      title="Marketing"
      backAction={{
        content: 'Settings',
        url: addSessionToUrl('/app/settings', session.id),
      }}
      secondaryActions={getMainNavigationActions({
        sessionId: session.id,
        currentPath: location.pathname,
      })}
    >
      <BlockStack gap="400">
        {actionMessage && (
          <Banner
            tone={actionMessage.type === 'success' ? 'success' : 'critical'}
            onDismiss={() => setActionMessage(null)}
          >
            {actionMessage.text}
          </Banner>
        )}

        {/* Product Search Section */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">
              Search Products
            </Text>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
            >
              <InlineStack gap="200" align="space-between" blockAlign="center">
                <div style={{ flex: '1 1 auto', minWidth: '300px' }}>
                  <TextField
                    label="Search for products"
                    labelHidden
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Enter product name or SKU..."
                    autoComplete="off"
                  />
                </div>
                <Button
                  submit
                  loading={isSearching || fetcher.state === 'loading'}
                  variant="primary"
                >
                  Search
                </Button>
              </InlineStack>
            </Form>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">
                  Search Results
                </Text>
                <ResourceList
                  resourceName={{ singular: 'product', plural: 'products' }}
                  items={searchResults}
                  renderItem={(item) => {
                    const product = item as CrmProduct;
                    const isInShowcase = showcaseProducts.some(
                      sp => sp.crm_product_id === product.id && !sp.crm_variant_id
                    );
                    const itemId = String(product.id || `product-${product.title}-${product.variantTitle || ''}`);

                    return (
                      <ResourceItem
                        id={itemId}
                        key={itemId}
                        media={
                          <Thumbnail
                            source={product.image || ''}
                            alt={product.title}
                            size="medium"
                          />
                        }
                        accessibilityLabel={`View details for ${product.title}`}
                        onClick={() => {}}
                      >
                        <InlineStack gap="300" align="space-between" blockAlign="center">
                          <Box>
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="bold" as="h3">
                                {product.title}
                              </Text>
                              <Text variant="bodySm" tone="subdued" as="p">
                                {product.variantTitle || 'N/A'}
                              </Text>
                              <Text variant="bodySm" as="p">
                                {formatPrice(product.price)}
                              </Text>
                            </BlockStack>
                          </Box>
                          <Box>
                            {isInShowcase ? (
                              <Badge tone="success">In Showcase</Badge>
                            ) : (
                              <Button
                                onClick={() => handleAddProduct(product)}
                                size="micro"
                              >
                                Add to Showcase
                              </Button>
                            )}
                          </Box>
                        </InlineStack>
                      </ResourceItem>
                    );
                  }}
                />
              </BlockStack>
            )}

            {fetcher.state === 'loading' && searchQuery && (
              <Box padding="400">
                <InlineStack align="center" gap="200">
                  <Spinner size="small" />
                  <Text variant="bodySm" tone="subdued" as="p">Searching products...</Text>
                </InlineStack>
              </Box>
            )}

            {fetcher.data?.products && searchResults.length === 0 && searchQuery && (
              <EmptyState
                heading="No products found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Try adjusting your search query.</p>
              </EmptyState>
            )}
          </BlockStack>
        </Card>

        {/* Showcase Products List */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">
              Showcase Products ({showcaseProducts.length})
            </Text>

            {showcaseProducts.length === 0 ? (
              <EmptyState
                heading="No showcase products yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Search for products above to add them to your showcase.</p>
              </EmptyState>
            ) : (
              <ResourceList
                resourceName={{ singular: 'showcase product', plural: 'showcase products' }}
                items={showcaseProducts}
                renderItem={(item) => {
                  const product = item as typeof showcaseProducts[0];
                  return (
                    <ResourceItem
                      key={product.id}
                      id={product.id}
                      media={
                        <Thumbnail
                          source={product.image_url}
                          alt={product.title}
                          size="medium"
                        />
                      }
                      accessibilityLabel={`View details for ${product.title}`}
                      onClick={() => {}}
                    >
                      <InlineStack gap="300" align="space-between" blockAlign="center">
                        <Box>
                          <BlockStack gap="100">
                            <InlineStack gap="200" align="start">
                              <Text variant="bodyMd" fontWeight="bold" as="h3">
                                {product.title}
                              </Text>
                              {!product.is_active && (
                                <Badge tone="warning">Inactive</Badge>
                              )}
                            </InlineStack>
                            {product.price && (
                              <Text variant="bodySm" as="p">
                                ${(product.price / 100).toFixed(2)}
                              </Text>
                            )}
                          </BlockStack>
                        </Box>
                        <Box>
                          <InlineStack gap="200">
                            <Form method="post">
                              <input type="hidden" name="intent" value="toggle_showcase_product" />
                              <input type="hidden" name="productId" value={product.id} />
                              <input type="hidden" name="isActive" value={product.is_active.toString()} />
                              <Button
                                submit
                                variant={product.is_active ? 'secondary' : 'primary'}
                                size="micro"
                              >
                                {product.is_active ? 'Deactivate' : 'Activate'}
                              </Button>
                            </Form>
                            <Form method="post">
                              <input type="hidden" name="intent" value="remove_showcase_product" />
                              <input type="hidden" name="productId" value={product.id} />
                              <Button
                                submit
                                icon={MinusIcon}
                                variant="plain"
                                tone="critical"
                                size="micro"
                                accessibilityLabel={`Remove ${product.title || 'product'}`}
                              />
                            </Form>
                          </InlineStack>
                        </Box>
                      </InlineStack>
                    </ResourceItem>
                  );
                }}
              />
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

