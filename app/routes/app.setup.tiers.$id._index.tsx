import { type ActionFunctionArgs } from 'react-router';
import { Form, useNavigate, useActionData, useRouteLoaderData } from 'react-router';
import { useState, useEffect } from 'react';
import { 
  Page, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  TextField,
  InlineStack,
  Checkbox,
  Divider,
  Box,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import { crmManager } from '~/lib/crm/index.server';
import type { loader as tierLayoutLoader } from './app.setup.tiers.$id';

// Type for enriched promotions from the parent loader
type EnrichedPromotion = {
  id: string;
  club_stage_id: string;
  crm_id: string;
  crm_type: string;
  title: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  c7Data?: any;
};

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  const url = new URL(request.url);
  
  // Ensure HTTPS for embedded Commerce7 app
  if (url.protocol === 'http:') {
    url.protocol = 'https:';
  }
  
  try {
    if (actionType === 'delete_tier') {
      // Delete tier and redirect to tiers list
      await db.deleteClubStage(tierId);
      
      const redirectUrl = addSessionToUrl('/app/setup/tiers', session.id) + 
        '&toast=' + encodeURIComponent('Tier deleted successfully') +
        '&toastType=success';
      
      return {
        success: true,
        redirect: redirectUrl,
      };
    }
    
    if (actionType === 'update_tier_details') {
      const tierName = formData.get('tier_name') as string;
      const durationMonths = parseInt(formData.get('duration_months') as string);
      const minPurchaseAmount = parseFloat(formData.get('min_purchase_amount') as string);
      const minLtvAmount = parseFloat(formData.get('min_ltv_amount') as string) || 0;
      const upgradable = formData.get('upgradable') === 'true';
      
      // Update tier details in DB
      await db.updateClubStage(tierId, {
        name: tierName,
        durationMonths,
        minPurchaseAmount,
        minLtvAmount,
        upgradable,
      });
      
      // Sync with CRM
      const tier = await db.getClubStageWithDetails(tierId);
      if (tier) {
        const provider = crmManager.getProvider(session.crmType, session.tenantShop, session.accessToken);
        
        // Idempotent upsert - creates or updates as needed
        const result = await provider.upsertClub({
          id: tier.id,
          name: tierName,
          c7ClubId: tier.c7_club_id,
        });
        
        // Save CRM club ID if it was just created
        if (!tier.c7_club_id) {
          await db.updateClubStage(tierId, {
            c7ClubId: result.crmClubId,
          });
        }
      }
      
      // Return success feedback (stays on same route - no scroll)
      return {
        action: 'update_tier_details',
        success: 'Tier details updated successfully',
      };
    }
    
    if (actionType === 'toggle_loyalty') {
      const enabled = formData.get('loyalty_enabled') === 'true';
      
      if (enabled) {
        const earnRate = parseFloat(formData.get('earn_rate') as string) / 100; // Convert % to decimal
        const bonus = parseInt(formData.get('bonus_points') as string || '0');
        
        const tier = await db.getClubStageWithDetails(tierId);
        const existingLoyalty = await db.getTierLoyaltyConfig(tierId);
        
        if (!existingLoyalty && tier?.c7_club_id) {
          // Create new loyalty tier in CRM
          const provider = crmManager.getProvider(session.crmType, session.tenantShop, session.accessToken);
          try {
            const loyaltyTier = await provider.createLoyaltyTier({
              title: `${tier.name} Rewards`,
              qualificationType: "Club",
              clubsToQualify: [{ id: tier.c7_club_id }],
              earnRate,
              sortOrder: 0,
            });
            
            // Save to DB
            await db.createTierLoyaltyConfig({
              stageId: tierId,
              c7LoyaltyTierId: loyaltyTier.id,
              tierTitle: loyaltyTier.title,
              earnRate,
              initialPointsBonus: bonus,
            });
          } catch (error) {
            console.error('Failed to create loyalty tier:', error);
            // Continue - loyalty is optional
          }
        }
      } else {
        // Delete loyalty config
        const loyalty = await db.getTierLoyaltyConfig(tierId);
        if (loyalty) {
          const provider = crmManager.getProvider(session.crmType, session.tenantShop, session.accessToken);
          try {
            await provider.deleteLoyaltyTier(loyalty.c7_loyalty_tier_id);
          } catch (error) {
            console.error('Failed to delete loyalty tier from CRM:', error);
            // Continue - still delete from our DB
          }
        }
        await db.deleteTierLoyaltyConfig(tierId);
      }
      
      // Redirect with success toast (remove 'new' flag if present)
      url.searchParams.delete('new');
      url.searchParams.set('toast', enabled ? 'Loyalty rewards enabled' : 'Loyalty rewards disabled');
      url.searchParams.set('toastType', 'success');
      return Response.redirect(url.toString());
    }
    
    // Invalid action
    url.searchParams.set('toast', 'Invalid action');
    url.searchParams.set('toastType', 'error');
    return Response.redirect(url.toString());
  } catch (error) {
    // Return error feedback for same-route actions
    if (actionType === 'update_tier_details') {
      return {
        action: actionType,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
    
    // Redirect with error toast for route-changing actions
    url.searchParams.set('toast', error instanceof Error ? error.message : 'Unknown error occurred');
    url.searchParams.set('toastType', 'error');
    return Response.redirect(url.toString());
  }
}

export default function TierDetails() {
  const parentData = useRouteLoaderData<typeof tierLayoutLoader>('routes/app.setup.tiers.$id');
  if (!parentData) throw new Error('Parent loader data not found');
  
  const { tier, promotions: rawPromotions, loyalty, session } = parentData;
  const promotions = rawPromotions as EnrichedPromotion[];
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  // Check if this is a newly created tier (not yet customized)
  const isNewTier = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('new') === 'true';
  
  const [tierName, setTierName] = useState(tier.name);
  const [durationMonths, setDurationMonths] = useState(tier.duration_months.toString());
  const [minPurchaseAmount, setMinPurchaseAmount] = useState(tier.min_purchase_amount.toString());
  const [minLtvAmount, setMinLtvAmount] = useState(tier.min_ltv_amount?.toString() || '0');
  const [upgradable, setUpgradable] = useState(tier.upgradable ?? true);
  
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(!!loyalty);
  const [earnRate, setEarnRate] = useState(
    loyalty && loyalty.earn_rate !== null ? (loyalty.earn_rate * 100).toString() : '2'
  );
  const [bonusPoints, setBonusPoints] = useState(
    loyalty?.initial_points_bonus?.toString() || '0'
  );
  
  // Track feedback banner visibility
  const [showFeedback, setShowFeedback] = useState(true);
  
  // Reset feedback visibility when actionData changes
  useEffect(() => {
    if (actionData?.action === 'update_tier_details') {
      setShowFeedback(true);
      // Auto-hide after 4 seconds
      const timer = setTimeout(() => setShowFeedback(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionData]);
  
  // Track if tier details have been modified
  const tierDetailsChanged = 
    tierName !== tier.name ||
    durationMonths !== tier.duration_months.toString() ||
    minPurchaseAmount !== tier.min_purchase_amount.toString() ||
    minLtvAmount !== (tier.min_ltv_amount?.toString() || '0') ||
    upgradable !== (tier.upgradable ?? true);
  
  // Track if loyalty settings have been modified
  const loyaltyChanged = 
    loyaltyEnabled !== !!loyalty ||
    (loyaltyEnabled && (
      earnRate !== (loyalty && loyalty.earn_rate !== null ? (loyalty.earn_rate * 100).toString() : '2') ||
      bonusPoints !== (loyalty?.initial_points_bonus?.toString() || '0')
    ));
  
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  // Handle redirect after action
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      window.location.href = actionData.redirect;
    }
  }, [actionData]);
  
  return (
    <Page title={`${tier.is_active ? 'Edit' : 'View'} Tier: ${tierName}`}>
      <BlockStack gap="500">
        {/* Inactive Tier Warning */}
        {!tier.is_active && (
          <Banner tone="critical" title="Tier Inactive">
            <p>
              This tier was deleted in Commerce7 and cannot be edited or reactivated. 
              All form fields are read-only. Historical enrollment data is preserved.
            </p>
          </Banner>
        )}
        
        {/* Banners at Top */}
        {actionData?.action === 'update_tier_details' && showFeedback && (
          <div
            style={{
              animation: 'slideDown 0.3s ease-out',
            }}
          >
            {actionData.success && (
              <Banner tone="success" onDismiss={() => setShowFeedback(false)}>
                {actionData.success}
              </Banner>
            )}
            {actionData.error && (
              <Banner tone="critical" onDismiss={() => setShowFeedback(false)}>
                {actionData.error}
              </Banner>
            )}
          </div>
        )}

        {/* Navigation Buttons at Top */}
        <Box paddingBlockEnd="400">
          <InlineStack align="space-between">
            <Button
              onClick={() => navigate(addSessionToUrl('/app/setup/tiers', session.id))}
            >
              ← Back to Tiers
            </Button>
            
            <Button
              variant="primary"
              onClick={() => navigate(addSessionToUrl('/app/setup/review', session.id))}
            >
              Continue to Review →
            </Button>
          </InlineStack>
        </Box>
              {/* Tier Basic Info */}
              <section>
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h3">
                      Tier Details
                    </Text>
                    
                    <Form method="post">
                      <input type="hidden" name="action" value="update_tier_details" />
                      <BlockStack gap="400">
                        <TextField
                          label="Tier Name"
                          value={tierName}
                          onChange={setTierName}
                          name="tier_name"
                          autoComplete="off"
                          helpText="e.g., 'Bronze', 'Silver', 'Gold'"
                          disabled={!tier.is_active}
                        />
                        
                        <InlineStack gap="400">
                          <div style={{ flex: 1 }}>
                            <TextField
                              label="Duration (months)"
                              value={durationMonths}
                              onChange={setDurationMonths}
                              name="duration_months"
                              type="number"
                              autoComplete="off"
                              disabled={!tier.is_active}
                            />
                          </div>
                          
                          <div style={{ flex: 1 }}>
                            <TextField
                              label="Min Purchase ($)"
                              value={minPurchaseAmount}
                              onChange={setMinPurchaseAmount}
                              name="min_purchase_amount"
                              type="number"
                              autoComplete="off"
                              disabled={!tier.is_active}
                            />
                          </div>
                          
                          <div style={{ flex: 1 }}>
                            <TextField
                              label="Min LTV ($)"
                              value={minLtvAmount}
                              onChange={setMinLtvAmount}
                              name="min_ltv_amount"
                              type="number"
                              autoComplete="off"
                              disabled={!tier.is_active}
                            />
                          </div>
                        </InlineStack>
                        
                        <Checkbox
                          label="Members can upgrade to this tier"
                          checked={upgradable}
                          onChange={setUpgradable}
                          helpText="If unchecked, this tier can only be assigned manually (e.g., for high-value customers). Automatic tier progression will skip non-upgradable tiers."
                          disabled={!tier.is_active}
                        />
                        
                        <input type="hidden" name="upgradable" value={upgradable.toString()} />
                        
                        {tier.is_active && (
                          <InlineStack align="end">
                            <Button 
                              submit 
                              variant="primary"
                              disabled={!tierDetailsChanged}
                            >
                              Save Details
                            </Button>
                          </InlineStack>
                        )}
                      </BlockStack>
                    </Form>
                    
                    {!isNewTier && tier.is_active && (
                      <>
                        <Divider />
                        <Form method="post">
                          <input type="hidden" name="action" value="delete_tier" />
                          <Button 
                            submit 
                            tone="critical"
                          >
                            Delete Tier
                          </Button>
                        </Form>
                      </>
                    )}
                  </BlockStack>
                </Card>
              </section>
              
              {/* Promotions Section */}
              <section>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text variant="headingMd" as="h3">
                        Promotions ({promotions.length})
                      </Text>
                      {tier.is_active && (
                        <Button
                          onClick={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}/promotions/new`, session.id))}
                        >
                          + Add Promotion
                        </Button>
                      )}
                    </InlineStack>
                    
                    {promotions.length === 0 && (
                      <Banner tone="warning">
                        Add at least one promotion to make this tier functional.
                      </Banner>
                    )}
                    
                    {promotions.length > 0 && (
                      <BlockStack gap="200">
                        {promotions.map((promo: EnrichedPromotion) => (
                          <Card key={promo.id}>
                            <InlineStack align="space-between" blockAlign="center">
                              <BlockStack gap="100">
                                <Text variant="headingSm" as="h4">
                                  {promo.title || promo.c7Data?.title || 'Untitled Promotion'}
                                </Text>
                                {promo.c7Data && (
                                  <Text variant="bodySm" as="p" tone="subdued">
                                    {promo.c7Data.type} · {promo.c7Data.discountType} · 
                                    {promo.c7Data.discountType === 'Percentage Off' 
                                      ? ` ${(promo.c7Data.discount / 100).toFixed(0)}%` 
                                      : ` $${promo.c7Data.discount}`
                                    }
                                  </Text>
                                )}
                              </BlockStack>
                              <Button
                                onClick={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}/promotions/${promo.id}`, session.id))}
                                disabled={!tier.is_active}
                              >
                                {tier.is_active ? 'Edit' : 'View'}
                              </Button>
                            </InlineStack>
                          </Card>
                        ))}
                      </BlockStack>
                    )}
                  </BlockStack>
                </Card>
              </section>
              
              {/* Loyalty Section */}
              <section>
                <Form method="post">
                  <input type="hidden" name="action" value="toggle_loyalty" />
                  <input type="hidden" name="loyalty_enabled" value={loyaltyEnabled.toString()} />
                  <input type="hidden" name="earn_rate" value={earnRate} />
                  <input type="hidden" name="bonus_points" value={bonusPoints} />
                  
                  <Card>
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h3">
                        Loyalty Rewards
                      </Text>
                      
                      <Checkbox
                        label="Enable loyalty rewards for this tier"
                        checked={loyaltyEnabled}
                        onChange={setLoyaltyEnabled}
                        helpText="Members automatically earn points on all purchases"
                        disabled={!tier.is_active}
                      />
                      
                      {loyaltyEnabled && (
                        <BlockStack gap="300">
                          <Banner tone="info">
                            Members in this tier will automatically earn points on ALL purchases (not just club purchases).
                          </Banner>
                          
                          <TextField
                            label="Points Earn Rate (%)"
                            value={earnRate}
                            onChange={setEarnRate}
                            type="number"
                            suffix="%"
                            autoComplete="off"
                            helpText="Percentage of purchase amount earned as points (e.g., 2% means $100 purchase = 2 points)"
                            disabled={!tier.is_active}
                          />
                          
                          <TextField
                            label="Welcome Bonus Points"
                            value={bonusPoints}
                            onChange={setBonusPoints}
                            type="number"
                            autoComplete="off"
                            helpText="Bonus points awarded when member joins this tier (optional)"
                            disabled={!tier.is_active}
                          />
                          
                          {tier.is_active && (
                            <InlineStack align="end">
                              <Button 
                                submit 
                                variant="primary"
                                disabled={!loyaltyChanged}
                              >
                                Save Loyalty Config
                              </Button>
                            </InlineStack>
                          )}
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Card>
                </Form>
              </section>
              
      </BlockStack>
    </Page>
  );
}

