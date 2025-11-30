import { redirect } from 'react-router';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import { createTierTagAndCoupon, syncTierTagAndCoupon } from '~/lib/tier-helpers.server';
import { parseDiscount, type Discount } from '~/types/discount';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';

interface TierFormDataSerialized {
  id: string;
  name: string;
  durationMonths: string;
  minPurchaseAmount: string;
  description?: string;
  upgradable?: boolean;
  
  // New: Array of promotions (can have multiple per tier)
  promotions?: Array<{
    title: string;
    productDiscountType?: string;
    productDiscount?: number;
    shippingDiscountType?: string;
    shippingDiscount?: number;
    minimumCartAmount?: number;
  }>;
  
  // New: Optional loyalty configuration
  loyalty?: {
    enabled: boolean;
    earnRate: number; // decimal, e.g., 0.02 = 2%
    initialPointsBonus?: number;
  };
  
  // OLD FIELDS (deprecated, for backwards compatibility during migration)
  discountPercentage?: string;
  discount?: any;
}

interface SetupFormData {
  clubName: string;
  clubDescription: string;
  tiers: TierFormDataSerialized[];
  pointsPerDollar: string;
  minMembershipDays: string;
  pointDollarValue: string;
  minPointsRedemption: string;
}

/**
 * Parses form data for setup/update
 */
export function parseSetupFormData(formData: FormData): SetupFormData {
  const clubName = formData.get('club_name') as string;
  const clubDescription = formData.get('club_description') as string;
  const tiersJson = formData.get('tiers') as string;
  const pointsPerDollar = formData.get('points_per_dollar') as string;
  const minMembershipDays = formData.get('min_membership_days') as string;
  const pointDollarValue = formData.get('point_dollar_value') as string;
  const minPointsRedemption = formData.get('min_points_redemption') as string;
  
  const tiers: TierFormDataSerialized[] = tiersJson ? JSON.parse(tiersJson) : [];
  
  return {
    clubName,
    clubDescription,
    tiers,
    pointsPerDollar,
    minMembershipDays,
    pointDollarValue,
    minPointsRedemption,
  };
}

/**
 * Validates setup form data
 */
export function validateSetupData(data: SetupFormData) {
  if (!data.clubName || !data.tiers || data.tiers.length === 0) {
    return {
      success: false,
      message: 'Club name and at least one tier are required'
    };
  }
  
  return { success: true };
}

/**
 * Creates a club program in the database
 */
export async function createClubProgram(
  clientId: string,
  clubName: string,
  clubDescription: string
) {
  return db.createClubProgram(clientId, clubName, clubDescription);
}

/**
 * Creates club tiers in the database (NEW ARCHITECTURE)
 * Note: C7 club/promotion creation happens separately now
 */
export async function createClubTiers(
  clubProgramId: string,
  tiers: TierFormDataSerialized[]
) {
  const stages = tiers.map((tier, index) => ({
    name: tier.name,
    durationMonths: parseInt(tier.durationMonths),
    minPurchaseAmount: parseFloat(tier.minPurchaseAmount),
    stageOrder: index + 1,
    upgradable: tier.upgradable ?? true,
  }));
  
  return db.createClubStages(clubProgramId, stages);
}

/**
 * Creates C7 Clubs, Promotions, and Loyalty for tiers (NEW ARCHITECTURE)
 * Uses orchestration methods for atomic operations with rollback
 */
export async function createTiersInC7(
  tiers: TierFormDataSerialized[],
  createdTiers: any[],
  crmType: string,
  tenantShop: string
): Promise<string[]> {
  if (crmType !== 'commerce7') {
    return ['Shopify not yet supported for new club architecture'];
  }
  
  const provider = new Commerce7Provider(tenantShop);
  const errors: string[] = [];
  
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const createdTier = createdTiers[i];
    
    try {
      // Use orchestration method for atomic creation
      const result = await provider.createTierWithPromotionsAndLoyalty({
        name: tier.name,
        description: tier.description,
        durationMonths: parseInt(tier.durationMonths),
        minPurchaseAmount: parseFloat(tier.minPurchaseAmount),
        promotions: tier.promotions || [],
        loyalty: tier.loyalty,
      });
      
      // Update tier with C7 club ID
      await db.updateClubStage(createdTier.id, {
        c7ClubId: result.clubId,
      });
      
      // Save promotions to club_stage_promotions table
      if (result.promotionIds.length > 0) {
        await db.createStagePromotions(
          createdTier.id,
          result.promotionIds.map(promoId => ({
            crmId: promoId,
            crmType: 'commerce7',
          }))
        );
      }
      
      // Save loyalty configuration if enabled
      if (result.loyaltyTierId && tier.loyalty) {
        await db.createTierLoyaltyConfig({
          stageId: createdTier.id,
          c7LoyaltyTierId: result.loyaltyTierId,
          tierTitle: `${tier.name} Rewards`,
          earnRate: tier.loyalty.earnRate,
          initialPointsBonus: tier.loyalty.initialPointsBonus || 0,
        });
      }
      
    } catch (error) {
      const errorMsg = `Failed to create C7 resources for tier "${tier.name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }
  
  return errors;
}

/**
 * DEPRECATED: Old createTierDiscounts (kept for backwards compatibility)
 * Use createTiersInC7 instead
 */
export async function createTierDiscounts(
  tiers: TierFormDataSerialized[],
  createdTiers: any[],
  crmType: string,
  tenantShop: string
): Promise<string[]> {
  console.warn('createTierDiscounts is deprecated, use createTiersInC7 instead');
  return createTiersInC7(tiers, createdTiers, crmType, tenantShop);
}

/**
 * Creates loyalty point rules in the database
 * @deprecated Global loyalty rules are deprecated. Use tier-specific loyalty instead.
 */
export async function createLoyaltyRules(
  clientId: string,
  pointsPerDollar: string,
  minMembershipDays: string,
  pointDollarValue: string,
  minPointsRedemption: string
) {
  return db.createLoyaltyRules(
    clientId,
    parseFloat(pointsPerDollar || '1'),
    parseInt(minMembershipDays || '365'),
    parseFloat(pointDollarValue || '0.01'),
    parseInt(minPointsRedemption || '100')
  );
}

/**
 * Marks setup as complete for a client
 */
export async function markSetupComplete(clientId: string) {
  return db.markSetupComplete(clientId);
}

/**
 * Rollback helper - deletes club program and all related data
 */
export async function rollbackClubProgram(clubProgramId: string) {
  return db.deleteClubProgram(clubProgramId);
}

/**
 * Updates an existing club program
 */
export async function updateClubProgram(
  clubProgramId: string,
  clubName: string,
  clubDescription: string
) {
  return db.updateClubProgram(clubProgramId, clubName, clubDescription);
}

/**
 * Updates an existing tier (NEW ARCHITECTURE)
 * Note: C7 club/promotion updates need to be handled separately
 */
export async function updateExistingTier(
  tier: TierFormDataSerialized,
  stageOrder: number
) {
  return db.updateClubStage(tier.id, {
    name: tier.name,
    durationMonths: parseInt(tier.durationMonths),
    minPurchaseAmount: parseFloat(tier.minPurchaseAmount),
    stageOrder,
    upgradable: tier.upgradable,
  });
}

/**
 * Creates a new tier (NEW ARCHITECTURE)
 * Note: C7 club/promotion creation needs to be handled separately
 */
export async function createNewTier(
  clubProgramId: string,
  tier: TierFormDataSerialized,
  stageOrder: number
) {
  const stages = await db.createClubStages(clubProgramId, [{
    name: tier.name,
    durationMonths: parseInt(tier.durationMonths),
    minPurchaseAmount: parseFloat(tier.minPurchaseAmount),
    stageOrder,
  }]);
  
  return stages[0];
}

/**
 * Syncs a tier's discount with Commerce7
 * @deprecated This is for the old tag/coupon system. Use createTiersInC7 instead.
 */
export async function syncTierDiscount(
  tier: TierFormDataSerialized,
  existingTier: any,
  crmType: string,
  tenantShop: string
): Promise<string | null> {
  if (!tier.discount || crmType !== 'commerce7') {
    return null;
  }
  
  try {
    const discount = parseDiscount(tier.discount);
    const provider = new Commerce7Provider(tenantShop);
    
    const result = await syncTierTagAndCoupon(
      provider,
      tier.name,
      discount,
      existingTier?.platform_tag_id,
      existingTier?.platform_discount_id
    );
    
    const supabase = db.getSupabaseClient();
    await supabase
      .from('club_stages')
      .update({ 
        platform_tag_id: result.tagId,
        platform_discount_id: result.couponId,
        discount_code: result.couponCode,
        discount_title: result.couponTitle,
      })
      .eq('id', tier.id);
    
    return null;
  } catch (error) {
    const errorMsg = `Failed to sync coupon for tier "${tier.name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(errorMsg);
    return errorMsg;
  }
}

/**
 * Deletes a tier and its associated C7 resources (NEW ARCHITECTURE)
 * Deletes club, promotions, and loyalty tier from C7
 */
export async function deleteTier(
  tierId: string,
  tierData: any,
  crmType: string,
  tenantShop: string
) {
  if (crmType === 'commerce7' && tierData?.c7_club_id) {
    const provider = new Commerce7Provider(tenantShop);
    
    // Get promotions for this tier
    const promotions = await db.getStagePromotions(tierId);
    
    // Get loyalty tier for this tier
    const loyaltyConfig = await db.getTierLoyaltyConfig(tierId);
    
    // Use rollback method to clean up C7 resources
    await provider.rollbackTierCreation({
      clubId: tierData.c7_club_id,
      promotionIds: promotions?.map(p => p.crm_id) || [],
      loyaltyTierId: loyaltyConfig?.c7_loyalty_tier_id || null,
    });
  }
  
  // Delete from database (CASCADE will handle related tables)
  await db.deleteClubStage(tierId);
}

/**
 * Updates loyalty point rules
 * @deprecated Global loyalty rules are deprecated. Use tier-specific loyalty instead.
 */
export async function updateLoyaltyRules(
  clientId: string,
  pointsPerDollar: string,
  minMembershipDays: string,
  pointDollarValue: string,
  minPointsRedemption: string
) {
  return db.updateLoyaltyRules(
    clientId,
    parseFloat(pointsPerDollar || '1'),
    parseInt(minMembershipDays || '365'),
    parseFloat(pointDollarValue || '0.01'),
    parseInt(minPointsRedemption || '100')
  );
}

/**
 * Checks if a tier ID is an existing tier (UUID format)
 */
export function isExistingTier(tierId: string): boolean {
  return !!tierId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
}

/**
 * Builds success redirect URL with toast message
 */
export function buildSuccessRedirect(
  sessionId: string,
  message: string,
  errors: string[]
): never {
  let successMessage = message;
  if (errors.length > 0) {
    successMessage += ` (${errors.length} coupon operation(s) failed - see console)`;
  }
  
  const settingsUrl = addSessionToUrl('/app/settings', sessionId) + 
    `&toast=${encodeURIComponent(successMessage)}&toastType=success`;
  
  throw redirect(settingsUrl);
}

