import type { CrmProvider } from '~/types/crm';
import { ShopifyProvider } from './shopify.server';
import { Commerce7Provider } from './commerce7.server';
import type { AppSessionData } from '~/lib/session-storage.server';
import type { Discount } from '~/types';

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

// ============================================
// Promotion Service Functions
// ============================================

/**
 * Create a promotion in the CRM
 * @param session - App session with tenant info
 * @param discount - Abstract Discount object
 * @param clubId - CRM club ID to link promotion to
 * @returns Created promotion with CRM ID and title
 */
import { toC7Promotion, fromC7Promotion } from '~/types/discount-commerce7';

export async function createPromotion(
  session: AppSessionData,
  discount: Discount,
  clubId: string
): Promise<{ id: string; title: string }> {
  if (session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    const c7Payload = toC7Promotion(discount, clubId);
    const c7Promotion = await provider.createPromotion(c7Payload);
    return { id: c7Promotion.id, title: c7Promotion.title };
  }
  
  // Add Shopify support later
  throw new Error(`Unsupported CRM type: ${session.crmType}`);
}

/**
 * Get a promotion from the CRM
 * @param session - App session
 * @param crmPromotionId - CRM promotion ID
 * @returns Abstract Discount object
 */
export async function getPromotion(
  session: AppSessionData,
  crmPromotionId: string
): Promise<Discount> {
  if (session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    const c7Promotion = await provider.getPromotion(crmPromotionId);
    return fromC7Promotion(c7Promotion);
  }
  
  throw new Error(`Unsupported CRM type: ${session.crmType}`);
}

/**
 * Update a promotion in the CRM
 * @param session - App session
 * @param crmPromotionId - CRM promotion ID
 * @param discount - Updated Discount object
 * @param clubId - CRM club ID
 */
export async function updatePromotion(
  session: AppSessionData,
  crmPromotionId: string,
  discount: Discount,
  clubId: string
): Promise<void> {
  if (session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    const c7Payload = toC7Promotion(discount, clubId);
    await provider.updatePromotion(crmPromotionId, c7Payload);
    return;
  }
  
  throw new Error(`Unsupported CRM type: ${session.crmType}`);
}

/**
 * Delete a promotion from the CRM
 * @param session - App session
 * @param crmPromotionId - CRM promotion ID
 */
export async function deletePromotion(
  session: AppSessionData,
  crmPromotionId: string
): Promise<void> {
  if (session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    await provider.deletePromotion(crmPromotionId);
    return;
  }
  
  throw new Error(`Unsupported CRM type: ${session.crmType}`);
}
