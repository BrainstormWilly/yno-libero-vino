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
  Box,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { crmManager } from '~/lib/crm';
import { addSessionToUrl } from '~/util/session';
import { KLAVIYO_METRICS } from '~/lib/communication/klaviyo.constants';
import { MAILCHIMP_TAGS } from '~/lib/communication/mailchimp.constants';
import { KlaviyoProvider } from '~/lib/communication/providers/klaviyo.server';
import type { KlaviyoProviderData } from '~/types/communication-klaviyo';
import type { CommunicationPreferences } from '~/lib/communication/preferences';
import { sendClientEmail, trackClientEvent } from '~/lib/communication/communication.service.server';

type CommunicationConfigRow = Awaited<ReturnType<typeof db.getCommunicationConfig>>;

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

  const communicationConfig = await db.getCommunicationConfig(session.clientId);
  const client = await db.getClient(session.clientId);
  
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
    const preferences = draft.preferences ?? db.getDefaultCommunicationPreferences();
    
    if (!lvCustomer) {
      lvCustomer = await db.createCustomer(session.clientId, {
        email: draft.customer.email,
        firstName: draft.customer.firstName,
        lastName: draft.customer.lastName,
        phone: draft.customer.phone || null,
        crmId: draft.customer.crmId,
      });
    }
    
    await db.upsertCommunicationPreferences(lvCustomer.id, preferences);
    
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
    if (
      loyalty &&
      loyalty.initial_points_bonus &&
      loyalty.initial_points_bonus > 0 &&
      typeof provider.preloadTierBonusPoints === 'function'
    ) {
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
    
    if (communicationConfig) {
      const providerData = (communicationConfig.provider_data ?? null) as unknown as KlaviyoProviderData | null;
      const providerKey = communicationConfig.email_provider?.toLowerCase();
      if (providerKey === 'klaviyo') {
        await triggerKlaviyoClubSignup({
          clientId: session.clientId,
          clientName: client?.org_name ?? null,
          communicationConfig,
          providerData,
          preferences,
          customer: {
            email: draft.customer.email,
            firstName: draft.customer.firstName,
            lastName: draft.customer.lastName,
            phone: draft.customer.phone ?? null,
            crmId: draft.customer.crmId,
          },
          lvCustomerId: lvCustomer.id,
          crmMembershipId: crmMembership.id || null,
          tier: {
            id: draft.tier.id,
            name: draft.tier.name,
            durationMonths: draft.tier.durationMonths,
            minPurchaseAmount: draft.tier.minPurchaseAmount,
          },
          enrollmentDate,
          expirationDate,
          purchaseAmount: draft.tier.purchaseAmount,
        });
      } else if (providerKey === 'mailchimp') {
        await triggerMailchimpClubSignup({
          clientId: session.clientId,
          clientName: client?.org_name ?? null,
          communicationConfig,
          preferences,
          customer: {
            email: draft.customer.email,
            firstName: draft.customer.firstName,
            lastName: draft.customer.lastName,
            crmId: draft.customer.crmId,
          },
          lvCustomerId: lvCustomer.id,
          crmMembershipId: crmMembership.id || null,
          tier: {
            id: draft.tier.id,
            name: draft.tier.name,
            durationMonths: draft.tier.durationMonths,
            minPurchaseAmount: draft.tier.minPurchaseAmount,
          },
          enrollmentDate,
          expirationDate,
        });
      } else {
        try {
          await sendSendGridWelcomeEmail({
            clientId: session.clientId,
            clientName: client?.org_name ?? null,
            communicationConfig,
            preferences,
            customer: {
              email: draft.customer.email,
              firstName: draft.customer.firstName,
              lastName: draft.customer.lastName,
            },
            tier: {
              name: draft.tier.name,
              durationMonths: draft.tier.durationMonths,
              minPurchaseAmount: draft.tier.minPurchaseAmount,
            },
            enrollmentDate,
            expirationDate,
          });
        } catch (error) {
          console.warn('SendGrid welcome email failed:', error);
        }
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

async function triggerKlaviyoClubSignup(options: {
  clientId: string;
  clientName?: string | null;
  communicationConfig: CommunicationConfigRow;
  providerData: KlaviyoProviderData | null;
  preferences: CommunicationPreferences;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    crmId: string;
  };
  lvCustomerId: string;
  crmMembershipId: string | null;
  tier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  enrollmentDate: Date;
  expirationDate: Date;
  purchaseAmount?: number;
}): Promise<void> {
  const { communicationConfig } = options;

  if (!communicationConfig || communicationConfig.email_provider !== 'klaviyo') {
    return;
  }

  if (options.preferences.unsubscribedAll) {
    console.info('Skipping Klaviyo ClubSignup event: member unsubscribed from all communications.');
    return;
  }

  const apiKey = communicationConfig.email_api_key ?? process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    console.warn('Klaviyo ClubSignup skipped: missing API key.');
    return;
  }

  if (!options.providerData?.metrics?.CLUB_SIGNUP?.id) {
    console.warn('Klaviyo provider data missing ClubSignup metric id; sending event anyway.');
  }

  const provider = new KlaviyoProvider({
    apiKey,
    defaultFromEmail: communicationConfig.email_from_address ?? undefined,
    defaultFromName: communicationConfig.email_from_name ?? undefined,
  });

  const wineryName = options.clientName ?? undefined;
  const profileProperties: Record<string, unknown> = {
    client_id: options.clientId,
    winery_name: wineryName,
    libero_member: true,
    membership_status: 'active',
    membership_started_at: options.enrollmentDate.toISOString(),
    membership_expires_at: options.expirationDate.toISOString(),
    tier_id: options.tier.id,
    tier_name: options.tier.name,
    tier_duration_months: options.tier.durationMonths,
    tier_min_purchase_amount: options.tier.minPurchaseAmount,
    communication_preferences: options.preferences,
    include_marketing_flows: options.providerData?.includeMarketing ?? false,
    seeded_at: options.providerData?.seededAt ?? null,
  };

  if (options.purchaseAmount !== undefined) {
    profileProperties.tier_purchase_amount = options.purchaseAmount;
  }

  const eventProperties = {
    ...profileProperties,
    lv_customer_id: options.lvCustomerId,
    crm_customer_id: options.customer.crmId,
    crm_membership_id: options.crmMembershipId,
    signup_channel: 'sales-associate',
    flow_id: options.providerData?.flows?.CLUB_SIGNUP?.id ?? null,
    metric_id: options.providerData?.metrics?.CLUB_SIGNUP?.id ?? null,
  };

  try {
    await provider.updateProfile({
      email: options.customer.email,
      phone: options.customer.phone || undefined,
      firstName: options.customer.firstName,
      lastName: options.customer.lastName,
      properties: profileProperties,
    });

    await provider.trackEvent({
      event: KLAVIYO_METRICS.CLUB_SIGNUP,
      customer: {
        email: options.customer.email,
        phone: options.customer.phone || undefined,
        id: options.customer.crmId,
        properties: {
          membership_status: 'active',
          membership_expires_at: options.expirationDate.toISOString(),
          tier_name: options.tier.name,
          communication_preferences: options.preferences,
        },
      },
      properties: eventProperties,
      time: options.enrollmentDate.toISOString(),
    });

    console.info('Klaviyo ClubSignup event sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
    });
  } catch (error) {
    console.warn('Klaviyo ClubSignup trigger failed:', error);
  }
}

async function triggerMailchimpClubSignup(options: {
  clientId: string;
  clientName?: string | null;
  communicationConfig: CommunicationConfigRow;
  preferences: CommunicationPreferences;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    crmId: string;
  };
  lvCustomerId: string;
  crmMembershipId: string | null;
  tier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  enrollmentDate: Date;
  expirationDate: Date;
}): Promise<void> {
  if (!options.communicationConfig || options.communicationConfig.email_provider !== 'mailchimp') {
    return;
  }

  if (options.preferences.unsubscribedAll) {
    console.info('Skipping Mailchimp ClubSignup event: member unsubscribed from all communications.');
    return;
  }

  const membershipProps = {
    client_id: options.clientId,
    client_name: options.clientName ?? undefined,
    membership_status: 'active',
    membership_started_at: options.enrollmentDate.toISOString(),
    membership_expires_at: options.expirationDate.toISOString(),
    tier_id: options.tier.id,
    tier_name: options.tier.name,
    tier_duration_months: options.tier.durationMonths,
    tier_min_purchase_amount: options.tier.minPurchaseAmount,
    communication_preferences: options.preferences,
    lv_customer_id: options.lvCustomerId,
    crm_membership_id: options.crmMembershipId,
  };

  try {
    await trackClientEvent(options.clientId, {
      event: MAILCHIMP_TAGS.CLUB_SIGNUP,
      customer: {
        email: options.customer.email,
        id: options.customer.crmId,
        properties: {
          first_name: options.customer.firstName,
          last_name: options.customer.lastName,
          ...membershipProps,
        },
      },
      properties: {
        ...membershipProps,
        signup_channel: 'sales-associate',
        source: 'LiberoVino::ClubSignup',
      },
      time: options.enrollmentDate.toISOString(),
    });

    console.info('Mailchimp ClubSignup event sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
    });
  } catch (error) {
    console.warn('Mailchimp ClubSignup trigger failed:', error);
  }
}

async function sendSendGridWelcomeEmail(options: {
  clientId: string;
  clientName?: string | null;
  communicationConfig: CommunicationConfigRow;
  preferences: CommunicationPreferences;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
  };
  tier: {
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  enrollmentDate: Date;
  expirationDate: Date;
}): Promise<void> {
  if (options.preferences.unsubscribedAll) {
    return;
  }

  const subject = `${options.clientName ?? 'Your winery'} – Membership Confirmed`;
  const expirationFormatted = options.expirationDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `<!doctype html>
    <html lang="en">
      <body style="font-family: Helvetica, Arial, sans-serif; color: #202124;">
        <h1 style="font-size:22px;">Welcome to ${options.clientName ?? 'LiberoVino'}!</h1>
        <p>Hi ${options.customer.firstName},</p>
        <p>Thanks for joining the ${options.tier.name} tier. We’ve confirmed your membership and logged it in your account.</p>
        <ul>
          <li><strong>Tier duration:</strong> ${options.tier.durationMonths} months</li>
          <li><strong>Minimum purchase commitment:</strong> $${options.tier.minPurchaseAmount.toFixed(2)}</li>
          <li><strong>Membership duration ends:</strong> ${expirationFormatted}</li>
        </ul>
        <p>You’re in control—shop when you’re ready and keep an eye on your inbox for monthly status updates.</p>
        <p style="margin-top:24px;">Cheers,<br/>${options.clientName ?? 'The LiberoVino Team'}</p>
      </body>
    </html>`;

  const text = `Welcome to ${options.clientName ?? 'LiberoVino'}!

Hi ${options.customer.firstName},

Thanks for joining the ${options.tier.name} tier. Your membership is active and will run for ${options.tier.durationMonths} months.

• Minimum purchase commitment: $${options.tier.minPurchaseAmount.toFixed(2)}
• Membership duration ends: ${expirationFormatted}

Shop when you’re ready and watch for future status updates.

Cheers,
${options.clientName ?? 'The LiberoVino Team'}`;

  await sendClientEmail(options.clientId, {
    to: options.customer.email,
    toName: `${options.customer.firstName} ${options.customer.lastName}`,
    subject,
    html,
    text,
    tags: ['membership', 'welcome'],
  });
}

export default function ReviewAndEnroll() {
  const { draft, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  return (
    <Page title="Review & Complete Enrollment">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Banners at Top */}
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
          
          {!draft.paymentVerified && (
            <Banner tone="warning" title="Payment details missing">
              Add or select a payment method before enrolling the member.
            </Banner>
          )}
          
          {draft.paymentVerified && draft.payment && (
            <BlockStack gap="200">
              <Text variant="bodyMd" as="p">
                <strong>{draft.payment.brand || 'Card'} •••• {draft.payment.last4}</strong>
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Expires {draft.payment.expiryMonth}/{draft.payment.expiryYear}
              </Text>
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      {/* Communication Preferences */}
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h3">
              Communication Preferences
            </Text>
            <Button
              variant="plain"
              onClick={() => navigate(addSessionToUrl('/app/members/new/customer', session.id))}
            >
              Edit
            </Button>
          </InlineStack>

          {!draft.preferences && (
            <Banner tone="info" title="Preferences not captured">
              Set the member's communication preferences before completing enrollment.
            </Banner>
          )}

          {draft.preferences && (
            <BlockStack gap="300">
              {draft.preferences.unsubscribedAll && (
                <Banner tone="critical" title="Member unsubscribed">
                  All email and SMS communications are disabled.
                </Banner>
              )}

              <BlockStack gap="200">
                <Text variant="headingSm" as="h4">
                  Email
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Monthly status: {draft.preferences.emailMonthlyStatus ? 'On' : 'Off'}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Duration reminders: {draft.preferences.emailExpirationWarnings ? 'On' : 'Off'}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Promotions: {draft.preferences.emailPromotions ? 'On' : 'Off'}
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <Text variant="headingSm" as="h4">
                  SMS
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Monthly status: {draft.preferences.smsMonthlyStatus ? 'On' : 'Off'}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Duration reminders: {draft.preferences.smsExpirationWarnings ? 'On' : 'Off'}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Promotions: {draft.preferences.smsPromotions ? 'On' : 'Off'}
                </Text>
              </BlockStack>
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

