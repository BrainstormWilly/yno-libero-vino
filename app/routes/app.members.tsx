import { type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate } from 'react-router';
import { useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Badge,
  EmptyState,
  DataTable,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { addSessionToUrl } from '~/util/session';
import { setupAutoResize } from '~/util/iframe-helper';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }

  const client = await db.getClient(session.clientId);
  if (!client?.setup_complete) {
    throw new Response('Setup not complete', { status: 403 });
  }

  // Get all enrollments
  const enrollments = await db.getEnrollmentsByClientId(session.clientId);

  return {
    session,
    client,
    enrollments,
  };
}

export default function MembersPage() {
  const { session, enrollments } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  useEffect(() => {
    setupAutoResize();
  }, []);

  // Prepare table data
  const tableRows = enrollments.map((enrollment: any) => [
    `${enrollment.customers.first_name} ${enrollment.customers.last_name}`,
    enrollment.customers.email,
    enrollment.club_stages.name,
    new Date(enrollment.enrolled_at).toLocaleDateString(),
    enrollment.expires_at
      ? new Date(enrollment.expires_at).toLocaleDateString()
      : 'No expiration',
    <Badge tone={enrollment.status === 'active' ? 'success' : 'warning'} key={enrollment.id}>
      {enrollment.status}
    </Badge>,
  ]);

  return (
    <Page
      title="Club Members"
      primaryAction={{
        content: 'Add Member',
        onAction: () => navigate(addSessionToUrl('/app/members/new', session.id)),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            {enrollments.length === 0 ? (
              <EmptyState
                heading="No members yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Start building your club by adding your first member.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                headings={['Name', 'Email', 'Tier', 'Enrolled', 'Expires', 'Status']}
                rows={tableRows}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

