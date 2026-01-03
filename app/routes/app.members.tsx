import { type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, useSubmit, useLocation } from 'react-router';
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

  // Get search and filter params from URL
  const url = new URL(request.url);
  const search = url.searchParams.get('search') || undefined;
  const tierFilter = url.searchParams.get('tier') || undefined;
  const statusFilter = url.searchParams.get('status') || undefined;

  // Get all customers with their enrollment summary (customer-centric view)
  const customers = await db.getCustomersWithEnrollmentSummary(session.clientId, {
    search,
    tierFilter,
    statusFilter,
  });

  // Get all tiers for filter dropdown (include inactive for filtering existing enrollments)
  const clubProgram = await db.getClubProgram(session.clientId);
  const tiers = clubProgram?.club_stages || [];

  return {
    session,
    client,
    customers,
    tiers,
    search: search || '',
    tierFilter: tierFilter || '',
    statusFilter: statusFilter || '',
  };
}

export default function MembersPage() {
  const { session, customers, tiers, search: initialSearch, tierFilter: initialTierFilter, statusFilter: initialStatusFilter } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [searchValue, setSearchValue] = useState(initialSearch);
  const [tierFilterValue, setTierFilterValue] = useState(initialTierFilter);
  const [statusFilterValue, setStatusFilterValue] = useState(initialStatusFilter);

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
    if (statusFilterValue) params.set('status', statusFilterValue);
    params.set('session', session.id);
    
    navigate(`/app/members?${params.toString()}`);
  }, [searchValue, tierFilterValue, statusFilterValue, session.id, navigate]);

  // Handle tier filter change
  const handleTierFilterChange = useCallback((value: string) => {
    setTierFilterValue(value);
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    if (value) params.set('tier', value);
    if (statusFilterValue) params.set('status', statusFilterValue);
    params.set('session', session.id);
    
    navigate(`/app/members?${params.toString()}`);
  }, [searchValue, statusFilterValue, session.id, navigate]);

  // Handle status filter change
  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilterValue(value);
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    if (tierFilterValue) params.set('tier', tierFilterValue);
    if (value) params.set('status', value);
    params.set('session', session.id);
    
    navigate(`/app/members?${params.toString()}`);
  }, [searchValue, tierFilterValue, session.id, navigate]);

  // Clear filters
  const handleClearFilters = useCallback(() => {
    setSearchValue('');
    setTierFilterValue('');
    setStatusFilterValue('');
    navigate(addSessionToUrl('/app/members', session.id));
  }, [session.id, navigate]);

  // Prepare table data with click handlers
  const tableRows = customers.map((customer: any) => {
    const handleRowClick = () => {
      // Navigate to customer detail view (enrollment_id is still used for the URL for now)
      if (customer.enrollment_id) {
        navigate(addSessionToUrl(`/app/members/${customer.enrollment_id}`, session.id));
      }
    };
    
    return [
      <button
        key={`name-${customer.customer_id}`}
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
        {customer.first_name} {customer.last_name}
      </button>,
      <button
        key={`email-${customer.customer_id}`}
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
        {customer.email}
      </button>,
      <button
        key={`tier-${customer.customer_id}`}
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
        {customer.tier_name || 'N/A'}
      </button>,
      <button
        key={`points-${customer.customer_id}`}
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
        {customer.loyalty_points_balance.toLocaleString()}
      </button>,
      <button
        key={`enrolled-${customer.customer_id}`}
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
        {customer.enrolled_at
          ? new Date(customer.enrolled_at).toLocaleDateString()
          : 'N/A'}
      </button>,
      <button
        key={`expires-${customer.customer_id}`}
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
        {customer.expires_at
          ? new Date(customer.expires_at).toLocaleDateString()
          : 'N/A'}
      </button>,
      <button
        key={`status-${customer.customer_id}`}
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
        {customer.enrollment_status ? (
          <Badge tone={customer.enrollment_status === 'active' ? 'success' : 'warning'}>
            {customer.enrollment_status}
          </Badge>
        ) : (
          'No enrollment'
        )}
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

  // Status filter options
  const statusOptions = [
    { label: 'Active Only', value: '' },
    { label: 'All Statuses', value: 'all' },
    { label: 'Expired', value: 'expired' },
    { label: 'Cancelled', value: 'cancelled' },
  ];

  return (
    <Page
      title="Club Members"
      primaryAction={{
        content: 'Add Member',
        onAction: () => navigate(addSessionToUrl('/app/members/new', session.id)),
      }}
      secondaryActions={getMainNavigationActions({
        sessionId: session.id,
        currentPath: location.pathname,
      })}
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
                    if (statusFilterValue) params.set('status', statusFilterValue);
                    params.set('session', session.id);
                    navigate(`/app/members?${params.toString()}`);
                  }}
                />
              </div>
              <div style={{ width: '180px' }}>
                <Select
                  label="Filter by tier"
                  options={tierOptions}
                  value={tierFilterValue}
                  onChange={handleTierFilterChange}
                  labelHidden
                />
              </div>
              <div style={{ width: '180px' }}>
                <Select
                  label="Filter by status"
                  options={statusOptions}
                  value={statusFilterValue}
                  onChange={handleStatusFilterChange}
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
              {customers.length === 0 ? (
                <EmptyState
                  heading={searchValue || tierFilterValue || statusFilterValue ? "No members found" : "No members yet"}
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={
                    searchValue || tierFilterValue || statusFilterValue
                      ? {
                          content: 'Clear filters',
                          onAction: handleClearFilters,
                        }
                      : undefined
                  }
                >
                  <p>
                    {searchValue || tierFilterValue || statusFilterValue
                      ? 'Try adjusting your search or filters.'
                      : 'Start building your club by adding your first member.'}
                  </p>
                </EmptyState>
              ) : (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text', 'text']}
                  headings={['Name', 'Email', 'Tier', 'Loyalty Points', 'Enrolled', 'Expires', 'Status']}
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

