import { type LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { Page, Layout } from '@shopify/polaris';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { addSessionToUrl } from '~/util/session';
import EnrollmentSummary from '~/components/EnrollmentSummary';
import ProgressNavBar, { type ProgressStep } from '~/components/ProgressNavBar';
import { getMainNavigationActions } from '~/util/navigation';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const client = await db.getClient(session.clientId);
  if (!client?.setup_complete) {
    throw new Response('Setup not complete', { status: 403 });
  }
  
  // Load enrollment draft
  const draft = await db.getEnrollmentDraft(session.id);
  
  // Determine current step from pathname
  const url = new URL(request.url);
  const pathname = url.pathname;
  let currentStep: 'qualify' | 'customer' | 'address' | 'payment' | 'review' = 'qualify';
  
  if (pathname.includes('/customer')) currentStep = 'customer';
  else if (pathname.includes('/address')) currentStep = 'address';
  else if (pathname.includes('/payment')) currentStep = 'payment';
  else if (pathname.includes('/review')) currentStep = 'review';
  
  return {
    session,
    client,
    draft,
    currentStep,
  };
}

export default function MemberEnrollmentLayout() {
  const { draft, currentStep, session } = useLoaderData<typeof loader>();
  
  // Define enrollment steps
  const ENROLLMENT_STEPS: ProgressStep[] = [
    { key: 'qualify', label: 'Tier', url: addSessionToUrl('/app/members/new', session.id), order: 1 },
    { key: 'customer', label: 'Customer', url: addSessionToUrl('/app/members/new/customer', session.id), order: 2 },
    { key: 'address', label: 'Address', url: addSessionToUrl('/app/members/new/address', session.id), order: 3 },
    { key: 'payment', label: 'Payment', url: addSessionToUrl('/app/members/new/payment', session.id), order: 4 },
    { key: 'review', label: 'Review', url: addSessionToUrl('/app/members/new/review', session.id), order: 5 },
  ];
  
  // Determine completed steps from draft
  const completedSteps = new Set<string>();
  if (draft?.tier) completedSteps.add('qualify');
  if (draft?.customer) completedSteps.add('customer');
  if (draft?.customer?.shippingAddressId) completedSteps.add('address');
  if (draft?.customer?.paymentMethodId) completedSteps.add('payment');
  
  return (
    <Page title="Enroll New Member"
      secondaryActions={getMainNavigationActions({
        sessionId: session.id,
        currentPath: location.pathname,
      })}
    >
      {/* Progress Bar */}
      <div style={{ marginBottom: '24px' }}>
        <ProgressNavBar
          steps={ENROLLMENT_STEPS}
          currentStepKey={currentStep}
          completedStepKeys={completedSteps}
        />
      </div>
      
      <Layout>
        {/* Main content area */}
        <Layout.Section>
          <Outlet />
        </Layout.Section>
        
        {/* Sidebar with enrollment summary */}
        <Layout.Section variant="oneThird">
          <EnrollmentSummary draft={draft} currentStep={currentStep} />
        </Layout.Section>
      </Layout>
    </Page>
  );
}

