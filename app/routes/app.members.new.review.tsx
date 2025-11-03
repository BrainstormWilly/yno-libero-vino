import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData } from 'react-router';
import {
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
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
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
        error: 'Invalid tier or tier not synced with Commerce7',
      };
    }
    
    // Club membership creation is Commerce7-specific for now
    if (!(provider instanceof Commerce7Provider)) {
      return {
        success: false,
        error: 'Club enrollment is currently only supported for Commerce7',
      };
    }
    
    // Validate we have all required IDs
    if (!draft.customer.billingAddressId || !draft.customer.shippingAddressId || !draft.customer.paymentMethodId) {
      return {
        success: false,
        error: 'Missing required address or payment information',
      };
    }
    
    // Create membership in Commerce7
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
        crmType: session.crmType,
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
    let redirectUrl = addSessionToUrl('/app/members', session.id) +
      '&toast=' + encodeURIComponent(`${draft.customer.firstName} ${draft.customer.lastName} enrolled successfully! 🎉`) +
      '&toastType=success';
    
    // Ensure HTTPS for embedded app
    if (redirectUrl.startsWith('http://')) {
      redirectUrl = redirectUrl.replace('http://', 'https://');
    }
    
    return Response.redirect(redirectUrl);
  } catch (error) {
    console.error('Enrollment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete enrollment',
    };
  }
}

export default function ReviewAndEnroll() {
  const { draft } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  return (
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
          <Text variant="headingMd" as="h3">
            Customer Information
          </Text>
          
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
          <Text variant="headingMd" as="h3">
            Selected Tier
          </Text>
          
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
      
      {/* Verification Summary */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Verification Status
          </Text>
          
          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                Address:
              </Text>
              <Badge tone="success">Verified ✓</Badge>
            </InlineStack>
            
            <InlineStack align="space-between">
              <Text variant="bodyMd" as="p">
                Payment Method:
              </Text>
              <Badge tone="success">Verified ✓</Badge>
            </InlineStack>
          </BlockStack>
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
  );
}

