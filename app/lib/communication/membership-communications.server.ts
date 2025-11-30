/**
 * Communication helpers for membership lifecycle events
 * Handles expiration and upgrade notifications
 */

import * as db from '~/lib/db/supabase.server';
import { getSupabaseClient } from '~/lib/db/supabase.server';
import { KLAVIYO_METRICS } from './klaviyo.constants';
import { MAILCHIMP_TAGS } from './mailchimp.constants';
import { sendClientEmail, trackClientEvent } from './communication.service.server';
import { KlaviyoProvider } from './providers/klaviyo.server';
import type { KlaviyoProviderData } from '~/types/communication-klaviyo';
import type { CommunicationPreferences } from './preferences';

type CommunicationConfigRow = Awaited<ReturnType<typeof db.getCommunicationConfig>>;

/**
 * Send expiration notification to customer
 * Called after successful membership cancellation in CRM
 */
export async function sendExpirationNotification(
  clientId: string,
  customerCrmId: string,
  stageId: string
): Promise<void> {
  try {
    // Get communication config
    const communicationConfig = await db.getCommunicationConfig(clientId);
    if (!communicationConfig) {
      console.info('No communication config found for client, skipping expiration notification');
      return;
    }

    // Get customer and enrollment data
    const customer = await db.getCustomerByCrmId(clientId, customerCrmId);
    if (!customer) {
      console.warn(`Customer not found for CRM ID ${customerCrmId}, skipping expiration notification`);
      return;
    }

    // Get preferences
    const preferences = await db.getCommunicationPreferences(customer.id);
    if (preferences.unsubscribedAll) {
      console.info(`Customer ${customer.id} unsubscribed from all communications, skipping expiration notification`);
      return;
    }

    // Get enrollment and tier data
    // Use getEnrollmentById if we have enrollment_id, otherwise query directly
    const supabase = getSupabaseClient();
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from('club_enrollments')
      .select(`
        *,
        club_stages!inner (
          id,
          name,
          duration_months,
          min_purchase_amount
        )
      `)
      .eq('customer_id', customer.id)
      .eq('club_stage_id', stageId)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollmentError || !enrollmentData) {
      console.warn(`Enrollment not found for customer ${customer.id} and stage ${stageId}, skipping expiration notification`);
      return;
    }

    // Supabase returns nested relation as object (not array) when using .single() or .maybeSingle()
    const enrollment = enrollmentData as any;
    const tier = enrollment.club_stages;
    
    if (!tier) {
      console.warn(`Tier not found for enrollment, skipping expiration notification`);
      return;
    }
    const client = await db.getClient(clientId);

    // Send based on provider
    const providerKey = communicationConfig.email_provider?.toLowerCase();
    
    if (providerKey === 'klaviyo') {
      await triggerKlaviyoExpiration({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        providerData: (communicationConfig.provider_data ?? null) as unknown as KlaviyoProviderData | null,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
          phone: customer.phone,
          crmId: customer.crm_id ?? '',
        },
        lvCustomerId: customer.id,
        tier: {
          id: tier.id,
          name: tier.name,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
        },
        expirationDate: new Date(enrollment.expires_at ?? new Date()),
      });
    } else if (providerKey === 'mailchimp') {
      await triggerMailchimpExpiration({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
          crmId: customer.crm_id ?? '',
        },
        lvCustomerId: customer.id,
        tier: {
          id: tier.id,
          name: tier.name,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
        },
        expirationDate: new Date(enrollment.expires_at ?? new Date()),
      });
    } else if (providerKey === 'sendgrid') {
      await triggerSendGridExpiration({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
        },
        tier: {
          id: tier.id,
          name: tier.name,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
        },
        expirationDate: new Date(enrollment.expires_at ?? new Date()),
      });
    }
  } catch (error) {
    console.error('Error sending expiration notification:', error);
    // Don't throw - communication failures shouldn't break the sync process
  }
}

/**
 * Send tier upgrade notification to customer
 * Called after successful tier upgrade in CRM
 */
export async function sendUpgradeNotification(
  clientId: string,
  customerCrmId: string,
  oldStageId: string,
  newStageId: string
): Promise<void> {
  try {
    // Get communication config
    const communicationConfig = await db.getCommunicationConfig(clientId);
    if (!communicationConfig) {
      console.info('No communication config found for client, skipping upgrade notification');
      return;
    }

    // Get customer data
    const customer = await db.getCustomerByCrmId(clientId, customerCrmId);
    if (!customer) {
      console.warn(`Customer not found for CRM ID ${customerCrmId}, skipping upgrade notification`);
      return;
    }

    // Get preferences
    const preferences = await db.getCommunicationPreferences(customer.id);
    if (preferences.unsubscribedAll) {
      console.info(`Customer ${customer.id} unsubscribed from all communications, skipping upgrade notification`);
      return;
    }

    // Get old and new tier data
    const supabase = getSupabaseClient();
    const { data: oldTier } = await supabase
      .from('club_stages')
      .select('*')
      .eq('id', oldStageId)
      .single();

    const { data: newTier } = await supabase
      .from('club_stages')
      .select('*')
      .eq('id', newStageId)
      .single();

    if (!oldTier || !newTier) {
      console.warn(`Tiers not found (old: ${oldStageId}, new: ${newStageId}), skipping upgrade notification`);
      return;
    }

    // Get new enrollment data
    const { data: enrollment } = await supabase
      .from('club_enrollments')
      .select('*')
      .eq('customer_id', customer.id)
      .eq('club_stage_id', newStageId)
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .single();

    if (!enrollment) {
      console.warn(`New enrollment not found for customer ${customer.id} and stage ${newStageId}, skipping upgrade notification`);
      return;
    }

    const client = await db.getClient(clientId);

    // Send based on provider
    const providerKey = communicationConfig.email_provider?.toLowerCase();
    
    if (providerKey === 'klaviyo') {
      await triggerKlaviyoUpgrade({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        providerData: (communicationConfig.provider_data ?? null) as unknown as KlaviyoProviderData | null,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
          phone: customer.phone,
          crmId: customer.crm_id ?? '',
        },
        lvCustomerId: customer.id,
        oldTier: {
          id: oldTier.id,
          name: oldTier.name,
          durationMonths: oldTier.duration_months,
          minPurchaseAmount: oldTier.min_purchase_amount,
        },
        newTier: {
          id: newTier.id,
          name: newTier.name,
          durationMonths: newTier.duration_months,
          minPurchaseAmount: newTier.min_purchase_amount,
        },
        enrollmentDate: new Date(enrollment.enrolled_at),
        expirationDate: new Date(enrollment.expires_at),
      });
    } else if (providerKey === 'mailchimp') {
      await triggerMailchimpUpgrade({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
          crmId: customer.crm_id ?? '',
        },
        lvCustomerId: customer.id,
        oldTier: {
          id: oldTier.id,
          name: oldTier.name,
          durationMonths: oldTier.duration_months,
          minPurchaseAmount: oldTier.min_purchase_amount,
        },
        newTier: {
          id: newTier.id,
          name: newTier.name,
          durationMonths: newTier.duration_months,
          minPurchaseAmount: newTier.min_purchase_amount,
        },
        enrollmentDate: new Date(enrollment.enrolled_at),
        expirationDate: new Date(enrollment.expires_at),
      });
    } else if (providerKey === 'sendgrid') {
      await triggerSendGridUpgrade({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
        },
        oldTier: {
          id: oldTier.id,
          name: oldTier.name,
          durationMonths: oldTier.duration_months,
          minPurchaseAmount: oldTier.min_purchase_amount,
        },
        newTier: {
          id: newTier.id,
          name: newTier.name,
          durationMonths: newTier.duration_months,
          minPurchaseAmount: newTier.min_purchase_amount,
        },
        enrollmentDate: new Date(enrollment.enrolled_at),
        expirationDate: new Date(enrollment.expires_at),
      });
    }
  } catch (error) {
    console.error('Error sending upgrade notification:', error);
    // Don't throw - communication failures shouldn't break the sync process
  }
}

// Klaviyo expiration notification
async function triggerKlaviyoExpiration(options: {
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
  tier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  expirationDate: Date;
}): Promise<void> {
  const { communicationConfig } = options;

  if (!communicationConfig || communicationConfig.email_provider !== 'klaviyo') {
    return;
  }

  if (options.preferences.unsubscribedAll || !options.preferences.emailExpirationWarnings) {
    console.info('Skipping Klaviyo expiration notification: member unsubscribed or preferences disabled.');
    return;
  }

  const apiKey = communicationConfig.email_api_key ?? process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    console.warn('Klaviyo expiration notification skipped: missing API key.');
    return;
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
    libero_member: false, // Membership expired
    membership_status: 'expired',
    tier_id: options.tier.id,
    tier_name: options.tier.name,
    communication_preferences: options.preferences,
  };

  const eventProperties = {
    ...profileProperties,
    lv_customer_id: options.lvCustomerId,
    crm_customer_id: options.customer.crmId,
    membership_expired_at: options.expirationDate.toISOString(),
    tier_min_purchase_amount: options.tier.minPurchaseAmount,
    flow_id: options.providerData?.flows?.EXPIRATION_NOTICE?.id ?? null,
    metric_id: options.providerData?.metrics?.EXPIRATION_NOTICE?.id ?? null,
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
      event: KLAVIYO_METRICS.EXPIRATION_NOTICE,
      customer: {
        email: options.customer.email,
        phone: options.customer.phone || undefined,
        id: options.customer.crmId,
        properties: {
          membership_status: 'expired',
          membership_expired_at: options.expirationDate.toISOString(),
          tier_name: options.tier.name,
        },
      },
      properties: eventProperties,
      time: new Date().toISOString(),
    });

    console.info('Klaviyo expiration notification sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
    });
  } catch (error) {
    console.warn('Klaviyo expiration notification failed:', error);
  }
}

// Mailchimp expiration notification
async function triggerMailchimpExpiration(options: {
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
  tier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  expirationDate: Date;
}): Promise<void> {
  if (!options.communicationConfig || options.communicationConfig.email_provider !== 'mailchimp') {
    return;
  }

  if (options.preferences.unsubscribedAll || !options.preferences.emailExpirationWarnings) {
    console.info('Skipping Mailchimp expiration notification: member unsubscribed or preferences disabled.');
    return;
  }

  const membershipProps = {
    client_id: options.clientId,
    client_name: options.clientName ?? undefined,
    membership_status: 'expired',
    membership_expired_at: options.expirationDate.toISOString(),
    tier_id: options.tier.id,
    tier_name: options.tier.name,
    tier_min_purchase_amount: options.tier.minPurchaseAmount,
    communication_preferences: options.preferences,
    lv_customer_id: options.lvCustomerId,
  };

  try {
    await trackClientEvent(options.clientId, {
      event: MAILCHIMP_TAGS.EXPIRATION_NOTICE,
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
        source: 'LiberoVino::ExpirationNotice',
      },
      time: new Date().toISOString(),
    });

    console.info('Mailchimp expiration notification sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
    });
  } catch (error) {
    console.warn('Mailchimp expiration notification failed:', error);
  }
}

// Klaviyo upgrade notification
async function triggerKlaviyoUpgrade(options: {
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
  oldTier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  newTier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  enrollmentDate: Date;
  expirationDate: Date;
}): Promise<void> {
  const { communicationConfig } = options;

  if (!communicationConfig || communicationConfig.email_provider !== 'klaviyo') {
    return;
  }

  if (options.preferences.unsubscribedAll) {
    console.info('Skipping Klaviyo upgrade notification: member unsubscribed from all communications.');
    return;
  }

  const apiKey = communicationConfig.email_api_key ?? process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    console.warn('Klaviyo upgrade notification skipped: missing API key.');
    return;
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
    tier_id: options.newTier.id,
    tier_name: options.newTier.name,
    tier_duration_months: options.newTier.durationMonths,
    tier_min_purchase_amount: options.newTier.minPurchaseAmount,
    communication_preferences: options.preferences,
    include_marketing_flows: options.providerData?.includeMarketing ?? false,
  };

  const eventProperties = {
    ...profileProperties,
    lv_customer_id: options.lvCustomerId,
    crm_customer_id: options.customer.crmId,
    previous_tier_id: options.oldTier.id,
    previous_tier_name: options.oldTier.name,
    upgrade_date: new Date().toISOString(),
    flow_id: options.providerData?.flows?.TIER_UPGRADE?.id ?? null,
    metric_id: options.providerData?.metrics?.TIER_UPGRADE?.id ?? null,
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
      event: KLAVIYO_METRICS.TIER_UPGRADE,
      customer: {
        email: options.customer.email,
        phone: options.customer.phone || undefined,
        id: options.customer.crmId,
        properties: {
          membership_status: 'active',
          membership_expires_at: options.expirationDate.toISOString(),
          tier_name: options.newTier.name,
          previous_tier_name: options.oldTier.name,
        },
      },
      properties: eventProperties,
      time: new Date().toISOString(),
    });

    console.info('Klaviyo upgrade notification sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
      oldTier: options.oldTier.name,
      newTier: options.newTier.name,
    });
  } catch (error) {
    console.warn('Klaviyo upgrade notification failed:', error);
  }
}

// Mailchimp upgrade notification
async function triggerMailchimpUpgrade(options: {
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
  oldTier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  newTier: {
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
    console.info('Skipping Mailchimp upgrade notification: member unsubscribed from all communications.');
    return;
  }

  const membershipProps = {
    client_id: options.clientId,
    client_name: options.clientName ?? undefined,
    membership_status: 'active',
    membership_started_at: options.enrollmentDate.toISOString(),
    membership_expires_at: options.expirationDate.toISOString(),
    tier_id: options.newTier.id,
    tier_name: options.newTier.name,
    tier_duration_months: options.newTier.durationMonths,
    tier_min_purchase_amount: options.newTier.minPurchaseAmount,
    previous_tier_id: options.oldTier.id,
    previous_tier_name: options.oldTier.name,
    upgrade_date: new Date().toISOString(),
    communication_preferences: options.preferences,
    lv_customer_id: options.lvCustomerId,
  };

  try {
    await trackClientEvent(options.clientId, {
      event: MAILCHIMP_TAGS.TIER_UPGRADE,
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
        source: 'LiberoVino::TierUpgrade',
      },
      time: new Date().toISOString(),
    });

    console.info('Mailchimp upgrade notification sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
      oldTier: options.oldTier.name,
      newTier: options.newTier.name,
    });
  } catch (error) {
    console.warn('Mailchimp upgrade notification failed:', error);
  }
}

/**
 * Send monthly status notification to a customer
 * Called by the monthly status cron job
 */
export async function sendMonthlyStatusNotification(
  clientId: string,
  customerId: string
): Promise<void> {
  try {
    // Get communication config
    const communicationConfig = await db.getCommunicationConfig(clientId);
    if (!communicationConfig) {
      console.info('No communication config found for client, skipping monthly status notification');
      return;
    }

    // Check if monthly status is enabled for this client
    if (!communicationConfig.send_monthly_status) {
      console.info(`Monthly status disabled for client ${clientId}, skipping`);
      return;
    }

    // Get customer data
    const supabase = getSupabaseClient();
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('client_id', clientId)
      .single();

    if (customerError || !customer) {
      console.warn(`Customer not found: ${customerId}, skipping monthly status notification`);
      return;
    }

    // Check if customer is an active club member
    if (!customer.is_club_member) {
      console.info(`Customer ${customerId} is not a club member, skipping monthly status notification`);
      return;
    }

    // Get preferences
    const preferences = await db.getCommunicationPreferences(customer.id);
    if (preferences.unsubscribedAll) {
      console.info(`Customer ${customer.id} unsubscribed from all communications, skipping monthly status notification`);
      return;
    }

    // Get active enrollment
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from('club_enrollments')
      .select(`
        *,
        club_stages!inner (
          id,
          name,
          duration_months,
          min_purchase_amount,
          club_program_id,
          stage_order
        )
      `)
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (enrollmentError || !enrollmentData) {
      console.warn(`No active enrollment found for customer ${customer.id}, skipping monthly status notification`);
      return;
    }

    // Handle nested structure from Supabase
    const enrollment = enrollmentData as any;
    const tier = enrollment.club_stages;

    if (!tier || !enrollment.expires_at) {
      console.warn(`Invalid enrollment data for customer ${customer.id}, skipping monthly status notification`);
      return;
    }

    // Calculate days remaining
    const expiresAt = new Date(enrollment.expires_at);
    const now = new Date();
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get client info
    const client = await db.getClient(clientId);

    // Get next tier (if upgradable)
    let nextTier = null;
    if (tier.club_program_id && tier.stage_order !== null) {
      const { data: programStages } = await supabase
        .from('club_stages')
        .select('id, name, min_purchase_amount, stage_order')
        .eq('club_program_id', tier.club_program_id)
        .eq('is_active', true)
        .order('stage_order', { ascending: true });

      if (programStages) {
        const currentStage = programStages.find(s => s.id === tier.id);
        if (currentStage && currentStage.stage_order !== null) {
          nextTier = programStages.find(s => s.stage_order !== null && s.stage_order > currentStage.stage_order);
        }
      }
    }

    // Send based on provider
    const providerKey = communicationConfig.email_provider?.toLowerCase();
    
    if (providerKey === 'klaviyo') {
      await triggerKlaviyoMonthlyStatus({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        providerData: (communicationConfig.provider_data ?? null) as unknown as KlaviyoProviderData | null,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
          phone: customer.phone,
          crmId: customer.crm_id ?? '',
        },
        lvCustomerId: customer.id,
        tier: {
          id: tier.id,
          name: tier.name,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
          discountPercentage: 0, // Discount is stored in promotions, not stages
        },
        enrollmentDate: new Date(enrollment.enrolled_at),
        expirationDate: expiresAt,
        daysRemaining,
        nextTier: nextTier ? {
          id: nextTier.id,
          name: nextTier.name,
          minPurchaseAmount: nextTier.min_purchase_amount,
          discountPercentage: 0,
        } : null,
      });
    } else if (providerKey === 'mailchimp') {
      await triggerMailchimpMonthlyStatus({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
          crmId: customer.crm_id ?? '',
        },
        lvCustomerId: customer.id,
        tier: {
          id: tier.id,
          name: tier.name,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
          discountPercentage: 0, // Discount is stored in promotions, not stages
        },
        enrollmentDate: new Date(enrollment.enrolled_at),
        expirationDate: expiresAt,
        daysRemaining,
        nextTier: nextTier ? {
          id: nextTier.id,
          name: nextTier.name,
          minPurchaseAmount: nextTier.min_purchase_amount,
          discountPercentage: 0,
        } : null,
      });
    } else if (providerKey === 'sendgrid') {
      await triggerSendGridMonthlyStatus({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
        },
        tier: {
          id: tier.id,
          name: tier.name,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
        },
        enrollmentDate: new Date(enrollment.enrolled_at),
        expirationDate: expiresAt,
        daysRemaining,
        nextTier: nextTier ? {
          id: nextTier.id,
          name: nextTier.name,
          minPurchaseAmount: nextTier.min_purchase_amount,
        } : null,
      });
    }
  } catch (error) {
    console.error('Error sending monthly status notification:', error);
    // Don't throw - communication failures shouldn't break the cron process
  }
}

/**
 * Process monthly status notifications for all active members of a client
 * Called by the cron job API endpoint
 */
export async function processMonthlyStatusForClient(clientId: string): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    // Get all active club members for this client
    const supabase = getSupabaseClient();
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id')
      .eq('client_id', clientId)
      .eq('is_club_member', true);

    if (error || !customers || customers.length === 0) {
      console.info(`No active club members found for client ${clientId}`);
      return { processed: 0, errors: 0 };
    }

    console.info(`Processing monthly status for ${customers.length} members in client ${clientId}`);

    // Process each customer
    for (const customer of customers) {
      try {
        await sendMonthlyStatusNotification(clientId, customer.id);
        processed++;
        
        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing monthly status for customer ${customer.id}:`, error);
        errors++;
      }
    }

    console.info(`Monthly status processing complete for client ${clientId}: ${processed} processed, ${errors} errors`);
  } catch (error) {
    console.error(`Error processing monthly status for client ${clientId}:`, error);
    errors++;
  }

  return { processed, errors };
}

// Klaviyo monthly status notification
async function triggerKlaviyoMonthlyStatus(options: {
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
  tier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
    discountPercentage: number;
  };
  enrollmentDate: Date;
  expirationDate: Date;
  daysRemaining: number;
  nextTier: {
    id: string;
    name: string;
    minPurchaseAmount: number;
    discountPercentage: number;
  } | null;
}): Promise<void> {
  const { communicationConfig } = options;

  if (!communicationConfig || communicationConfig.email_provider !== 'klaviyo') {
    return;
  }

  if (options.preferences.unsubscribedAll || options.preferences.emailMonthlyStatus === false) {
    console.info('Skipping Klaviyo monthly status: member unsubscribed or preferences disabled.');
    return;
  }

  const apiKey = communicationConfig.email_api_key ?? process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    console.warn('Klaviyo monthly status skipped: missing API key.');
    return;
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
    days_remaining: options.daysRemaining,
    tier_id: options.tier.id,
    tier_name: options.tier.name,
    tier_duration_months: options.tier.durationMonths,
    tier_min_purchase_amount: options.tier.minPurchaseAmount,
    tier_discount_percentage: options.tier.discountPercentage ?? 0,
    communication_preferences: options.preferences,
    include_marketing_flows: options.providerData?.includeMarketing ?? false,
  };

  if (options.nextTier) {
    profileProperties.next_tier_id = options.nextTier.id;
    profileProperties.next_tier_name = options.nextTier.name;
    profileProperties.next_tier_min_purchase_amount = options.nextTier.minPurchaseAmount;
    profileProperties.next_tier_discount_percentage = options.nextTier.discountPercentage;
  }

  const eventProperties = {
    ...profileProperties,
    lv_customer_id: options.lvCustomerId,
    crm_customer_id: options.customer.crmId,
    flow_id: options.providerData?.flows?.MONTHLY_STATUS?.id ?? null,
    metric_id: options.providerData?.metrics?.MONTHLY_STATUS?.id ?? null,
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
      event: KLAVIYO_METRICS.MONTHLY_STATUS,
      customer: {
        email: options.customer.email,
        phone: options.customer.phone || undefined,
        id: options.customer.crmId,
        properties: {
          membership_status: 'active',
          membership_expires_at: options.expirationDate.toISOString(),
          days_remaining: options.daysRemaining,
          tier_name: options.tier.name,
          tier_discount_percentage: options.tier.discountPercentage ?? 0,
        },
      },
      properties: eventProperties,
      time: new Date().toISOString(),
    });

    console.info('Klaviyo monthly status sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
      daysRemaining: options.daysRemaining,
    });
  } catch (error) {
    console.warn('Klaviyo monthly status failed:', error);
  }
}

// Mailchimp monthly status notification
async function triggerMailchimpMonthlyStatus(options: {
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
  tier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
    discountPercentage: number;
  };
  enrollmentDate: Date;
  expirationDate: Date;
  daysRemaining: number;
  nextTier: {
    id: string;
    name: string;
    minPurchaseAmount: number;
    discountPercentage: number;
  } | null;
}): Promise<void> {
  if (!options.communicationConfig || options.communicationConfig.email_provider !== 'mailchimp') {
    return;
  }

  if (options.preferences.unsubscribedAll || options.preferences.emailMonthlyStatus === false) {
    console.info('Skipping Mailchimp monthly status: member unsubscribed or preferences disabled.');
    return;
  }

  const membershipProps = {
    client_id: options.clientId,
    client_name: options.clientName ?? undefined,
    membership_status: 'active',
    membership_started_at: options.enrollmentDate.toISOString(),
    membership_expires_at: options.expirationDate.toISOString(),
    days_remaining: options.daysRemaining,
    tier_id: options.tier.id,
    tier_name: options.tier.name,
    tier_duration_months: options.tier.durationMonths,
    tier_min_purchase_amount: options.tier.minPurchaseAmount,
    tier_discount_percentage: options.tier.discountPercentage ?? 0,
    communication_preferences: options.preferences,
    lv_customer_id: options.lvCustomerId,
  };

  if (options.nextTier) {
    (membershipProps as any).next_tier_id = options.nextTier.id;
    (membershipProps as any).next_tier_name = options.nextTier.name;
    (membershipProps as any).next_tier_min_purchase_amount = options.nextTier.minPurchaseAmount;
    (membershipProps as any).next_tier_discount_percentage = options.nextTier.discountPercentage;
  }

  try {
    await trackClientEvent(options.clientId, {
      event: MAILCHIMP_TAGS.MONTHLY_STATUS,
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
        source: 'LiberoVino::MonthlyStatus',
      },
      time: new Date().toISOString(),
    });

    console.info('Mailchimp monthly status sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
      daysRemaining: options.daysRemaining,
    });
  } catch (error) {
    console.warn('Mailchimp monthly status failed:', error);
  }
}

// SendGrid monthly status notification
async function triggerSendGridMonthlyStatus(options: {
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
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  enrollmentDate: Date;
  expirationDate: Date;
  daysRemaining: number;
  nextTier: {
    id: string;
    name: string;
    minPurchaseAmount: number;
  } | null;
}): Promise<void> {
  if (!options.communicationConfig || options.communicationConfig.email_provider !== 'sendgrid') {
    return;
  }

  if (options.preferences.unsubscribedAll || options.preferences.emailMonthlyStatus === false) {
    console.info('Skipping SendGrid monthly status: member unsubscribed or preferences disabled.');
    return;
  }

  const clientName = options.clientName ?? 'Your winery';
  const expirationFormatted = options.expirationDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build status message based on days remaining
  let statusMessage = '';
  if (options.daysRemaining > 30) {
    statusMessage = `Your membership is active and valid until ${expirationFormatted}.`;
  } else if (options.daysRemaining > 0) {
    statusMessage = `⚠️ Your membership expires in ${options.daysRemaining} day${options.daysRemaining === 1 ? '' : 's'} on ${expirationFormatted}.`;
  } else {
    statusMessage = `Your membership expired on ${expirationFormatted}.`;
  }

  // Build next tier upgrade message if available
  let upgradeMessage = '';
  if (options.nextTier) {
    upgradeMessage = `
        <div style="margin-top:24px; padding:16px; background-color:#f8f9fa; border-left:4px solid #0066cc;">
          <h3 style="margin-top:0; color:#0066cc;">Upgrade to ${options.nextTier.name}!</h3>
          <p>Purchase $${options.nextTier.minPurchaseAmount.toFixed(2)} to unlock the ${options.nextTier.name} tier benefits.</p>
        </div>`;
  }

  const subject = `${clientName} – Your Monthly Membership Status`;
  
  const html = `<!doctype html>
    <html lang="en">
      <body style="font-family: Helvetica, Arial, sans-serif; color: #202124; line-height: 1.6;">
        <h1 style="font-size:22px;">Your ${clientName} Membership Status</h1>
        <p>Hi ${options.customer.firstName},</p>
        <p>Here's your monthly membership update:</p>
        <div style="margin:20px 0; padding:16px; background-color:#f8f9fa; border-radius:4px;">
          <h2 style="margin-top:0; color:#202124;">${options.tier.name} Member</h2>
          <p><strong>Status:</strong> ${statusMessage}</p>
          <ul style="margin:16px 0; padding-left:20px;">
            <li><strong>Tier duration:</strong> ${options.tier.durationMonths} months</li>
            <li><strong>Minimum purchase commitment:</strong> $${options.tier.minPurchaseAmount.toFixed(2)}</li>
            <li><strong>Days remaining:</strong> ${options.daysRemaining}</li>
          </ul>
        </div>
        ${upgradeMessage}
        <div style="margin-top:24px; padding:16px; background-color:#fff3cd; border-left:4px solid #ffc107;">
          <p style="margin:0;"><strong>Renewal reminder:</strong> To keep your discount active, purchase at least $${options.tier.minPurchaseAmount.toFixed(2)} before ${expirationFormatted}.</p>
        </div>
        <p style="margin-top:24px;">You're in control—shop when you're ready.</p>
        <p style="margin-top:24px;">Cheers,<br/>${clientName}</p>
      </body>
    </html>`;

  const text = `Your ${clientName} Membership Status

Hi ${options.customer.firstName},

Here's your monthly membership update:

${options.tier.name} Member
Status: ${statusMessage}

• Tier duration: ${options.tier.durationMonths} months
• Minimum purchase commitment: $${options.tier.minPurchaseAmount.toFixed(2)}
• Days remaining: ${options.daysRemaining}
${options.nextTier ? `
Upgrade to ${options.nextTier.name}!
Purchase $${options.nextTier.minPurchaseAmount.toFixed(2)} to unlock the ${options.nextTier.name} tier benefits.
` : ''}
Renewal reminder: To keep your discount active, purchase at least $${options.tier.minPurchaseAmount.toFixed(2)} before ${expirationFormatted}.

You're in control—shop when you're ready.

Cheers,
${clientName}`;

  try {
    await sendClientEmail(options.clientId, {
      to: options.customer.email,
      toName: `${options.customer.firstName} ${options.customer.lastName}`,
      subject,
      html,
      text,
      tags: ['membership', 'monthly-status'],
    });

    console.info('SendGrid monthly status sent', {
      clientId: options.clientId,
      email: options.customer.email,
      daysRemaining: options.daysRemaining,
    });
  } catch (error) {
    console.warn('SendGrid monthly status failed:', error);
  }
}

// SendGrid expiration notification
async function triggerSendGridExpiration(options: {
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
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  expirationDate: Date;
}): Promise<void> {
  if (!options.communicationConfig || options.communicationConfig.email_provider !== 'sendgrid') {
    return;
  }

  if (options.preferences.unsubscribedAll || options.preferences.emailExpirationWarnings === false) {
    console.info('Skipping SendGrid expiration notification: member unsubscribed or preferences disabled.');
    return;
  }

  const clientName = options.clientName ?? 'Your winery';
  const expirationFormatted = options.expirationDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `${clientName} – Membership Expired`;
  
  const html = `<!doctype html>
    <html lang="en">
      <body style="font-family: Helvetica, Arial, sans-serif; color: #202124; line-height: 1.6;">
        <h1 style="font-size:22px;">Your ${options.tier.name} Membership Has Expired</h1>
        <p>Hi ${options.customer.firstName},</p>
        <p>Your ${options.tier.name} membership expired on ${expirationFormatted}.</p>
        <div style="margin:20px 0; padding:16px; background-color:#f8f9fa; border-radius:4px;">
          <p>To continue enjoying your member benefits, you'll need to make a qualifying purchase to renew your membership.</p>
          <ul style="margin:16px 0; padding-left:20px;">
            <li><strong>Tier:</strong> ${options.tier.name}</li>
            <li><strong>Minimum purchase to renew:</strong> $${options.tier.minPurchaseAmount.toFixed(2)}</li>
          </ul>
        </div>
        <p>We hope to see you back soon!</p>
        <p style="margin-top:24px;">Cheers,<br/>${clientName}</p>
      </body>
    </html>`;

  const text = `Your ${options.tier.name} Membership Has Expired

Hi ${options.customer.firstName},

Your ${options.tier.name} membership expired on ${expirationFormatted}.

To continue enjoying your member benefits, you'll need to make a qualifying purchase to renew your membership.

• Tier: ${options.tier.name}
• Minimum purchase to renew: $${options.tier.minPurchaseAmount.toFixed(2)}

We hope to see you back soon!

Cheers,
${clientName}`;

  try {
    await sendClientEmail(options.clientId, {
      to: options.customer.email,
      toName: `${options.customer.firstName} ${options.customer.lastName}`,
      subject,
      html,
      text,
      tags: ['membership', 'expiration'],
    });

    console.info('SendGrid expiration notification sent', {
      clientId: options.clientId,
      email: options.customer.email,
    });
  } catch (error) {
    console.warn('SendGrid expiration notification failed:', error);
  }
}

// SendGrid upgrade notification
async function triggerSendGridUpgrade(options: {
  clientId: string;
  clientName?: string | null;
  communicationConfig: CommunicationConfigRow;
  preferences: CommunicationPreferences;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
  };
  oldTier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  newTier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  enrollmentDate: Date;
  expirationDate: Date;
}): Promise<void> {
  if (!options.communicationConfig || options.communicationConfig.email_provider !== 'sendgrid') {
    return;
  }

  if (options.preferences.unsubscribedAll) {
    console.info('Skipping SendGrid upgrade notification: member unsubscribed from all communications.');
    return;
  }

  const clientName = options.clientName ?? 'Your winery';
  const expirationFormatted = options.expirationDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `${clientName} – Congratulations on Your Tier Upgrade!`;
  
  const html = `<!doctype html>
    <html lang="en">
      <body style="font-family: Helvetica, Arial, sans-serif; color: #202124; line-height: 1.6;">
        <h1 style="font-size:22px;">Congratulations on Your Upgrade! 🎉</h1>
        <p>Hi ${options.customer.firstName},</p>
        <p>Great news! You've been upgraded to the <strong>${options.newTier.name}</strong> tier!</p>
        <div style="margin:20px 0; padding:16px; background-color:#e8f5e9; border-left:4px solid #4caf50; border-radius:4px;">
          <h2 style="margin-top:0; color:#2e7d32;">Previous Tier: ${options.oldTier.name}</h2>
          <p style="font-size:24px; margin:16px 0;">↓</p>
          <h2 style="margin-bottom:0; color:#2e7d32;">New Tier: ${options.newTier.name}</h2>
        </div>
        <div style="margin:20px 0; padding:16px; background-color:#f8f9fa; border-radius:4px;">
          <h3 style="margin-top:0;">Your New Benefits:</h3>
          <ul style="margin:16px 0; padding-left:20px;">
            <li><strong>Tier duration:</strong> ${options.newTier.durationMonths} months</li>
            <li><strong>Minimum purchase commitment:</strong> $${options.newTier.minPurchaseAmount.toFixed(2)}</li>
            <li><strong>Membership duration ends:</strong> ${expirationFormatted}</li>
          </ul>
        </div>
        <p>Enjoy your enhanced membership benefits!</p>
        <p style="margin-top:24px;">Cheers,<br/>${clientName}</p>
      </body>
    </html>`;

  const text = `Congratulations on Your Tier Upgrade!

Hi ${options.customer.firstName},

Great news! You've been upgraded to the ${options.newTier.name} tier!

Previous Tier: ${options.oldTier.name}
↓
New Tier: ${options.newTier.name}

Your New Benefits:
• Tier duration: ${options.newTier.durationMonths} months
• Minimum purchase commitment: $${options.newTier.minPurchaseAmount.toFixed(2)}
• Membership duration ends: ${expirationFormatted}

Enjoy your enhanced membership benefits!

Cheers,
${clientName}`;

  try {
    await sendClientEmail(options.clientId, {
      to: options.customer.email,
      toName: `${options.customer.firstName} ${options.customer.lastName}`,
      subject,
      html,
      text,
      tags: ['membership', 'upgrade'],
    });

    console.info('SendGrid upgrade notification sent', {
      clientId: options.clientId,
      email: options.customer.email,
      oldTier: options.oldTier.name,
      newTier: options.newTier.name,
    });
  } catch (error) {
    console.warn('SendGrid upgrade notification failed:', error);
  }
}

/**
 * Send expiration warning notification to a customer
 * Called by the expiration warning queue processor
 * This is sent X days (default 7) before membership expires
 */
export async function sendExpirationWarningNotification(
  clientId: string,
  customerId: string,
  enrollmentId: string
): Promise<void> {
  try {
    // Get communication config
    const communicationConfig = await db.getCommunicationConfig(clientId);
    if (!communicationConfig) {
      console.info('No communication config found for client, skipping expiration warning notification');
      return;
    }

    // Check if expiration warnings are enabled for this client
    if (!communicationConfig.send_expiration_warnings) {
      console.info(`Expiration warnings disabled for client ${clientId}, skipping`);
      return;
    }

    // Get customer data
    const supabase = getSupabaseClient();
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('client_id', clientId)
      .single();

    if (customerError || !customer) {
      console.warn(`Customer not found: ${customerId}, skipping expiration warning notification`);
      return;
    }

    // Get preferences
    const preferences = await db.getCommunicationPreferences(customer.id);
    if (preferences.unsubscribedAll) {
      console.info(`Customer ${customer.id} unsubscribed from all communications, skipping expiration warning notification`);
      return;
    }

    // Get enrollment and tier data
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from('club_enrollments')
      .select(`
        *,
        club_stages!inner (
          id,
          name,
          duration_months,
          min_purchase_amount,
          club_program_id,
          stage_order
        )
      `)
      .eq('id', enrollmentId)
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .maybeSingle();

    if (enrollmentError || !enrollmentData) {
      console.warn(`No active enrollment found for customer ${customer.id} and enrollment ${enrollmentId}, skipping expiration warning notification`);
      return;
    }

    // Handle nested structure from Supabase
    const enrollment = enrollmentData as any;
    const tier = enrollment.club_stages;

    if (!tier || !enrollment.expires_at) {
      console.warn(`Invalid enrollment data for enrollment ${enrollmentId}, skipping expiration warning notification`);
      return;
    }

    // Calculate days remaining
    const expiresAt = new Date(enrollment.expires_at);
    const now = new Date();
    const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Get client info
    const client = await db.getClient(clientId);

    // Send based on provider
    const providerKey = communicationConfig.email_provider?.toLowerCase();
    
    if (providerKey === 'klaviyo') {
      await triggerKlaviyoExpirationWarning({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        providerData: (communicationConfig.provider_data ?? null) as unknown as KlaviyoProviderData | null,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
          phone: customer.phone,
          crmId: customer.crm_id ?? '',
        },
        lvCustomerId: customer.id,
        tier: {
          id: tier.id,
          name: tier.name,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
        },
        expirationDate: expiresAt,
        daysRemaining,
      });
    } else if (providerKey === 'mailchimp') {
      await triggerMailchimpExpirationWarning({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
          crmId: customer.crm_id ?? '',
        },
        lvCustomerId: customer.id,
        tier: {
          id: tier.id,
          name: tier.name,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
        },
        expirationDate: expiresAt,
        daysRemaining,
      });
    } else if (providerKey === 'sendgrid') {
      await triggerSendGridExpirationWarning({
        clientId,
        clientName: client?.org_name ?? null,
        communicationConfig,
        preferences,
        customer: {
          email: customer.email,
          firstName: customer.first_name ?? '',
          lastName: customer.last_name ?? '',
        },
        tier: {
          id: tier.id,
          name: tier.name,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
        },
        expirationDate: expiresAt,
        daysRemaining,
      });
    }
  } catch (error) {
    console.error('Error sending expiration warning notification:', error);
    // Don't throw - communication failures shouldn't break the cron process
  }
}

// Klaviyo expiration warning notification
async function triggerKlaviyoExpirationWarning(options: {
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
  tier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  expirationDate: Date;
  daysRemaining: number;
}): Promise<void> {
  const { communicationConfig } = options;

  if (!communicationConfig || communicationConfig.email_provider !== 'klaviyo') {
    return;
  }

  if (options.preferences.unsubscribedAll || options.preferences.emailExpirationWarnings === false) {
    console.info('Skipping Klaviyo expiration warning: member unsubscribed or preferences disabled.');
    return;
  }

  const apiKey = communicationConfig.email_api_key ?? process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    console.warn('Klaviyo expiration warning skipped: missing API key.');
    return;
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
    membership_expires_at: options.expirationDate.toISOString(),
    days_remaining: options.daysRemaining,
    tier_id: options.tier.id,
    tier_name: options.tier.name,
    tier_min_purchase_amount: options.tier.minPurchaseAmount,
    communication_preferences: options.preferences,
    include_marketing_flows: options.providerData?.includeMarketing ?? false,
  };

  const eventProperties = {
    ...profileProperties,
    lv_customer_id: options.lvCustomerId,
    crm_customer_id: options.customer.crmId,
    flow_id: options.providerData?.flows?.EXPIRATION_WARNING?.id ?? null,
    metric_id: options.providerData?.metrics?.EXPIRATION_WARNING?.id ?? null,
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
      event: KLAVIYO_METRICS.EXPIRATION_WARNING,
      customer: {
        email: options.customer.email,
        phone: options.customer.phone || undefined,
        id: options.customer.crmId,
        properties: {
          membership_status: 'active',
          membership_expires_at: options.expirationDate.toISOString(),
          days_remaining: options.daysRemaining,
          tier_name: options.tier.name,
        },
      },
      properties: eventProperties,
      time: new Date().toISOString(),
    });

    console.info('Klaviyo expiration warning sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
      daysRemaining: options.daysRemaining,
    });
  } catch (error) {
    console.warn('Klaviyo expiration warning failed:', error);
  }
}

// Mailchimp expiration warning notification
async function triggerMailchimpExpirationWarning(options: {
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
  tier: {
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  expirationDate: Date;
  daysRemaining: number;
}): Promise<void> {
  if (!options.communicationConfig || options.communicationConfig.email_provider !== 'mailchimp') {
    return;
  }

  if (options.preferences.unsubscribedAll || options.preferences.emailExpirationWarnings === false) {
    console.info('Skipping Mailchimp expiration warning: member unsubscribed or preferences disabled.');
    return;
  }

  const membershipProps = {
    client_id: options.clientId,
    client_name: options.clientName ?? undefined,
    membership_status: 'active',
    membership_expires_at: options.expirationDate.toISOString(),
    days_remaining: options.daysRemaining,
    tier_id: options.tier.id,
    tier_name: options.tier.name,
    tier_min_purchase_amount: options.tier.minPurchaseAmount,
    communication_preferences: options.preferences,
    lv_customer_id: options.lvCustomerId,
  };

  try {
    await trackClientEvent(options.clientId, {
      event: MAILCHIMP_TAGS.EXPIRATION_WARNING,
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
        source: 'LiberoVino::ExpirationWarning',
      },
      time: new Date().toISOString(),
    });

    console.info('Mailchimp expiration warning sent', {
      clientId: options.clientId,
      email: options.customer.email,
      crmCustomerId: options.customer.crmId,
      daysRemaining: options.daysRemaining,
    });
  } catch (error) {
    console.warn('Mailchimp expiration warning failed:', error);
  }
}

// SendGrid expiration warning notification
async function triggerSendGridExpirationWarning(options: {
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
    id: string;
    name: string;
    durationMonths: number;
    minPurchaseAmount: number;
  };
  expirationDate: Date;
  daysRemaining: number;
}): Promise<void> {
  if (!options.communicationConfig || options.communicationConfig.email_provider !== 'sendgrid') {
    return;
  }

  if (options.preferences.unsubscribedAll || options.preferences.emailExpirationWarnings === false) {
    console.info('Skipping SendGrid expiration warning: member unsubscribed or preferences disabled.');
    return;
  }

  const clientName = options.clientName ?? 'Your winery';
  const expirationFormatted = options.expirationDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `${clientName} – Your Membership Expires Soon`;
  
  const html = `<!doctype html>
    <html lang="en">
      <body style="font-family: Helvetica, Arial, sans-serif; color: #202124; line-height: 1.6;">
        <h1 style="font-size:22px;">⚠️ Your Membership Expires in ${options.daysRemaining} Day${options.daysRemaining === 1 ? '' : 's'}</h1>
        <p>Hi ${options.customer.firstName},</p>
        <p>Your ${options.tier.name} membership expires on ${expirationFormatted} (${options.daysRemaining} day${options.daysRemaining === 1 ? '' : 's'} from now).</p>
        <div style="margin:20px 0; padding:16px; background-color:#fff3cd; border-left:4px solid #ffc107; border-radius:4px;">
          <h3 style="margin-top:0; color:#856404;">Renewal Reminder</h3>
          <p>To keep your member benefits active, make a qualifying purchase before your membership expires:</p>
          <ul style="margin:16px 0; padding-left:20px;">
            <li><strong>Tier:</strong> ${options.tier.name}</li>
            <li><strong>Minimum purchase to renew:</strong> $${options.tier.minPurchaseAmount.toFixed(2)}</li>
            <li><strong>Expires on:</strong> ${expirationFormatted}</li>
          </ul>
        </div>
        <p>Don't let your benefits expire—shop now to renew your membership!</p>
        <p style="margin-top:24px;">Cheers,<br/>${clientName}</p>
      </body>
    </html>`;

  const text = `Your Membership Expires in ${options.daysRemaining} Day${options.daysRemaining === 1 ? '' : 's'}

Hi ${options.customer.firstName},

Your ${options.tier.name} membership expires on ${expirationFormatted} (${options.daysRemaining} day${options.daysRemaining === 1 ? '' : 's'} from now).

Renewal Reminder:
To keep your member benefits active, make a qualifying purchase before your membership expires:

• Tier: ${options.tier.name}
• Minimum purchase to renew: $${options.tier.minPurchaseAmount.toFixed(2)}
• Expires on: ${expirationFormatted}

Don't let your benefits expire—shop now to renew your membership!

Cheers,
${clientName}`;

  try {
    await sendClientEmail(options.clientId, {
      to: options.customer.email,
      toName: `${options.customer.firstName} ${options.customer.lastName}`,
      subject,
      html,
      text,
      tags: ['membership', 'expiration-warning'],
    });

    console.info('SendGrid expiration warning sent', {
      clientId: options.clientId,
      email: options.customer.email,
      daysRemaining: options.daysRemaining,
    });
  } catch (error) {
    console.warn('SendGrid expiration warning failed:', error);
  }
}

