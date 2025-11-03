import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, Form, useActionData } from 'react-router';
import { useEffect } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  InlineStack,
  Banner,
  Badge,
  Box,
  Divider,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const client = await db.getClient(session.clientId);
  const existingProgram = await db.getClubProgram(session.clientId);
  
  if (!existingProgram) {
    // No club program yet, redirect back to start
    throw new Response('Club program not found', { status: 404 });
  }
  
  // Fetch promotions and loyalty for each tier
  const tiersWithData = await Promise.all(
    (existingProgram.club_stages || []).map(async (stage: any) => {
      const promotions = await db.getStagePromotions(stage.id);
      const loyalty = await db.getTierLoyaltyConfig(stage.id);
      
      return {
        ...stage,
        promotionCount: promotions.length,
        hasLoyalty: !!loyalty,
        loyaltyEarnRate: loyalty?.earn_rate,
        loyaltyBonus: loyalty?.initial_points_bonus,
      };
    })
  );
  
  return {
    session,
    client,
    clubProgram: existingProgram,
    tiers: tiersWithData,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  
  if (actionType === 'create_tier') {
    const existingProgram = await db.getClubProgram(session.clientId);
    if (!existingProgram) {
      return {
        success: false,
        message: 'Club program not found',
      };
    }
    
    // Get current tier count for order
    const tierCount = existingProgram.club_stages?.length || 0;
    
    // Create a new blank tier
    const newTiers = await db.createClubStages(existingProgram.id, [{
      name: `New Tier ${tierCount + 1}`,
      durationMonths: 3,
      minPurchaseAmount: 150,
      stageOrder: tierCount + 1,
    }]);
    
    // Redirect to edit the new tier with 'new' flag
    return {
      success: true,
      redirect: addSessionToUrl(`/app/setup/tiers/${newTiers[0].id}?new=true`, session.id),
    };
  }
  
  if (actionType === 'delete_tier') {
    const tierId = formData.get('tier_id') as string;
    
    try {
      // For now, just delete from DB (we'll add C7 cleanup later)
      await db.deleteClubStage(tierId);
      
      return {
        success: true,
        message: 'Tier deleted successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete tier',
      };
    }
  }
  
  return { success: false, message: 'Invalid action' };
}

export default function SetupTiers() {
  const { clubProgram, tiers, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  // Handle redirect from action
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);
  
  const canContinue = tiers.length > 0 && tiers.every((t: any) => t.promotionCount > 0);
  
  return (
    <Page
      title="Membership Tiers"
      backAction={{ 
        content: 'Back to Club Info', 
        onAction: () => navigate(addSessionToUrl('/app/setup', session.id)) 
      }}
    >
      <Layout>
        {/* Success/Error Messages */}
        {actionData && !actionData.success && (
          <Layout.Section>
            <Banner tone="critical" title={actionData.message} />
          </Layout.Section>
        )}
        
        {actionData && actionData.success && actionData.message && (
          <Layout.Section>
            <Banner tone="success" title={actionData.message} />
          </Layout.Section>
        )}
        
        {/* Instructions */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">
                Configure Your Membership Tiers
              </Text>
              <Text variant="bodyMd" as="p">
                Create tiers that offer different benefits and pricing. Each tier can have:
              </Text>
              <BlockStack gap="100">
                <Text variant="bodyMd" as="p">
                  • Multiple promotions (discounts, free shipping, etc.)
                </Text>
                <Text variant="bodyMd" as="p">
                  • Optional loyalty rewards with welcome bonuses
                </Text>
                <Text variant="bodyMd" as="p">
                  • Custom membership duration and minimum purchase
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
        
        {/* Tier Summary Cards */}
        <Layout.Section>
          <BlockStack gap="400">
            {tiers.map((tier: any, index: number) => (
              <Card key={tier.id}>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="start">
                    <BlockStack gap="200">
                      <Text variant="headingMd" as="h3">
                        {tier.name}
                      </Text>
                      <BlockStack gap="100">
                        <Text variant="bodyMd" as="p" tone="subdued">
                          Duration: {tier.duration_months} months · Min Purchase: ${tier.min_purchase_amount}
                        </Text>
                        <InlineStack gap="200">
                          <Badge tone={tier.promotionCount > 0 ? 'success' : 'attention'}>
                            {`${tier.promotionCount} ${tier.promotionCount === 1 ? 'Promotion' : 'Promotions'}`}
                          </Badge>
                          {tier.hasLoyalty && (
                            <Badge tone="info">
                              {`Loyalty: ${(tier.loyaltyEarnRate * 100).toFixed(0)}% earn${tier.loyaltyBonus > 0 ? ` + ${tier.loyaltyBonus} bonus pts` : ''}`}
                            </Badge>
                          )}
                        </InlineStack>
                      </BlockStack>
                    </BlockStack>
                    
                    <InlineStack gap="200">
                      <Button
                        onClick={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}`, session.id))}
                      >
                        Edit
                      </Button>
                      <Form method="post">
                        <input type="hidden" name="action" value="delete_tier" />
                        <input type="hidden" name="tier_id" value={tier.id} />
                        <Button
                          tone="critical"
                          submit
                        >
                          Delete
                        </Button>
                      </Form>
                    </InlineStack>
                  </InlineStack>
                  
                  {tier.promotionCount === 0 && (
                    <Banner tone="warning">
                      This tier has no promotions. Add at least one promotion to make it functional.
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            ))}
            
            {/* Add Tier Button */}
            <Form method="post">
              <input type="hidden" name="action" value="create_tier" />
              <Button submit size="large">
                + Add Tier
              </Button>
            </Form>
          </BlockStack>
        </Layout.Section>
        
        {/* Navigation */}
        <Layout.Section>
          <Card>
            <InlineStack align="space-between">
              <Button
                onClick={() => navigate(addSessionToUrl('/app/setup', session.id))}
              >
                ← Back
              </Button>
              
              <Button
                variant="primary"
                onClick={() => navigate(addSessionToUrl('/app/setup/review', session.id))}
                disabled={!canContinue}
              >
                Continue to Review →
              </Button>
            </InlineStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

