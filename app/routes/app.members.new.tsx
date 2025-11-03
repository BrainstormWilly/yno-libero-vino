import { type LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData, useNavigate } from 'react-router';
import { Page, Layout } from '@shopify/polaris';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { addSessionToUrl } from '~/util/session';
import EnrollmentSummary from '~/components/EnrollmentSummary';

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
  const navigate = useNavigate();
  
  return (
    <Page
      title="Enroll New Member"
      backAction={{
        content: 'Members',
        onAction: () => navigate(addSessionToUrl('/app/members', session.id)),
      }}
    >
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

