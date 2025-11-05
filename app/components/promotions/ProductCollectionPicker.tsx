/**
 * Product/Collection Picker Component
 * Allows searching, browsing, and selecting products or collections
 */

import { useState, useEffect } from 'react';
import {
  BlockStack,
  InlineStack,
  TextField,
  Button,
  Box,
  Text,
  Badge,
  Checkbox,
  Icon,
} from '@shopify/polaris';
import { SearchIcon, DeleteIcon } from '@shopify/polaris-icons';
import { useDebounce } from '~/hooks/useDebounce';

type Item = {
  id: string;
  title: string;
};

type PickerType = 'product' | 'collection';

type ProductCollectionPickerProps = {
  type: PickerType;
  selected: Item[];
  onChange: (items: Item[]) => void;
  crm: any; // CRM provider from useCrmProvider hook
};

export function ProductCollectionPicker({
  type,
  selected,
  onChange,
  crm,
}: ProductCollectionPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showList, setShowList] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  
  const isProduct = type === 'product';
  const items = isProduct ? crm?.products : crm?.collections;
  const loading = isProduct ? crm?.productsLoading : crm?.collectionsLoading;
  const getItems = isProduct ? crm?.getProducts : crm?.getCollections;
  
  // Debug log
  if (typeof window !== 'undefined') {
    console.log('[ProductCollectionPicker]', { type, crm, items, loading });
  }
  
  // Auto-load items when search query changes
  useEffect(() => {
    if (showList) {
      getItems({ q: debouncedSearchQuery.trim() || undefined, limit: 25 });
    }
  }, [debouncedSearchQuery, showList]);
  
  const handleToggle = (item: Item) => {
    const isSelected = selected.some(i => i.id === item.id);
    onChange(
      isSelected
        ? selected.filter(i => i.id !== item.id)
        : [...selected, item]
    );
  };
  
  const handleRemove = (item: Item) => {
    onChange(selected.filter(i => i.id !== item.id));
  };
  
  const filteredItems = (items || []).filter((item: any) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const label = isProduct ? 'Products' : 'Collections';
  const badgeTone = isProduct ? 'info' : 'success';
  
  return (
    <BlockStack gap="300">
      {/* Selected Items */}
      {selected.length > 0 && (
        <Box>
          <BlockStack gap="200">
            <Text variant="bodyMd" as="p" tone="subdued">
              Selected {label}
            </Text>
            <InlineStack gap="200" wrap>
              {selected.map((item) => (
                <InlineStack key={item.id} gap="100" blockAlign="center">
                  <Badge tone={badgeTone}>{item.title}</Badge>
                  <Button
                    icon={DeleteIcon}
                    variant="plain"
                    size="micro"
                    onClick={() => handleRemove(item)}
                    accessibilityLabel={`Remove ${item.title}`}
                  />
                </InlineStack>
              ))}
            </InlineStack>
          </BlockStack>
        </Box>
      )}
      
      {/* Search/Browse Controls */}
      <InlineStack gap="300" blockAlign="center">
        <div style={{ flex: 1 }}>
          <TextField
            label=""
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              if (!showList) setShowList(true);
            }}
            placeholder={`Search ${label.toLowerCase()}...`}
            prefix={<Icon source={SearchIcon} />}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearchQuery('')}
            loading={loading}
          />
        </div>
        <Button 
          onClick={() => {
            if (showList) {
              setShowList(false);
              setSearchQuery('');
            } else {
              setShowList(true);
              getItems({ limit: 25 });
            }
          }}
          loading={loading}
        >
          {showList ? 'Clear' : 'Browse'}
        </Button>
      </InlineStack>
      
      {/* Item List */}
      {showList && filteredItems.length > 0 && (
        <Box>
          <BlockStack gap="200">
            {filteredItems.map((item: any) => {
              const isSelected = selected.some(i => i.id === item.id);
              return (
                <Box
                  key={item.id}
                  padding="200"
                  background={isSelected ? "bg-surface-selected" : "bg-surface"}
                  borderRadius="100"
                >
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="bodyMd" as="p">
                      {item.title}
                    </Text>
                    <Checkbox
                      label=""
                      checked={isSelected}
                      onChange={() => handleToggle({ id: item.id, title: item.title })}
                    />
                  </InlineStack>
                </Box>
              );
            })}
          </BlockStack>
        </Box>
      )}
    </BlockStack>
  );
}

