import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, useNavigate, Form, useActionData } from 'react-router';
import { useEffect, useState } from 'react';
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
  ButtonGroup,
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
  
  // Fetch promotions and loyalty for each tier, sorted by stage_order
  // Active tiers first (by stage_order), then inactive tiers (null stage_order) at the end
  const sortedStages = (existingProgram.club_stages || []).sort((a: any, b: any) => {
    // Active tiers come first
    if (a.is_active && !b.is_active) return -1;
    if (!a.is_active && b.is_active) return 1;
    // Within active tiers, sort by stage_order
    if (a.is_active && b.is_active) {
      return (a.stage_order || 0) - (b.stage_order || 0);
    }
    // Inactive tiers stay in their original order
    return 0;
  });
  
  const tiersWithData = await Promise.all(
    sortedStages.map(async (stage: any) => {
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
  
  if (actionType === 'reorder_tier') {
    const tierId = formData.get('tier_id') as string;
    const direction = formData.get('direction') as 'up' | 'down';
    
    try {
      const existingProgram = await db.getClubProgram(session.clientId);
      if (!existingProgram || !existingProgram.club_stages) {
        return {
          success: false,
          message: 'Club program not found',
        };
      }
      
      // Find the tier to move
      const tierToMove = existingProgram.club_stages.find((s: any) => s.id === tierId);
      if (!tierToMove) {
        return {
          success: false,
          message: 'Tier not found',
        };
      }
      
      // Only consider active tiers for reordering (inactive tiers have NULL stage_order)
      const activeTiers = existingProgram.club_stages.filter((s: any) => s.is_active);
      
      // Sort active tiers by stage_order
      const sortedTiers = [...activeTiers].sort((a: any, b: any) => 
        (a.stage_order || 0) - (b.stage_order || 0)
      );
      
      // Find current index
      const currentIndex = sortedTiers.findIndex((t: any) => t.id === tierId);
      if (currentIndex === -1) {
        return {
          success: false,
          message: 'Tier not found in sorted list',
        };
      }
      
      // Calculate target index
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      
      // Validate bounds
      if (targetIndex < 0 || targetIndex >= sortedTiers.length) {
        return {
          success: false,
          message: `Cannot move tier ${direction === 'up' ? 'up' : 'down'}`,
        };
      }
      
      // Get the tier to swap with
      const targetTier = sortedTiers[targetIndex];
      
      // Swap stage_order values using NULL as temporary value to avoid unique constraint violation
      // The partial unique index only applies to non-null values, so NULL is safe as a temporary value
      const tempOrder = tierToMove.stage_order;
      const targetOrder = targetTier.stage_order;
      
      // Step 1: Set first tier to NULL temporarily (won't violate unique constraint)
      await db.updateClubStage(tierId, { stageOrder: null });
      
      // Step 2: Set second tier to first tier's original value
      await db.updateClubStage(targetTier.id, { stageOrder: tempOrder });
      
      // Step 3: Set first tier to second tier's original value
      await db.updateClubStage(tierId, { stageOrder: targetOrder });
      
      return {
        success: true,
        message: `Tier moved ${direction === 'up' ? 'up' : 'down'} successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to reorder tier',
      };
    }
  }
  
  return { success: false, message: 'Invalid action' };
}

export default function SetupTiers() {
  const { clubProgram, tiers, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'active' | 'inactive'>('active');
  
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
  
  // Filter tiers based on view mode
  const activeTiers = tiers.filter((t: any) => t.is_active);
  const inactiveTiers = tiers.filter((t: any) => !t.is_active);
  const displayedTiers = viewMode === 'active' ? activeTiers : inactiveTiers;
  
  // Sort active tiers by stage_order, inactive tiers by name
  const sortedDisplayedTiers = viewMode === 'active'
    ? [...displayedTiers].sort((a: any, b: any) => (a.stage_order || 0) - (b.stage_order || 0))
    : [...displayedTiers].sort((a: any, b: any) => a.name.localeCompare(b.name));
  
  return (
    <Page title="Membership Tiers">
      <Layout>
        {/* Banners and Navigation at Top */}
        <Layout.Section>
          <BlockStack gap="400">
            {/* Success/Error Messages */}
            {actionData && !actionData.success && (
              <Banner tone="critical" title={actionData.message} />
            )}
            
            {actionData && actionData.success && actionData.message && (
              <Banner tone="success" title={actionData.message} />
            )}

            {/* Navigation Buttons at Top */}
            <Box paddingBlockEnd="400">
              <InlineStack align="space-between">
                <Button
                  onClick={() => navigate(addSessionToUrl('/app/setup', session.id))}
                >
                  ← Back to Club Info
                </Button>
                
                <Button
                  variant="primary"
                  onClick={() => navigate(addSessionToUrl('/app/setup/communication', session.id))}
                  disabled={!canContinue}
                >
                  Continue to Communication →
                </Button>
              </InlineStack>
            </Box>
          </BlockStack>
        </Layout.Section>
        
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
          <Card>
            <BlockStack gap="400">
              {/* Header with Toggle */}
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">
                  {viewMode === 'active' ? 'Current club tiers in upgrade order' : 'Inactive tiers (Historical)'}
                </Text>
                <ButtonGroup>
                  <Button
                    pressed={viewMode === 'active'}
                    onClick={() => setViewMode('active')}
                  >
                    Active ({activeTiers.length.toString()})
                  </Button>
                  <Button
                    pressed={viewMode === 'inactive'}
                    onClick={() => setViewMode('inactive')}
                    disabled={inactiveTiers.length === 0}
                  >
                    Inactive ({inactiveTiers.length.toString()})
                  </Button>
                </ButtonGroup>
              </InlineStack>
              
              {viewMode === 'inactive' && (
                <Banner tone="info">
                  These tiers were deleted in Commerce7 and cannot be edited or reactivated. They are shown for historical reference only.
                </Banner>
              )}
              
              {/* Tier Cards */}
              {sortedDisplayedTiers.length === 0 ? (
                <Banner tone="info">
                  {viewMode === 'active' 
                    ? 'No active tiers yet. Create your first tier to get started.'
                    : 'No inactive tiers.'}
                </Banner>
              ) : (
                <BlockStack gap="400">
                  {sortedDisplayedTiers.map((tier: any) => {
                    // For active tiers, calculate reorder buttons
                    let canMoveUp = false;
                    let canMoveDown = false;
                    
                    if (viewMode === 'active') {
                      const currentIndex = sortedDisplayedTiers.findIndex((t: any) => t.id === tier.id);
                      canMoveUp = currentIndex > 0;
                      canMoveDown = currentIndex < sortedDisplayedTiers.length - 1;
                    }
                    
                    return (
                      <Card key={tier.id}>
                        <BlockStack gap="300">
                          <InlineStack align="space-between" blockAlign="start">
                            <BlockStack gap="200">
                              {viewMode === 'inactive' && (
                                <InlineStack gap="200" blockAlign="center">
                                  <Text variant="headingMd" as="h3" tone="subdued">
                                    {tier.name}
                                  </Text>
                                  <Badge tone="critical">INACTIVE</Badge>
                                </InlineStack>
                              )}
                              {viewMode === 'active' && (
                                <Text variant="headingMd" as="h3">
                                  {tier.name}
                                </Text>
                              )}
                              <BlockStack gap="100">
                                <Text variant="bodyMd" as="p" tone={viewMode === 'inactive' ? 'subdued' : undefined}>
                                  Duration: {tier.duration_months} months · Min Purchase: ${tier.min_purchase_amount} · Min LTV: ${tier.min_ltv_amount || 0}
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
                              {viewMode === 'active' && canMoveUp && (
                                <Form method="post">
                                  <input type="hidden" name="action" value="reorder_tier" />
                                  <input type="hidden" name="tier_id" value={tier.id} />
                                  <input type="hidden" name="direction" value="up" />
                                  <Button size="slim" submit>
                                    ↑ Downgrade
                                  </Button>
                                </Form>
                              )}
                              {viewMode === 'active' && canMoveDown && (
                                <Form method="post">
                                  <input type="hidden" name="action" value="reorder_tier" />
                                  <input type="hidden" name="tier_id" value={tier.id} />
                                  <input type="hidden" name="direction" value="down" />
                                  <Button size="slim" submit>
                                    ↓ Upgrade
                                  </Button>
                                </Form>
                              )}
                              <Button
                                onClick={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}`, session.id))}
                              >
                                {viewMode === 'active' ? 'Edit' : 'View Details'}
                              </Button>
                              {viewMode === 'active' && (
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
                              )}
                            </InlineStack>
                          </InlineStack>
                          
                          {viewMode === 'active' && tier.promotionCount === 0 && (
                            <Banner tone="warning">
                              This tier has no promotions. Add at least one promotion to make it functional.
                            </Banner>
                          )}
                        </BlockStack>
                      </Card>
                    );
                  })}
                </BlockStack>
              )}
              
              {/* Add Tier Button (only show for active view) */}
              {viewMode === 'active' && (
                <Form method="post">
                  <input type="hidden" name="action" value="create_tier" />
                  <Button submit size="large">
                    + Add Tier
                  </Button>
                </Form>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
        
      </Layout>
    </Page>
  );
}

