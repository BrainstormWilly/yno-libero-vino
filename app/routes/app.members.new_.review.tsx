import { type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate } from 'react-router';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  Divider,
  Badge,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { crmManager } from '~/lib/crm';
import { addSessionToUrl } from '~/util/session';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Get draft
  const draft = await db.getEnrollmentDraft(session.id);
  if (!draft || !draft.customer || !draft.tier || !draft.addressVerified || !draft.paymentVerified) {
    throw new Response('Enrollment not ready', { status: 400 });
  }
  
  return {
    session,
    draft,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const draft = await db.getEnrollmentDraft(session.id);
  if (!draft || !draft.customer || !draft.tier) {
    return { success: false, error: 'Incomplete enrollment data' };
  }
  
  try {
    // Get the appropriate CRM provider
    const provider = crmManager.getProvider(
      session.crmType,
      session.tenantShop,
      session.accessToken
    );
    
    // Get tier details
    const tier = await db.getClubStageWithDetails(draft.tier.id);
    if (!tier || !tier.c7_club_id) {
      return {
        success: false,
        error: 'Invalid tier or tier not synced with CRM',
      };
    }
    
    // Validate we have all required IDs
    if (!draft.customer.billingAddressId || !draft.customer.shippingAddressId || !draft.customer.paymentMethodId) {
      return {
        success: false,
        error: 'Missing required address or payment information',
      };
    }
    
    // Create membership in CRM
    const enrollmentDate = new Date();
    const expirationDate = new Date(enrollmentDate);
    expirationDate.setMonth(expirationDate.getMonth() + tier.duration_months);
    
    const crmMembership = await provider.createClubMembership({
      customerId: draft.customer.crmId,
      clubId: tier.c7_club_id,
      billingAddressId: draft.customer.billingAddressId,
      shippingAddressId: draft.customer.shippingAddressId,
      paymentMethodId: draft.customer.paymentMethodId,
      startDate: enrollmentDate.toISOString(),
    });
    
    // Create/update customer in LV database
    let lvCustomer = await db.getCustomerByCrmId(session.clientId, draft.customer.crmId);
    
    if (!lvCustomer) {
      lvCustomer = await db.createCustomer(session.clientId, {
        email: draft.customer.email,
        firstName: draft.customer.firstName,
        lastName: draft.customer.lastName,
        phone: draft.customer.phone || null,
        crmId: draft.customer.crmId,
      });
    }
    
    // Create enrollment record
    await db.createClubEnrollment({
      customerId: lvCustomer.id,
      clubStageId: draft.tier.id,
      status: 'active',
      enrolledAt: enrollmentDate.toISOString(),
      expiresAt: expirationDate.toISOString(),
      crmMembershipId: crmMembership.id || null,
    });
    
    // Award welcome bonus points if applicable
    const loyalty = await db.getTierLoyaltyConfig(draft.tier.id);
    if (loyalty && loyalty.initial_points_bonus && loyalty.initial_points_bonus > 0) {
      try {
        await provider.preloadTierBonusPoints(
          draft.customer.crmId,
          loyalty.initial_points_bonus,
          tier.name
        );
      } catch (error) {
        // Log but don't fail enrollment if bonus points fail
        console.warn('Failed to add welcome bonus points:', error);
      }
    }
    
    // Clear draft
    await db.clearEnrollmentDraft(session.id);
    
    // Redirect to members list with success toast
    const redirectUrl = addSessionToUrl('/app/members', session.id) +
      '&toast=' + encodeURIComponent(`${draft.customer.firstName} ${draft.customer.lastName} enrolled successfully! 🎉`) +
      '&toastType=success';
    
    throw redirect(redirectUrl);
  } catch (error) {
    // Re-throw Response objects (redirects)
    if (error instanceof Response) {
      throw error;
    }
    
    console.error('Enrollment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete enrollment',
    };
  }
}

export default function ReviewAndEnroll() {
  const { draft, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  return (
    <Page
      title="Review & Complete Enrollment"
      backAction={{
        content: 'Back',
        onAction: () => navigate(addSessionToUrl('/app/members/new/payment', session.id)),
      }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
      {/* Error Banner */}
      {actionData && !actionData.success && (
        <Banner tone="critical" title="Error">
          {actionData.error}
        </Banner>
      )}
      
      {/* Instructions */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">
            Step 5: Review & Confirm
          </Text>
          <Text variant="bodyMd" as="p">
            Review the enrollment details below and click "Complete Enrollment" to finalize.
          </Text>
        </BlockStack>
      </Card>
      
      {/* Customer Summary */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h3">
              Customer Information
            </Text>
            <Button
              variant="plain"
              onClick={() => navigate(addSessionToUrl('/app/members/new', session.id))}
            >
              Edit
            </Button>
          </InlineStack>
          
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                <strong>Name:</strong>
              </Text>
              <Text variant="bodyMd" as="p">
                {draft.customer?.firstName} {draft.customer?.lastName}
              </Text>
            </InlineStack>
            
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                <strong>Email:</strong>
              </Text>
              <Text variant="bodyMd" as="p">
                {draft.customer?.email}
              </Text>
            </InlineStack>
            
            {draft.customer?.phone && (
              <InlineStack align="space-between">
                <Text variant="bodyMd" as="p">
                  <strong>Phone:</strong>
                </Text>
                <Text variant="bodyMd" as="p">
                  {draft.customer.phone}
                </Text>
              </InlineStack>
            )}
            
            {draft.customer?.ltv !== undefined && (
              <InlineStack align="space-between">
                <Text variant="bodyMd" as="p">
                  <strong>Purchase History:</strong>
                </Text>
                <Text variant="bodyMd" as="p">
                  ${draft.customer.ltv.toFixed(2)}
                </Text>
              </InlineStack>
            )}
            
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                <strong>Status:</strong>
              </Text>
              <Badge tone={draft.customer?.isExisting ? 'info' : 'attention'}>
                {draft.customer?.isExisting ? 'Existing Customer' : 'New Customer'}
              </Badge>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>
      
      {/* Tier Summary */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h3">
              Selected Tier
            </Text>
            <Button
              variant="plain"
              onClick={() => navigate(addSessionToUrl('/app/members/new', session.id))}
            >
              Edit
            </Button>
          </InlineStack>
          
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                <strong>Tier Name:</strong>
              </Text>
              <Text variant="bodyMd" as="p">
                {draft.tier?.name}
              </Text>
            </InlineStack>
            
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                <strong>Duration:</strong>
              </Text>
              <Text variant="bodyMd" as="p">
                {draft.tier?.durationMonths} months
              </Text>
            </InlineStack>
            
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                <strong>Minimum Purchase:</strong>
              </Text>
              <Text variant="bodyMd" as="p">
                ${draft.tier?.minPurchaseAmount}
              </Text>
            </InlineStack>
            
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                <strong>Customer Purchase:</strong>
              </Text>
              <Text variant="bodyMd" as="p">
                ${draft.tier?.purchaseAmount.toFixed(2)}
              </Text>
            </InlineStack>
            
            <Divider />
            
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                <strong>Qualification Status:</strong>
              </Text>
              <Badge tone={draft.tier?.qualified ? 'success' : 'attention'}>
                {draft.tier?.qualified ? 'Qualified' : 'Not Qualified (Override)'}
              </Badge>
            </InlineStack>
          </BlockStack>
        </BlockStack>
      </Card>
      
      {/* Address Summary */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h3">
              Address
            </Text>
            <Button
              variant="plain"
              onClick={() => navigate(addSessionToUrl('/app/members/new/address', session.id))}
            >
              Edit
            </Button>
          </InlineStack>
          
          {draft.address?.billing && (
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p">
                  <strong>Billing Address</strong>
                </Text>
                <Text variant="bodyMd" as="p">
                  {draft.address.billing.address1}
                </Text>
                {draft.address.billing.address2 && (
                  <Text variant="bodyMd" as="p">
                    {draft.address.billing.address2}
                  </Text>
                )}
                <Text variant="bodyMd" as="p">
                  {draft.address.billing.city}, {draft.address.billing.state} {draft.address.billing.zip}
                </Text>
                {draft.address.billing.country && (
                  <Text variant="bodyMd" as="p">
                    {draft.address.billing.country}
                  </Text>
                )}
              </BlockStack>
              
              {draft.address.shipping && (
                <>
                  <Divider />
                  <BlockStack gap="100">
                    <Text variant="bodyMd" as="p">
                      <strong>Shipping Address</strong>
                    </Text>
                    <Text variant="bodyMd" as="p">
                      {draft.address.shipping.address1}
                    </Text>
                    {draft.address.shipping.address2 && (
                      <Text variant="bodyMd" as="p">
                        {draft.address.shipping.address2}
                      </Text>
                    )}
                    <Text variant="bodyMd" as="p">
                      {draft.address.shipping.city}, {draft.address.shipping.state} {draft.address.shipping.zip}
                    </Text>
                    {draft.address.shipping.country && (
                      <Text variant="bodyMd" as="p">
                        {draft.address.shipping.country}
                      </Text>
                    )}
                  </BlockStack>
                </>
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Card>
      
      {/* Payment Summary */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h3">
              Payment Method
            </Text>
            <Button
              variant="plain"
              onClick={() => navigate(addSessionToUrl('/app/members/new/payment', session.id))}
            >
              Edit
            </Button>
          </InlineStack>
          
          {draft.payment && (
            <BlockStack gap="100">
              <Text variant="bodyMd" as="p">
                <strong>{draft.payment.brand || 'Card'} ending in {draft.payment.last4}</strong>
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Expires: {draft.payment.expiryMonth}/{draft.payment.expiryYear}
              </Text>
            </BlockStack>
          )}
        </BlockStack>
      </Card>
      
      {/* Enrollment Actions */}
      <Card>
        <Form method="post">
          <BlockStack gap="300">
            <Text variant="bodyMd" as="p">
              All information has been verified. Click the button below to complete the enrollment 
              and create the membership in Commerce7.
            </Text>
            
            <Button
              variant="primary"
              submit
              size="large"
            >
              Complete Enrollment 🚀
            </Button>
          </BlockStack>
        </Form>
      </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

