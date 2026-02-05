import { type LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData, useSearchParams } from 'react-router';
import { useEffect } from 'react';
import { 
  Banner,
  BlockStack,
  Text,
} from '@shopify/polaris';
import { Toaster, toast } from 'sonner';
import { getSubdomainInfo } from '~/util/subdomain';
import { 
  isDevMode,
  handleDevMode,
  handleNewAuthorization,
  handleExistingSession,
  checkSetupRedirect
} from '~/lib/app-loader-helpers.server';
import { recalculateAndUpdateSetupComplete } from '~/lib/db/supabase.server';
import { calculateSetupProgress } from '~/lib/setup-progress.server';
import { scrollToTop } from '~/util/iframe-helper';
import SetupWizard from '~/components/SetupWizard';

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
    const devResult = await handleDevMode(request, url);
    
    // Add setup progress for dev mode too
    let setupProgress = null;
    if (!devResult.client.setup_complete) {
      const progressData = await calculateSetupProgress(devResult.client.id);
      await recalculateAndUpdateSetupComplete(devResult.client.id);
      
      setupProgress = {
        progress: progressData.progress,
        progressData: {
          hasClubProgram: progressData.hasClubProgram,
          hasTier: progressData.hasTier,
          hasPromo: progressData.hasPromo,
          hasCommConfig: progressData.hasCommConfig,
        },
      };
    }
    
    return {
      ...devResult,
      setupProgress: setupProgress as { progress: number; progressData: { hasClubProgram: boolean; hasTier: boolean; hasPromo: boolean; hasCommConfig: boolean } } | null,
      currentRoute: url.pathname,
    };
  }

  // CASE 1: New authorization request (embedded app launching with account token)
  if (account && identifier && crmType) {
    return await handleNewAuthorization(request, url, identifier, account, crmType);
  } 
  
  // CASE 2: Existing session (user navigating within app)
  const { client, session } = await handleExistingSession(request, url);

  // Check if setup is incomplete and redirect (but not if already on setup route)
  checkSetupRedirect(client, url, session.id);

  // Calculate setup progress based on data (not routes)
  let setupProgress = null;
  if (!client.setup_complete) {
    const progressData = await calculateSetupProgress(client.id);
    
    // Recalculate and update setup_complete flag based on progress
    await recalculateAndUpdateSetupComplete(client.id);
    
    setupProgress = {
      progress: progressData.progress,
      progressData: {
        hasClubProgram: progressData.hasClubProgram,
        hasTier: progressData.hasTier,
        hasPromo: progressData.hasPromo,
        hasCommConfig: progressData.hasCommConfig,
      },
    };
  }

  // Parent route only checks auth - child routes handle their own logic
  return {
    client,
    session,
    isDev: false,
    setupProgress: setupProgress as { progress: number; progressData: { hasClubProgram: boolean; hasTier: boolean; hasPromo: boolean; hasCommConfig: boolean } } | null,
    currentRoute: url.pathname,
  };
}

export default function AppLayout() {
  const loaderData = useLoaderData<typeof loader>();
  const { client, session, setupProgress, currentRoute } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const isSetupIncomplete = !client.setup_complete;
  const theme = session?.theme || 'light';
  
  // Apply theme class to HTML element for dark mode
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.setAttribute('data-theme', theme);
    // Cache in localStorage for next page load to prevent flash
    localStorage.setItem('adminUITheme', theme);
  }, [theme]);
  
  // Handle toast notifications from URL params (for route-changing feedback)
  useEffect(() => {
    const feedbackParam = searchParams.get('toast');
    const feedbackType = searchParams.get('toastType');
    
    if (feedbackParam) {
      const isError = feedbackType === 'error';
      
      // Scroll to top so toast is visible
      scrollToTop();
      
      // Show toast notification at top
      if (isError) {
        toast.error(feedbackParam);
      } else {
        toast.success(feedbackParam);
      }
      
      // Remove params from URL
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('toast');
      newParams.delete('toastType');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <>
      <Toaster position="top-center" richColors />
      <div className={`embedded-app-wrapper min-h-screen ${
        theme === 'dark' 
          ? 'bg-[#161C27]' 
          : 'bg-white'
      }`}>
      {/* Setup Wizard */}
      {isSetupIncomplete && setupProgress && (
        <div className="container mx-auto px-4 mb-6">
          <Banner tone="info">
            <BlockStack gap="300">
              <Text variant="bodyMd" as="p">
                <strong>Setup in Progress</strong> - Complete the setup wizard to unlock all features
              </Text>
              <SetupWizard 
                currentRoute={currentRoute || ''}
                progressData={setupProgress.progressData}
                progress={setupProgress.progress}
              />
            </BlockStack>
          </Banner>
        </div>
      )}

      {/* Nested routes render here */}
      <Outlet />

      {/* Footer button */}
      <div className="flex justify-center">
        <div className="footer-button">
          <a
            href="https://liberovino.wine"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img 
              style={{ objectFit: 'contain' }}
              src={theme === 'dark' ? '/media/powered-by-dark.png' : '/media/powered-by-light.png'} 
              alt="Powered by LiberoVino" 
            />
          </a>
        </div>
      </div>
    </div>
    </>
  );
}
