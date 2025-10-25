import { createClient } from '@supabase/supabase-js';
import { redirect } from 'react-router';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Consider a client "new" if created within the last 5 minutes
const NEW_CLIENT_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Checks if this is a first visit (client created recently)
 */
export function isFirstVisit(createdAt: string): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  return (now.getTime() - created.getTime()) < NEW_CLIENT_THRESHOLD_MS;
}

/**
 * Gets client data and checks if setup is complete
 * Redirects to setup if incomplete
 */
export async function getClientAndCheckSetup(clientId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  if (!client) {
    throw new Error('Client not found');
  }
  
  // Check if setup is complete - redirect to setup if not
  if (!client.setup_complete) {
    console.log('⚙️  Setup incomplete - redirecting to /app/setup');
    throw redirect('/app/setup');
  }
  
  return client;
}

/**
 * Gets client data for dev mode (without setup check)
 */
export async function getDevModeClient(clientId: string) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();
  
  if (!client) {
    throw new Error('Dev client not found');
  }
  
  return client;
}

/**
 * Updates organization details in the database
 */
export async function updateOrganization(
  clientId: string,
  orgName: string,
  orgContact: string
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { error } = await supabase
    .from('clients')
    .update({ 
      org_name: orgName,
      org_contact: orgContact,
      updated_at: new Date().toISOString()
    })
    .eq('id', clientId);
  
  if (error) {
    throw new Error(`Failed to update organization details: ${error.message}`);
  }
}

/**
 * Checks if we're in dev mode
 */
export function isDevMode(crmType: string): boolean {
  return (
    process.env.NODE_ENV === 'development' && 
    process.env.EMBEDDED_APP === 'no' && 
    crmType === 'commerce7'
  );
}

