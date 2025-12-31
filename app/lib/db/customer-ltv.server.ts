/**
 * Customer Lifetime Value (LTV) Management
 * 
 * Functions to maintain and reconcile customer lifetime value for tier qualification
 */

import { getSupabaseClient } from './supabase.server';
import { crmManager } from '../crm/index.server';
import type { CrmProvider } from '~/types/crm';

/**
 * Update customer LTV by adding/subtracting an amount
 * Used when processing order webhooks
 * 
 * @param customerId - Customer UUID
 * @param amount - Amount to add (positive) or subtract (negative)
 */
export async function updateCustomerLTV(
  customerId: string,
  amount: number
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Try to use the database function first (faster, atomic)
  const { error: rpcError } = await supabase.rpc('update_customer_ltv', {
    customer_id: customerId,
    amount_change: amount,
  });
  
  if (rpcError) {
    // Fallback to manual update if RPC doesn't exist yet
    const { data: customer } = await supabase
      .from('customers')
      .select('lifetime_value')
      .eq('id', customerId)
      .single();
    
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }
    
    const newLTV = (customer.lifetime_value || 0) + amount;
    
    const { error: updateError } = await supabase
      .from('customers')
      .update({
        lifetime_value: Math.max(0, newLTV), // Ensure LTV doesn't go negative
        updated_at: new Date().toISOString(),
      })
      .eq('id', customerId);
    
    if (updateError) {
      throw new Error(`Failed to update customer LTV: ${updateError.message}`);
    }
  }
}

/**
 * Initialize customer LTV by fetching from CRM
 * Called when customer enrolls to get their current LTV
 * 
 * @param clientId - Client UUID
 * @param customerId - Customer UUID (LV database ID)
 * @param crmCustomerId - Customer ID in CRM
 * @param crmType - CRM type ('commerce7' | 'shopify')
 * @param tenantShop - Tenant/shop identifier
 * @param accessToken - CRM access token (optional, Commerce7 uses env vars)
 */
export async function initializeCustomerLTV(
  clientId: string,
  customerId: string,
  crmCustomerId: string,
  crmType: string,
  tenantShop: string,
  accessToken: string | undefined
): Promise<number> {
  try {
    const provider = crmManager.getProvider(crmType, tenantShop, accessToken) as CrmProvider;
    
    // Fetch customer with LTV from CRM
    if ('getCustomerWithLTV' in provider && typeof provider.getCustomerWithLTV === 'function') {
      const customer = await provider.getCustomerWithLTV(crmCustomerId);
      const ltv = customer.ltv || 0;
      
      // Update database
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('customers')
        .update({
          lifetime_value: ltv,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);
      
      if (error) {
        console.error(`Failed to initialize LTV for customer ${customerId}:`, error);
        return 0;
      }
      
      return ltv;
    }
    
    // Fallback: return 0 if provider doesn't support LTV
    return 0;
  } catch (error) {
    console.error(`Error initializing LTV for customer ${customerId}:`, error);
    return 0;
  }
}

/**
 * Reconcile customer LTV against CRM
 * Fetches current LTV from CRM and updates database if different
 * 
 * Called inline during monthly status processing to ensure fresh LTV data before sending emails.
 * 
 * @param clientId - Client UUID
 * @param customerId - Customer UUID (LV database ID)
 * @param crmCustomerId - Customer ID in CRM
 * @param crmType - CRM type ('commerce7' | 'shopify')
 * @param tenantShop - Tenant/shop identifier
 * @param accessToken - CRM access token (optional, Commerce7 uses env vars)
 * @returns Object with updated flag and LTV values
 */
export async function reconcileCustomerLTV(
  clientId: string,
  customerId: string,
  crmCustomerId: string,
  crmType: string,
  tenantShop: string,
  accessToken: string | undefined
): Promise<{ updated: boolean; ltvFromCrm: number; ltvInDb: number }> {
  const supabase = getSupabaseClient();
  
  // Get current LTV from database
  const { data: customer } = await supabase
    .from('customers')
    .select('lifetime_value')
    .eq('id', customerId)
    .single();
  
  const ltvInDb = customer?.lifetime_value || 0;
  
  try {
    const provider = crmManager.getProvider(crmType, tenantShop, accessToken) as CrmProvider;
    
    // Fetch customer with LTV from CRM
    if ('getCustomerWithLTV' in provider && typeof provider.getCustomerWithLTV === 'function') {
      const crmCustomer = await provider.getCustomerWithLTV(crmCustomerId);
      const ltvFromCrm = crmCustomer.ltv || 0;
      
      // Update if different (allowing for small floating point differences)
      const difference = Math.abs(ltvFromCrm - ltvInDb);
      if (difference > 0.01) {
        const { error } = await supabase
          .from('customers')
          .update({
            lifetime_value: ltvFromCrm,
            updated_at: new Date().toISOString(),
          })
          .eq('id', customerId);
        
        if (error) {
          console.error(`Failed to reconcile LTV for customer ${customerId}:`, error);
          return { updated: false, ltvFromCrm, ltvInDb };
        }
        
        return { updated: true, ltvFromCrm, ltvInDb };
      }
      
      return { updated: false, ltvFromCrm, ltvInDb };
    }
    
    // Provider doesn't support LTV
    return { updated: false, ltvFromCrm: 0, ltvInDb };
  } catch (error) {
    console.error(`Error reconciling LTV for customer ${customerId}:`, error);
    return { updated: false, ltvFromCrm: 0, ltvInDb };
  }
}
