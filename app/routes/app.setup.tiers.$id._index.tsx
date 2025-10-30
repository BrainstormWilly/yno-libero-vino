import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  TextField,
  InlineStack,
  Checkbox,
  Box,
  Divider,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import TierSummary from '~/components/TierSummary';

// Type for enriched promotions from the loader
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

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id;
  if (!tierId) {
    throw new Error('Tier ID required');
  }
  
  const tier = await db.getClubStageWithDetails(tierId);
  if (!tier) {
    throw new Response('Tier not found', { status: 404 });
  }
  
  // Fetch promotions
  const promotions = await db.getStagePromotions(tierId);
  
  // Fetch loyalty config
  const loyalty = await db.getTierLoyaltyConfig(tierId);
  
  // Fetch full C7 promotion details if C7
  let enrichedPromotions = promotions;
  if (session.crmType === 'commerce7' && tier.c7_club_id) {
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
    session,
    tier,
    promotions: enrichedPromotions,
    loyalty,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  const url = new URL(request.url);
  
  try {
    if (actionType === 'update_tier_details') {
      const tierName = formData.get('tier_name') as string;
      const durationMonths = parseInt(formData.get('duration_months') as string);
      const minPurchaseAmount = parseFloat(formData.get('min_purchase_amount') as string);
      
      await db.updateClubStage(tierId, {
        name: tierName,
        durationMonths,
        minPurchaseAmount,
      });
      
      // Redirect with success toast
      url.searchParams.set('toast', 'Tier details updated successfully');
      url.searchParams.set('toastType', 'success');
      return Response.redirect(url.toString());
    }
    
    if (actionType === 'toggle_loyalty') {
      const enabled = formData.get('loyalty_enabled') === 'true';
      
      if (enabled) {
        const earnRate = parseFloat(formData.get('earn_rate') as string) / 100; // Convert % to decimal
        const bonus = parseInt(formData.get('bonus_points') as string || '0');
        
        const tier = await db.getClubStageWithDetails(tierId);
        const existingLoyalty = await db.getTierLoyaltyConfig(tierId);
        
        if (!existingLoyalty && tier?.c7_club_id) {
          // Create new loyalty tier in C7
          const provider = new Commerce7Provider(session.tenantShop);
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
        }
      } else {
        // Delete loyalty config
        const loyalty = await db.getTierLoyaltyConfig(tierId);
        if (loyalty && session.crmType === 'commerce7') {
          const provider = new Commerce7Provider(session.tenantShop);
          await provider.deleteLoyaltyTier(loyalty.c7_loyalty_tier_id);
        }
        await db.deleteTierLoyaltyConfig(tierId);
      }
      
      // Redirect with success toast
      url.searchParams.set('toast', enabled ? 'Loyalty rewards enabled' : 'Loyalty rewards disabled');
      url.searchParams.set('toastType', 'success');
      return Response.redirect(url.toString());
    }
    
    // Invalid action
    url.searchParams.set('toast', 'Invalid action');
    url.searchParams.set('toastType', 'error');
    return Response.redirect(url.toString());
  } catch (error) {
    // Redirect with error toast
    url.searchParams.set('toast', error instanceof Error ? error.message : 'Unknown error occurred');
    url.searchParams.set('toastType', 'error');
    return Response.redirect(url.toString());
  }
}

export default function TierDetails() {
  const { tier, promotions: rawPromotions, loyalty, session } = useLoaderData<typeof loader>();
  const promotions = rawPromotions as EnrichedPromotion[];
  const navigate = useNavigate();
  
  const [tierName, setTierName] = useState(tier.name);
  const [durationMonths, setDurationMonths] = useState(tier.duration_months.toString());
  const [minPurchaseAmount, setMinPurchaseAmount] = useState(tier.min_purchase_amount.toString());
  
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(!!loyalty);
  const [earnRate, setEarnRate] = useState(
    loyalty && loyalty.earn_rate !== null ? (loyalty.earn_rate * 100).toString() : '2'
  );
  const [bonusPoints, setBonusPoints] = useState(
    loyalty?.initial_points_bonus?.toString() || '0'
  );
  
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  return (
    <Page
      title={`Edit Tier: ${tierName}`}
      backAction={{ 
        content: 'Back to Tiers', 
        onAction: () => navigate(addSessionToUrl('/app/setup/tiers', session.id)) 
      }}
    >
      <Layout>
        {/* Main Content - Left Side */}
        <Layout.Section>
          <main>
            <BlockStack gap="500">
              {/* Tier Basic Info */}
              <section>
                <Form method="post">
                  <input type="hidden" name="action" value="update_tier_details" />
                  
                  <Card>
                    <BlockStack gap="400">
                      <Text variant="headingMd" as="h3">
                        Tier Details
                      </Text>
                      
                      <TextField
                        label="Tier Name"
                        value={tierName}
                        onChange={setTierName}
                        name="tier_name"
                        autoComplete="off"
                        helpText="e.g., 'Bronze', 'Silver', 'Gold'"
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
                          />
                        </div>
                      </InlineStack>
                      
                      <InlineStack align="end">
                        <Button submit variant="primary">
                          Save Details
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                </Form>
              </section>
              
              {/* Promotions Section */}
              <section>
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text variant="headingMd" as="h3">
                        Promotions ({promotions.length})
                      </Text>
                      <Button
                        onClick={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}/promotions/new`, session.id))}
                      >
                        + Add Promotion
                      </Button>
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
                              >
                                Edit
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
                          />
                          
                          <TextField
                            label="Welcome Bonus Points"
                            value={bonusPoints}
                            onChange={setBonusPoints}
                            type="number"
                            autoComplete="off"
                            helpText="Bonus points awarded when member joins this tier (optional)"
                          />
                          
                          <InlineStack align="end">
                            <Button submit variant="primary">
                              Save Loyalty Config
                            </Button>
                          </InlineStack>
                        </BlockStack>
                      )}
                    </BlockStack>
                  </Card>
                </Form>
              </section>
            </BlockStack>
          </main>
        </Layout.Section>

        {/* Summary Panel - Right Side */}
        <Layout.Section variant="oneThird">
          <aside>
            <TierSummary 
              tier={tier} 
              promotions={promotions.map(p => ({
                id: p.id,
                title: p.title || p.c7Data?.title || 'Untitled Promotion',
                c7Data: p.c7Data,
              }))}
              loyalty={loyalty && loyalty.earn_rate !== null && loyalty.initial_points_bonus !== null ? {
                earn_rate: loyalty.earn_rate,
                initial_points_bonus: loyalty.initial_points_bonus,
              } : null}
            />
          </aside>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

