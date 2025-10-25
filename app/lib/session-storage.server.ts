/**
 * Unified Session Storage for Commerce7 and Shopify
 * 
 * Both platforms use DB storage (no cookies due to Shopify iframe restrictions)
 * 
 * Commerce7: Session ID passed via URL (?session=xxx)
 * Shopify: Session token from App Bridge (via Shopify SDK)
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export interface AppSessionData {
  id: string; // Session ID
  clientId: string;
  tenantShop: string; // tenant ID (C7) or shop domain (Shopify)
  crmType: 'commerce7' | 'shopify';
  userName?: string;
  userEmail?: string;
  theme?: 'light' | 'dark';
  
  // Shopify-specific (for OAuth)
  accessToken?: string;
  scope?: string;
  expiresAt?: Date;
  
  // Commerce7-specific
  accountToken?: string; // C7's account token for API calls
}

/**
 * Create/update a session in the database
 */
export async function storeSession(data: AppSessionData): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Default expiration: 8 hours from now
  const expiresAt = data.expiresAt || new Date(Date.now() + 8 * 60 * 60 * 1000);
  
  const sessionData = {
    id: data.id,
    client_id: data.clientId,
    user_name: data.userName,
    user_email: data.userEmail,
    theme: data.theme || 'light',
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
    
    // Store CRM-specific data in metadata
    metadata: {
      tenantShop: data.tenantShop,
      crmType: data.crmType,
      accessToken: data.accessToken,
      scope: data.scope,
      accountToken: data.accountToken,
    },
  };

  console.log('💾 Storing session:', data.id);

  const { error } = await supabase
    .from('app_sessions')
    .upsert(sessionData, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    });

  if (error) {
    console.error('❌ Failed to store session:', error);
    return false;
  }

  console.log('✅ Session stored successfully:', data.id);
  return true;
}

/**
 * Load a session from the database
 */
export async function loadSession(id: string): Promise<AppSessionData | null> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('📥 Loading session:', id);
  
  const { data, error } = await supabase
    .from('app_sessions')
    .select(`
      id,
      client_id,
      user_name,
      user_email,
      theme,
      expires_at,
      metadata,
      clients!inner (
        tenant_shop,
        crm_type
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    console.log('❌ Failed to load session:', error?.message || 'No data');
    return null;
  }
  
  console.log('✅ Session loaded successfully:', data.id);

  // Check if expired
  if (new Date(data.expires_at) < new Date()) {
    await deleteSession(id);
    return null;
  }

  // Update last activity
  await supabase
    .from('app_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', id);

  const client = Array.isArray(data.clients) ? data.clients[0] : data.clients;
  const metadata = data.metadata as any || {};

  return {
    id: data.id,
    clientId: data.client_id,
    tenantShop: metadata.tenantShop || client.tenant_shop,
    crmType: metadata.crmType || client.crm_type,
    userName: data.user_name || undefined,
    userEmail: data.user_email || undefined,
    theme: data.theme as 'light' | 'dark' || undefined,
    accessToken: metadata.accessToken,
    scope: metadata.scope,
    accountToken: metadata.accountToken,
    expiresAt: new Date(data.expires_at),
  };
}

/**
 * Delete a single session
 */
export async function deleteSession(id: string): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { error } = await supabase
    .from('app_sessions')
    .delete()
    .eq('id', id);

  return !error;
}

/**
 * Delete all sessions for a client
 */
export async function deleteSessionsByClient(clientId: string): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { error } = await supabase
    .from('app_sessions')
    .delete()
    .eq('client_id', clientId);

  return !error;
}

/**
 * Find sessions by shop/tenant (for Shopify compatibility)
 */
export async function findSessionsByShop(tenantShop: string): Promise<AppSessionData[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // First get client by tenant_shop
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('tenant_shop', tenantShop)
    .single();

  if (!client) {
    return [];
  }

  const { data: sessions } = await supabase
    .from('app_sessions')
    .select(`
      id,
      client_id,
      user_name,
      user_email,
      theme,
      expires_at,
      metadata,
      clients!inner (
        tenant_shop,
        crm_type
      )
    `)
    .eq('client_id', client.id);

  if (!sessions) {
    return [];
  }

  return sessions
    .filter(session => new Date(session.expires_at) > new Date()) // Only active sessions
    .map(session => {
      const clientData = Array.isArray(session.clients) ? session.clients[0] : session.clients;
      const metadata = session.metadata as any || {};
      
      return {
        id: session.id,
        clientId: session.client_id,
        tenantShop: metadata.tenantShop || clientData.tenant_shop,
        crmType: metadata.crmType || clientData.crm_type,
        userName: session.user_name || undefined,
        userEmail: session.user_email || undefined,
        theme: session.theme as 'light' | 'dark' || undefined,
        accessToken: metadata.accessToken,
        scope: metadata.scope,
        accountToken: metadata.accountToken,
        expiresAt: new Date(session.expires_at),
      };
    });
}

/**
 * Create a new session ID
 */
export function createSessionId(crmType: 'commerce7' | 'shopify', identifier: string): string {
  // Format: {crm}_{identifier}_{random}
  // This makes sessions easily identifiable and debuggable
  const random = crypto.randomBytes(16).toString('hex');
  return `${crmType}_${identifier}_${random}`;
}

/**
 * Extract session ID from request (URL parameter or App Bridge)
 */
export function getSessionIdFromRequest(request: Request, crmType: 'commerce7' | 'shopify'): string | null {
  const url = new URL(request.url);
  
  if (crmType === 'commerce7') {
    // C7: Look for ?session=xxx in URL
    return url.searchParams.get('session');
  }
  
  if (crmType === 'shopify') {
    // Shopify: App Bridge passes session token in different ways
    // Could be in URL params or headers depending on context
    const sessionParam = url.searchParams.get('session');
    if (sessionParam) return sessionParam;
    
    // Check for Shopify's session token in headers
    const sessionToken = request.headers.get('authorization')?.replace('Bearer ', '');
    if (sessionToken) return sessionToken;
  }
  
  return null;
}

/**
 * Build URL with session parameter
 */
export function addSessionToUrl(url: string, sessionId: string): string {
  const urlObj = new URL(url, 'http://localhost'); // Base doesn't matter, we're just manipulating params
  urlObj.searchParams.set('session', sessionId);
  
  // Return just the path + params if it was a relative URL
  if (!url.startsWith('http')) {
    return `${urlObj.pathname}${urlObj.search}`;
  }
  
  return urlObj.toString();
}

/**
 * Check if session storage is ready
 */
export function isReady(): boolean {
  return !!(supabaseUrl && supabaseServiceKey);
}

/**
 * Clean up expired sessions (call from cron)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data, error } = await supabase
    .from('app_sessions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select();
  
  if (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
  
  return data?.length || 0;
}

