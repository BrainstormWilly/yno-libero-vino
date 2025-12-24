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
import { crmManager, getPromotion } from '~/lib/crm/index.server';
import type { AppSessionData } from '~/lib/session-storage.server';
import { addSessionToUrl } from '~/util/session';
import { KLAVIYO_METRICS } from '~/lib/communication/klaviyo.constants';
import { MAILCHIMP_TAGS } from '~/lib/communication/mailchimp.constants';
import { KlaviyoProvider } from '~/lib/communication/providers/klaviyo.server';
import type { KlaviyoProviderData } from '~/types/communication-klaviyo';
import type { CommunicationPreferences } from '~/lib/communication/preferences';
import { sendClientEmail, sendClientSMS, trackClientEvent } from '~/lib/communication/communication.service.server';
import { flattenSMSOptInProperties } from '~/lib/communication/preferences';

type CommunicationConfigRow = Awaited<ReturnType<typeof db.getCommunicationConfig>>;

/**
 * Get the shop/store URL for a client based on their CRM type
 * Uses stored website_url if available, otherwise constructs from tenant_shop
 * For Commerce7: Uses organization-website from install payload if stored, otherwise constructs URL
 * For Shopify: Uses tenant_shop directly (which is the shop domain)
 */
function getShopUrl(client: { crm_type: string; tenant_shop: string; website_url?: string | null } | null): string {
  if (!client) {
    return 'https://example.com'; // Fallback
  }

  // If website_url is stored, use it (this comes from organization-website for Commerce7)
  if (client.website_url) {
    return client.website_url;
  }

  // Fallback to constructed URLs if website_url is not stored
  if (client.crm_type === 'commerce7') {
    // Commerce7: tenant_shop is the tenant identifier
    // Customer-facing storefront is typically at: https://{tenant}.commerce7.com
    return `https://${client.tenant_shop}.commerce7.com`;
  } else if (client.crm_type === 'shopify') {
    // Shopify: tenant_shop is the shop domain (e.g., "mystore.myshopify.com")
    return `https://${client.tenant_shop}`;
  }

  return 'https://example.com'; // Fallback
}

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
    if (!tier) {
      return {
        success: false,
        error: 'Invalid tier',
      };
    }
    
    // For Commerce7, validate club is synced
    if (session.crmType === 'commerce7' && !tier.c7_club_id) {
      return {
        success: false,
        error: 'Tier not synced with CRM',
      };
    }
    
    // Validate we have all required IDs for Commerce7
    if (session.crmType === 'commerce7' && (!draft.customer.billingAddressId || !draft.customer.shippingAddressId || !draft.customer.paymentMethodId)) {
      return {
        success: false,
        error: 'Missing required address or payment information',
      };
    }
    
    // Calculate enrollment dates
    const enrollmentDate = new Date();
    const expirationDate = new Date(enrollmentDate);
    expirationDate.setMonth(expirationDate.getMonth() + tier.duration_months);
    
    // Create/update customer in LV database first
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
    
    // Mark SMS opt-in via signup form (form checkbox is sufficient TCPA consent)
    // No need to send separate opt-in request SMS - consent is given via form
    const updatedPreferences: CommunicationPreferences = {
      ...preferences,
      smsOptedInAt: preferences.smsOptedInAt || new Date().toISOString(),
      smsOptInMethod: 'signup_form',
      smsOptInSource: '/app/members/new',
    };
    await db.upsertCommunicationPreferences(lvCustomer.id, updatedPreferences);
    
    // Sync to CRM FIRST - MUST succeed before creating enrollment
    // If CRM sync fails, enrollment fails (customer won't get discount otherwise)
    let crmMembershipId: string | null = null;
    
    if (session.crmType === 'commerce7' && tier.c7_club_id) {
      // Commerce7: Create club membership (must succeed)
      const crmMembership = await provider.createClubMembership({
        customerId: draft.customer.crmId,
        clubId: tier.c7_club_id,
        billingAddressId: draft.customer.billingAddressId!,
        shippingAddressId: draft.customer.shippingAddressId!,
        paymentMethodId: draft.customer.paymentMethodId!,
        startDate: enrollmentDate.toISOString(),
      });
      
      crmMembershipId = crmMembership.id || null;
    } else if (session.crmType === 'shopify') {
      // Shopify: Add customer to promotions (must succeed)
      // TODO: Implement Shopify promotion assignment
      throw new Error('Shopify enrollment not yet implemented');
    }
    
    // Create enrollment record in our DB after CRM sync succeeds
    const enrollment = await db.createClubEnrollment({
      customerId: lvCustomer.id,
      clubStageId: draft.tier.id,
      status: 'active',
      enrolledAt: enrollmentDate.toISOString(),
      expiresAt: expirationDate.toISOString(),
      crmMembershipId: crmMembershipId,
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
          preferences: updatedPreferences, // Use updated preferences with SMS opt-in info
          customer: {
            email: draft.customer.email,
            firstName: draft.customer.firstName,
            lastName: draft.customer.lastName,
            phone: draft.customer.phone ?? null,
            crmId: draft.customer.crmId,
            birthdate: draft.customer.birthdate || "1900-01-01", // Required for wine sales and Klaviyo SMS age-gating
          },
          lvCustomerId: lvCustomer.id,
          crmMembershipId: crmMembershipId,
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
          crmMembershipId: crmMembershipId,
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
            preferences: updatedPreferences,
            customer: {
              email: draft.customer.email,
              firstName: draft.customer.firstName,
              lastName: draft.customer.lastName,
              phone: draft.customer.phone ?? null,
            },
            tier: {
              name: draft.tier.name,
              durationMonths: draft.tier.durationMonths,
              minPurchaseAmount: draft.tier.minPurchaseAmount,
            },
            enrollmentDate,
            expirationDate,
            shopUrl: getShopUrl(client),
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
    birthdate: string; // Required for wine sales and Klaviyo SMS age-gating
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

  // Fetch additional data needed for template variables
  const supabase = db.getSupabaseClient();
  const client = await db.getClient(options.clientId);
  
  const [customerData, tierDetails, promotions, nextTier] = await Promise.all([
    supabase
      .from('customers')
      .select('loyalty_points_balance')
      .eq('id', options.lvCustomerId)
      .maybeSingle(),
    db.getClubStageWithDetails(options.tier.id),
    db.getStagePromotions(options.tier.id),
    // Get next tier if current tier has stage_order
    (async () => {
      const currentTier = await db.getClubStageWithDetails(options.tier.id);
      if (!currentTier?.club_program_id || currentTier.stage_order === null) {
        return null;
      }
      const { data: nextTierData } = await supabase
        .from('club_stages')
        .select('id, name, min_purchase_amount, stage_order')
        .eq('club_program_id', currentTier.club_program_id)
        .eq('is_active', true)
        .gt('stage_order', currentTier.stage_order)
        .order('stage_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      return nextTierData;
    })(),
  ]);

  const customer = customerData?.data || null;

  // Calculate days remaining
  const now = new Date();
  const daysRemaining = Math.ceil((options.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // Get discount percentage from first percentage-based promotion
  let discountPercentage = 0;
  if (client && client.crm_type === 'commerce7' && client.tenant_shop && promotions.length > 0) {
    try {
      // Fetch the first promotion's details from Commerce7
      const firstPromo = promotions[0];
      if (firstPromo.crm_type === 'commerce7') {
        const session = { crmType: client.crm_type, tenantShop: client.tenant_shop } as AppSessionData;
        const discount = await getPromotion(session, firstPromo.crm_id);
        if (discount.value.type === 'percentage' && discount.value.percentage !== undefined) {
          discountPercentage = discount.value.percentage;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch discount from Commerce7 promotion:', error);
      // Fall back to 0 if fetch fails
    }
  }

  const wineryName = options.clientName ?? undefined;
  const shopUrl = getShopUrl(client);
  
  const profileProperties: Record<string, unknown> = {
    client_id: options.clientId,
    winery_name: wineryName,
    shop_url: shopUrl,
    libero_member: true,
    membership_status: 'active',
    membership_started_at: options.enrollmentDate.toISOString(),
    membership_expires_at: options.expirationDate.toISOString(),
    tier_id: options.tier.id,
    tier_name: options.tier.name,
    current_stage: options.tier.name, // Alias for template compatibility
    tier_duration_months: options.tier.durationMonths,
    tier_min_purchase_amount: options.tier.minPurchaseAmount,
    min_purchase_amount: options.tier.minPurchaseAmount, // Alias for template
    discount_percentage: discountPercentage, // Fetched from Commerce7 promotions
    days_remaining: daysRemaining,
    points_balance: customer?.loyalty_points_balance ?? 0,
    communication_preferences: options.preferences,
    include_marketing_flows: options.providerData?.includeMarketing ?? false,
    seeded_at: options.providerData?.seededAt ?? null,
    // Flattened SMS opt-in properties (for Klaviyo conditional splits)
    ...flattenSMSOptInProperties(options.preferences),
  };

  if (options.purchaseAmount !== undefined) {
    profileProperties.tier_purchase_amount = options.purchaseAmount;
  }

  // Add next tier info if available
  let nextTierDiscount = 0;
  if (nextTier && client && client.crm_type === 'commerce7' && client.tenant_shop) {
    try {
      const nextTierPromotions = await db.getStagePromotions(nextTier.id);
      if (nextTierPromotions.length > 0) {
        const firstNextPromo = nextTierPromotions[0];
        if (firstNextPromo.crm_type === 'commerce7') {
          const session = { crmType: client.crm_type, tenantShop: client.tenant_shop } as AppSessionData;
          const discount = await getPromotion(session, firstNextPromo.crm_id);
          if (discount.value.type === 'percentage' && discount.value.percentage !== undefined) {
            nextTierDiscount = discount.value.percentage;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to fetch next tier discount from Commerce7 promotion:', error);
      // Fall back to 0 if fetch fails
    }
  }
  
  if (nextTier) {
    profileProperties.next_stage = nextTier.name;
    profileProperties.next_stage_amount = nextTier.min_purchase_amount;
    profileProperties.next_stage_discount = nextTierDiscount;
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
    // Update/create profile and get profile ID
    const profileId = await provider.updateProfile({
      email: options.customer.email,
      phone: options.customer.phone || undefined,
      firstName: options.customer.firstName,
      lastName: options.customer.lastName,
      properties: profileProperties,
      externalId: options.customer.crmId, // Use CRM customer ID to help Klaviyo merge profiles
    });

    // Subscribe profile to email and SMS - required for flows to send
    // Note: Klaviyo email API only supports 'marketing' subscription
    // We use 'marketing' even for transactional flows to enable email sending
    if (profileId && provider instanceof KlaviyoProvider) {
      // Subscribe to SMS if transactional or marketing is enabled
      const smsChannels: ('transactional' | 'marketing')[] = [];
      if (options.preferences.smsTransactional) {
        smsChannels.push('transactional');
      }
      if (options.preferences.smsMarketing) {
        smsChannels.push('marketing');
      }
      const shouldSubscribeSMS = options.customer.phone && smsChannels.length > 0;
      
      // Format birthdate as YYYY-MM-DD - required for wine sales and Klaviyo SMS age-gating
      if (!options.customer.birthdate) {
        throw new Error('Birthdate is required for wine sales but was not provided');
      }
      const date = new Date(options.customer.birthdate);
      const birthdate = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Use actual SMS opt-in timestamp if available, otherwise let the method use default
      // The subscribeProfileToChannels method will:
      // - Use the provided timestamp if it's > 1 day old (historical import)
      // - Otherwise use 5 seconds ago for real-time enrollments (ensures it's after profile creation)
      const consentedAt: string | undefined = options.preferences.smsOptedInAt || undefined; // Use actual opt-in timestamp if available
      
      await provider.subscribeProfileToChannels({
        profileId,
        email: options.customer.email,
        phoneNumber: options.customer.phone || undefined,
        birthdate,
        emailChannel: 'marketing', // Use 'marketing' to enable email sending (even for transactional flows)
        sms: shouldSubscribeSMS ? smsChannels : undefined, // Subscribe to requested SMS channels
        consentedAt, // Use actual opt-in timestamp if available, otherwise method uses real-time default
      });
    }

    // Log template variables for debugging
    console.info('Klaviyo ClubSignup - Template variables being sent:', {
      current_stage: profileProperties.current_stage,
      days_remaining: profileProperties.days_remaining,
      discount_percentage: profileProperties.discount_percentage,
      points_balance: profileProperties.points_balance,
      next_stage: profileProperties.next_stage,
      tier_name: profileProperties.tier_name,
      membership_expires_at: options.expirationDate.toISOString(),
      sms_opted_in_at: flattenSMSOptInProperties(options.preferences).sms_opted_in_at,
      sms_opt_in_method: flattenSMSOptInProperties(options.preferences).sms_opt_in_method,
      sms_opt_in_confirmed_at: flattenSMSOptInProperties(options.preferences).sms_opt_in_confirmed_at,
    });

    await provider.trackEvent({
      event: KLAVIYO_METRICS.CLUB_SIGNUP,
      customer: {
        email: options.customer.email,
        phone: options.customer.phone || undefined,
        id: options.customer.crmId,
        firstName: options.customer.firstName,
        lastName: options.customer.lastName,
        // Put ALL template variables in customer.properties so they're stored on the profile
        // This ensures templates can access them even if updateProfile fails
        properties: {
          ...profileProperties, // Include all profile properties (template variables, SMS props, etc.)
          membership_status: 'active',
          membership_expires_at: options.expirationDate.toISOString(),
        },
      },
      properties: eventProperties, // Event-level properties for flow logic (templates can access these too)
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
    phone?: string | null;
  };
  tier: {
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  enrollmentDate: Date;
  expirationDate: Date;
  shopUrl: string;
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
        <p>Thanks for joining the ${options.tier.name} tier. We've confirmed your membership and logged it in your account.</p>
        <ul>
          <li><strong>Tier duration:</strong> ${options.tier.durationMonths} months</li>
          <li><strong>Minimum purchase commitment:</strong> $${options.tier.minPurchaseAmount.toFixed(2)}</li>
          <li><strong>Membership duration ends:</strong> ${expirationFormatted}</li>
        </ul>
        <p>You're in control—shop when you're ready and keep an eye on your inbox for monthly status updates.</p>
        <p style="margin-top:24px;">Cheers,<br/>${options.clientName ?? 'The LiberoVino Team'}</p>
      </body>
    </html>`;

  const text = `Welcome to ${options.clientName ?? 'LiberoVino'}!

Hi ${options.customer.firstName},

Thanks for joining the ${options.tier.name} tier. Your membership is active and will run for ${options.tier.durationMonths} months.

• Minimum purchase commitment: $${options.tier.minPurchaseAmount.toFixed(2)}
• Membership duration ends: ${expirationFormatted}

Shop when you're ready and watch for future status updates.

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

  // Send SMS if customer has phone and SMS preferences enabled
  if (
    options.customer.phone &&
    (options.preferences.smsTransactional || options.preferences.smsMarketing)
  ) {
    try {
      const smsMessage = `Hi ${options.customer.firstName}! Your ${options.clientName ?? 'LiberoVino'} ${options.tier.name} membership is live! You choose what ships and when. Shop: ${options.shopUrl} Reply STOP to opt out. Msg & data rates may apply.`;

      await sendClientSMS(options.clientId, {
        to: options.customer.phone,
        message: smsMessage,
        tags: ['membership', 'welcome', 'club-signup'],
      });

      console.info(`Club signup SMS sent to ${options.customer.phone} for customer ${options.customer.email}`);
    } catch (error) {
      // Log but don't fail enrollment if SMS fails
      console.warn(`Failed to send club signup SMS to ${options.customer.phone}:`, error);
    }
  }
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
                  Marketing: {(draft.preferences.emailMarketing ?? false) ? 'On' : 'Off'}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Transactional emails (monthly status, expiration warnings) are automatic
                </Text>
              </BlockStack>

              <Divider />

              <BlockStack gap="200">
                <Text variant="headingSm" as="h4">
                  SMS
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Transactional: {(draft.preferences.smsTransactional ?? false) ? 'On' : 'Off'}
                </Text>
                <Text variant="bodySm" as="p" tone="subdued">
                  Marketing: {(draft.preferences.smsMarketing ?? false) ? 'On' : 'Off'}
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
              All information has been verified. Please confirm the member's information and communication preferences are correct before completing enrollment.
            </Text>
            
            <Banner tone="info">
              <BlockStack gap="200">
                <Text variant="bodyMd" as="p">
                  By completing enrollment, you confirm that:
                </Text>
                <BlockStack gap="100">
                  <Text variant="bodySm" as="p">
                    • All customer information is accurate
                  </Text>
                  <Text variant="bodySm" as="p">
                    • The customer has provided consent for the selected communication preferences
                  </Text>
                  <Text variant="bodySm" as="p">
                    • Age verification is complete (required for wine club membership)
                  </Text>
                </BlockStack>
              </BlockStack>
            </Banner>
            
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

