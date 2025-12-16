import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import { serializeDiscount, parseDiscount, type Discount } from '~/types/discount';
import { fromC7Coupon } from '~/types/discount-commerce7';
import * as db from '~/lib/db/supabase.server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Gets client data from Supabase
 */
export async function getClientData(clientId: string) {
  return db.getClient(clientId);
}

/**
 * Fetches existing club program with stages
 */
export async function getExistingProgram(clientId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: existingProgram } = await supabase
    .from('club_programs')
    .select('*, club_stages(*)')
    .eq('client_id', clientId)
    .single();
  
  return existingProgram;
}

/**
 * Fetches loyalty point rules for a client
 * @deprecated Global loyalty rules are deprecated. Use tier-specific loyalty instead.
 */
export async function getLoyaltyRules(clientId: string) {
  return db.getLoyaltyRules(clientId);
}

/**
 * Enriches a single collection reference with title from Commerce7
 */
async function enrichCollection(
  provider: Commerce7Provider,
  collectionRef: any
): Promise<{ id: string; title?: string }> {
  const collectionId = typeof collectionRef === 'string' ? collectionRef : collectionRef.id;
  
  if (!collectionId) {
    console.warn('Collection reference missing ID:', collectionRef);
    return { id: '' };
  }
  
  try {
    const collection = await provider.getCollection(collectionId);
    return { id: collectionId, title: collection.title };
  } catch (error) {
    console.warn(`Failed to fetch collection ${collectionId}:`, error);
    return { id: collectionId };
  }
}

/**
 * Enriches a single product reference with title from Commerce7
 */
async function enrichProduct(
  provider: Commerce7Provider,
  productRef: any
): Promise<{ id: string; title?: string }> {
  const productId = typeof productRef === 'string' ? productRef : productRef.id;
  
  if (!productId) {
    console.warn('Product reference missing ID:', productRef);
    return { id: '' };
  }
  
  try {
    const product = await provider.getProduct(productId);
    return { id: productId, title: product.title };
  } catch (error) {
    console.warn(`Failed to fetch product ${productId}:`, error);
    return { id: productId };
  }
}

/**
 * Enriches a discount with collection and product titles from Commerce7
 */
async function enrichDiscount(provider: Commerce7Provider, discount: Discount): Promise<Discount> {
  // Enrich collections with titles
  if (discount.appliesTo?.collections && discount.appliesTo.collections.length > 0) {
    const enrichedCollections = await Promise.all(
      discount.appliesTo.collections.map((collectionRef) => 
        enrichCollection(provider, collectionRef)
      )
    );
    discount.appliesTo.collections = enrichedCollections;
  }
  
  // Enrich products with titles
  if (discount.appliesTo?.products && discount.appliesTo.products.length > 0) {
    const enrichedProducts = await Promise.all(
      discount.appliesTo.products.map((productRef) => 
        enrichProduct(provider, productRef)
      )
    );
    discount.appliesTo.products = enrichedProducts;
  }
  
  return discount;
}

/**
 * Fetches promotions for a club stage from the database
 */
async function fetchStagePromotions(stageId: string): Promise<any[]> {
  return db.getStagePromotions(stageId);
}

/**
 * Fetches loyalty configuration for a club stage
 */
async function fetchStageLoyalty(stageId: string): Promise<any | null> {
  return db.getTierLoyaltyConfig(stageId);
}

/**
 * Fetches and enriches club/promotion/loyalty data from C7 for a club stage (NEW ARCHITECTURE)
 */
async function fetchStageC7Data(
  provider: Commerce7Provider,
  stage: any
): Promise<any> {
  try {
    // Fetch promotions from database
    const promotions = await fetchStagePromotions(stage.id);
    
    // Fetch full C7 promotion details (optional, for display)
    const enrichedPromotions = await Promise.all(
      promotions.map(async (promo) => {
        try {
          const c7Promotion = await provider.getPromotion(promo.crm_id);
          return {
            ...promo,
            c7Data: c7Promotion, // Full C7 promotion object
          };
        } catch (error) {
          console.warn(`Failed to fetch promotion ${promo.crm_id}:`, error);
          return promo; // Return without C7 data
        }
      })
    );
    
    // Fetch loyalty configuration
    const loyalty = await fetchStageLoyalty(stage.id);
    
    // Fetch full C7 loyalty tier details (optional)
    let enrichedLoyalty = null;
    if (loyalty?.c7_loyalty_tier_id) {
      try {
        const c7LoyaltyTier = await provider.getLoyaltyTier(loyalty.c7_loyalty_tier_id);
        enrichedLoyalty = {
          ...loyalty,
          c7Data: c7LoyaltyTier,
        };
      } catch (error) {
        console.warn(`Failed to fetch loyalty tier ${loyalty.c7_loyalty_tier_id}:`, error);
        enrichedLoyalty = loyalty;
      }
    }
    
    return {
      ...stage,
      promotions: enrichedPromotions,
      loyalty: enrichedLoyalty,
    };
  } catch (error) {
    console.error(`Failed to fetch C7 data for tier ${stage.name}:`, error);
    return stage;
  }
}

/**
 * DEPRECATED: Old fetchStageDiscount (kept for backwards compatibility)
 * Use fetchStageC7Data instead
 */
async function fetchStageDiscount(
  provider: Commerce7Provider,
  stage: any
): Promise<any> {
  console.warn('fetchStageDiscount is deprecated, use fetchStageC7Data instead');
  return fetchStageC7Data(provider, stage);
}

/**
 * Fetches existing program with enriched C7 club/promotion/loyalty data (NEW ARCHITECTURE)
 */
export async function getExistingProgramWithDiscounts(
  clientId: string,
  tenantShop: string,
  crmType: string
): Promise<any> {
  const existingProgram = await getExistingProgram(clientId);
  
  if (!existingProgram?.club_stages || crmType !== 'commerce7') {
    return existingProgram;
  }
  
  const provider = new Commerce7Provider(tenantShop);
  
  const tiersWithC7Data = await Promise.all(
    existingProgram.club_stages.map((stage: any) => 
      fetchStageC7Data(provider, stage)
    )
  );
  
  return {
    ...existingProgram,
    club_stages: tiersWithC7Data,
  };
}

/**
 * Handles dev mode data fetching
 */
export async function fetchDevModeData(clientId: string) {
  const client = await getClientData(clientId);
  const existingProgram = await getExistingProgram(clientId);
  const loyaltyRules = await getLoyaltyRules(clientId);
  
  return {
    client,
    existingProgram,
    loyaltyRules,
    hasSetup: !!existingProgram && !!loyaltyRules,
  };
}

