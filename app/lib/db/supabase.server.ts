/**
 * Centralized Supabase database operations
 * All database queries should go through this module
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '~/types/supabase';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Type aliases for convenience
type Client = Database['public']['Tables']['clients']['Row'];
type ClubProgram = Database['public']['Tables']['club_programs']['Row'];
type ClubStage = Database['public']['Tables']['club_stages']['Row'];
type StagePromotion = Database['public']['Tables']['club_stage_promotions']['Row'];
type TierLoyalty = Database['public']['Tables']['tier_loyalty_config']['Row'];
type LoyaltyRules = Database['public']['Tables']['loyalty_point_rules']['Row'];

/**
 * Get a Supabase client with service role (typed)
 */
export function getSupabaseClient() {
  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

// ============================================
// CLIENT OPERATIONS
// ============================================

export async function getClient(clientId: string): Promise<Client | null> {
  const supabase = getSupabaseClient();
  
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  return client;
}

export async function markSetupComplete(clientId: string) {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('clients')
    .update({ 
      setup_complete: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', clientId);
}

// ============================================
// CLUB PROGRAM OPERATIONS
// ============================================

export async function createClubProgram(
  clientId: string,
  name: string,
  description: string
): Promise<ClubProgram> {
  const supabase = getSupabaseClient();
  
  const { data: clubProgram, error } = await supabase
    .from('club_programs')
    .insert({
      client_id: clientId,
      name,
      description,
      is_active: true,
    })
    .select()
    .single();
  
  if (error || !clubProgram) {
    throw new Error(`Failed to create club program: ${error?.message}`);
  }
  
  return clubProgram;
}

export async function getClubProgram(clientId: string): Promise<(ClubProgram & { club_stages: ClubStage[] }) | null> {
  const supabase = getSupabaseClient();
  
  const { data: program } = await supabase
    .from('club_programs')
    .select('*, club_stages(*)')
    .eq('client_id', clientId)
    .single();
  
  return program;
}

export async function updateClubProgram(
  programId: string,
  name: string,
  description: string
) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('club_programs')
    .update({
      name,
      description,
      updated_at: new Date().toISOString()
    })
    .eq('id', programId);
  
  if (error) {
    throw new Error(`Failed to update club program: ${error.message}`);
  }
}

export async function deleteClubProgram(programId: string) {
  const supabase = getSupabaseClient();
  
  // Delete stages first
  await supabase.from('club_stages').delete().eq('club_program_id', programId);
  
  // Delete program
  await supabase.from('club_programs').delete().eq('id', programId);
}

// ============================================
// CLUB STAGE (TIER) OPERATIONS
// ============================================

export async function createClubStages(
  programId: string,
  stages: Array<{
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
    stageOrder: number;
  }>
): Promise<ClubStage[]> {
  const supabase = getSupabaseClient();
  
  const inserts = stages.map((stage) => ({
    club_program_id: programId,
    name: stage.name,
    duration_months: stage.durationMonths,
    min_purchase_amount: stage.minPurchaseAmount,
    stage_order: stage.stageOrder,
    is_active: true,
  }));
  
  const { data, error } = await supabase
    .from('club_stages')
    .insert(inserts)
    .select();
  
  if (error || !data) {
    throw new Error(`Failed to create club stages: ${error?.message}`);
  }
  
  return data;
}

export async function updateClubStage(
  stageId: string,
  data: {
    name?: string;
    durationMonths?: number;
    minPurchaseAmount?: number;
    stageOrder?: number;
    c7ClubId?: string;
  }
) {
  const supabase = getSupabaseClient();
  
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  if (data.name) updateData.name = data.name;
  if (data.durationMonths) updateData.duration_months = data.durationMonths;
  if (data.minPurchaseAmount) updateData.min_purchase_amount = data.minPurchaseAmount;
  if (data.stageOrder !== undefined) updateData.stage_order = data.stageOrder;
  if (data.c7ClubId) updateData.c7_club_id = data.c7ClubId;
  
  const { error } = await supabase
    .from('club_stages')
    .update(updateData)
    .eq('id', stageId);
  
  if (error) {
    throw new Error(`Failed to update club stage: ${error.message}`);
  }
}

export async function deleteClubStage(stageId: string) {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('club_stages')
    .delete()
    .eq('id', stageId);
}

export async function getClubStageWithDetails(stageId: string): Promise<ClubStage | null> {
  const supabase = getSupabaseClient();
  
  const { data: stage } = await supabase
    .from('club_stages')
    .select('*')
    .eq('id', stageId)
    .single();
  
  return stage;
}

// ============================================
// PROMOTION OPERATIONS
// ============================================

export async function createStagePromotions(
  stageId: string,
  promotions: Array<{
    crmId: string;
    crmType: string;
    title?: string;
    description?: string;
  }>
) {
  const supabase = getSupabaseClient();
  
  const inserts = promotions.map(promo => ({
    club_stage_id: stageId,
    crm_id: promo.crmId,
    crm_type: promo.crmType,
    title: promo.title,
    description: promo.description,
  }));
  
  const { error } = await supabase
    .from('club_stage_promotions')
    .insert(inserts);
  
  if (error) {
    throw new Error(`Failed to create stage promotions: ${error.message}`);
  }
}

export async function getStagePromotions(stageId: string): Promise<StagePromotion[]> {
  const supabase = getSupabaseClient();
  
  const { data: promotions } = await supabase
    .from('club_stage_promotions')
    .select('*')
    .eq('club_stage_id', stageId);
  
  return promotions || [];
}

export async function deleteStagePromotions(stageId: string) {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('club_stage_promotions')
    .delete()
    .eq('club_stage_id', stageId);
}

// ============================================
// LOYALTY OPERATIONS
// ============================================

export async function createTierLoyaltyConfig(config: {
  stageId: string;
  c7LoyaltyTierId: string;
  tierTitle: string;
  earnRate: number;
  initialPointsBonus: number;
}) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('tier_loyalty_config')
    .insert({
      club_stage_id: config.stageId,
      c7_loyalty_tier_id: config.c7LoyaltyTierId,
      tier_title: config.tierTitle,
      earn_rate: config.earnRate,
      initial_points_bonus: config.initialPointsBonus,
      is_active: true,
    });
  
  if (error) {
    throw new Error(`Failed to create tier loyalty config: ${error.message}`);
  }
}

export async function getTierLoyaltyConfig(stageId: string): Promise<TierLoyalty | null> {
  const supabase = getSupabaseClient();
  
  const { data: loyalty } = await supabase
    .from('tier_loyalty_config')
    .select('*')
    .eq('club_stage_id', stageId)
    .single();
  
  return loyalty;
}

export async function deleteTierLoyaltyConfig(stageId: string) {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('tier_loyalty_config')
    .delete()
    .eq('club_stage_id', stageId);
}

// ============================================
// LOYALTY POINT RULES (DEPRECATED - global rules)
// ============================================

export async function createLoyaltyRules(
  clientId: string,
  pointsPerDollar: number,
  minMembershipDays: number,
  pointDollarValue: number,
  minPointsRedemption: number
) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('loyalty_point_rules')
    .insert({
      client_id: clientId,
      points_per_dollar: pointsPerDollar,
      min_membership_days: minMembershipDays,
      point_dollar_value: pointDollarValue,
      min_points_for_redemption: minPointsRedemption,
      is_active: true,
    });
  
  if (error) {
    throw new Error(`Failed to create loyalty rules: ${error.message}`);
  }
}

export async function getLoyaltyRules(clientId: string): Promise<LoyaltyRules | null> {
  const supabase = getSupabaseClient();
  
  const { data: rules } = await supabase
    .from('loyalty_point_rules')
    .select('*')
    .eq('client_id', clientId)
    .single();
  
  return rules;
}

export async function updateLoyaltyRules(
  clientId: string,
  pointsPerDollar: number,
  minMembershipDays: number,
  pointDollarValue: number,
  minPointsRedemption: number
) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('loyalty_point_rules')
    .update({
      points_per_dollar: pointsPerDollar,
      min_membership_days: minMembershipDays,
      point_dollar_value: pointDollarValue,
      min_points_for_redemption: minPointsRedemption,
      updated_at: new Date().toISOString()
    })
    .eq('client_id', clientId);
  
  if (error) {
    throw new Error(`Failed to update loyalty rules: ${error.message}`);
  }
}

