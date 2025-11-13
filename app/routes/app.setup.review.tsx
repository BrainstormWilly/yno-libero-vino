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
  Banner,
  InlineStack,
  Badge,
  Divider,
  List,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const client = await db.getClient(session.clientId);
  const clubProgram = await db.getClubProgram(session.clientId);
  const communicationConfig = await db.getCommunicationConfig(session.clientId);
  
  if (!clubProgram) {
    throw new Response('Club program not found', { status: 404 });
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
  
  try {
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
  
  const canComplete = allTiersConfigured && communicationConfig;
  
  return (
    <Page
      title="Review & Launch"
      backAction={{ 
        content: 'Back to Communication', 
        onAction: () => navigate(addSessionToUrl('/app/setup/communication', session.id)) 
      }}
    >
      <Layout>
        {/* Error Messages */}
        {actionData && !actionData.success && (
          <Layout.Section>
            <Banner tone="critical" title={actionData.message} />
          </Layout.Section>
        )}
        
        {!allTiersConfigured && (
          <Layout.Section>
            <Banner tone="warning">
              Some tiers are missing promotions. All tiers must have at least one promotion to be functional.
            </Banner>
          </Layout.Section>
        )}
        
        {!communicationConfig && (
          <Layout.Section>
            <Banner tone="warning">
              Communication settings must be configured to send member notifications.
            </Banner>
          </Layout.Section>
        )}
        
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
              
              {communicationConfig ? (
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Email Provider:
                    </Text>
                    <Text variant="bodyMd" as="p">
                      {communicationConfig.email_provider === 'klaviyo' ? 'Klaviyo' : 
                       communicationConfig.email_provider === 'mailchimp' ? 'Mailchimp' : 
                       'SendGrid (LiberoVino Managed)'}
                    </Text>
                  </InlineStack>
                  
                  {communicationConfig.email_from_address && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        From Email:
                      </Text>
                      <Text variant="bodyMd" as="p">
                        {communicationConfig.email_from_address}
                      </Text>
                    </InlineStack>
                  )}
                  
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Monthly Status Emails:
                    </Text>
                    <Badge tone={communicationConfig.send_monthly_status ? 'success' : 'critical'}>
                      {communicationConfig.send_monthly_status ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </InlineStack>
                  
                  <InlineStack align="space-between">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Expiration Warnings:
                    </Text>
                    <Badge tone={communicationConfig.send_expiration_warnings ? 'success' : 'critical'}>
                      {communicationConfig.send_expiration_warnings ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </InlineStack>
                  
                  {communicationConfig.send_expiration_warnings && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        Warning Days Before:
                      </Text>
                      <Text variant="bodyMd" as="p">
                        {communicationConfig.warning_days_before} days
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
        
        {/* Submit */}
        <Layout.Section>
          <Form method="post">
            <Card>
              <BlockStack gap="300">
                <Text variant="bodyMd" as="p">
                  Your tiers are already synced with Commerce7. Click Complete Setup to finish the configuration
                  and start managing your club program. You can always edit your configuration later.
                </Text>
                
                <InlineStack align="space-between">
                  <Button
                    onClick={() => navigate(addSessionToUrl('/app/setup/communication', session.id))}
                  >
                    ← Back
                  </Button>
                  
                  <Button
                    variant="primary"
                    submit
                    disabled={!canComplete}
                    size="large"
                  >
                    Complete Setup 🚀
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

