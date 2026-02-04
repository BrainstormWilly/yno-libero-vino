import { type ActionFunctionArgs } from 'react-router';
import { Form, useNavigate, useActionData, useRouteLoaderData, useSubmit } from 'react-router';
import { useState, useEffect, useMemo } from 'react';
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
import { getSupabaseClient, recalculateAndUpdateSetupComplete } from '~/lib/db/supabase.server';
import { crmManager, deletePromotion as crmDeletePromotion } from '~/lib/crm/index.server';
import type { loader as tierLayoutLoader } from './app.setup.tiers.$id';
import TierDetailsForm from '~/components/TierDetailsForm';

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
      const promotions = await db.getStagePromotions(tierId);
      for (const promo of promotions) {
        if (promo.crm_type === 'commerce7' && promo.crm_id) {
          try {
            await crmDeletePromotion(session, promo.crm_id);
          } catch (err) {
            console.error('Failed to delete C7 promotion:', promo.crm_id, err);
            return {
              success: false,
              error: `Failed to delete promotion in Commerce7: ${err instanceof Error ? err.message : 'Unknown error'}. Tier was not deleted.`,
            };
          }
        }
      }
      await db.deleteClubStage(tierId);
      
      // Recalculate setup progress
      await recalculateAndUpdateSetupComplete(session.clientId);
      
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
      const minLtvAmount = parseFloat(formData.get('min_ltv_amount') as string) || 0;
      const upgradable = formData.get('upgradable') === 'true';
      const tierType = formData.get('tier_type') as string || 'discount';
      const initialQualificationAllowed = formData.get('initial_qualification_allowed') !== 'false';
      const overrideRaw = formData.get('min_purchase_amount_override') as string;
      
      // Initial purchase = min_ltv_amount / 12 (LTV/12)
      const calculated = minLtvAmount / 12;
      const minPurchaseAmount =
        overrideRaw !== '' && overrideRaw != null && !Number.isNaN(parseFloat(overrideRaw))
          ? Math.max(0, parseFloat(overrideRaw))
          : calculated;
      
      // Check if tier exists - if not, create it
      const existingTier = await db.getClubStageWithDetails(tierId);
      const existingProgram = await db.getClubProgram(session.clientId);
      if (!existingProgram) {
        return {
          action: 'update_tier_details',
          error: 'Club program not found',
        };
      }
      
      if (!existingTier) {
        // Create new tier with the temp UUID as the actual ID
        const tierCount = existingProgram.club_stages?.length || 0;
        const supabase = getSupabaseClient();
        
        const insert: any = {
          id: tierId, // Use the temp UUID as the actual tier ID
          club_program_id: existingProgram.id,
          name: tierName,
          duration_months: durationMonths,
          min_purchase_amount: minPurchaseAmount,
          min_ltv_amount: minLtvAmount,
          stage_order: tierCount + 1,
          is_active: true,
          upgradable,
          tier_type: tierType,
          initial_qualification_allowed: initialQualificationAllowed,
        };
        
        const { data: newTiers, error } = await supabase
          .from('club_stages')
          .insert(insert)
          .select();
        
        if (error) {
          return {
            action: 'update_tier_details',
            error: `Failed to create tier: ${error.message}`,
          };
        }
        
        if (!newTiers || newTiers.length === 0) {
          return {
            action: 'update_tier_details',
            error: 'Failed to create tier: No data returned',
          };
        }
        
        // Sync with CRM
        const createdTier = newTiers[0];
        const provider = crmManager.getProvider(session.crmType, session.tenantShop, session.accessToken);
        const result = await provider.upsertClub({
          id: createdTier.id,
          name: tierName,
          c7ClubId: null,
        });
        
        // Save CRM club ID
        await db.updateClubStage(tierId, {
          c7ClubId: result.crmClubId,
        });
        
        // Recalculate setup progress
        await recalculateAndUpdateSetupComplete(session.clientId);
      } else {
        // Update existing tier
        await db.updateClubStage(tierId, {
          name: tierName,
          durationMonths,
          minPurchaseAmount,
          minLtvAmount,
          upgradable,
          tierType,
          initialQualificationAllowed,
        });
        
        // Sync with CRM
        const provider = crmManager.getProvider(session.crmType, session.tenantShop, session.accessToken);
        const result = await provider.upsertClub({
          id: existingTier.id,
          name: tierName,
          c7ClubId: existingTier.c7_club_id,
        });
        
        // Save CRM club ID if it was just created
        if (!existingTier.c7_club_id) {
          await db.updateClubStage(tierId, {
            c7ClubId: result.crmClubId,
          });
        }
      }
      
      // Recalculate setup progress
      await recalculateAndUpdateSetupComplete(session.clientId);
      
      // Return success feedback (stays on same route - no scroll)
      return {
        action: 'update_tier_details',
        success: existingTier ? 'Tier details updated successfully' : 'Tier created successfully',
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
  
  const { tier, promotions: rawPromotions, loyalty, session, isNewTier } = parentData;
  const promotions = rawPromotions as EnrichedPromotion[];
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();
  
  const [tierName, setTierName] = useState(tier.name);
  const [durationMonths, setDurationMonths] = useState(tier.duration_months.toString());
  const [minLtvAmount, setMinLtvAmount] = useState(tier.min_ltv_amount?.toString() || '0');
  const [upgradable, setUpgradable] = useState(tier.upgradable ?? true);
  const [tierType, setTierType] = useState((tier as any).tier_type || 'discount');
  const [initialQualificationAllowed, setInitialQualificationAllowed] = useState(
    tier.initial_qualification_allowed ?? true
  );
  const [minPurchaseOverride, setMinPurchaseOverride] = useState(() => {
    const calc = tier.min_ltv_amount ? (tier.min_ltv_amount / 12).toFixed(2) : '0.00';
    return tier.min_purchase_amount !== parseFloat(calc)
      ? String(tier.min_purchase_amount)
      : '';
  });
  
  // Initial purchase = min_ltv_amount / 12 (LTV/12)
  const calculatedMinPurchase = useMemo(() => {
    const minLtv = parseFloat(minLtvAmount) || 0;
    if (minLtv > 0) {
      return (minLtv / 12).toFixed(2);
    }
    return '0.00';
  }, [minLtvAmount]);
  
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(!!loyalty);
  const [earnRate, setEarnRate] = useState(
    loyalty && loyalty.earn_rate !== null ? (loyalty.earn_rate * 100).toString() : '2'
  );
  const [bonusPoints, setBonusPoints] = useState(
    loyalty?.initial_points_bonus?.toString() || '0'
  );
  
  // Track feedback banner visibility
  const [showFeedback, setShowFeedback] = useState(true);
  
  // Reset form only when tier id or tier data actually changes (not on object reference change)
  useEffect(() => {
    setTierName(tier.name);
    setDurationMonths(tier.duration_months.toString());
    setMinLtvAmount(tier.min_ltv_amount?.toString() || '0');
    setUpgradable(tier.upgradable ?? true);
    setTierType((tier as any).tier_type || 'discount');
    setInitialQualificationAllowed(tier.initial_qualification_allowed ?? true);
    const calc = tier.min_ltv_amount ? (tier.min_ltv_amount / 12).toFixed(2) : '0.00';
    setMinPurchaseOverride(
      tier.min_purchase_amount !== parseFloat(calc) ? String(tier.min_purchase_amount) : ''
    );
  }, [tier.id, tier.name, tier.duration_months, tier.min_ltv_amount, tier.min_purchase_amount, tier.upgradable, tier.initial_qualification_allowed]);
  
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
    minLtvAmount !== (tier.min_ltv_amount?.toString() || '0') ||
    upgradable !== (tier.upgradable ?? true) ||
    tierType !== ((tier as any).tier_type || 'discount') ||
    initialQualificationAllowed !== (tier.initial_qualification_allowed ?? true) ||
    (() => {
      const calc = tier.min_ltv_amount ? (tier.min_ltv_amount / 12).toFixed(2) : '0.00';
      const expectedOverride = tier.min_purchase_amount !== parseFloat(calc)
        ? String(tier.min_purchase_amount)
        : '';
      return minPurchaseOverride !== expectedOverride;
    })();
  
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
                  <Form method="post">
                    <BlockStack gap="400">
                      <TierDetailsForm
                        tierName={tierName}
                        durationMonths={durationMonths}
                        minLtvAmount={minLtvAmount}
                        upgradable={upgradable}
                        initialQualificationAllowed={initialQualificationAllowed}
                        minPurchaseOverride={minPurchaseOverride}
                        calculatedMinPurchase={calculatedMinPurchase}
                        tierType={tierType}
                        onTierNameChange={setTierName}
                        onDurationMonthsChange={setDurationMonths}
                        onMinLtvAmountChange={setMinLtvAmount}
                        onUpgradableChange={setUpgradable}
                        onInitialQualificationAllowedChange={setInitialQualificationAllowed}
                        onMinPurchaseOverrideChange={setMinPurchaseOverride}
                        onTierTypeChange={setTierType}
                        actionName="update_tier_details"
                        disabled={!tier.is_active}
                        showTierType={true}
                        showMinPurchaseInline={true}
                        tierNameHelpText="e.g., 'Bronze', 'Silver', 'Gold'"
                        submitButtonLabel="Save Details"
                        submitButtonDisabled={!tier.is_active || !tierDetailsChanged}
                      />
                      {!isNewTier && tier.is_active && (
                        <>
                          <Divider />
                          <Button
                            tone="critical"
                            onClick={() => {
                              const promoCount = promotions.length;
                              const promoWarning = promoCount > 0
                                ? ` Deleting this tier will also permanently delete its ${promoCount} promotion(s) in Commerce7.`
                                : '';
                              if (confirm(`Are you sure you want to delete this tier?${promoWarning} This cannot be undone.`)) {
                                const fd = new FormData();
                                fd.set('action', 'delete_tier');
                                submit(fd, { method: 'post' });
                              }
                            }}
                          >
                            Delete Tier
                          </Button>
                        </>
                      )}
                    </BlockStack>
                  </Form>
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
                      {tier.is_active && !isNewTier && (
                        <Button
                          onClick={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}/promotions/new`, session.id))}
                        >
                          + Add Promotion
                        </Button>
                      )}
                      {isNewTier && (
                        <Banner tone="info">
                          Save tier details before adding promotions.
                        </Banner>
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
                        disabled={!tier.is_active || isNewTier}
                      />
                      {isNewTier && (
                        <Banner tone="info">
                          Save tier details before configuring loyalty rewards.
                        </Banner>
                      )}
                      
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

