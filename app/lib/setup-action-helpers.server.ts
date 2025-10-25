import { createClient } from '@supabase/supabase-js';
import { redirect } from 'react-router';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import { createTierTagAndCoupon, syncTierTagAndCoupon } from '~/lib/tier-helpers.server';
import { parseDiscount, type Discount } from '~/types/discount';
import { addSessionToUrl } from '~/util/session';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TierFormDataSerialized {
  id: string;
  name: string;
  discountPercentage: string;
  durationMonths: string;
  minPurchaseAmount: string;
  description?: string;
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
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: clubProgram, error: clubError } = await supabase
    .from('club_programs')
    .insert({
      client_id: clientId,
      name: clubName,
      description: clubDescription,
      is_active: true,
    })
    .select()
    .single();
  
  if (clubError || !clubProgram) {
    throw new Error(`Failed to create club program: ${clubError?.message}`);
  }
  
  return clubProgram;
}

/**
 * Creates club tiers in the database
 */
export async function createClubTiers(
  clubProgramId: string,
  tiers: TierFormDataSerialized[]
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const tierInserts = tiers.map((tier, index) => ({
    club_program_id: clubProgramId,
    name: tier.name,
    discount_percentage: parseFloat(tier.discountPercentage),
    duration_months: parseInt(tier.durationMonths),
    min_purchase_amount: parseFloat(tier.minPurchaseAmount),
    stage_order: index + 1,
    is_active: true,
    discount_code: tier.discount?.code,
    discount_title: tier.discount?.title,
  }));
  
  const { data: createdTiers, error: tiersError } = await supabase
    .from('club_stages')
    .insert(tierInserts)
    .select();
  
  if (tiersError || !createdTiers) {
    throw new Error(`Failed to create tiers: ${tiersError?.message}`);
  }
  
  return createdTiers;
}

/**
 * Creates discounts in CRM (Commerce7/Shopify) for tiers
 */
export async function createTierDiscounts(
  tiers: TierFormDataSerialized[],
  createdTiers: any[],
  crmType: string,
  tenantShop: string
): Promise<string[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const errors: string[] = [];
  
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const createdTier = createdTiers[i];
    
    if (!tier.discount) continue;
    
    try {
      const discount = parseDiscount(tier.discount);
      
      if (crmType === 'commerce7') {
        const provider = new Commerce7Provider(tenantShop);
        const result = await createTierTagAndCoupon(provider, tier.name, discount);
        
        await supabase
          .from('club_stages')
          .update({ 
            platform_tag_id: result.tagId,
            platform_discount_id: result.couponId,
            discount_code: result.couponCode,
            discount_title: result.couponTitle,
          })
          .eq('id', createdTier.id);
      } else if (crmType === 'shopify') {
        throw new Error('Shopify discount creation not yet implemented');
      }
    } catch (error) {
      const errorMsg = `Failed to create discount for tier "${tier.name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      errors.push(errorMsg);
    }
  }
  
  return errors;
}

/**
 * Creates loyalty point rules in the database
 */
export async function createLoyaltyRules(
  clientId: string,
  pointsPerDollar: string,
  minMembershipDays: string,
  pointDollarValue: string,
  minPointsRedemption: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { error: loyaltyError } = await supabase
    .from('loyalty_point_rules')
    .insert({
      client_id: clientId,
      points_per_dollar: parseFloat(pointsPerDollar || '1'),
      min_membership_days: parseInt(minMembershipDays || '365'),
      point_dollar_value: parseFloat(pointDollarValue || '0.01'),
      min_points_for_redemption: parseInt(minPointsRedemption || '100'),
      is_active: true,
    });
  
  if (loyaltyError) {
    throw new Error(`Failed to create loyalty rules: ${loyaltyError.message}`);
  }
}

/**
 * Marks setup as complete for a client
 */
export async function markSetupComplete(clientId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  await supabase
    .from('clients')
    .update({ 
      setup_complete: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', clientId);
}

/**
 * Rollback helper - deletes club program and all related data
 */
export async function rollbackClubProgram(clubProgramId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  await supabase.from('club_stages').delete().eq('club_program_id', clubProgramId);
  await supabase.from('club_programs').delete().eq('id', clubProgramId);
}

/**
 * Updates an existing club program
 */
export async function updateClubProgram(
  clubProgramId: string,
  clubName: string,
  clubDescription: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { error: updateProgramError } = await supabase
    .from('club_programs')
    .update({
      name: clubName,
      description: clubDescription,
      updated_at: new Date().toISOString()
    })
    .eq('id', clubProgramId);
  
  if (updateProgramError) {
    throw new Error(`Failed to update club program: ${updateProgramError.message}`);
  }
}

/**
 * Updates an existing tier
 */
export async function updateExistingTier(
  tier: TierFormDataSerialized,
  stageOrder: number
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { error: updateTierError } = await supabase
    .from('club_stages')
    .update({
      name: tier.name,
      discount_percentage: parseFloat(tier.discountPercentage),
      duration_months: parseInt(tier.durationMonths),
      min_purchase_amount: parseFloat(tier.minPurchaseAmount),
      stage_order: stageOrder,
      discount_code: tier.discount?.code,
      discount_title: tier.discount?.title,
      updated_at: new Date().toISOString()
    })
    .eq('id', tier.id);
  
  if (updateTierError) {
    throw new Error(`Failed to update tier ${tier.name}: ${updateTierError.message}`);
  }
}

/**
 * Creates a new tier
 */
export async function createNewTier(
  clubProgramId: string,
  tier: TierFormDataSerialized,
  stageOrder: number
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: newTier, error: createTierError } = await supabase
    .from('club_stages')
    .insert({
      club_program_id: clubProgramId,
      name: tier.name,
      discount_percentage: parseFloat(tier.discountPercentage),
      duration_months: parseInt(tier.durationMonths),
      min_purchase_amount: parseFloat(tier.minPurchaseAmount),
      stage_order: stageOrder,
      is_active: true,
      discount_code: tier.discount?.code,
      discount_title: tier.discount?.title,
    })
    .select()
    .single();
  
  if (createTierError || !newTier) {
    throw new Error(`Failed to create new tier ${tier.name}: ${createTierError?.message}`);
  }
  
  return newTier;
}

/**
 * Syncs a tier's discount with Commerce7
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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
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
 * Deletes a tier and its associated CRM resources
 */
export async function deleteTier(
  tierId: string,
  tierData: any,
  crmType: string,
  tenantShop: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  if (crmType === 'commerce7') {
    const provider = new Commerce7Provider(tenantShop);
    
    // Delete coupon
    if (tierData?.platform_discount_id) {
      try {
        await provider.deleteC7Coupon(tierData.platform_discount_id);
      } catch (error) {
        console.error(`Failed to delete coupon for tier "${tierData?.name}":`, error);
      }
    }
    
    // Delete tag
    if (tierData?.platform_tag_id) {
      try {
        await provider.deleteTag(tierData.platform_tag_id);
      } catch (error) {
        console.error(`Failed to delete tag for tier "${tierData?.name}":`, error);
      }
    }
  }
  
  // Delete the tier from database
  await supabase
    .from('club_stages')
    .delete()
    .eq('id', tierId);
}

/**
 * Updates loyalty point rules
 */
export async function updateLoyaltyRules(
  clientId: string,
  pointsPerDollar: string,
  minMembershipDays: string,
  pointDollarValue: string,
  minPointsRedemption: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { error: updateLoyaltyError } = await supabase
    .from('loyalty_point_rules')
    .update({
      points_per_dollar: parseFloat(pointsPerDollar || '1'),
      min_membership_days: parseInt(minMembershipDays || '365'),
      point_dollar_value: parseFloat(pointDollarValue || '0.01'),
      min_points_for_redemption: parseInt(minPointsRedemption || '100'),
      updated_at: new Date().toISOString()
    })
    .eq('client_id', clientId);
  
  if (updateLoyaltyError) {
    throw new Error(`Failed to update loyalty rules: ${updateLoyaltyError.message}`);
  }
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

