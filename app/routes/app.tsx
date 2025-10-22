import { type LoaderFunctionArgs, redirect } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { 
  Page, 
  Layout,
  Banner,
  Text,
  InlineStack,
  Button
} from '@shopify/polaris';
import { getSubdomainInfo } from '~/util/subdomain';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import { getAppSession, createAppSession, redirectWithSession, getFakeAppSession } from '~/lib/sessions.server';
import { getClient, getClientbyCrmIdentifier, upsertFakeClient } from '~/lib/supabase.server';
import type { Tables } from '~/types/supabase';
import type { CrmTypes } from '~/types/crm';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const subdomainInfo = getSubdomainInfo(request);
  const { crmType } = subdomainInfo;
  
  // Get potential authorization parameters
  const tenantId = url.searchParams.get('tenantId');
  const shop = url.searchParams.get('shop');
  const identifier = tenantId || shop;
  const account = url.searchParams.get('account');
  
  // DEV MODE: Unembedded local testing (Commerce7 only - Shopify doesn't need this)
  if (process.env.NODE_ENV === 'development' && process.env.EMBEDDED_APP === 'no' && crmType === 'commerce7') {
    console.log('🔓 DEV MODE: Upsert fake C7 client and create fake session');
    
    // Upsert fake C7 client (Yno Fanbase equivalent)
    const fakeClient = await upsertFakeClient('commerce7');
    if (!fakeClient) {
      throw new Error('Failed to create fake C7 client in dev mode');
    }
    
    // Create fake session
    const fakeSession = getFakeAppSession('commerce7');
    
    // Override with actual client ID
    fakeSession.clientId = fakeClient.id;
    fakeSession.tenantShop = fakeClient.tenant_shop;
    
    console.log('✅ DEV MODE: Using fake client:', fakeClient.org_name);
    
    return { 
      client: fakeClient,
      session: fakeSession,
      isDev: true 
    };
  }

  let client: Tables<'clients'> | null = null;
  let session: any = null;

  // CASE 1: New authorization request (embedded app launching with account token)
  if (account && identifier && crmType) {
    console.log(`🔐 New authorization request for ${crmType}: ${identifier}`);
    
    if (crmType === 'commerce7') {
      const c7Provider = new Commerce7Provider();
      const authResult = await c7Provider.authorizeUse(request);
      
      if (!authResult) {
        throw new Error('Commerce7 authorization failed. Invalid account token.');
      }
      
      console.log(`✅ Commerce7 user authorized: ${authResult.user.email} for tenant ${authResult.tenantId}`);
      
      // Look up the client
      client = await getClientbyCrmIdentifier('commerce7', identifier);
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
      return redirectWithSession('/app', sessionId);
    } else {
      // TODO: Handle Shopify authorization
      throw new Error('Shopify authorization not yet implemented');
    }
  } 
  // CASE 2: Existing session (user navigating within app)
  else {
    session = await getAppSession(request);
    if (!session) {
      // No session and no auth parameters - redirect to homepage
      console.log('⛔ No session found - redirecting to homepage');
      throw redirect('/');
    }
    
    // Get client from session
    client = await getClient(session.clientId);
    if (!client) {
      // Client not found - session is invalid, redirect to homepage
      console.log('⛔ Client not found - redirecting to homepage');
      throw redirect('/');
    }
  }

  // Parent route only checks auth - child routes handle their own logic
  return {
    client,
    session,
    isDev: false
  };
}

export default function AppLayout() {
  const { client, session } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-100">
      {/* Simple header */}
      <div className="bg-white shadow-sm border-b border-gray-200 mb-6">
        <div className="container mx-auto px-4 py-4">
          <InlineStack align="space-between" blockAlign="center">
            <div>
              <Text variant="headingLg" as="h1">
                {client?.org_name || 'LiberoVino'}
              </Text>
              {session && (
                <Text variant="bodySm" as="p" tone="subdued">
                  {session.userName} ({session.userEmail})
                </Text>
              )}
            </div>
            <InlineStack gap="200">
              <Button url="/app">Dashboard</Button>
              <Button url="/app/settings">Settings</Button>
              <Button url="/logout">Logout</Button>
            </InlineStack>
          </InlineStack>
        </div>
      </div>

      {/* Nested routes render here */}
      <Outlet />
    </div>
  );
}
