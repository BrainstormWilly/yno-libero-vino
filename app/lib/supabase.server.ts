import { createClient } from '@supabase/supabase-js';
import type { Tables } from '~/types/supabase';
import type { CrmTypes } from '~/types/crm';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Session storage for CRM providers
export interface CrmSession {
  id: string;
  crmType: 'shopify' | 'commerce7';
  shop?: string; // For Shopify
  tenant?: string; // For Commerce7
  accessToken: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export const createCrmSession = async (session: Omit<CrmSession, 'id' | 'createdAt' | 'updatedAt'>) => {
  const { data, error } = await supabase
    .from('crm_sessions')
    .insert({
      ...session,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteCrmSession = async (id: string) => {
  const { error } = await supabase
    .from('crm_sessions')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};

export const getClient = async (id: string) => {
  const clientQ = supabase.from('clients')
    .select('*')
    .eq('id', id)
    .single();

  const { data, error } = await clientQ;
  if (error) throw error;

  return data;
};

export const getC7CustomerbyIdentifier = async (identifier: string) => {
  const customerQ = supabase.from('customers')
    .select('*')
    .eq('crm_type', crmType)
    .eq('identifier', identifier)
    .single();

  const { data, error } = await customerQ;
  if (error) throw error;
  return data;
};

export const getClientbyCrmIdentifier = async (crmType: CrmTypes, identifier: string) => {
  if (crmType === 'commerce7') {
    return await getC7ClientbyIdentifer(identifier);
  }
  
  return await getShopifyClientbyIdentifier(identifier);
};

export const getC7ClientbyIdentifer = async (identifier: string) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_shop', identifier)
    .eq('crm_type', 'commerce7')
    .single();

  if (error) throw error;
  return data;
};

export const getShopifyClientbyIdentifier = async (identifier: string) => {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_shop', identifier)
    .eq('crm_type', 'shopify')
    .single();

  if (error) throw error;
  return data;
};

export const getCrmSession = async (id: string) => {
  const { data, error } = await supabase
    .from('crm_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
};

export const upsertFakeClient = async (crmType: CrmTypes) => {
  if (crmType === 'commerce7') {
    return await upsertFakeC7Client();
  } 
  
  return await upsertFakeShopifyClient();
};

export const upsertFakeShopifyClient = async () => {
  let { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_shop', 'fake-client-shopify')
    .single();
  
  if (!client) {
    const { data: newClient, error } = await supabase
      .from('clients')
      .upsert({
        id: 'yno-fake-shopify-client-id',
        tenant_shop: 'fake-client-shopify',
        crm_type: 'shopify',
        org_name: 'Fake Shopify Client',
        org_contact: 'William Langley',
        user_email: 'will@ynosoftware.com',
      })
      .select()
      .single();
    
    if (error) {
      console.error('Failed to create yno-fanbase client:', error);
    }
    client = newClient;
  }
};

export const upsertFakeC7Client = async () => {
  let { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_shop', 'yno-fanbase')
    .single();
    
  if (!client) {
    const { data: newClient, error } = await supabase
      .from('clients')
      .upsert({
        id: 'yno-fanbase-client-id',
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
    }
    client = newClient;
  }

  return client
};

export const updateCrmSession = async (id: string, updates: Partial<CrmSession>) => {
  const { data, error } = await supabase
    .from('crm_sessions')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};


