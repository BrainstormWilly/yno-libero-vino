import type { CrmProvider, CreatePromotionTierContext } from '~/types/crm';
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

export type { CreatePromotionTierContext } from '~/types/crm';

/**
 * Create a promotion in the CRM. For Commerce7, when tierContext is passed and tier has 2+ promos (including this one),
 * the provider creates/updates the promotion set and attaches all promos; returns promotionSetId for the route to persist on the tier.
 * @param session - App session with tenant info
 * @param discount - Abstract Discount object
 * @param clubId - CRM club ID to link promotion to
 * @param tierContext - Optional tier context (tierName, existingSetId, existingPromoIds) so C7 can sync promotion set
 * @returns Created promotion with id, title, and optional promotionSetId when a set was created/used
 */
import { toC7Promotion, fromC7Promotion } from '~/types/discount-commerce7';

export async function createPromotion(
  session: AppSessionData,
  discount: Discount,
  clubId: string,
  tierContext?: CreatePromotionTierContext
): Promise<{ id: string; title: string; promotionSetId?: string }> {
  if (session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    const c7Payload = toC7Promotion(discount, clubId); // no set on create; provider attaches set after if needed
    const result = await provider.createPromotion(c7Payload, tierContext);
    return {
      id: result.id,
      title: result.title,
      ...(result.promotionSetId != null && { promotionSetId: result.promotionSetId }),
    };
  }
  
  // Add Shopify support later
  throw new Error(`Unsupported CRM type: ${session.crmType}`);
}

/**
 * Create a promotion set in the CRM (Commerce7 only). Set is created with title only;
 * add promos via promotion-set-x-promotion, then conclude with updatePromotionSet(setId, { title }).
 * @param session - App session
 * @param title - Set title (e.g. "${tier.name} benefits")
 * @returns Created set with id
 */
export async function createPromotionSet(
  session: AppSessionData,
  title: string
): Promise<{ id: string }> {
  if (session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    const set = await provider.createPromotionSet({ title });
    return { id: set.id };
  }
  throw new Error(`Unsupported CRM type: ${session.crmType}`);
}

/**
 * Update a promotion set (Commerce7 only). Send { title } to conclude after addPromotionToSet or removePromotionFromSet.
 * @param session - App session
 * @param setId - Promotion set ID
 * @param title - Set title (e.g. "${tier.name} benefits")
 */
export async function updatePromotionSet(
  session: AppSessionData,
  setId: string,
  title: string
): Promise<void> {
  if (session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    await provider.updatePromotionSet(setId, { title });
    return;
  }
  throw new Error(`Unsupported CRM type: ${session.crmType}`);
}

/**
 * Remove a promotion from a set (Commerce7 only). DELETE promotion-set-x-promotion. Then call updatePromotionSet(setId, title) to conclude.
 */
export async function removePromotionFromSet(
  session: AppSessionData,
  promotionId: string,
  promotionSetId: string
): Promise<void> {
  if (session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    await provider.removePromotionFromSet(promotionId, promotionSetId);
    return;
  }
  throw new Error(`Unsupported CRM type: ${session.crmType}`);
}

/**
 * Delete a promotion set (Commerce7 only).
 * @param session - App session
 * @param setId - Promotion set ID
 */
export async function deletePromotionSet(
  session: AppSessionData,
  setId: string
): Promise<void> {
  if (session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    await provider.deletePromotionSet(setId);
    return;
  }
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
