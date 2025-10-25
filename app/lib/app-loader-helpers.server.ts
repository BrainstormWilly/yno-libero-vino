import { redirect } from 'react-router';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import { createAppSession, getAppSession, redirectWithSession } from '~/lib/sessions.server';
import { getClient, getClientbyCrmIdentifier, upsertFakeClient } from '~/lib/supabase.server';
import type { Tables } from '~/types/supabase';
import type { CrmTypes } from '~/types/crm';

interface LoaderResult {
  client: Tables<'clients'>;
  session: any;
  isDev: boolean;
}

/**
 * DEV MODE: Handles unembedded local testing (Commerce7 only)
 * Creates/retrieves a fake client and session for development
 */
export async function handleDevMode(request: Request, url: URL): Promise<LoaderResult> {
  console.log('🔓 DEV MODE: Upsert fake C7 client and session');
  
  // Upsert fake C7 client (Yno Fanbase equivalent)
  const fakeClient = await upsertFakeClient('commerce7');
  if (!fakeClient) {
    throw new Error('Failed to create fake C7 client in dev mode');
  }
  
  // Check if we already have a session in the URL
  let session = await getAppSession(request, 'commerce7');
  
  if (!session) {
    // No session yet - create a real one and redirect with session ID
    console.log('🔐 DEV MODE: Creating real session in database');
    const sessionId = await createAppSession({
      clientId: fakeClient.id,
      tenantShop: fakeClient.tenant_shop,
      crmType: 'commerce7',
      userName: 'William Langley (Dev)',
      userEmail: 'will@ynosoftware.com',
      theme: 'light',
    });
    
    console.log('✅ DEV MODE: Real session created:', sessionId);
    
    // Redirect with session ID in URL
    throw redirectWithSession(url.pathname, sessionId);
  }
  
  console.log('✅ DEV MODE: Using existing session:', session.id);
  console.log('   Client:', fakeClient.org_name);

  // Check if setup is incomplete and we're NOT already on the setup route
  if (!fakeClient.setup_complete && !url.pathname.includes('/app/setup')) {
    throw redirectWithSession('/app/setup', session.id);
  }

  return { 
    client: fakeClient,
    session: session,
    isDev: true 
  };
}

/**
 * CASE 1: New authorization request (embedded app launching with account token)
 * Handles Commerce7 or Shopify authorization and creates a new session
 */
export async function handleNewAuthorization(
  request: Request,
  url: URL,
  identifier: string,
  account: string,
  crmType: CrmTypes
): Promise<never> {
  console.log(`🔐 New authorization request for ${crmType}: ${identifier}`);
  
  if (crmType === 'commerce7') {
    const c7Provider = new Commerce7Provider(identifier);
    const authResult = await c7Provider.authorizeUse(request);
    
    if (!authResult) {
      throw new Error('Commerce7 authorization failed. Invalid account token.');
    }
    
    console.log(`✅ Commerce7 user authorized: ${authResult.user.email} for tenant ${authResult.tenantId}`);
    
    // Look up the client
    const client = await getClientbyCrmIdentifier('commerce7', identifier);
    if (!client) {
      throw new Error(`Client not found for tenant: ${identifier}`);
    }
    
    // Create new session and redirect with session in URL
    const sessionId = await createAppSession({
      clientId: client.id,
      tenantShop: identifier,
      crmType: 'commerce7',
      userName: authResult.user.firstName || authResult.user.email,
      userEmail: authResult.user.email,
      theme: url.searchParams.get('adminUITheme') === 'dark' ? 'dark' : 'light',
      accountToken: account,
    });
    
    // Redirect to /app with session ID in URL (removes account token)
    throw redirectWithSession('/app', sessionId);
  } else {
    // TODO: Handle Shopify authorization
    throw new Error('Shopify authorization not yet implemented');
  }
}

/**
 * CASE 2: Existing session (user navigating within app)
 * Retrieves session and client from database
 */
export async function handleExistingSession(request: Request, url: URL): Promise<{
  client: Tables<'clients'>;
  session: any;
}> {
  const session = await getAppSession(request);
  if (!session) {
    // No session and no auth parameters - redirect to homepage
    console.log('⛔ No session found - redirecting to homepage');
    console.log('   URL:', url.href);
    console.log('   Session param:', url.searchParams.get('session'));
    throw redirect('/');
  }
  
  console.log('✅ Session found:', session.id);
  
  // Get client from session
  const client = await getClient(session.clientId);
  if (!client) {
    // Client not found - session is invalid, redirect to homepage
    console.log('⛔ Client not found - redirecting to homepage');
    throw redirect('/');
  }

  return { client, session };
}

/**
 * Checks if setup is incomplete and redirects to setup page
 * Returns true if redirect was thrown, false otherwise
 */
export function checkSetupRedirect(
  client: Tables<'clients'>,
  url: URL,
  sessionId: string
): void {
  if (!client.setup_complete && !url.pathname.includes('/app/setup')) {
    console.log('🔧 Setup incomplete - redirecting to /app/setup with session');
    throw redirectWithSession('/app/setup', sessionId);
  }
}

/**
 * Checks if we're in dev mode (unembedded local testing)
 */
export function isDevMode(crmType: CrmTypes | null): boolean {
  return (
    process.env.NODE_ENV === 'development' && 
    process.env.EMBEDDED_APP === 'no' && 
    crmType === 'commerce7'
  );
}

