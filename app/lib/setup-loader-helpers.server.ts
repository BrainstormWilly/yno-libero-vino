import { createClient } from '@supabase/supabase-js';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import { serializeDiscount, parseDiscount, type Discount } from '~/types/discount';
import { fromC7Coupon } from '~/types/discount-commerce7';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Gets client data from Supabase
 */
export async function getClientData(clientId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  return client;
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
 */
export async function getLoyaltyRules(clientId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: loyaltyRules } = await supabase
    .from('loyalty_point_rules')
    .select('*')
    .eq('client_id', clientId)
    .single();
  
  return loyaltyRules;
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
 * Fetches and enriches discount data from Commerce7 for a club stage
 */
async function fetchStageDiscount(
  provider: Commerce7Provider,
  stage: any
): Promise<any> {
  if (!stage.platform_discount_id) {
    return stage;
  }
  
  try {
    // Fetch the full C7 coupon data
    const c7CouponData = await provider.getC7CouponFull(stage.platform_discount_id);
    
    // Convert to unified Discount type
    let discount: Discount;
    try {
      discount = fromC7Coupon(c7CouponData) as Discount;
      
      // Enrich collections and products with titles
      discount = await enrichDiscount(provider, discount);
      
    } catch (conversionError) {
      console.error(`Conversion error for ${stage.name}:`, conversionError);
      throw conversionError;
    }
    
    // Serialize for transmission (dates to strings)
    const serializedDiscount = serializeDiscount(discount);
    
    return {
      ...stage,
      discountData: serializedDiscount,
    };
  } catch (error) {
    console.error(`Failed to fetch discount for tier ${stage.name}:`, error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return stage;
  }
}

/**
 * Fetches existing program with enriched discount data from Commerce7
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
  
  const tiersWithDiscounts = await Promise.all(
    existingProgram.club_stages.map((stage: any) => 
      fetchStageDiscount(provider, stage)
    )
  );
  
  return {
    ...existingProgram,
    club_stages: tiersWithDiscounts,
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

