import { createClient } from '@supabase/supabase-js';

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

export const getCrmSession = async (id: string) => {
  const { data, error } = await supabase
    .from('crm_sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
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

export const deleteCrmSession = async (id: string) => {
  const { error } = await supabase
    .from('crm_sessions')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};
