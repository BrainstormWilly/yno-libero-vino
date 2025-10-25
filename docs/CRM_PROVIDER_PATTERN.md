# CRM Provider Pattern - Implementation Guide

## Overview

The CRM Provider pattern abstracts Commerce7 and Shopify API calls through:
1. **Unified Type Definitions** - Common interfaces for all CRM operations
2. **Provider Classes** - Platform-specific implementations (server-side)
3. **Resource Routes** - Data-only API endpoints
4. **React Hook** - Client-side interface using fetchers

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  React Component (app.setup.tsx)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ const crm = useCrmProvider(session);                 │  │
│  │ crm.getProducts({ q: 'wine', limit: 25 });          │  │
│  │ // crm.products, crm.productsLoading, crm.error     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  useCrmProvider Hook (hooks/useCrmProvider.ts)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Uses useFetcher() to call resource routes           │  │
│  │ Returns: methods, data, loading states, errors      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Resource Route (routes/api.products.tsx)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ export async function loader({ request }) {         │  │
│  │   const provider = crmManager.getProvider(...);     │  │
│  │   const products = await provider.getProducts();    │  │
│  │   return json({ products });                        │  │
│  │ }                                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  CRM Manager (lib/crm/index.ts)                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Returns Commerce7Provider or ShopifyProvider        │  │
│  │ based on session.crmType                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Provider Classes                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Commerce7Provider (lib/crm/commerce7.server.ts)     │  │
│  │ ShopifyProvider (lib/crm/shopify.server.ts)         │  │
│  │                                                       │  │
│  │ Both implement CrmProvider interface                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Type Definitions (`app/types/crm.ts`)

Common interfaces that both providers must implement:

```typescript
export interface CrmProduct {
  id: string;
  title: string;
  sku: string;
  price: number;
  image?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmProvider {
  getProducts(params?: any): Promise<CrmProduct[]>;
  getProduct(id: string): Promise<CrmProduct>;
  // ... other methods
}
```

### 2. Provider Classes (Server-Side)

**Commerce7Provider** (`app/lib/crm/commerce7.server.ts`):
- ✅ Fully implemented
- Uses Commerce7 REST API
- Accepts params: `{ q: string, limit: number }`

**ShopifyProvider** (`app/lib/crm/shopify.server.ts`):
- ⚠️ Stub implementation (not yet complete)
- Will use Shopify GraphQL Admin API
- Will accept params: `{ title: string, limit: number, status: string }`

### 3. Resource Route (`app/routes/api.products.tsx`)

Data-only route that:
- Gets session from request
- Instantiates correct provider
- Calls provider method
- Returns JSON response

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  const provider = crmManager.getProvider(
    session.crmType,
    session.tenantShop,
    session.accessToken
  );
  const products = await provider.getProducts({ q, limit });
  return json({ products });
}
```

### 4. React Hook (`app/hooks/useCrmProvider.ts`)

Client-side interface using `useFetcher`:

```typescript
export function useCrmProvider(session: AppSessionData) {
  const productsFetcher = useFetcher();
  
  const getProducts = useCallback((params) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set('q', params.q);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    productsFetcher.load(`/api/products?${searchParams}`);
  }, []);
  
  return {
    getProducts,
    products: productsFetcher.data?.products || null,
    productsLoading: productsFetcher.state === 'loading',
    productsError: productsFetcher.data?.error || null,
  };
}
```

## Usage Example

In your React component:

```typescript
import { useCrmProvider } from '~/hooks/useCrmProvider';

export default function Setup() {
  const { session } = useLoaderData<typeof loader>();
  const crm = useCrmProvider(session);
  
  // Call the method
  const handleSearch = (query: string) => {
    crm.getProducts({ q: query, limit: 25 });
  };
  
  // Use the state
  return (
    <div>
      {crm.productsLoading && <Spinner />}
      {crm.productsError && <Banner tone="critical">{crm.productsError}</Banner>}
      {crm.products && crm.products.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

## Benefits

1. **Abstraction** - Components don't know which CRM they're using
2. **Type Safety** - TypeScript ensures consistent interfaces
3. **Server-Side Security** - API keys/tokens stay on server
4. **Loading States** - Built-in loading/error handling
5. **Parallel Requests** - Multiple fetchers can run simultaneously
6. **Extensibility** - Easy to add new CRM providers or methods

## Adding New Operations

To add a new CRM operation (e.g., `getCollections`):

### Step 1: Add to CrmProvider Interface

```typescript
// app/types/crm.ts
export interface CrmCollection {
  id: string;
  title: string;
  // ... other fields
}

export interface CrmProvider {
  // ... existing methods
  getCollections(params?: any): Promise<CrmCollection[]>;
}
```

### Step 2: Implement in Both Providers

```typescript
// app/lib/crm/commerce7.server.ts
async getCollections(params?: any): Promise<CrmCollection[]> {
  // Commerce7-specific implementation
}

// app/lib/crm/shopify.server.ts
async getCollections(params?: any): Promise<CrmCollection[]> {
  // Shopify-specific implementation
}
```

### Step 3: Create Resource Route

```typescript
// app/routes/api.collections.tsx
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  const provider = crmManager.getProvider(...);
  const collections = await provider.getCollections(params);
  return json({ collections });
}
```

### Step 4: Add to useCrmProvider Hook

```typescript
// app/hooks/useCrmProvider.ts
export function useCrmProvider(session: AppSessionData) {
  const collectionsFetcher = useFetcher();
  
  const getCollections = useCallback((params) => {
    collectionsFetcher.load(`/api/collections?...`);
  }, []);
  
  return {
    // ... existing returns
    getCollections,
    collections: collectionsFetcher.data?.collections || null,
    collectionsLoading: collectionsFetcher.state === 'loading',
    collectionsError: collectionsFetcher.data?.error || null,
  };
}
```

### Step 5: Register Route

```typescript
// app/routes.ts
route("api/collections", "routes/api.collections.tsx"),
```

## Current Status

✅ **Implemented:**
- Type definitions for Products, Customers, Orders, Discounts
- CrmProvider interface
- Commerce7Provider (fully implemented)
- ShopifyProvider (stub with interface)
- CrmManager factory
- Resource route for products
- useCrmProvider hook with products support
- Integration in app.setup.tsx

⚠️ **TODO:**
- Implement ShopifyProvider.getProducts()
- Add resource routes for: collections, customers, discounts
- Extend useCrmProvider hook for other operations
- Add mutation support (POST/PUT/DELETE)

## Next Steps

1. **Implement Collections**: Follow same pattern as products
2. **Implement Customers**: For customer selection/search
3. **Implement Discounts**: CRUD operations for discount codes
4. **Add Mutations**: Use `fetcher.submit()` for POST/PUT/DELETE
5. **Complete Shopify Provider**: Implement all Shopify-specific methods

## Notes

- All CRM API calls happen server-side (security)
- Component only knows about the hook interface
- Params can be provider-specific (flexibility)
- Return types must match interface (consistency)
- Loading/error states are automatic (convenience)

