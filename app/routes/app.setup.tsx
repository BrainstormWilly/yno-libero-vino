import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, redirect, useNavigate } from 'react-router';
import { useState, useEffect, useMemo } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  InlineStack,
  ProgressBar,
  TextField,
  Box,
  Divider,
} from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { createDefaultDiscount, type Discount, type SerializedDiscount, serializeDiscount, parseDiscount } from '~/types/discount';
import { setupAutoResize, scrollToTop } from '~/util/iframe-helper';
import { useCrmProvider } from '~/hooks/useCrmProvider';
import { addSessionToUrl } from '~/util/session';
import WelcomeStep from '~/components/setup-steps/WelcomeStep';
import ClubNameStep from '~/components/setup-steps/ClubNameStep';
import TiersStep from '~/components/setup-steps/TiersStep';
import LoyaltyPointsStep from '~/components/setup-steps/LoyaltyPointsStep';
import ReviewStep from '~/components/setup-steps/ReviewStep';
import { 
  fetchDevModeData,
  getClientData,
  getLoyaltyRules,
  getExistingProgramWithDiscounts
} from '~/lib/setup-loader-helpers.server';
import {
  parseSetupFormData,
  validateSetupData,
  createClubProgram,
  createClubTiers,
  createTierDiscounts,
  createLoyaltyRules,
  markSetupComplete,
  rollbackClubProgram,
  updateClubProgram,
  updateExistingTier,
  createNewTier,
  syncTierDiscount,
  deleteTier,
  updateLoyaltyRules,
  isExistingTier,
  buildSuccessRedirect
} from '~/lib/setup-action-helpers.server';

interface TierFormData {
  id: string; // temp ID for form tracking
  name: string;
  durationMonths: string;
  minPurchaseAmount: string;
  description?: string;
  
  // NEW ARCHITECTURE: Multiple promotions per tier
  promotions: Array<{
    id: string; // temp ID for form tracking
    title: string;
    productDiscountType?: string; // "Percentage Off" | "Dollar Off" | "No Discount"
    productDiscount?: number;
    shippingDiscountType?: string; // "Percentage Off" | "Dollar Off" | "No Discount"
    shippingDiscount?: number;
    minimumCartAmount?: number;
  }>;
  
  // NEW ARCHITECTURE: Optional loyalty configuration
  loyalty?: {
    enabled: boolean;
    earnRate: number; // decimal, e.g., 0.02 = 2%
    initialPointsBonus?: number; // welcome bonus points
  };
  
  // OLD FIELDS (deprecated, for backwards compatibility)
  discountPercentage?: string;
  discount?: Discount;
  showDiscountForm?: boolean;
}

// For backwards compatibility - serialized version is same as TierFormData now
// (promotions and loyalty don't have date fields that need special serialization)
type TierFormDataSerialized = TierFormData;

export async function loader({ request }: LoaderFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  
  // DEV MODE: Get fake dev client (already created by parent /app route)
  if (process.env.NODE_ENV === 'development' && process.env.EMBEDDED_APP === 'no' && session.crmType === 'commerce7') {
    const data = await fetchDevModeData(session.clientId);
    return { 
      session,
      ...data,
    };
  }
  
  // Get client info
  const client = await getClientData(session.clientId);
  
  // Get loyalty rules
  const loyaltyRules = await getLoyaltyRules(session.clientId);
  
  // Fetch existing program with enriched discount data
  const existingProgram = await getExistingProgramWithDiscounts(
    session.clientId,
    session.tenantShop,
    session.crmType
  );
  
  return {
    session,
    client,
    existingProgram,
    loyaltyRules,
    hasSetup: !!existingProgram && !!loyaltyRules,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  const formData = await request.formData();
  const action = formData.get('action') as string;
  
  try {
    if (action === 'complete_setup') {
      const data = parseSetupFormData(formData);
      
      const validation = validateSetupData(data);
      if (!validation.success) {
        return validation;
      }
      
      // Create club program
      let clubProgram;
      try {
        clubProgram = await createClubProgram(
          session.clientId,
          data.clubName,
          data.clubDescription
        );
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to create club program'
        };
      }
      
      // Create tiers
      let createdTiers;
      try {
        createdTiers = await createClubTiers(clubProgram.id, data.tiers);
      } catch (error) {
        await rollbackClubProgram(clubProgram.id);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to create tiers'
        };
      }
      
      // Create tags and discounts in Commerce7/Shopify for each tier
      const discountCreationErrors = await createTierDiscounts(
        data.tiers,
        createdTiers,
        session.crmType,
        session.tenantShop
      );
      
      if (discountCreationErrors.length > 0) {
        console.warn('Some discounts failed to create:', discountCreationErrors);
      }
      
      // Create loyalty point rules
      try {
        await createLoyaltyRules(
          session.clientId,
          data.pointsPerDollar,
          data.minMembershipDays,
          data.pointDollarValue,
          data.minPointsRedemption
        );
      } catch (error) {
        await rollbackClubProgram(clubProgram.id);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to create loyalty rules'
        };
      }
      
      // Mark setup as complete in clients table
      await markSetupComplete(session.clientId);
      
      // Redirect to settings with success toast
      buildSuccessRedirect(
        session.id,
        'Club setup completed successfully!',
        discountCreationErrors
      );
    }
    
    if (action === 'update_setup') {
      const data = parseSetupFormData(formData);
      
      const validation = validateSetupData(data);
      if (!validation.success) {
        return validation;
      }
      
      // Get existing program
      const { getExistingProgram } = await import('~/lib/setup-loader-helpers.server');
      const existingProgram = await getExistingProgram(session.clientId);
      
      if (!existingProgram) {
        return {
          success: false,
          message: 'No existing club program found. Please use initial setup instead.'
        };
      }
      
      // Update club program
      try {
        await updateClubProgram(
          existingProgram.id,
          data.clubName,
          data.clubDescription
        );
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to update club program'
        };
      }
      
      // Handle tier updates (add/update/delete)
      const existingTierIds = new Set<string>(existingProgram.club_stages.map((s: any) => s.id));
      const updatedTierIds = new Set<string>();
      const discountUpdateErrors: string[] = [];
      
      // Process each tier from the form
      for (let i = 0; i < data.tiers.length; i++) {
        const tier = data.tiers[i];
        const stageOrder = i + 1;
        
        if (isExistingTier(tier.id) && existingTierIds.has(tier.id)) {
          // UPDATE existing tier
          updatedTierIds.add(tier.id);
          
          try {
            await updateExistingTier(tier, stageOrder);
          } catch (error) {
            console.error(error instanceof Error ? error.message : 'Failed to update tier');
            continue;
          }
          
          // Sync Commerce7 tag and coupon (handles all edge cases)
          const existingTier = existingProgram.club_stages.find((s: any) => s.id === tier.id);
          const syncError = await syncTierDiscount(
            tier,
            existingTier,
            session.crmType,
            session.tenantShop
          );
          
          if (syncError) {
            discountUpdateErrors.push(syncError);
          }
        } else {
          // CREATE new tier
          let newTier;
          try {
            newTier = await createNewTier(existingProgram.id, tier, stageOrder);
            updatedTierIds.add(newTier.id);
          } catch (error) {
            console.error(error instanceof Error ? error.message : 'Failed to create tier');
            continue;
          }
          
          // Create discount for new tier
          const createErrors = await createTierDiscounts(
            [tier],
            [newTier],
            session.crmType,
            session.tenantShop
          );
          
          discountUpdateErrors.push(...createErrors);
        }
      }
      
      // DELETE tiers that were removed
      const tiersToDelete = Array.from(existingTierIds).filter(id => !updatedTierIds.has(id));
      for (const tierIdToDelete of tiersToDelete) {
        const tierToDelete = existingProgram.club_stages.find((s: any) => s.id === tierIdToDelete);
        
        await deleteTier(
          tierIdToDelete,
          tierToDelete,
          session.crmType,
          session.tenantShop
        );
      }
      
      // Update loyalty point rules
      try {
        await updateLoyaltyRules(
          session.clientId,
          data.pointsPerDollar,
          data.minMembershipDays,
          data.pointDollarValue,
          data.minPointsRedemption
        );
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to update loyalty rules'
        };
      }
      
      // Redirect to settings with success toast
      buildSuccessRedirect(
        session.id,
        'Club setup updated successfully!',
        discountUpdateErrors
      );
    }
    
    return { success: false, message: 'Invalid action' };
    
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export default function Setup() {
  const { client, existingProgram, loyaltyRules, hasSetup, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const crm = useCrmProvider(session);
  
  // Determine if we're in edit mode
  const isEditMode = !!existingProgram;
  
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // Form state
  const [clubName, setClubName] = useState(existingProgram?.name || `${client.org_name} Wine Club`);
  const [clubDescription, setClubDescription] = useState(
    existingProgram?.description || 
    'Liberate your wine buying experience. Enjoy member pricing on your schedule - no forced shipments, no surprises.'
  );
  
  // Helper to create default promotion for a tier
  const createDefaultPromotion = (tierName: string, discountPercent: number) => ({
    id: `promo-${Date.now()}`,
    title: `${tierName} - ${discountPercent}% Off`,
    productDiscountType: 'Percentage Off',
    productDiscount: discountPercent,
    shippingDiscountType: 'No Discount',
  });
  
  const [tiers, setTiers] = useState<TierFormData[]>(
    existingProgram?.club_stages?.map((stage: any) => ({
      id: stage.id, // Use actual UUID for existing tiers
      name: stage.name,
      durationMonths: stage.duration_months.toString(),
      minPurchaseAmount: stage.min_purchase_amount.toString(),
      description: stage.description || '',
      // Map promotions from database
      promotions: stage.promotions?.map((promo: any) => ({
        id: promo.id,
        title: promo.title || promo.c7Data?.title || 'Untitled Promotion',
        productDiscountType: promo.c7Data?.productDiscountType,
        productDiscount: promo.c7Data?.productDiscount,
        shippingDiscountType: promo.c7Data?.shippingDiscountType,
        shippingDiscount: promo.c7Data?.shippingDiscount,
        minimumCartAmount: promo.c7Data?.minimumCartAmount,
      })) || [],
      // Map loyalty from database
      loyalty: stage.loyalty ? {
        enabled: true,
        earnRate: stage.loyalty.earn_rate || 0.01,
        initialPointsBonus: stage.loyalty.initial_points_bonus || 0,
      } : undefined,
    })) || [
      {
        id: 'tier-1',
        name: 'Bronze',
        durationMonths: '3',
        minPurchaseAmount: '150',
        description: 'Start your liberation journey',
        promotions: [
          createDefaultPromotion('Bronze', 10),
        ],
        loyalty: undefined, // No loyalty for default tier
      }
    ]
  );
  
  const [pointsPerDollar, setPointsPerDollar] = useState(
    loyaltyRules?.points_per_dollar?.toString() || '1'
  );
  const [minMembershipDays, setMinMembershipDays] = useState(
    loyaltyRules?.min_membership_days?.toString() || '365'
  );
  const [pointDollarValue, setPointDollarValue] = useState(
    loyaltyRules?.point_dollar_value?.toString() || '0.01'
  );
  const [minPointsRedemption, setMinPointsRedemption] = useState(
    loyaltyRules?.min_points_for_redemption?.toString() || '100'
  );
  
  // Collections are now handled by useCrmProvider (like products)
  
  const progressPercent = (currentStep / totalSteps) * 100;
  
  // Setup auto-resize for embedded iframe on mount
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  // Scroll to top when step changes (ResizeObserver handles height updates automatically)
  useEffect(() => {
    scrollToTop();
  }, [currentStep]);
  
  const addTier = () => {
    setTiers([...tiers, {
      id: `tier-${Date.now()}`,
      name: '',
      durationMonths: '',
      minPurchaseAmount: '',
      description: '',
      promotions: [
        {
          id: `promo-${Date.now()}`,
          title: '',
          productDiscountType: 'Percentage Off',
          productDiscount: 0,
          shippingDiscountType: 'No Discount',
        }
      ],
      loyalty: undefined, // No loyalty by default
    }]);
  };
  
  const removeTier = (id: string) => {
    setTiers(tiers.filter(t => t.id !== id));
  };
  
  const updateTier = (id: string, field: keyof TierFormData, value: string) => {
    setTiers(tiers.map(t => {
      if (t.id !== id) return t;
      
      const updated = { ...t, [field]: value };
      
      // Sync tier fields with discount
      if (updated.discount) {
        if (field === 'name' && value) {
          const cleanName = value.toUpperCase().replace(/\s+/g, '');
          updated.discount.code = `${cleanName}${updated.discountPercentage || ''}`;
          updated.discount.title = `${value} Tier - ${updated.discountPercentage || 0}% Off`;
        } else if (field === 'discountPercentage' && value) {
          updated.discount.value = {
            type: 'percentage',
            percentage: parseFloat(value) || 0,
          };
          if (updated.name) {
            const cleanName = updated.name.toUpperCase().replace(/\s+/g, '');
            updated.discount.code = `${cleanName}${value}`;
            updated.discount.title = `${updated.name} Tier - ${value}% Off`;
          }
        } else if (field === 'minPurchaseAmount' && value) {
          // Update discount minimum requirement
          updated.discount.minimumRequirement = {
            type: 'amount',
            amount: Math.round(parseFloat(value) * 100), // Convert to cents
          };
        }
      }
      
      return updated;
    }));
  };
  
  const updateTierDiscount = (id: string, discount: Discount) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, discount } : t));
  };
  
  const toggleDiscountForm = (id: string) => {
    setTiers(tiers.map(t => 
      t.id === id ? { ...t, showDiscountForm: !t.showDiscountForm } : t
    ));
  };
  
  // Load products from platform
  const loadProducts = async (q?: string) => {
    crm.getProducts({ q, limit: 25 });
  };
  
  // Load collections from platform
  const loadCollections = async (q?: string) => {
    crm.getCollections({ q, limit: 25 });
  };
  
  const moveTier = (index: number, direction: 'up' | 'down') => {
    const newTiers = [...tiers];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex >= 0 && swapIndex < tiers.length) {
      [newTiers[index], newTiers[swapIndex]] = [newTiers[swapIndex], newTiers[index]];
      setTiers(newTiers);
    }
  };
  
  const canProceed = () => {
    switch (currentStep) {
      case 1: return true; // Welcome
      case 2: return clubName.length > 0;
      case 3: return tiers.length > 0 && tiers.every(t => 
        t.name && t.discountPercentage && t.durationMonths && t.minPurchaseAmount
      );
      case 4: return pointsPerDollar && minMembershipDays && pointDollarValue;
      case 5: return true; // Review
      default: return false;
    }
  };

  return (
    <Page
      title={isEditMode ? "Edit Club Setup" : "LiberoVino Club Setup"}
      backAction={{ content: 'Cancel', onAction: () => navigate(addSessionToUrl('/app', session.id)) }}
    >
      <div style={{ paddingBottom: '80px' }}>
      <Layout>
        {/* Progress Bar */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Step {currentStep} of {totalSteps}
                </Text>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  {progressPercent.toFixed(0)}% Complete
                </Text>
              </InlineStack>
              <ProgressBar progress={progressPercent} size="small" tone="primary" />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Error Messages */}
        {actionData && !actionData.success && (
          <Layout.Section>
            <Banner tone="critical" title={actionData.message} />
          </Layout.Section>
        )}

        {/* Step Content */}
        <Layout.Section>
          {currentStep === 1 && <WelcomeStep />}

          {currentStep === 2 && (
            <ClubNameStep
              clubName={clubName}
              clubDescription={clubDescription}
              onClubNameChange={setClubName}
              onClubDescriptionChange={setClubDescription}
            />
          )}

          {currentStep === 3 && (
            <TiersStep
              tiers={tiers}
              sessionCrmType={session.crmType}
              availableProducts={crm.products || []}
              availableCollections={crm.collections || []}
              isLoading={crm.productsLoading || crm.collectionsLoading}
              onAddTier={addTier}
              onRemoveTier={removeTier}
              onMoveTier={moveTier}
              onUpdateTier={updateTier}
              onUpdateTierDiscount={updateTierDiscount}
              onToggleDiscountForm={toggleDiscountForm}
              onLoadProducts={loadProducts}
              onLoadCollections={loadCollections}
            />
          )}

          {currentStep === 4 && (
            <LoyaltyPointsStep
              pointsPerDollar={pointsPerDollar}
              minMembershipDays={minMembershipDays}
              pointDollarValue={pointDollarValue}
              minPointsRedemption={minPointsRedemption}
              onPointsPerDollarChange={setPointsPerDollar}
              onMinMembershipDaysChange={setMinMembershipDays}
              onPointDollarValueChange={setPointDollarValue}
              onMinPointsRedemptionChange={setMinPointsRedemption}
            />
          )}

          {currentStep === 5 && (
            <ReviewStep
              clubName={clubName}
              clubDescription={clubDescription}
              tiers={tiers}
              pointsPerDollar={pointsPerDollar}
              minMembershipDays={minMembershipDays}
              pointDollarValue={pointDollarValue}
              minPointsRedemption={minPointsRedemption}
            />
          )}
        </Layout.Section>

        {/* Navigation Buttons */}
        <Layout.Section>
          <Card>
            <InlineStack align="space-between">
              <Button
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
              >
                ← Previous
              </Button>
              
              {currentStep < totalSteps ? (
                <Button
                  variant="primary"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!canProceed()}
                >
                  Next →
                </Button>
              ) : (
                <Form method="post">
                  <input type="hidden" name="action" value={isEditMode ? "update_setup" : "complete_setup"} />
                  <input type="hidden" name="club_name" value={clubName} />
                  <input type="hidden" name="club_description" value={clubDescription} />
                  <input type="hidden" name="tiers" value={JSON.stringify(tiers.map(t => ({
                    ...t,
                    discount: t.discount ? serializeDiscount(t.discount) : undefined
                  })))} />
                  <input type="hidden" name="points_per_dollar" value={pointsPerDollar} />
                  <input type="hidden" name="min_membership_days" value={minMembershipDays} />
                  <input type="hidden" name="point_dollar_value" value={pointDollarValue} />
                  <input type="hidden" name="min_points_redemption" value={minPointsRedemption} />
                  <Button variant="primary" submit>
                    {isEditMode ? 'Update Setup 💾' : 'Complete Setup ✨'}
                  </Button>
                </Form>
              )}
            </InlineStack>
          </Card>
        </Layout.Section>
      </Layout>
      </div>
    </Page>
  );
}

