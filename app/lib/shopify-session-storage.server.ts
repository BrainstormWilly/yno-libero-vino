/**
 * Shopify Session Storage Adapter
 * 
 * Implements Shopify's SessionStorage interface using our unified session storage
 * This allows Shopify SDK to use our Supabase session storage
 */

import { Session, type SessionParams } from '@shopify/shopify-api';
import { 
  storeSession as dbStoreSession,
  loadSession as dbLoadSession,
  deleteSession as dbDeleteSession,
  findSessionsByShop,
  deleteSessionsByClient,
  isReady,
  type AppSessionData,
} from './session-storage.server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Convert Shopify Session to our AppSessionData format
 */
function shopifySessionToAppSession(session: Session, clientId: string): AppSessionData {
  return {
    id: session.id,
    clientId,
    tenantShop: session.shop,
    crmType: 'shopify',
    accessToken: session.accessToken,
    scope: session.scope,
    expiresAt: session.expires || undefined,
    // Shopify sessions don't have user info in the session itself
    userName: undefined,
    userEmail: undefined,
    theme: 'light',
  };
}

/**
 * Convert our AppSessionData to Shopify Session
 */
function appSessionToShopifySession(appSession: AppSessionData): Session {
  const sessionParams: SessionParams = {
    id: appSession.id,
    shop: appSession.tenantShop,
    state: '', // Shopify expects this but we don't use it
    isOnline: true, // LiberoVino uses online sessions
    scope: appSession.scope,
    expires: appSession.expiresAt,
    accessToken: appSession.accessToken || '',
  };

  return new Session(sessionParams);
}

/**
 * Get client ID from shop domain
 */
async function getClientIdFromShop(shop: string): Promise<string | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('tenant_shop', shop)
    .eq('crm_type', 'shopify')
    .single();

  return client?.id || null;
}

/**
 * Store a Shopify session
 * Implements Shopify's SessionStorage.storeSession
 */
export async function storeSession(session: Session): Promise<boolean> {
  console.log('📦 STORE SHOPIFY SESSION:', session.shop);
  
  // Get or create client for this shop
  let clientId = await getClientIdFromShop(session.shop);
  
  if (!clientId) {
    // Auto-create client on first session store
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: newClient, error } = await supabase
      .from('clients')
      .insert({
        tenant_shop: session.shop,
        crm_type: 'shopify',
        org_name: session.shop, // Default, will be updated later
      })
      .select('id')
      .single();
    
    if (error || !newClient) {
      console.error('Failed to create client for shop:', session.shop, error);
      return false;
    }
    
    clientId = newClient.id;
  }

  if (!clientId) {
    throw new Error('Client ID is required but not found');
  }
  const appSession = shopifySessionToAppSession(session, clientId as string);
  return await dbStoreSession(appSession);
}

/**
 * Load a Shopify session by ID
 * Implements Shopify's SessionStorage.loadSession
 */
export async function loadSession(id: string): Promise<Session | undefined> {
  const appSession = await dbLoadSession(id);
  
  if (!appSession || appSession.crmType !== 'shopify') {
    return undefined;
  }

  return appSessionToShopifySession(appSession);
}

/**
 * Delete a Shopify session by ID
 * Implements Shopify's SessionStorage.deleteSession
 */
export async function deleteSession(id: string): Promise<boolean> {
  return await dbDeleteSession(id);
}

/**
 * Delete all sessions for a shop
 * Implements Shopify's SessionStorage.deleteSessions
 */
export async function deleteSessions(ids: string[]): Promise<boolean> {
  const promises = ids.map(id => dbDeleteSession(id));
  const results = await Promise.all(promises);
  return results.every(r => r === true);
}

/**
 * Find all sessions for a shop
 * Implements Shopify's SessionStorage.findSessionsByShop
 */
export async function findSessionsByShopDomain(shop: string): Promise<Session[]> {
  const appSessions = await findSessionsByShop(shop);
  
  return appSessions
    .filter(s => s.crmType === 'shopify')
    .map(s => appSessionToShopifySession(s));
}

/**
 * Export object that matches Shopify's SessionStorage interface
 */
export default {
  storeSession,
  loadSession,
  deleteSession,
  deleteSessions,
  findSessionsByShop: findSessionsByShopDomain,
  isReady,
};

