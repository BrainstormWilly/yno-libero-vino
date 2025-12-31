/**
 * Tier Qualification Logic
 * 
 * Determines which tiers a customer qualifies for based on purchase amount and/or LTV
 */

import * as db from '~/lib/db/supabase.server';

export interface TierQualificationResult {
  qualifyingTier: {
    id: string;
    name: string;
    stage_order: number;
  } | null;
  qualifiedByPurchase: boolean;
  qualifiedByLTV: boolean;
}

/**
 * Find the highest tier a customer qualifies for
 * Checks both min_purchase_amount (single order) and min_ltv_amount (cumulative LTV)
 * 
 * @param clientId - Client UUID
 * @param purchaseAmount - Single order amount (optional)
 * @param customerLTV - Customer's lifetime value (optional)
 * @returns The highest qualifying tier, or null if none qualify
 */
export async function findQualifyingTier(
  clientId: string,
  purchaseAmount?: number,
  customerLTV?: number
): Promise<TierQualificationResult> {
  const supabase = db.getSupabaseClient();
  
  // Get club program for this client
  const clubProgram = await db.getClubProgram(clientId);
  if (!clubProgram) {
    return {
      qualifyingTier: null,
      qualifiedByPurchase: false,
      qualifiedByLTV: false,
    };
  }
  
  // Get all active tiers for this client, ordered by stage_order (ascending)
  const { data: tiers, error } = await supabase
    .from('club_stages')
    .select('id, name, stage_order, min_purchase_amount, min_ltv_amount')
    .eq('club_program_id', clubProgram.id)
    .eq('is_active', true)
    .not('stage_order', 'is', null)
    .order('stage_order', { ascending: true });
  
  if (error || !tiers || tiers.length === 0) {
    return {
      qualifyingTier: null,
      qualifiedByPurchase: false,
      qualifiedByLTV: false,
    };
  }
  
  // Find the highest tier the customer qualifies for
  // A customer qualifies if they meet EITHER the purchase amount OR LTV requirement
  let qualifyingTier: typeof tiers[0] | null = null;
  let qualifiedByPurchase = false;
  let qualifiedByLTV = false;
  
  // Iterate from highest to lowest tier (reverse order)
  for (let i = tiers.length - 1; i >= 0; i--) {
    const tier = tiers[i];
    const qualifiesByPurchase = purchaseAmount !== undefined && purchaseAmount >= (tier.min_purchase_amount || 0);
    const qualifiesByLTV = customerLTV !== undefined && customerLTV >= (tier.min_ltv_amount || 0);
    
    if (qualifiesByPurchase || qualifiesByLTV) {
      qualifyingTier = tier;
      qualifiedByPurchase = qualifiesByPurchase;
      qualifiedByLTV = qualifiesByLTV;
      break; // Take the highest qualifying tier
    }
  }
  
  return {
    qualifyingTier: qualifyingTier ? {
      id: qualifyingTier.id,
      name: qualifyingTier.name,
      stage_order: qualifyingTier.stage_order || 0,
    } : null,
    qualifiedByPurchase,
    qualifiedByLTV,
  };
}

/**
 * Check if customer qualifies for a specific tier upgrade
 * Used when checking if customer should be upgraded to a higher tier
 * 
 * @param customerId - Customer UUID
 * @param targetTierId - Tier ID to check qualification for
 * @param purchaseAmount - Single order amount (optional, for single-order qualification)
 * @returns true if customer qualifies for the target tier
 */
export async function customerQualifiesForTier(
  customerId: string,
  targetTierId: string,
  purchaseAmount?: number
): Promise<boolean> {
  const supabase = db.getSupabaseClient();
  
  // Get customer's LTV
  const { data: customer } = await supabase
    .from('customers')
    .select('client_id, lifetime_value')
    .eq('id', customerId)
    .single();
  
  if (!customer) {
    return false;
  }
  
  // Get target tier requirements
  const { data: tier } = await supabase
    .from('club_stages')
    .select('min_purchase_amount, min_ltv_amount')
    .eq('id', targetTierId)
    .single();
  
  if (!tier) {
    return false;
  }
  
  // Customer qualifies if they meet EITHER requirement
  const qualifiesByPurchase = purchaseAmount !== undefined && purchaseAmount >= (tier.min_purchase_amount || 0);
  const qualifiesByLTV = customer.lifetime_value >= (tier.min_ltv_amount || 0);
  
  return qualifiesByPurchase || qualifiesByLTV;
}

