import { useState, useCallback, useEffect } from "react";
import {
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Badge,
  Icon,
  Box,
  Checkbox,
  TextField,
  Tabs,
} from "@shopify/polaris";
import { SearchIcon, DeleteIcon } from "@shopify/polaris-icons";
import type { Discount } from "~/types/discount";
import { useDebounce } from "~/hooks/useDebounce";

interface Product {
  id: string;
  title: string;
  image?: string;
}

interface Collection {
  id: string;
  title: string;
}

interface ProductCollectionSelectorProps {
  discount: Discount;
  onUpdateDiscount: (discount: Discount) => void;
  availableProducts?: Product[];
  availableCollections?: Collection[];
  onLoadProducts?: (q?: string) => void | Promise<void>;
  onLoadCollections?: (q?: string) => void | Promise<void>;
  isLoading?: boolean;
}

export default function ProductCollectionSelector({
  discount,
  onUpdateDiscount,
  availableProducts = [],
  availableCollections = [],
  onLoadProducts,
  onLoadCollections,
  isLoading = false,
}: ProductCollectionSelectorProps) {
  const [selectedTab, setSelectedTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearchedProducts, setHasSearchedProducts] = useState(false);
  const [hasSearchedCollections, setHasSearchedCollections] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const handleToggleAllProducts = useCallback(() => {
    const newAppliesTo = {
      ...discount.appliesTo,
      scope: (discount.appliesTo.scope === "all" ? "specific" : "all") as "all" | "specific",
      all: discount.appliesTo.scope !== "all",
      products: [],
      collections: [],
    };
    onUpdateDiscount({
      ...discount,
      appliesTo: newAppliesTo,
    });
  }, [discount, onUpdateDiscount]);

  const handleToggleProduct = useCallback(
    (product: Product) => {
      const isSelected = discount.appliesTo.products.some((p) => p.id === product.id);
      const newProducts = isSelected
        ? discount.appliesTo.products.filter((p) => p.id !== product.id)
        : [...discount.appliesTo.products, { id: product.id, title: product.title }];

      onUpdateDiscount({
        ...discount,
        appliesTo: {
          ...discount.appliesTo,
          scope: "specific",
          all: false,
          products: newProducts,
        },
      });
    },
    [discount, onUpdateDiscount]
  );

  const handleToggleCollection = useCallback(
    (collection: Collection) => {
      const isSelected = discount.appliesTo.collections.some((c) => c.id === collection.id);
      const newCollections = isSelected
        ? discount.appliesTo.collections.filter((c) => c.id !== collection.id)
        : [...discount.appliesTo.collections, { id: collection.id, title: collection.title }];

      onUpdateDiscount({
        ...discount,
        appliesTo: {
          ...discount.appliesTo,
          scope: "specific",
          all: false,
          collections: newCollections,
        },
      });
    },
    [discount, onUpdateDiscount]
  );

  const handleRemoveProduct = useCallback(
    (productId: string) => {
      onUpdateDiscount({
        ...discount,
        appliesTo: {
          ...discount.appliesTo,
          products: discount.appliesTo.products.filter((p) => p.id !== productId),
        },
      });
    },
    [discount, onUpdateDiscount]
  );

  const handleRemoveCollection = useCallback(
    (collectionId: string) => {
      onUpdateDiscount({
        ...discount,
        appliesTo: {
          ...discount.appliesTo,
          collections: discount.appliesTo.collections.filter((c) => c.id !== collectionId),
        },
      });
    },
    [discount, onUpdateDiscount]
  );

  // Trigger API search when debounced query changes (but not on initial mount)
  useEffect(() => {
    if (onLoadProducts && selectedTab === 0 && hasSearchedProducts) {
      // If query is empty, do a full browse; otherwise search with query
      Promise.resolve(onLoadProducts(debouncedSearchQuery.trim() || undefined)).catch(() => {});
    }
  }, [debouncedSearchQuery, onLoadProducts, selectedTab, hasSearchedProducts]);
  
  useEffect(() => {
    if (onLoadCollections && selectedTab === 1 && hasSearchedCollections) {
      // If query is empty, do a full browse; otherwise search with query
      Promise.resolve(onLoadCollections(debouncedSearchQuery.trim() || undefined)).catch(() => {});
    }
  }, [debouncedSearchQuery, onLoadCollections, selectedTab, hasSearchedCollections]);

  const filteredProducts = availableProducts.filter((product) =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCollections = availableCollections.filter((collection) =>
    collection.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    {
      id: "products",
      content: `Products (${discount.appliesTo.products.length})`,
      panelID: "products-panel",
    },
    {
      id: "collections",
      content: `Collections (${discount.appliesTo.collections.length})`,
      panelID: "collections-panel",
    },
  ];

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="200">
          <Text variant="headingMd" as="h3">
            Products & Collections
          </Text>
          <Text variant="bodyMd" as="p" tone="subdued">
            Choose which products or collections this discount applies to.
          </Text>
        </BlockStack>

        {/* Apply to All Products Option */}
        <Box paddingBlock="200">
          <Checkbox
            label="Apply to all products"
            checked={discount.appliesTo.scope === "all" || discount.appliesTo.all === true}
            onChange={handleToggleAllProducts}
            helpText="When enabled, this discount will work on any product"
          />
        </Box>

        {discount.appliesTo.scope !== "all" && discount.appliesTo.all !== true && (
          <>
            {/* Selected Items Summary */}
            {(discount.appliesTo.products.length > 0 || discount.appliesTo.collections.length > 0) && (
              <BlockStack gap="200">
                <Text variant="headingSm" as="h4">
                  Selected Items
                </Text>
                <Box>
                  <InlineStack gap="200" wrap>
                    {discount.appliesTo.products.map((product) => (
                      <InlineStack key={product.id} gap="100" blockAlign="center">
                        <Badge tone="info">{product.title}</Badge>
                        <Button
                          icon={DeleteIcon}
                          variant="plain"
                          size="micro"
                          onClick={() => handleRemoveProduct(product.id)}
                          accessibilityLabel={`Remove ${product.title}`}
                        />
                      </InlineStack>
                    ))}
                    {discount.appliesTo.collections.map((collection) => (
                      <InlineStack key={collection.id} gap="100" blockAlign="center">
                        <Badge tone="success">{`${collection.title || collection.id} (Collection)`}</Badge>
                        <Button
                          icon={DeleteIcon}
                          variant="plain"
                          size="micro"
                          onClick={() => handleRemoveCollection(collection.id)}
                          accessibilityLabel={`Remove ${collection.title || collection.id}`}
                        />
                      </InlineStack>
                    ))}
                  </InlineStack>
                </Box>
              </BlockStack>
            )}

            {/* Tabs for Products/Collections */}
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
              <Box paddingBlockStart="400">
                {selectedTab === 0 && (
                  <BlockStack gap="300">
                    {/* Products Tab */}
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{ flex: 1 }}>
                        <TextField
                          label=""
                          value={searchQuery}
                          onChange={(value) => {
                            setSearchQuery(value);
                            if (!hasSearchedProducts) setHasSearchedProducts(true);
                          }}
                          placeholder="Search products..."
                          prefix={<Icon source={SearchIcon} />}
                          autoComplete="off"
                          clearButton
                          onClearButtonClick={() => {
                            setSearchQuery("");
                            if (!hasSearchedProducts) setHasSearchedProducts(true);
                          }}
                          loading={isLoading}
                        />
                      </div>
                      {onLoadProducts && (
                        <Button 
                          onClick={() => { 
                            setHasSearchedProducts(true); 
                            onLoadProducts(); 
                          }} 
                          loading={isLoading}
                        >
                          Browse Products
                        </Button>
                      )}
                    </InlineStack>

                    {availableProducts.length === 0 ? (
                      <Box padding="400">
                        <Text variant="bodyMd" as="p" tone="subdued" alignment="center">
                          {onLoadProducts
                            ? "Click 'Browse Products' to fetch your products or start typing to search"
                            : "No products available"}
                        </Text>
                      </Box>
                    ) : (
                      <Box>
                        <BlockStack gap="200">
                          {filteredProducts.map((product) => {
                            const isSelected = discount.appliesTo.products.some(
                              (p) => p.id === product.id
                            );
                            return (
                              <Box
                                key={product.id}
                                padding="200"
                                background={isSelected ? "bg-surface-selected" : "bg-surface"}
                                borderRadius="100"
                              >
                                <InlineStack align="space-between" blockAlign="center">
                                  <InlineStack gap="300" blockAlign="center">
                                    {product.image && (
                                      <img
                                        src={product.image}
                                        alt={product.title}
                                        style={{ 
                                          width: 40, 
                                          height: 40, 
                                          borderRadius: 4, 
                                          objectFit: 'cover' 
                                        }}
                                      />
                                    )}
                                    <Text variant="bodyMd" as="p">
                                      {product.title}
                                    </Text>
                                  </InlineStack>
                                  <Checkbox
                                    label=""
                                    checked={isSelected}
                                    onChange={() => handleToggleProduct(product)}
                                  />
                                </InlineStack>
                              </Box>
                            );
                          })}
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                )}

                {selectedTab === 1 && (
                  <BlockStack gap="300">
                    {/* Collections Tab */}
                    <InlineStack gap="300" blockAlign="center">
                      <div style={{ flex: 1 }}>
                        <TextField
                          label=""
                          value={searchQuery}
                          onChange={(value) => {
                            setSearchQuery(value);
                            if (!hasSearchedCollections) setHasSearchedCollections(true);
                          }}
                          placeholder="Search collections..."
                          prefix={<Icon source={SearchIcon} />}
                          autoComplete="off"
                          clearButton
                          onClearButtonClick={() => {
                            setSearchQuery("");
                            if (!hasSearchedCollections) setHasSearchedCollections(true);
                          }}
                          loading={isLoading}
                        />
                      </div>
                      {onLoadCollections && (
                        <Button 
                          onClick={() => { 
                            setHasSearchedCollections(true); 
                            onLoadCollections(); 
                          }} 
                          loading={isLoading}
                        >
                          Browse Collections
                        </Button>
                      )}
                    </InlineStack>

                    {availableCollections.length === 0 ? (
                      <Box padding="400">
                        <Text variant="bodyMd" as="p" tone="subdued" alignment="center">
                          {onLoadCollections
                            ? "Click 'Browse Collections' to fetch your collections or start typing to search"
                            : "No collections available"}
                        </Text>
                      </Box>
                    ) : (
                      <Box>
                        <BlockStack gap="200">
                          {filteredCollections.map((collection) => {
                            const isSelected = discount.appliesTo.collections.some(
                              (c) => c.id === collection.id
                            );
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
                                    onChange={() => handleToggleCollection(collection)}
                                  />
                                </InlineStack>
                              </Box>
                            );
                          })}
                        </BlockStack>
                      </Box>
                    )}
                  </BlockStack>
                )}
              </Box>
            </Tabs>
          </>
        )}
      </BlockStack>
    </Card>
  );
}

