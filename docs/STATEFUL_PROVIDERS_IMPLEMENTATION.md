# Stateful Provider Architecture Implementation

## Overview

This document describes the implementation of **stateful providers** for the LiberoVino multi-tenant CRM abstraction layer. Providers are now instantiated with tenant-specific credentials, making them context-aware and eliminating the need to pass tenant/shop identifiers to every method call.

## Architecture

### Before (Stateless Singleton Pattern)

```typescript
// Old approach - providers were singletons without tenant context
export class CrmManager {
  private providers: Map<string, CrmProvider> = new Map();

  constructor() {
    this.providers.set('shopify', new ShopifyProvider());
    this.providers.set('commerce7', new Commerce7Provider());
  }

  getProvider(crmType: string): CrmProvider {
    return this.providers.get(crmType);
  }
}

// Usage required passing tenant to every method
const provider = crmManager.getProvider('commerce7');
await provider.getCustomers({ tenant: 'my-tenant', q: '', limit: 50 });
```

**Problems:**
- Repetitive tenant/shop passing to every method
- Error-prone (easy to forget or pass wrong tenant)
- Messy method signatures
- No encapsulation of tenant context

### After (Stateful Factory Pattern)

```typescript
// New approach - providers are instantiated with tenant context
export class CrmManager {
  getProvider(crmType: string, identifier: string, accessToken?: string): CrmProvider {
    if (crmType === 'commerce7') {
      return new Commerce7Provider(identifier); // tenantId
    } else if (crmType === 'shopify') {
      return new ShopifyProvider(identifier, accessToken); // shop, token
    }
    throw new Error(`Unknown CRM type: ${crmType}`);
  }
}

// Usage is cleaner - no tenant parameter needed
const provider = crmManager.getProvider('commerce7', session.tenantShop);
await provider.getCustomers({ q: '', limit: 50 }); // No tenant param!
```

**Benefits:**
- ✅ Cleaner method signatures
- ✅ Better encapsulation
- ✅ Prevents mistakes (can't use wrong tenant)
- ✅ More intuitive API
- ✅ Natural multi-tenancy support

## Implementation Details

### Commerce7Provider

```typescript
export class Commerce7Provider implements CrmProvider {
  name = CrmNames.COMMERCE7;
  slug = CrmSlugs.COMMERCE7;
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  async getCustomers(params?: any): Promise<CrmCustomer[]> {
    // Uses this.tenantId automatically
    const response = await fetch(`${API_URL}/customer?...`, {
      headers: {
        Authorization: getApiAuth(),
        tenant: this.tenantId, // Instance property
      },
    });
    // ...
  }
}
```

### ShopifyProvider

```typescript
export class ShopifyProvider implements CrmProvider {
  name = CrmNames.SHOPIFY;
  slug = CrmSlugs.SHOPIFY;
  private shop: string;
  private accessToken: string;

  constructor(shop: string, accessToken: string) {
    this.shop = shop;
    this.accessToken = accessToken;
  }

  async getCustomers(params?: any): Promise<CrmCustomer[]> {
    // Uses this.shop and this.accessToken automatically
    const response = await fetch(`https://${this.shop}/admin/api/2024-01/graphql.json`, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
      },
    });
    // ...
  }
}
```

## Usage Patterns

### In Route Loaders (Authenticated Context)

```typescript
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  
  // Create provider instance with session context
  const provider = crmManager.getProvider(
    session.crmType,      // 'commerce7' or 'shopify'
    session.tenantShop,   // tenant ID or shop domain
    session.accessToken   // required for Shopify, optional for Commerce7
  );
  
  // Now all provider methods use the correct tenant context
  const customers = await provider.getCustomers();
  const products = await provider.getProducts({ limit: 100 });
  
  return { customers, products };
}
```

### In Webhook Handlers (Unauthenticated Context)

Webhooks extract tenant/shop from request headers:

```typescript
// Commerce7 Webhook
export async function action({ request }: ActionFunctionArgs) {
  const tenant = request.headers.get('x-commerce7-tenant');
  
  if (!tenant) {
    return Response.json({ error: 'Missing tenant' }, { status: 400 });
  }
  
  // Create provider with extracted tenant
  const provider = crmManager.getProvider('commerce7', tenant);
  
  // Validate and process webhook
  const isValid = await provider.validateWebhook(request);
  // ...
}
```

```typescript
// Shopify Webhook
export async function action({ request }: ActionFunctionArgs) {
  const shop = request.headers.get('x-shopify-shop-domain');
  
  if (!shop) {
    return Response.json({ error: 'Missing shop' }, { status: 400 });
  }
  
  // TODO: Retrieve access token from database based on shop
  const accessToken = await getShopAccessToken(shop);
  
  // Create provider with extracted shop and token
  const provider = crmManager.getProvider('shopify', shop, accessToken);
  
  // Validate and process webhook
  const isValid = await provider.validateWebhook(request);
  // ...
}
```

## Migration Guide

If you have existing code using the old pattern, here's how to migrate:

### Before

```typescript
// Old stateless approach
const provider = crmManager.getProvider('commerce7');
await provider.getCustomers({ tenant: myTenant, q: '' });
await provider.getProducts({ tenant: myTenant, limit: 50 });
```

### After

```typescript
// New stateful approach
const provider = crmManager.getProvider('commerce7', myTenant);
await provider.getCustomers({ q: '' });  // No tenant param!
await provider.getProducts({ limit: 50 }); // No tenant param!
```

## New Methods Implemented

Added the following methods to complete the `CrmProvider` interface:

### Customer Management
- `upsertCustomer(customer)` - Create or update customer (finds by email)
- `findCustomerByEmail(email)` - Search for customer by email address

### Discount Customer Assignment
- `addCustomerToDiscount(discountId, customerId)` - Assign customer to discount
- `removeCustomerFromDiscount(discountId, customerId)` - Remove customer from discount
- `getDiscountCustomers(discountId)` - Get list of customers for a discount

These methods are fully implemented for Commerce7 and have stub implementations for Shopify (marked with TODO).

## Files Changed

### Core Provider Files
- `app/lib/crm/commerce7.server.ts` - Added constructor, removed getCurrentTenant, updated all methods
- `app/lib/crm/shopify.server.ts` - Added constructor, added stub methods
- `app/lib/crm/index.ts` - Refactored to factory pattern

### Route Files
- `app/routes/webhooks.c7.tsx` - Extract tenant from headers, pass to provider
- `app/routes/webhooks.shp.tsx` - Extract shop from headers, pass to provider
- `app/routes/webhooks._index.tsx` - Updated to accept identifier parameter
- `app/routes/_index.tsx` - Removed provider instantiation (uses metadata instead)

### Utility Files
- `app/lib/sessions.server.ts` - Removed unused crmManager import

## Testing

To test the new stateful providers:

1. **Authenticated Context:**
   ```bash
   # Start dev server
   npm run dev
   
   # Access app routes with session
   # Provider will be instantiated with session.tenantShop
   ```

2. **Webhook Context:**
   ```bash
   # Test Commerce7 webhook with tenant header
   curl -X POST http://localhost:5173/webhooks/c7 \
     -H "x-commerce7-tenant: test-tenant" \
     -H "Content-Type: application/json" \
     -d '{"event":"customer.created","data":{}}'
   
   # Test Shopify webhook with shop header
   curl -X POST http://localhost:5173/webhooks/shp \
     -H "x-shopify-shop-domain: test-shop.myshopify.com" \
     -H "Content-Type: application/json" \
     -d '{"id":123}'
   ```

## Benefits Summary

1. **Type Safety** - Tenant context is enforced at provider instantiation
2. **Code Clarity** - Method calls are cleaner without repetitive tenant params
3. **Error Prevention** - Impossible to accidentally use wrong tenant
4. **Scalability** - Easy to add new CRM providers following same pattern
5. **Multi-tenancy** - Natural support for multiple concurrent tenants

## Next Steps

1. ✅ Implement `findCustomerByEmail` for Commerce7
2. ⏳ Implement `findCustomerByEmail` for Shopify
3. ⏳ Implement discount customer assignment methods for both platforms
4. ⏳ Add access token retrieval for Shopify webhooks
5. ⏳ Add comprehensive tests for provider instantiation patterns

---

**Implementation Date:** October 24, 2025  
**Author:** AI Assistant with User Direction

