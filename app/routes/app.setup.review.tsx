import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, useActionData, useNavigate } from 'react-router';
import { useEffect } from 'react';
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  BlockStack,
  Banner,
  InlineStack,
  Badge,
  Divider,
  List,
  Box,
  Form,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import { seedKlaviyoResources } from '~/lib/communication/klaviyo-seeding.server';
import { normalizeConfigForCreate } from '~/lib/communication/communication-helpers';
import type { Database } from '~/types/supabase';

type ProviderDataJson =
  Database['public']['Tables']['communication_configs']['Insert']['provider_data'];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const client = await db.getClient(session.clientId);
  const clubProgram = await db.getClubProgram(session.clientId);
  let communicationConfig = await db.getCommunicationConfig(session.clientId);
  
  if (!clubProgram) {
    throw new Response('Club program not found', { status: 404 });
  }

              // Seed/update Klaviyo resources if email provider is Klaviyo
              // This will create flows if they don't exist, or update them to include SMS if needed
              if (communicationConfig?.email_provider?.toLowerCase() === 'klaviyo') {
    const providerData = communicationConfig.provider_data as Record<string, unknown> | null;
    const klaviyoConfig = providerData?.klaviyoConfig as
      | {
          apiKey: string;
          fromEmail: string;
          fromName: string;
          includeMarketing?: boolean;
        }
      | undefined;

    // Always seed/update if we have the config (ensureFlow will update existing flows if needed)
    if (klaviyoConfig) {
      try {
        // Always include SMS when Klaviyo is the email provider (Klaviyo SMS is integrated)
        const emailProvider = communicationConfig?.email_provider?.toLowerCase();
        const includeSMS = emailProvider === 'klaviyo';

        const seededData = await seedKlaviyoResources({
          apiKey: klaviyoConfig.apiKey,
          fromEmail: klaviyoConfig.fromEmail,
          fromName: klaviyoConfig.fromName,
          includeMarketing: klaviyoConfig.includeMarketing ?? false,
          includeSMS,
        });

        // Update config with seeded data
        await db.updateCommunicationConfig(session.clientId, {
          providerData: seededData as unknown as ProviderDataJson,
        });

        // Reload config to get updated data
        communicationConfig = await db.getCommunicationConfig(session.clientId);
      } catch (error) {
        console.error('Klaviyo seeding failed in review route:', error);
        // Don't throw - allow user to see review page even if seeding fails
        // They can retry or fix the issue
      }
    }
  }
  
  // Fetch promotions and loyalty for each tier
  const tiersWithData = await Promise.all(
    (clubProgram.club_stages || []).map(async (stage: any) => {
      const promotions = await db.getStagePromotions(stage.id);
      const loyalty = await db.getTierLoyaltyConfig(stage.id);
      
      // Enrich promotions with C7 data if Commerce7
      let enrichedPromotions = promotions;
      if (session.crmType === 'commerce7' && stage.c7_club_id) {
        const provider = new Commerce7Provider(session.tenantShop);
        enrichedPromotions = await Promise.all(
          promotions.map(async (promo) => {
            try {
              const c7Promo = await provider.getPromotion(promo.crm_id);
              return { ...promo, c7Data: c7Promo };
            } catch (error) {
              return promo;
            }
          })
        );
      }
      
      return {
        ...stage,
        promotions: enrichedPromotions,
        loyalty,
      };
    })
  );
  
  return {
    session,
    client,
    clubProgram: {
      ...clubProgram,
      club_stages: tiersWithData,
    },
    communicationConfig,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const formData = await request.formData();
  const actionType = formData.get('actionType');
  
  if (actionType === 'save_communication_config') {
    // Save communication config from form data
    try {
      const existingConfig = await db.getCommunicationConfig(session.clientId);
      
      const configData: Partial<{
        emailProvider: string;
        emailApiKey?: string | null;
        emailFromAddress?: string | null;
        emailFromName?: string | null;
        emailListId?: string | null;
        smsProvider?: string | null;
        smsApiKey?: string | null;
        smsFromNumber?: string | null;
        sendMonthlyStatus?: boolean;
        sendExpirationWarnings?: boolean;
        warningDaysBefore?: number;
        providerData?: ProviderDataJson | null;
      }> = {};
      
      // Read all config fields from form data
      const emailProvider = formData.get('email_provider') as string | null;
      const smsProvider = formData.get('sms_provider') as string | null;
      
      if (emailProvider) configData.emailProvider = emailProvider;
      if (smsProvider) configData.smsProvider = smsProvider;
      
      // Email fields
      const emailApiKey = formData.get('email_api_key') as string | null;
      if (emailApiKey !== null) configData.emailApiKey = emailApiKey || null;
      
      const emailFromAddress = formData.get('email_from_address') as string | null;
      if (emailFromAddress !== null) configData.emailFromAddress = emailFromAddress || null;
      
      const emailFromName = formData.get('email_from_name') as string | null;
      if (emailFromName !== null) configData.emailFromName = emailFromName || null;
      
      const emailListId = formData.get('email_list_id') as string | null;
      if (emailListId !== null) configData.emailListId = emailListId || null;
      
      // SMS fields
      const smsApiKey = formData.get('sms_api_key') as string | null;
      if (smsApiKey !== null) configData.smsApiKey = smsApiKey || null;
      
      const smsFromNumber = formData.get('sms_from_number') as string | null;
      if (smsFromNumber !== null) configData.smsFromNumber = smsFromNumber || null;
      
      // Preferences
      const sendMonthlyStatus = formData.get('send_monthly_status');
      if (sendMonthlyStatus !== null) configData.sendMonthlyStatus = sendMonthlyStatus === 'true';
      
      const sendExpirationWarnings = formData.get('send_expiration_warnings');
      if (sendExpirationWarnings !== null) configData.sendExpirationWarnings = sendExpirationWarnings === 'true';
      
      const warningDaysBefore = formData.get('warning_days_before');
      if (warningDaysBefore !== null) configData.warningDaysBefore = parseInt(warningDaysBefore as string, 10) || 7;
      
      // Provider data (JSON string)
      const providerDataStr = formData.get('provider_data') as string | null;
      if (providerDataStr) {
        try {
          configData.providerData = JSON.parse(providerDataStr) as ProviderDataJson;
        } catch (e) {
          // Invalid JSON, skip
        }
      }
      
      if (existingConfig) {
        await db.updateCommunicationConfig(session.clientId, configData);
      } else {
        await db.createCommunicationConfig(
          session.clientId,
          normalizeConfigForCreate(
            {
              emailProvider: emailProvider || 'sendgrid',
              ...configData,
            },
            'sendgrid'
          )
        );
      }
      
      return {
        success: true,
        message: 'Communication config saved',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save communication config',
      };
    }
  }
  
  if (actionType === 'completeSetup') {
    try {
      // First, save the communication config from form data
      const existingConfig = await db.getCommunicationConfig(session.clientId);
      
      const configData: Partial<{
        emailProvider: string;
        emailApiKey?: string | null;
        emailFromAddress?: string | null;
        emailFromName?: string | null;
        emailListId?: string | null;
        smsProvider?: string | null;
        smsApiKey?: string | null;
        smsFromNumber?: string | null;
        sendMonthlyStatus?: boolean;
        sendExpirationWarnings?: boolean;
        warningDaysBefore?: number;
        providerData?: ProviderDataJson | null;
      }> = {};
      
      // Read all config fields from form data
      const emailProvider = formData.get('email_provider') as string | null;
      const smsProvider = formData.get('sms_provider') as string | null;
      
      if (emailProvider) configData.emailProvider = emailProvider;
      if (smsProvider) configData.smsProvider = smsProvider;
      
      // Email fields
      const emailApiKey = formData.get('email_api_key') as string | null;
      if (emailApiKey !== null) configData.emailApiKey = emailApiKey || null;
      
      const emailFromAddress = formData.get('email_from_address') as string | null;
      if (emailFromAddress !== null) configData.emailFromAddress = emailFromAddress || null;
      
      const emailFromName = formData.get('email_from_name') as string | null;
      if (emailFromName !== null) configData.emailFromName = emailFromName || null;
      
      const emailListId = formData.get('email_list_id') as string | null;
      if (emailListId !== null) configData.emailListId = emailListId || null;
      
      // SMS fields
      const smsApiKey = formData.get('sms_api_key') as string | null;
      if (smsApiKey !== null) configData.smsApiKey = smsApiKey || null;
      
      const smsFromNumber = formData.get('sms_from_number') as string | null;
      if (smsFromNumber !== null) configData.smsFromNumber = smsFromNumber || null;
      
      // Preferences
      const sendMonthlyStatus = formData.get('send_monthly_status');
      if (sendMonthlyStatus !== null) configData.sendMonthlyStatus = sendMonthlyStatus === 'true';
      
      const sendExpirationWarnings = formData.get('send_expiration_warnings');
      if (sendExpirationWarnings !== null) configData.sendExpirationWarnings = sendExpirationWarnings === 'true';
      
      const warningDaysBefore = formData.get('warning_days_before');
      if (warningDaysBefore !== null) configData.warningDaysBefore = parseInt(warningDaysBefore as string, 10) || 7;
      
      // Provider data (JSON string)
      const providerDataStr = formData.get('provider_data') as string | null;
      if (providerDataStr) {
        try {
          configData.providerData = JSON.parse(providerDataStr) as ProviderDataJson;
        } catch (e) {
          // Invalid JSON, skip
        }
      }
      
      // Save communication config
      if (existingConfig) {
        await db.updateCommunicationConfig(session.clientId, configData);
      } else if (emailProvider || smsProvider) {
        await db.createCommunicationConfig(
          session.clientId,
          normalizeConfigForCreate(
            {
              emailProvider: emailProvider || 'sendgrid',
              ...configData,
            },
            'sendgrid'
          )
        );
      }
      
      // Mark setup as complete
      await db.markSetupComplete(session.clientId);
      
      // Redirect to app home with success message
      const successUrl = addSessionToUrl('/app', session.id) + 
        '&toast=' + encodeURIComponent('Club setup completed successfully! 🎉') +
        '&toastType=success';
      
      return {
        success: true,
        redirect: successUrl,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to complete setup',
      };
    }
  }
  
  return {
    success: false,
    message: 'Invalid action',
  };
}

export default function SetupReview() {
  const { clubProgram, session, communicationConfig } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  // Handle redirect
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      window.location.href = actionData.redirect;
    }
  }, [actionData]);
  
  const allTiersConfigured = (clubProgram.club_stages || []).every(
    (tier: any) => tier.promotions?.length > 0
  );
  
  // Use communicationConfig from loader data
  const canComplete = allTiersConfigured && communicationConfig?.email_provider;
  
  return (
    <Page title="Review & Launch">
      <Layout>
        {/* Banners at Top */}
        <Layout.Section>
          <BlockStack gap="400">
            {actionData && !actionData.success && (
              <Banner tone="critical" title={actionData.message} />
            )}
            
            {!allTiersConfigured && (
              <Banner tone="warning">
                Some tiers are missing promotions. All tiers must have at least one promotion to be functional.
              </Banner>
            )}
            
            {!communicationConfig?.email_provider && (
              <Banner tone="warning">
                Communication settings must be configured to send member notifications.
              </Banner>
            )}

            {/* Navigation Buttons at Top */}
            <Box paddingBlockEnd="400">
              <InlineStack align="space-between">
                <Button
                  onClick={() => navigate(addSessionToUrl('/app/setup/communication', session.id))}
                >
                  ← Back to Communication
                </Button>
                
                <Form method="post">
                  <input type="hidden" name="actionType" value="completeSetup" />
                  {/* Include communication config data */}
                  {communicationConfig?.email_provider && (
                    <input type="hidden" name="email_provider" value={communicationConfig.email_provider} />
                  )}
                  {communicationConfig?.sms_provider && (
                    <input type="hidden" name="sms_provider" value={communicationConfig.sms_provider} />
                  )}
                  {communicationConfig?.email_api_key && (
                    <input type="hidden" name="email_api_key" value={communicationConfig.email_api_key} />
                  )}
                  {communicationConfig?.email_from_address && (
                    <input type="hidden" name="email_from_address" value={communicationConfig.email_from_address} />
                  )}
                  {communicationConfig?.email_from_name && (
                    <input type="hidden" name="email_from_name" value={communicationConfig.email_from_name} />
                  )}
                  {communicationConfig?.email_list_id && (
                    <input type="hidden" name="email_list_id" value={communicationConfig.email_list_id} />
                  )}
                  {communicationConfig?.sms_api_key && (
                    <input type="hidden" name="sms_api_key" value={communicationConfig.sms_api_key} />
                  )}
                  {communicationConfig?.sms_from_number && (
                    <input type="hidden" name="sms_from_number" value={communicationConfig.sms_from_number} />
                  )}
                  <input type="hidden" name="send_monthly_status" value={communicationConfig?.send_monthly_status ? 'true' : 'false'} />
                  <input type="hidden" name="send_expiration_warnings" value={communicationConfig?.send_expiration_warnings ? 'true' : 'false'} />
                  <input type="hidden" name="warning_days_before" value={String(communicationConfig?.warning_days_before || 7)} />
                  {communicationConfig?.provider_data && (
                    <input type="hidden" name="provider_data" value={JSON.stringify(communicationConfig.provider_data)} />
                  )}
                  
                  <Button
                    variant="primary"
                    submit
                    disabled={!canComplete}
                    size="large"
                  >
                    Complete Setup 🚀
                  </Button>
                </Form>
              </InlineStack>
            </Box>
          </BlockStack>
        </Layout.Section>
        
        {/* Club Program Summary */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h2">
                {clubProgram.name}
              </Text>
              <Text variant="bodyMd" as="p">
                {clubProgram.description}
              </Text>
              <Button
                variant="plain"
                onClick={() => navigate(addSessionToUrl('/app/setup', session.id))}
              >
                Edit Club Info
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
        
        {/* Tiers Summary */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h3">
                  Membership Tiers ({clubProgram.club_stages?.length || 0})
                </Text>
                <Button
                  variant="plain"
                  onClick={() => navigate(addSessionToUrl('/app/setup/tiers', session.id))}
                >
                  Edit Tiers
                </Button>
              </InlineStack>
              
              <Divider />
              
              <BlockStack gap="500">
                {(clubProgram.club_stages || []).map((tier: any, index: number) => (
                  <BlockStack key={tier.id} gap="300">
                    <InlineStack align="space-between" blockAlign="start">
                      <Text variant="headingSm" as="h4" fontWeight="semibold">
                        {tier.name}
                      </Text>
                      <InlineStack gap="200">
                        <Badge tone={tier.promotions?.length > 0 ? 'success' : 'critical'}>
                          {`${tier.promotions?.length || 0} Promotions`}
                        </Badge>
                        {tier.loyalty && (
                          <Badge tone="info">
                            Loyalty Enabled
                          </Badge>
                        )}
                      </InlineStack>
                    </InlineStack>
                    
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {tier.duration_months} months · ${tier.min_purchase_amount} minimum
                    </Text>
                    
                    {/* Promotions List */}
                    {tier.promotions?.length > 0 && (
                      <BlockStack gap="100">
                        <Text variant="bodySm" as="p" fontWeight="semibold">
                          Promotions:
                        </Text>
                        <List type="bullet">
                          {tier.promotions.map((promo: any) => (
                            <List.Item key={promo.id}>
                              {promo.title || promo.c7Data?.title || 'Untitled Promotion'}
                            </List.Item>
                          ))}
                        </List>
                      </BlockStack>
                    )}
                    
                    {/* Loyalty Info */}
                    {tier.loyalty && (
                      <BlockStack gap="100">
                        <Text variant="bodySm" as="p" fontWeight="semibold">
                          Loyalty:
                        </Text>
                        <Text variant="bodySm" as="p">
                          • Earn {(tier.loyalty.earn_rate * 100).toFixed(0)}% points per dollar
                        </Text>
                        {tier.loyalty.initial_points_bonus > 0 && (
                          <Text variant="bodySm" as="p">
                            • {tier.loyalty.initial_points_bonus} welcome bonus points
                          </Text>
                        )}
                      </BlockStack>
                    )}
                    
                    {index < (clubProgram.club_stages?.length || 0) - 1 && <Divider />}
                  </BlockStack>
                ))}
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
        
        {/* Communication Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h3">
                  Communication Settings
                </Text>
                <Button
                  variant="plain"
                  onClick={() => navigate(addSessionToUrl('/app/setup/communication', session.id))}
                >
                  Edit Settings
                </Button>
              </InlineStack>
              
              <Divider />
              
              {communicationConfig?.email_provider ? (
                <BlockStack gap="300">
                  {communicationConfig?.email_provider && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        Provider:
                      </Text>
                      <Text variant="bodyMd" as="p">
                        {communicationConfig?.email_provider === 'klaviyo' ? 'Klaviyo' : 
                         communicationConfig?.email_provider === 'mailchimp' ? 'Mailchimp' : 
                         'SendGrid (LiberoVino Managed)'}
                      </Text>
                    </InlineStack>
                  )}
                  
                  {communicationConfig?.email_from_address && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        From Email:
                      </Text>
                      <Text variant="bodyMd" as="p">
                        {communicationConfig?.email_from_address}
                      </Text>
                    </InlineStack>
                  )}
                  
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Monthly Status Emails:
                    </Text>
                    <Badge tone={communicationConfig?.send_monthly_status ? 'success' : 'critical'}>
                      {communicationConfig?.send_monthly_status ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </InlineStack>
                  
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Expiration Warnings:
                    </Text>
                    <Badge tone={communicationConfig?.send_expiration_warnings ? 'success' : 'critical'}>
                      {communicationConfig?.send_expiration_warnings ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </InlineStack>
                  
                  {communicationConfig?.send_expiration_warnings && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        Warning Days Before:
                      </Text>
                      <Text variant="bodyMd" as="p">
                        {communicationConfig?.warning_days_before} days
                      </Text>
                    </InlineStack>
                  )}
                </BlockStack>
              ) : (
                <Banner tone="warning">
                  Communication settings not configured. This is required for member notifications.
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
        
        {/* Submit Info */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="bodyMd" as="p">
                Your tiers are already synced with Commerce7. Click Complete Setup to finish the configuration
                and start managing your club program. You can always edit your configuration later.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

