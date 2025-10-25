import type { CrmProvider } from '~/types/crm';
import { ShopifyProvider } from './shopify.server';
import { Commerce7Provider } from './commerce7.server';

export class CrmManager {
  /**
   * Get a provider instance configured for a specific tenant/shop
   * @param crmType - The CRM type ('shopify' or 'commerce7')
   * @param identifier - For Commerce7: tenantId, For Shopify: shop domain
   * @param accessToken - Required for Shopify, optional for Commerce7
   */
  getProvider(crmType: string, identifier: string, accessToken?: string): CrmProvider {
    if (crmType === 'commerce7') {
      return new Commerce7Provider(identifier);
    } else if (crmType === 'shopify') {
      if (!accessToken) {
        throw new Error('Shopify provider requires an access token');
      }
      return new ShopifyProvider(identifier, accessToken);
    }
    
    throw new Error(`Unknown CRM type: ${crmType}`);
  }
}

// Singleton instance - still useful for factory pattern
export const crmManager = new CrmManager();
