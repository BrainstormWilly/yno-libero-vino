import { type LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData, useSearchParams } from 'react-router';
import { useEffect } from 'react';
import { 
  ProgressBar,
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
import { getClubProgram } from '~/lib/db/supabase.server';
import { scrollToTop } from '~/util/iframe-helper';

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
      const clubProgram = await getClubProgram(devResult.client.id);
      let progress = 0;
      let currentStep = '';
      
      if (clubProgram?.name) {
        progress += 25;
        currentStep = 'Create membership tiers';
      }
      
      if (clubProgram?.club_stages && clubProgram.club_stages.length > 0) {
        progress += 25;
        currentStep = 'Configure tier promotions';
        
        if (url.pathname.includes('/setup/review')) {
          progress += 50;
          currentStep = 'Review and launch';
        }
      } else if (!clubProgram) {
        currentStep = 'Create club program';
      }
      
      setupProgress = {
        progress: progress,
        currentStep,
      };
    }
    
    return {
      ...devResult,
      setupProgress: setupProgress as { progress: number; currentStep: string } | null,
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

  // Calculate setup progress if setup is incomplete
  let setupProgress = null;
  if (!client.setup_complete) {
    const clubProgram = await getClubProgram(client.id);
    
    // Calculate progress:
    // - Has club program name: 25%
    // - Has at least one tier: 25%
    // - All tiers have promotions: 50%
    let progress = 0;
    let currentStep = '';
    
    if (clubProgram?.name) {
      progress += 25;
      currentStep = 'Create membership tiers';
    }
    
    if (clubProgram?.club_stages && clubProgram.club_stages.length > 0) {
      progress += 25;
      currentStep = 'Configure tier promotions';
      
      // Check if all tiers have promotions (need to query separately)
      const allTiersConfigured = clubProgram.club_stages.every((tier: any) => {
        // We'll check this in the UI instead since we need to fetch promotions
        return true; // Placeholder for now
      });
      
      if (clubProgram.club_stages.length > 0) {
        // Assume configured if we're past tiers page
        const hasPromotions = url.pathname.includes('/setup/review');
        if (hasPromotions) {
          progress += 50;
          currentStep = 'Review and launch';
        }
      }
    } else if (!clubProgram) {
      currentStep = 'Create club program';
    }
    
    setupProgress = {
      progress: progress, // ProgressBar expects 0-100
      currentStep,
    };
  }

  // Parent route only checks auth - child routes handle their own logic
  return {
    client,
    session,
    isDev: false,
    setupProgress: setupProgress as { progress: number; currentStep: string } | null,
  };
}

export default function AppLayout() {
  const loaderData = useLoaderData<typeof loader>();
  const { client, session, setupProgress } = loaderData;
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
          : 'bg-gradient-to-br from-purple-50 to-violet-100'
      }`}>
      {/* Setup Progress Bar */}
      {isSetupIncomplete && setupProgress && (
        <div className="container mx-auto px-4 mb-6">
          <Banner tone="info">
            <BlockStack gap="300">
              <Text variant="bodyMd" as="p">
                <strong>Setup in Progress</strong> - Complete the setup wizard to unlock all features
              </Text>
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" tone="subdued">
                  Current step: {setupProgress.currentStep}
                </Text>
                <ProgressBar 
                  progress={setupProgress.progress} 
                  size="small"
                  tone="primary"
                />
                <Text variant="bodySm" as="p" tone="subdued">
                  {setupProgress.progress}% complete
                </Text>
              </BlockStack>
            </BlockStack>
          </Banner>
        </div>
      )}

      {/* Nested routes render here */}
      <Outlet />
    </div>
    </>
  );
}
