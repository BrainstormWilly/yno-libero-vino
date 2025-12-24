/**
 * Centralized Supabase database operations
 * All database queries should go through this module
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '~/types/supabase';
import {
  DEFAULT_COMMUNICATION_PREFERENCES,
  normalizeCommunicationPreferences,
  type CommunicationPreferences,
} from '~/lib/communication/preferences';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Type aliases for convenience
type Client = Database['public']['Tables']['clients']['Row'];
type ClubProgram = Database['public']['Tables']['club_programs']['Row'];
type ClubStage = Database['public']['Tables']['club_stages']['Row'];
type StagePromotion = Database['public']['Tables']['club_stage_promotions']['Row'];
type TierLoyalty = Database['public']['Tables']['tier_loyalty_config']['Row'];
type LoyaltyRules = Database['public']['Tables']['loyalty_point_rules']['Row'];
type CommunicationConfig = Database['public']['Tables']['communication_configs']['Row'];
type CommunicationConfigInsert = Database['public']['Tables']['communication_configs']['Insert'];

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

export async function getClientbyCrmIdentifier(crmType: string, identifier: string): Promise<Client | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_shop', identifier)
    .eq('crm_type', crmType)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

export async function upsertFakeClient(crmType: 'commerce7' | 'shopify'): Promise<Client | null> {
  const supabase = getSupabaseClient();
  
  if (crmType === 'commerce7') {
    let { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_shop', 'yno-fanbase')
      .single();
    
    if (!client) {
      const { data: newClient, error } = await supabase
        .from('clients')
        .upsert({
          id: 'a7f5c3e2-8d91-4b1e-9a2f-1c5b8e3d4f6a',
          tenant_shop: 'yno-fanbase',
          crm_type: 'commerce7',
          org_name: 'Yno Fanbase',
          org_contact: 'William Langley',
          user_email: 'bill@ynoguy.com',
        })
        .select()
        .single();
      
      if (error) {
        console.error('Failed to create yno-fanbase client:', error);
        return null;
      }
      client = newClient;
    }
    
    return client;
  } else {
    // Shopify
    let { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('tenant_shop', 'fake-client-shopify')
      .single();
    
    if (!client) {
      const { data: newClient, error } = await supabase
        .from('clients')
        .upsert({
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          tenant_shop: 'fake-client-shopify',
          crm_type: 'shopify',
          org_name: 'Fake Shopify Client',
          org_contact: 'William Langley',
          user_email: 'will@ynosoftware.com',
        })
        .select()
        .single();
      
      if (error) {
        console.error('Failed to create fake shopify client:', error);
        return null;
      }
      client = newClient;
    }
    
    return client;
  }
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

export async function updateClientEmailImages(
  clientId: string,
  images: {
    emailHeaderImageUrl?: string | null;
    emailFooterImageUrl?: string | null;
  }
) {
  const supabase = getSupabaseClient();
  
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  if (images.emailHeaderImageUrl !== undefined) {
    updateData.email_header_image_url = images.emailHeaderImageUrl;
  }
  if (images.emailFooterImageUrl !== undefined) {
    updateData.email_footer_image_url = images.emailFooterImageUrl;
  }
  
  const { error } = await supabase
    .from('clients')
    .update(updateData)
    .eq('id', clientId);
  
  if (error) {
    throw new Error(`Failed to update client email images: ${error.message}`);
  }
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
  
  const { data: program, error } = await supabase
    .from('club_programs')
    .select('*, club_stages(*)')
    .eq('client_id', clientId)
    .maybeSingle();
  
  if (error) return null;
  
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
    upgradable?: boolean;
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
    upgradable: stage.upgradable ?? true,
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
    minLtvAmount?: number;
    stageOrder?: number | null; // Allow null for inactive tiers
    c7ClubId?: string;
    upgradable?: boolean;
    isActive?: boolean;
  }
) {
  const supabase = getSupabaseClient();
  
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  if (data.name) updateData.name = data.name;
  if (data.durationMonths) updateData.duration_months = data.durationMonths;
  if (data.minPurchaseAmount) updateData.min_purchase_amount = data.minPurchaseAmount;
  if (data.minLtvAmount !== undefined) updateData.min_ltv_amount = data.minLtvAmount;
  if (data.stageOrder !== undefined) updateData.stage_order = data.stageOrder; // Can be null
  if (data.c7ClubId) updateData.c7_club_id = data.c7ClubId;
  if (data.upgradable !== undefined) updateData.upgradable = data.upgradable;
  if (data.isActive !== undefined) {
    updateData.is_active = data.isActive;
    // When marking as inactive, also set stage_order to NULL to free it up
    if (data.isActive === false && data.stageOrder === undefined) {
      updateData.stage_order = null;
    }
  }
  
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
  
  const { data: stage, error } = await supabase
    .from('club_stages')
    .select('*')
    .eq('id', stageId)
    .maybeSingle();
  
  if (error) return null;
  
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
  
  const { data: loyalty, error } = await supabase
    .from('tier_loyalty_config')
    .select('*')
    .eq('club_stage_id', stageId)
    .maybeSingle();
  
  if (error) return null;
  
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
  
  const { data: rules, error } = await supabase
    .from('loyalty_point_rules')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  
  if (error) return null;
  
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

// ============================================
// CUSTOMER OPERATIONS
// ============================================

export async function createCustomer(
  clientId: string,
  data: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    crmId: string;
  }
) {
  const supabase = getSupabaseClient();
  
  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      client_id: clientId,
      email: data.email,
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      crm_id: data.crmId,
    })
    .select()
    .single();
  
  if (error || !customer) {
    throw new Error(`Failed to create customer: ${error?.message}`);
  }
  
  return customer;
}

export async function getCustomerByCrmId(clientId: string, crmId: string) {
  const supabase = getSupabaseClient();
  
  const { data: customer, error } = await supabase
    .from('customers')
    .select('*')
    .eq('client_id', clientId)
    .eq('crm_id', crmId)
    .maybeSingle();
  
  if (error) return null;
  
  return customer;
}

export async function getCustomersByClientId(clientId: string) {
  const supabase = getSupabaseClient();
  
  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  
  return customers || [];
}

export function getDefaultCommunicationPreferences(): CommunicationPreferences {
  return { ...DEFAULT_COMMUNICATION_PREFERENCES };
}

export async function getCommunicationPreferences(
  customerId: string
): Promise<CommunicationPreferences> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('communication_preferences')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error || !data) {
    return getDefaultCommunicationPreferences();
  }

  return normalizeCommunicationPreferences({
    emailMarketing: data.email_marketing ?? undefined,
    smsTransactional: data.sms_transactional ?? undefined,
    smsMarketing: data.sms_marketing ?? undefined,
    unsubscribedAll: data.unsubscribed_all ?? undefined,
    smsOptedInAt: data.sms_opted_in_at ?? undefined,
    smsOptInMethod: data.sms_opt_in_method as 'web_form' | 'text_reply' | 'admin_manual' | 'signup_form' | undefined,
    smsOptInSource: data.sms_opt_in_source ?? undefined,
    smsOptInRequestSentAt: data.sms_opt_in_request_sent_at ?? undefined,
    smsOptInConfirmedAt: data.sms_opt_in_confirmed_at ?? undefined,
  });
}

export async function upsertCommunicationPreferences(
  customerId: string,
  preferences: CommunicationPreferences
): Promise<void> {
  const supabase = getSupabaseClient();

  const payload: any = {
    customer_id: customerId,
    email_marketing: preferences.emailMarketing,
    sms_transactional: preferences.smsTransactional,
    sms_marketing: preferences.smsMarketing,
    unsubscribed_all: preferences.unsubscribedAll,
    updated_at: new Date().toISOString(),
  };

  // Add SMS opt-in tracking fields if provided
  if (preferences.smsOptedInAt !== undefined) {
    payload.sms_opted_in_at = preferences.smsOptedInAt;
  }
  if (preferences.smsOptInMethod !== undefined) {
    payload.sms_opt_in_method = preferences.smsOptInMethod;
  }
  if (preferences.smsOptInSource !== undefined) {
    payload.sms_opt_in_source = preferences.smsOptInSource;
  }
  if (preferences.smsOptInRequestSentAt !== undefined) {
    payload.sms_opt_in_request_sent_at = preferences.smsOptInRequestSentAt;
  }
  if (preferences.smsOptInConfirmedAt !== undefined) {
    payload.sms_opt_in_confirmed_at = preferences.smsOptInConfirmedAt;
  }

  const { error } = await supabase
    .from('communication_preferences')
    .upsert(payload, { onConflict: 'customer_id' });

  if (error) {
    throw new Error(`Failed to upsert communication preferences: ${error.message}`);
  }
}

// ============================================
// CLUB ENROLLMENT OPERATIONS
// ============================================

export async function createClubEnrollment(data: {
  customerId: string;
  clubStageId: string;
  status: 'active' | 'expired' | 'cancelled';
  enrolledAt: string;
  expiresAt: string; // Required - NOT NULL in schema
  crmMembershipId: string | null;
}) {
  const supabase = getSupabaseClient();
  
  const { data: enrollment, error} = await supabase
    .from('club_enrollments')
    .insert({
      customer_id: data.customerId,
      club_stage_id: data.clubStageId,
      status: data.status,
      enrolled_at: data.enrolledAt,
      expires_at: data.expiresAt,
      c7_membership_id: data.crmMembershipId, // Column name is c7_membership_id
    })
    .select()
    .single();
  
  if (error || !enrollment) {
    throw new Error(`Failed to create enrollment: ${error?.message}`);
  }
  
  // Update customer flags if enrollment is active
  if (data.status === 'active') {
    await supabase
      .from('customers')
      .update({ 
        is_club_member: true,
        current_club_stage_id: data.clubStageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.customerId);
  }
  
  return enrollment;
}

export async function getActiveEnrollment(customerId: string, clubStageId: string) {
  const supabase = getSupabaseClient();
  
  const { data: enrollment, error } = await supabase
    .from('club_enrollments')
    .select('*')
    .eq('customer_id', customerId)
    .eq('club_stage_id', clubStageId)
    .eq('status', 'active')
    .maybeSingle();
  
  if (error) return null;
  
  return enrollment;
}

/**
 * Get the current active enrollment for a customer (any tier)
 */
export async function getCurrentActiveEnrollment(customerId: string) {
  const supabase = getSupabaseClient();
  
  const { data: enrollment, error } = await supabase
    .from('club_enrollments')
    .select(`
      *,
      club_stages!inner (
        id,
        name,
        stage_order,
        min_purchase_amount,
        min_ltv_amount,
        c7_club_id,
        club_program_id
      )
    `)
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) return null;
  
  return enrollment;
}

/**
 * Get the next tier in progression (higher stage_order) for a client's club program
 */
export async function getNextTier(clientId: string, currentStageOrder: number) {
  const supabase = getSupabaseClient();
  
  const { data: nextStage, error } = await supabase
    .from('club_stages')
    .select(`
      *,
      club_programs!inner (
        id,
        client_id
      )
    `)
    .eq('club_programs.client_id', clientId)
    .gt('stage_order', currentStageOrder)
    .eq('is_active', true)
    .order('stage_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (error) return null;
  
  return nextStage;
}

export async function getEnrollmentsByStage(clubStageId: string) {
  const supabase = getSupabaseClient();
  
  const { data: enrollments } = await supabase
    .from('club_enrollments')
    .select(`
      *,
      customers (
        id,
        email,
        first_name,
        last_name,
        phone,
        crm_id
      )
    `)
    .eq('club_stage_id', clubStageId)
    .order('enrolled_at', { ascending: false });
  
  return enrollments || [];
}

export async function getEnrollmentsByClientId(
  clientId: string,
  options?: {
    search?: string;
    tierFilter?: string;
    statusFilter?: string;
  }
) {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('club_enrollments')
    .select(`
      *,
      customers!inner (
        id,
        email,
        first_name,
        last_name,
        phone,
        crm_id,
        client_id
      ),
      club_stages (
        id,
        name,
        duration_months,
        min_purchase_amount
      )
    `)
    .eq('customers.client_id', clientId);
  
  // Apply search filter if provided
  if (options?.search) {
    const searchTerm = `%${options.search}%`;
    query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`, {
      referencedTable: 'customers'
    });
  }
  
  // Apply tier filter if provided
  if (options?.tierFilter) {
    query = query.eq('club_stage_id', options.tierFilter);
  }
  
  // Apply status filter if provided (default to 'active' only)
  if (options?.statusFilter && options.statusFilter !== 'all') {
    query = query.eq('status', options.statusFilter);
  } else if (!options?.statusFilter) {
    // Default: show only active enrollments
    query = query.eq('status', 'active');
  }
  // If statusFilter === 'all', don't add any status filter
  
  const { data: enrollments } = await query.order('enrolled_at', { ascending: false });
  
  return enrollments || [];
}

/**
 * Get customers with their most recent enrollment data (customer-centric view)
 * Shows loyalty points, cumulative days, and current/last tier information
 * This is the preferred method for displaying member lists as it groups by customer
 */
export async function getCustomersWithEnrollmentSummary(
  clientId: string,
  options?: {
    search?: string;
    tierFilter?: string;
    statusFilter?: string;
  }
) {
  const supabase = getSupabaseClient();
  
  let query = supabase
    // Note: customer_enrollment_summary is a database view, not in Supabase types
    .from('customer_enrollment_summary' as any)
    .select('*')
    .eq('client_id', clientId);
  
  // Apply search filter
  if (options?.search) {
    const searchTerm = `%${options.search}%`;
    query = query.or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
  }
  
  // Apply tier filter
  if (options?.tierFilter) {
    query = query.eq('club_stage_id', options.tierFilter);
  }
  
  // Apply status filter (default to 'active' only)
  if (options?.statusFilter === 'all') {
    // Show all customers, regardless of enrollment status
    // Don't add any status filter
  } else if (options?.statusFilter) {
    // Show customers with specific enrollment status
    query = query.eq('enrollment_status', options.statusFilter);
  } else {
    // Default: only show customers with active enrollments
    query = query.eq('enrollment_status', 'active');
  }
  
  const { data: customers } = await query.order('customer_created_at', { ascending: false });
  
  return customers || [];
}

export async function getEnrollmentById(enrollmentId: string) {
  const supabase = getSupabaseClient();
  
  const { data: enrollment, error } = await supabase
    .from('club_enrollments')
    .select(`
      *,
      customers!inner (
        id,
        email,
        first_name,
        last_name,
        phone,
        crm_id,
        client_id
      ),
      club_stages!inner (
        id,
        name,
        stage_order,
        duration_months,
        min_purchase_amount,
        min_ltv_amount,
        c7_club_id
      )
    `)
    .eq('id', enrollmentId)
    .single();
  
  if (error) {
    throw new Error(`Failed to fetch enrollment: ${error.message}`);
  }
  
  return enrollment;
}

export async function cancelEnrollment(enrollmentId: string) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('club_enrollments')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', enrollmentId);
  
  if (error) {
    throw new Error(`Failed to cancel enrollment: ${error.message}`);
  }
}

export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: 'active' | 'expired' | 'cancelled'
) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('club_enrollments')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', enrollmentId);
  
  if (error) {
    throw new Error(`Failed to update enrollment status: ${error.message}`);
  }
}

// ============================================
// CRM SYNC QUEUE OPERATIONS
// ============================================

/**
 * Queue a CRM sync operation for retry
 * Used when direct CRM sync fails or needs to be deferred
 */
export async function queueCrmSync(data: {
  clientId: string;
  enrollmentId?: string | null;
  actionType: 'add_membership' | 'cancel_membership' | 'upgrade_membership';
  stageId: string;
  oldStageId?: string | null;
  customerCrmId: string;
}) {
  const supabase = getSupabaseClient();
  
  const { data: queueItem, error } = await supabase
    .from('crm_sync_queue')
    .insert({
      client_id: data.clientId,
      enrollment_id: data.enrollmentId || null,
      action_type: data.actionType,
      stage_id: data.stageId,
      old_stage_id: data.oldStageId || null,
      customer_crm_id: data.customerCrmId,
      status: 'pending',
      attempts: 0,
      max_attempts: 5,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Failed to queue CRM sync:', error);
    throw new Error(`Failed to queue CRM sync: ${error.message}`);
  }
  
  return queueItem;
}

// ============================================
// ENROLLMENT DRAFT OPERATIONS
// ============================================

export interface EnrollmentDraft {
  customer?: {
    id?: string;              // LV customer ID if exists
    crmId: string;           // C7 customer ID
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    birthdate?: string;      // ISO date string (YYYY-MM-DD) - Required for wine sales
    ltv?: number;            // Customer's lifetime value
    isExisting: boolean;     // Whether customer already exists
    billingAddressId?: string;   // C7 billing address ID
    shippingAddressId?: string;  // C7 shipping address ID (defaults to billing)
    paymentMethodId?: string;    // C7 credit card ID
  };
  tier?: {
    id: string;
    name: string;
    qualified: boolean;
    purchaseAmount: number;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  address?: {
    billing: {
      address1: string;
      address2?: string;
      city: string;
      state: string;
      zip: string;
      country?: string;
    };
    shipping?: {
      address1: string;
      address2?: string;
      city: string;
      state: string;
      zip: string;
      country?: string;
    };
  };
  payment?: {
    last4: string;
    brand?: string;
    expiryMonth?: string;
    expiryYear?: string;
  };
  preferences?: CommunicationPreferences;
  addressVerified: boolean;
  paymentVerified: boolean;
}

export async function getEnrollmentDraft(sessionId: string): Promise<EnrollmentDraft | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('enrollment_drafts')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle(); // Use maybeSingle() instead of single() to handle 0 rows
  
  if (error || !data) return null;
  
  const draftData = data.customer_data as any;
  
  return {
    customer: draftData?.customer,
    tier: data.tier_data as any,
    address: draftData?.address,
    payment: draftData?.payment,
    preferences: normalizeCommunicationPreferences(draftData?.preferences),
    addressVerified: data.address_verified || false,
    paymentVerified: data.payment_verified || false,
  };
}

export async function updateEnrollmentDraft(
  sessionId: string,
  draft: Partial<EnrollmentDraft>
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const existing = await getEnrollmentDraft(sessionId);

  const mergedPreferences = normalizeCommunicationPreferences({
    ...(existing?.preferences ?? {}),
    ...(draft.preferences ?? {}),
  });

  const mergedCustomer = draft.customer
    ? { ...(existing?.customer ?? {}), ...draft.customer }
    : existing?.customer;

  const mergedTier = draft.tier ?? existing?.tier;
  const mergedAddress = draft.address ?? existing?.address;
  const mergedPayment = draft.payment ?? existing?.payment;

  const merged: EnrollmentDraft = {
    customer: mergedCustomer,
    tier: mergedTier,
    address: mergedAddress,
    payment: mergedPayment,
    preferences: mergedPreferences,
    addressVerified: draft.addressVerified ?? existing?.addressVerified ?? false,
    paymentVerified: draft.paymentVerified ?? existing?.paymentVerified ?? false,
  };
  
  const customerData = {
    customer: merged.customer || null,
    address: merged.address || null,
    payment: merged.payment || null,
    preferences: merged.preferences,
  };
  
  const { error } = await supabase
    .from('enrollment_drafts')
    .upsert({
      session_id: sessionId,
      customer_data: customerData,
      tier_data: merged.tier || null,
      address_verified: merged.addressVerified || false,
      payment_verified: merged.paymentVerified || false,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'session_id'
    });
  
  if (error) {
    throw new Error(`Failed to update enrollment draft: ${error.message}`);
  }
}

export async function clearEnrollmentDraft(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  await supabase
    .from('enrollment_drafts')
    .delete()
    .eq('session_id', sessionId);
}

// ============================================
// COMMUNICATION CONFIG OPERATIONS
// ============================================

export async function getCommunicationConfig(clientId: string): Promise<CommunicationConfig | null> {
  const supabase = getSupabaseClient();
  
  const { data: config, error } = await supabase
    .from('communication_configs')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  
  if (error) return null;
  
  return config;
}

export async function createCommunicationConfig(
  clientId: string,
  config: {
    emailProvider: string;
    emailApiKey?: string;
    emailFromAddress?: string;
    emailFromName?: string;
    emailListId?: string;
    smsProvider?: string;
    smsApiKey?: string;
    smsFromNumber?: string;
    sendMonthlyStatus?: boolean;
    sendExpirationWarnings?: boolean;
    warningDaysBefore?: number;
    providerData?: CommunicationConfigInsert['provider_data'];
  }
): Promise<CommunicationConfig> {
  const supabase = getSupabaseClient();
  
  const { data: commConfig, error } = await supabase
    .from('communication_configs')
    .insert({
      client_id: clientId,
      email_provider: config.emailProvider,
      email_api_key: config.emailApiKey || null,
      email_from_address: config.emailFromAddress || null,
      email_from_name: config.emailFromName || null,
      email_list_id: config.emailListId || null,
      sms_provider: config.smsProvider || null,
      sms_api_key: config.smsApiKey || null,
      sms_from_number: config.smsFromNumber || null,
      send_monthly_status: config.sendMonthlyStatus !== undefined ? config.sendMonthlyStatus : true,
      send_expiration_warnings: config.sendExpirationWarnings !== undefined ? config.sendExpirationWarnings : true,
      warning_days_before: config.warningDaysBefore || 7,
      provider_data: config.providerData ?? ({} as Database['public']['Tables']['communication_configs']['Insert']['provider_data']),
    })
    .select()
    .single();
  
  if (error || !commConfig) {
    throw new Error(`Failed to create communication config: ${error?.message}`);
  }
  
  return commConfig;
}

export async function updateCommunicationConfig(
  clientId: string,
  config: {
    emailProvider?: string;
    emailApiKey?: string | null;
    emailFromAddress?: string | null;
    emailFromName?: string | null;
    emailListId?: string | null;
    smsProvider?: string | null;
    smsApiKey?: string | null;
    smsFromNumber?: string | null;
    sendMonthlyStatus?: boolean;
    sendExpirationWarnings?: boolean;
    warningDaysBefore?: number;
    providerData?: CommunicationConfigInsert['provider_data'] | null;
    emailProviderConfirmed?: boolean;
    smsProviderConfirmed?: boolean;
  }
): Promise<CommunicationConfig> {
  const supabase = getSupabaseClient();
  
  const updateData: any = {
    updated_at: new Date().toISOString()
  };
  
  if (config.emailProvider !== undefined) updateData.email_provider = config.emailProvider;
  if (config.emailApiKey !== undefined) updateData.email_api_key = config.emailApiKey;
  if (config.emailFromAddress !== undefined) updateData.email_from_address = config.emailFromAddress;
  if (config.emailFromName !== undefined) updateData.email_from_name = config.emailFromName;
  if (config.emailListId !== undefined) updateData.email_list_id = config.emailListId;
  if (config.smsProvider !== undefined) updateData.sms_provider = config.smsProvider;
  if (config.smsApiKey !== undefined) updateData.sms_api_key = config.smsApiKey;
  if (config.smsFromNumber !== undefined) updateData.sms_from_number = config.smsFromNumber;
  if (config.sendMonthlyStatus !== undefined) updateData.send_monthly_status = config.sendMonthlyStatus;
  if (config.sendExpirationWarnings !== undefined) updateData.send_expiration_warnings = config.sendExpirationWarnings;
  if (config.warningDaysBefore !== undefined) updateData.warning_days_before = config.warningDaysBefore;
  if (config.providerData !== undefined) updateData.provider_data = config.providerData;
  if (config.emailProviderConfirmed !== undefined) updateData.email_provider_confirmed = config.emailProviderConfirmed;
  if (config.smsProviderConfirmed !== undefined) updateData.sms_provider_confirmed = config.smsProviderConfirmed;
  
  const { data: commConfig, error } = await supabase
    .from('communication_configs')
    .update(updateData)
    .eq('client_id', clientId)
    .select()
    .single();
  
  if (error || !commConfig) {
    throw new Error(`Failed to update communication config: ${error?.message}`);
  }
  
  return commConfig;
}

// ============================================
// COMMUNICATION TEMPLATE OPERATIONS
// ============================================

type CommunicationTemplate = Database['public']['Tables']['communication_templates']['Row'];
type CommunicationTemplateInsert = Database['public']['Tables']['communication_templates']['Insert'];

/**
 * Get a communication template for a client
 */
export async function getCommunicationTemplate(
  clientId: string,
  templateType: string,
  channel: 'email' | 'sms' = 'email'
): Promise<CommunicationTemplate | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('communication_templates')
    .select('*')
    .eq('client_id', clientId)
    .eq('template_type', templateType)
    .eq('channel', channel)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching communication template:', error);
    return null;
  }
  
  return data;
}

/**
 * Upsert a communication template (create or update)
 */
export async function upsertCommunicationTemplate(
  clientId: string,
  templateType: string,
  channel: 'email' | 'sms',
  templateData: {
    subject?: string | null;
    htmlBody?: string | null;
    textBody?: string | null;
    customContent?: string | null;
    providerTemplateId?: string | null;
    availableVariables?: Record<string, unknown> | null;
    isActive?: boolean;
  }
): Promise<CommunicationTemplate> {
  const supabase = getSupabaseClient();
  
  const insertData: CommunicationTemplateInsert = {
    client_id: clientId,
    template_type: templateType,
    channel,
    subject: templateData.subject ?? null,
    html_body: templateData.htmlBody ?? null,
    text_body: templateData.textBody ?? null,
    custom_content: templateData.customContent ?? null,
    provider_template_id: templateData.providerTemplateId ?? null,
    available_variables: (templateData.availableVariables ?? null) as Database['public']['Tables']['communication_templates']['Insert']['available_variables'],
    is_active: templateData.isActive ?? true,
    updated_at: new Date().toISOString(),
  };
  
  const { data, error } = await supabase
    .from('communication_templates')
    .upsert(insertData, {
      onConflict: 'client_id,template_type,channel',
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new Error(`Failed to upsert communication template: ${error?.message}`);
  }
  
  return data;
}

/**
 * Initialize default SendGrid templates from base files for a client
 * This should be called when a client first sets up SendGrid
 */
export async function initializeSendGridTemplates(clientId: string): Promise<void> {
  const { loadBaseTemplate } = await import('~/lib/communication/templates.server');
  
  const templateTypes: Array<{ fileType: string; dbType: string }> = [
    { fileType: 'monthly-status', dbType: 'monthly_status' },
    { fileType: 'expiration-warning', dbType: 'expiration_warning' },
    { fileType: 'expiration', dbType: 'expiration' },
    { fileType: 'upgrade', dbType: 'upgrade_available' },
  ];
  
  for (const { fileType, dbType } of templateTypes) {
    try {
      const baseTemplate = loadBaseTemplate(fileType as any);
      
      await upsertCommunicationTemplate(clientId, dbType, 'email', {
        htmlBody: baseTemplate,
        isActive: true,
      });
    } catch (error) {
      console.error(`Failed to initialize template ${dbType} for client ${clientId}:`, error);
      // Continue with other templates even if one fails
    }
  }
}

