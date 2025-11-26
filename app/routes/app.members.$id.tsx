import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate } from 'react-router';
import { useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  Banner,
  Box,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { addSessionToUrl } from '~/util/session';
import { setupAutoResize } from '~/util/iframe-helper';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const { id } = params;
  if (!id) {
    throw new Response('Enrollment ID required', { status: 400 });
  }
  
  // Get enrollment with full details
  const enrollment = await db.getEnrollmentById(id);
  
  if (!enrollment) {
    throw new Response('Enrollment not found', { status: 404 });
  }
  
  return {
    session,
    enrollment,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const { id } = params;
  if (!id) {
    return { success: false, error: 'Enrollment ID required' };
  }
  
  const formData = await request.formData();
  const action = formData.get('action');
  
  if (action === 'cancel') {
    try {
      await db.cancelEnrollment(id);
      return { 
        success: true, 
        message: 'Membership cancelled successfully',
        action: 'cancelled'
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cancel membership' 
      };
    }
  }
  
  return { success: false, error: 'Invalid action' };
}

export default function MemberDetail() {
  const { session, enrollment } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  const handleEditInC7 = () => {
    if (enrollment.c7_membership_id) {
      window.open(`/club/membership/${enrollment.c7_membership_id}`, '_blank');
    }
  };
  
  const isCancelled = enrollment.status === 'cancelled' || actionData?.action === 'cancelled';
  
  return (
    <Page
      title={`${enrollment.customers.first_name} ${enrollment.customers.last_name}`}
      subtitle={enrollment.club_stages.name}
      primaryAction={
        enrollment.c7_membership_id
          ? {
              content: 'Edit in Commerce7',
              onAction: handleEditInC7,
            }
          : undefined
      }
      secondaryActions={
        enrollment.status === 'active'
          ? [
              {
                content: 'Cancel Membership',
                destructive: true,
                onAction: () => {
                  if (confirm('Are you sure you want to cancel this membership? This action cannot be undone.')) {
                    const form = document.getElementById('cancel-form') as HTMLFormElement;
                    if (form) form.requestSubmit();
                  }
                },
              },
            ]
          : undefined
      }
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Banners at Top */}
            {actionData && actionData.success && (
              <Banner tone="success" title="Success">
                {actionData.message}
              </Banner>
            )}
            
            {actionData && !actionData.success && (
              <Banner tone="critical" title="Error">
                {actionData.error}
              </Banner>
            )}

            {/* Navigation Button at Top */}
            <Box paddingBlockEnd="400">
              <Button onClick={() => navigate(addSessionToUrl('/app/members', session.id))}>
                ← Back to Members
              </Button>
            </Box>
            
            {/* Membership Status */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Membership Status
                </Text>
                
                <InlineStack gap="200">
                  <Badge tone={
                    enrollment.status === 'active' ? 'success' :
                    enrollment.status === 'cancelled' ? 'critical' :
                    enrollment.status === 'expired' ? 'warning' : 'info'
                  }>
                    {enrollment.status.toUpperCase()}
                  </Badge>
                  {isCancelled && (
                    <Badge tone="attention">Cancellation Pending</Badge>
                  )}
                </InlineStack>
                
                <Divider />
                
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p">
                      <strong>Enrolled:</strong>
                    </Text>
                    <Text variant="bodyMd" as="p">
                      {new Date(enrollment.enrolled_at).toLocaleDateString()}
                    </Text>
                  </InlineStack>
                  
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p">
                      <strong>Duration End:</strong>
                    </Text>
                    <Text variant="bodyMd" as="p">
                      {new Date(enrollment.expires_at).toLocaleDateString()}
                    </Text>
                  </InlineStack>
                  
                  {enrollment.c7_membership_id && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p">
                        <strong>C7 Membership ID:</strong>
                      </Text>
                      <Text variant="bodyMd" as="p" fontWeight="medium">
                        {enrollment.c7_membership_id}
                      </Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
            
            {/* Customer Information */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Customer Information
                </Text>
                
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p">
                      <strong>Email:</strong>
                    </Text>
                    <Text variant="bodyMd" as="p">
                      {enrollment.customers.email}
                    </Text>
                  </InlineStack>
                  
                  {enrollment.customers.phone && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p">
                        <strong>Phone:</strong>
                      </Text>
                      <Text variant="bodyMd" as="p">
                        {enrollment.customers.phone}
                      </Text>
                    </InlineStack>
                  )}
                  
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p">
                      <strong>CRM ID:</strong>
                    </Text>
                    <Text variant="bodyMd" as="p" fontWeight="medium">
                      {enrollment.customers.crm_id}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
            
            {/* Tier Details */}
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Tier Details
                </Text>
                
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p">
                      <strong>Duration:</strong>
                    </Text>
                    <Text variant="bodyMd" as="p">
                      {enrollment.club_stages.duration_months} months
                    </Text>
                  </InlineStack>
                  
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p">
                      <strong>Min Purchase:</strong>
                    </Text>
                    <Text variant="bodyMd" as="p">
                      ${enrollment.club_stages.min_purchase_amount}
                    </Text>
                  </InlineStack>
                  
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p">
                      <strong>Min LTV:</strong>
                    </Text>
                    <Text variant="bodyMd" as="p">
                      ${enrollment.club_stages.min_ltv_amount}
                    </Text>
                  </InlineStack>
                  
                  {enrollment.club_stages.c7_club_id && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p">
                        <strong>C7 Club ID:</strong>
                      </Text>
                      <Text variant="bodyMd" as="p" fontWeight="medium">
                        {enrollment.club_stages.c7_club_id}
                      </Text>
                    </InlineStack>
                  )}
                </BlockStack>
              </BlockStack>
            </Card>
            
          </BlockStack>
          
          {/* Hidden cancel form */}
          <Form method="post" id="cancel-form" style={{ display: 'none' }}>
            <input type="hidden" name="action" value="cancel" />
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

