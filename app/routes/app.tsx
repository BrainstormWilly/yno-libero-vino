import { type LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData, useSearchParams } from 'react-router';
import { useState, useCallback, useEffect } from 'react';
import { 
  Page, 
  Layout,
  Banner,
  Text,
  InlineStack,
  Button,
  Frame,
  Toast
} from '@shopify/polaris';
import { getSubdomainInfo } from '~/util/subdomain';
import { addSessionToUrl } from '~/util/session';
import { 
  isDevMode,
  handleDevMode,
  handleNewAuthorization,
  handleExistingSession,
  checkSetupRedirect
} from '~/lib/app-loader-helpers.server';

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
  if (isDevMode(crmType)) {
    return await handleDevMode(request, url);
  }

  // CASE 1: New authorization request (embedded app launching with account token)
  if (account && identifier && crmType) {
    return await handleNewAuthorization(request, url, identifier, account, crmType);
  } 
  
  // CASE 2: Existing session (user navigating within app)
  const { client, session } = await handleExistingSession(request, url);

  // Check if setup is incomplete and redirect (but not if already on setup route)
  checkSetupRedirect(client, url, session.id);

  // Parent route only checks auth - child routes handle their own logic
  return {
    client,
    session,
    isDev: false
  };
}

export default function AppLayout() {
  const { client, session } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Toast state
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  
  // Check for toast in URL params on mount and when params change
  useEffect(() => {
    const toast = searchParams.get('toast');
    const toastType = searchParams.get('toastType');
    
    if (toast) {
      setToastMessage(toast);
      setToastError(toastType === 'error');
      setToastActive(true);
      
      // Remove toast params from URL without triggering navigation
      searchParams.delete('toast');
      searchParams.delete('toastType');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  
  const toggleToast = useCallback(() => setToastActive((active) => !active), []);
  
  const toastMarkup = toastActive ? (
    <Toast 
      content={toastMessage} 
      onDismiss={toggleToast}
      error={toastError}
      duration={4500}
    />
  ) : null;

  return (
    <Frame>
      {toastMarkup}
      <div className="embedded-app-wrapper min-h-screen bg-gradient-to-br from-purple-50 to-violet-100">
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
              <Button url={addSessionToUrl('/app', session.id)}>Dashboard</Button>
              <Button url={addSessionToUrl('/app/settings', session.id)}>Settings</Button>
            </InlineStack>
          </InlineStack>
        </div>
      </div>

      {/* Nested routes render here */}
      <div className="container mx-auto px-4 pb-8">
        <Outlet />
      </div>
    </div>
    </Frame>
  );
}
