import { type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, useSubmit } from 'react-router';
import { useEffect, useState, useCallback } from 'react';
import {
  Page,
  Layout,
  Card,
  Badge,
  EmptyState,
  DataTable,
  TextField,
  Select,
  InlineStack,
  BlockStack,
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

  // Get search and filter params from URL
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || undefined;
  const tierFilter = url.searchParams.get('tier') || undefined;

  // Get all enrollments with filters
  const enrollments = await db.getEnrollmentsByClientId(session.clientId, {
    search,
    tierFilter,
  });

  // Get all tiers for filter dropdown
  const clubProgram = await db.getClubProgram(session.clientId);
  const tiers = clubProgram?.club_stages || [];

  return {
    session,
    client,
    enrollments,
    tiers,
    search: search || '',
    tierFilter: tierFilter || '',
  };
}

export default function MembersPage() {
  const { session, enrollments, tiers, search: initialSearch, tierFilter: initialTierFilter } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [searchValue, setSearchValue] = useState(initialSearch);
  const [tierFilterValue, setTierFilterValue] = useState(initialTierFilter);

  useEffect(() => {
    setupAutoResize();
  }, []);

  // Debounced search handler
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);

  // Submit filters
  const handleFilterSubmit = useCallback(() => {
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    if (tierFilterValue) params.set('tier', tierFilterValue);
    params.set('session', session.id);
    
    navigate(`/app/members?${params.toString()}`);
  }, [searchValue, tierFilterValue, session.id, navigate]);

  // Handle tier filter change
  const handleTierFilterChange = useCallback((value: string) => {
    setTierFilterValue(value);
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    if (value) params.set('tier', value);
    params.set('session', session.id);
    
    navigate(`/app/members?${params.toString()}`);
  }, [searchValue, session.id, navigate]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setSearchValue('');
    setTierFilterValue('');
    navigate(addSessionToUrl('/app/members', session.id));
  }, [session.id, navigate]);

  // Prepare table data with click handlers
  const tableRows = enrollments.map((enrollment: any) => {
    const handleRowClick = () => {
      navigate(addSessionToUrl(`/app/members/${enrollment.id}`, session.id));
    };
    
    return [
      <button
        key={`name-${enrollment.id}`}
        onClick={handleRowClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        {enrollment.customers.first_name} {enrollment.customers.last_name}
      </button>,
      <button
        key={`email-${enrollment.id}`}
        onClick={handleRowClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        {enrollment.customers.email}
      </button>,
      <button
        key={`tier-${enrollment.id}`}
        onClick={handleRowClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        {enrollment.club_stages.name}
      </button>,
      <button
        key={`enrolled-${enrollment.id}`}
        onClick={handleRowClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        {new Date(enrollment.enrolled_at).toLocaleDateString()}
      </button>,
      <button
        key={`expires-${enrollment.id}`}
        onClick={handleRowClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        {enrollment.expires_at
          ? new Date(enrollment.expires_at).toLocaleDateString()
          : 'No expiration'}
      </button>,
      <button
        key={`status-${enrollment.id}`}
        onClick={handleRowClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          font: 'inherit',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        <Badge tone={enrollment.status === 'active' ? 'success' : 'warning'}>
          {enrollment.status}
        </Badge>
      </button>,
    ];
  });

  // Tier filter options
  const tierOptions = [
    { label: 'All Tiers', value: '' },
    ...tiers.map((tier: any) => ({
      label: tier.name,
      value: tier.id,
    })),
  ];

  return (
    <Page
      title="Club Members"
      primaryAction={{
        content: 'Add Member',
        onAction: () => navigate(addSessionToUrl('/app/members/new', session.id)),
      }}
    >
      <Layout>
        {/* Search and Filter Bar */}
        <Layout.Section>
          <Card>
            <InlineStack gap="400" align="start">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Search"
                  value={searchValue}
                  onChange={handleSearchChange}
                  onBlur={handleFilterSubmit}
                  placeholder="Search by name or email"
                  autoComplete="off"
                  labelHidden
                  clearButton
                  onClearButtonClick={() => {
                    setSearchValue('');
                    const params = new URLSearchParams();
                    if (tierFilterValue) params.set('tier', tierFilterValue);
                    params.set('session', session.id);
                    navigate(`/app/members?${params.toString()}`);
                  }}
                />
              </div>
              <div style={{ width: '200px' }}>
                <Select
                  label="Filter by tier"
                  options={tierOptions}
                  value={tierFilterValue}
                  onChange={handleTierFilterChange}
                  labelHidden
                />
              </div>
            </InlineStack>
          </Card>
        </Layout.Section>
        
        {/* Members Table */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              {/* Table or Empty State */}
              {enrollments.length === 0 ? (
                <EmptyState
                  heading={searchValue || tierFilterValue ? "No members found" : "No members yet"}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={
                    searchValue || tierFilterValue
                      ? {
                          content: 'Clear filters',
                          onAction: handleClearFilters,
                        }
                      : undefined
                  }
                >
                  <p>
                    {searchValue || tierFilterValue
                      ? 'Try adjusting your search or filters.'
                      : 'Start building your club by adding your first member.'}
                  </p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
                  headings={['Name', 'Email', 'Tier', 'Enrolled', 'Expires', 'Status']}
                  rows={tableRows}
                  hoverable
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

