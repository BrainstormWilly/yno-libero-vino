import { type ActionFunctionArgs } from 'react-router';
import { useRouteLoaderData, Form, useActionData, useLocation, useNavigate, useSubmit, useNavigation } from 'react-router';
import { useState, useMemo, useEffect } from 'react';
import { 
  Page, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  Box,
  InlineGrid,
  Divider,
  useBreakpoints,
  Link,
  List,
} from '@shopify/polaris';
import { getAppSession } from '~/lib/sessions.server';
import { getMainNavigationActions } from '~/util/navigation';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import { recalculateAndUpdateSetupComplete } from '~/lib/db/supabase.server';
import * as crm from '~/lib/crm/index.server';
import { deleteTierCrmResources } from '~/lib/club-tier-promotions.server';
import type { loader as tierLayoutLoader } from './app.settings.club_tiers.$id';
import TierDetailsForm from '~/components/TierDetailsForm';
import { TierLoyaltySection } from '~/components/TierLoyaltySection';

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  
  if (actionType === 'update_tier') {
    const tierName = (formData.get('tier_name') as string)?.trim() ?? '';
    const durationMonthsRaw = formData.get('duration_months') as string;
    const minLtvAmountRaw = formData.get('min_ltv_amount') as string;
    const durationMonths = parseInt(durationMonthsRaw, 10);
    const minLtvAmount = parseFloat(minLtvAmountRaw);
    const overrideRaw = formData.get('min_purchase_amount_override') as string;
    const initialQualificationAllowed = formData.get('initial_qualification_allowed') !== 'false';
    const upgradable = formData.get('upgradable') !== 'false';

    if (!tierName) {
      return { success: false, message: 'Tier name is required.', action: 'update_tier' };
    }
    if (Number.isNaN(durationMonths) || durationMonths < 1 || durationMonths > 12) {
      return { success: false, message: 'Duration must be between 1 and 12 months.', action: 'update_tier' };
    }
    if (Number.isNaN(minLtvAmount) || minLtvAmount <= 0) {
      return { success: false, message: 'Minimum Annual LTV is required and must be greater than 0.', action: 'update_tier' };
    }
    if (initialQualificationAllowed && overrideRaw !== '' && overrideRaw != null) {
      const overrideNum = parseFloat(overrideRaw);
      if (Number.isNaN(overrideNum)) {
        return { success: false, message: 'Initial purchase amount must be a number.', action: 'update_tier' };
      }
      if (overrideNum > minLtvAmount) {
        return {
          success: false,
          message: 'Initial purchase amount cannot exceed Minimum Annual LTV.',
          action: 'update_tier',
        };
      }
    }

    const calculated = minLtvAmount / 12;
    const minPurchaseAmount =
      overrideRaw !== '' && overrideRaw != null && !Number.isNaN(parseFloat(overrideRaw))
        ? Math.max(0, parseFloat(overrideRaw))
        : calculated;

    await db.updateClubStage(tierId, {
      name: tierName,
      durationMonths,
      minPurchaseAmount,
      minLtvAmount,
      initialQualificationAllowed,
      upgradable,
    });

    // Sync tier to C7 if missing (e.g. tier was created in settings before sync)
    const updatedTier = await db.getClubStageWithDetails(tierId);
    if (updatedTier && !updatedTier.c7_club_id && session.crmType === 'commerce7') {
      const provider = crm.crmManager.getProvider(session.crmType, session.tenantShop, session.accessToken);
      const result = await provider.upsertClub({
        id: tierId,
        name: tierName,
        c7ClubId: null,
      });
      await db.updateClubStage(tierId, { c7ClubId: result.crmClubId });
    }

    return {
      success: true,
      message: 'Tier updated successfully',
      action: 'update_tier',
    };
  }

  if (actionType === 'delete_tier') {
    const enrollmentCount = await db.getEnrollmentCountForStage(tierId);
    if (enrollmentCount > 0) {
      return {
        success: false,
        message: 'Cannot delete a tier that has members. Move or remove members first.',
        action: 'delete_tier',
      };
    }

    try {
      await deleteTierCrmResources(session, tierId);
    } catch (err) {
      return {
        success: false,
        message: `Failed to delete tier in CRM: ${err instanceof Error ? err.message : 'Unknown error'}. Tier was not deleted.`,
        action: 'delete_tier',
      };
    }

    await db.deleteClubStage(tierId);
    
    // Recalculate setup progress - if it drops below 100%, setup_complete will be set to false
    await recalculateAndUpdateSetupComplete(session.clientId);
    
    // Check if setup is now incomplete - if so, redirect to setup instead of settings
    const client = await db.getClient(session.clientId);
    const redirectPath = client?.setup_complete ? '/app/settings/club_tiers' : '/app/setup/tiers';
    const redirectUrl = addSessionToUrl(redirectPath, session.id);
    
    return {
      success: true,
      redirect: redirectUrl,
    };
  }

  if (actionType === 'toggle_loyalty') {
    const enabled = formData.get('loyalty_enabled') === 'true';
    let message: string;

    if (enabled) {
      const earnRate = parseFloat(formData.get('earn_rate') as string) / 100;
      const bonus = parseInt(formData.get('bonus_points') as string || '0');

      const tier = await db.getClubStageWithDetails(tierId);
      const existingLoyalty = await db.getTierLoyaltyConfig(tierId);
      const provider = crm.crmManager.getProvider(
        session.crmType,
        session.tenantShop,
        session.accessToken
      );

      if (!existingLoyalty && tier?.c7_club_id) {
        try {
          const loyaltyTier = await provider.createLoyaltyTier({
            title: `${tier.name} Rewards`,
            qualificationType: 'Club',
            clubsToQualify: [{ id: tier.c7_club_id }],
            earnRate,
            sortOrder: 0,
          });
          await db.createTierLoyaltyConfig({
            stageId: tierId,
            c7LoyaltyTierId: loyaltyTier.id,
            tierTitle: loyaltyTier.title,
            earnRate,
            initialPointsBonus: bonus,
          });
        } catch (error) {
          console.error('Failed to create loyalty tier:', error);
        }
        message = 'Loyalty rewards enabled';
      } else if (existingLoyalty) {
        try {
          if (provider.updateLoyaltyTier) {
            await provider.updateLoyaltyTier(existingLoyalty.c7_loyalty_tier_id, { earnRate });
          }
          await db.updateTierLoyaltyConfig(tierId, {
            earnRate,
            initialPointsBonus: bonus,
          });
        } catch (error) {
          console.error('Failed to update loyalty tier:', error);
        }
        message = 'Loyalty config updated';
      } else {
        message = 'Loyalty rewards enabled';
      }
    } else {
      const loyalty = await db.getTierLoyaltyConfig(tierId);
      if (loyalty) {
        const provider = crm.crmManager.getProvider(
          session.crmType,
          session.tenantShop,
          session.accessToken
        );
        try {
          await provider.deleteLoyaltyTier(loyalty.c7_loyalty_tier_id);
        } catch (error) {
          console.error('Failed to delete loyalty tier from CRM:', error);
        }
      }
      await db.deleteTierLoyaltyConfig(tierId);
      message = 'Loyalty rewards disabled';
    }

    return {
      success: true,
      message,
      action: 'toggle_loyalty',
    };
  }

  return {
    success: false,
    message: 'Invalid action',
  };
}

export default function TierDetail() {
  const parentData = useRouteLoaderData<typeof tierLayoutLoader>('routes/app.settings.club_tiers.$id');
  if (!parentData) throw new Error('Parent loader data not found');
  
  const { session, tier, promotions, enrollmentCount, loyalty } = parentData;
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const { smUp } = useBreakpoints();
  
  const [tierBannerDismissed, setTierBannerDismissed] = useState(false);
  const [deleteBannerDismissed, setDeleteBannerDismissed] = useState(false);
  const [tierName, setTierName] = useState(tier.name);
  const [durationMonths, setDurationMonths] = useState(String(tier.duration_months));
  const [minLtvAmount, setMinLtvAmount] = useState(String(tier.min_ltv_amount ?? 600));
  const [minPurchaseOverride, setMinPurchaseOverride] = useState(() => {
    const calc = tier.min_ltv_amount ? (tier.min_ltv_amount / 12).toFixed(2) : '0.00';
    return tier.min_purchase_amount !== parseFloat(calc)
      ? String(tier.min_purchase_amount)
      : '';
  });
  const [initialQualificationAllowed, setInitialQualificationAllowed] = useState(
    tier.initial_qualification_allowed ?? true
  );
  const [upgradable, setUpgradable] = useState(tier.upgradable ?? true);
  
  const durationNum = durationMonths === '' ? NaN : parseInt(durationMonths.trim(), 10);
  const minLtvNum = minLtvAmount === '' ? NaN : parseFloat(minLtvAmount.trim());
  const minPurchaseOverrideNum =
    minPurchaseOverride === '' ? null : parseFloat(minPurchaseOverride.trim());

  const validation = useMemo(() => {
    const errors: {
      tierName?: string;
      durationMonths?: string;
      minLtvAmount?: string;
      minPurchaseOverride?: string;
    } = {};
    const nameTrimmed = (tierName ?? '').trim();
    if (!nameTrimmed) errors.tierName = 'Tier name is required.';
    
    if (durationMonths === '' || durationMonths.trim() === '') {
      errors.durationMonths = 'Duration is required.';
    } else if (Number.isNaN(durationNum)) {
      errors.durationMonths = 'Duration must be a number.';
    } else if (durationNum < 1 || durationNum > 12) {
      errors.durationMonths = 'Duration must be between 1 and 12 months.';
    }
    
    if (minLtvAmount === '' || minLtvAmount.trim() === '') {
      errors.minLtvAmount = 'Minimum Annual LTV is required.';
    } else if (Number.isNaN(minLtvNum)) {
      errors.minLtvAmount = 'Minimum Annual LTV must be a number.';
    } else if (minLtvNum <= 0) {
      errors.minLtvAmount = 'Minimum Annual LTV must be greater than 0.';
    }
    
    if (initialQualificationAllowed && minPurchaseOverride !== '' && minPurchaseOverride.trim() !== '') {
      if (minPurchaseOverrideNum === null || Number.isNaN(minPurchaseOverrideNum)) {
        errors.minPurchaseOverride = 'Must be a number.';
      } else if (minLtvNum > 0 && minPurchaseOverrideNum > minLtvNum) {
        errors.minPurchaseOverride = 'Initial purchase amount cannot exceed Minimum Annual LTV.';
      }
    }
    const isValid =
      !!nameTrimmed &&
      !Number.isNaN(durationNum) &&
      durationNum >= 1 &&
      durationNum <= 12 &&
      !Number.isNaN(minLtvNum) &&
      minLtvNum > 0 &&
      (!initialQualificationAllowed ||
        minPurchaseOverride === '' ||
        minPurchaseOverride.trim() === '' ||
        (minPurchaseOverrideNum !== null &&
          !Number.isNaN(minPurchaseOverrideNum) &&
          minPurchaseOverrideNum <= minLtvNum));
    return { errors, isValid };
  }, [
    tierName,
    durationMonths,
    durationNum,
    minLtvAmount,
    minLtvNum,
    initialQualificationAllowed,
    minPurchaseOverride,
    minPurchaseOverrideNum,
  ]);

  const calculatedMinPurchase = useMemo(() => {
    if (!Number.isNaN(minLtvNum) && minLtvNum > 0) {
      return (minLtvNum / 12).toFixed(2);
    }
    return '0.00';
  }, [minLtvNum]);

  const tierDetailsChanged =
    tierName !== tier.name ||
    durationMonths !== String(tier.duration_months) ||
    minLtvAmount !== (tier.min_ltv_amount ?? 600).toString() ||
    upgradable !== (tier.upgradable ?? true) ||
    initialQualificationAllowed !== (tier.initial_qualification_allowed ?? true) ||
    (() => {
      const calc = tier.min_ltv_amount ? (tier.min_ltv_amount / 12).toFixed(2) : '0.00';
      const expectedOverride =
        tier.min_purchase_amount !== parseFloat(calc) ? String(tier.min_purchase_amount) : '';
      return minPurchaseOverride !== expectedOverride;
    })();
  const isTierFormSubmitting =
    navigation.state === 'submitting' && navigation.formData?.get('action') === 'update_tier';

  // Reset form only when tier id or tier data actually changes (not on object reference change)
  useEffect(() => {
    setTierName(tier.name);
    setDurationMonths(String(tier.duration_months));
    setMinLtvAmount(String(tier.min_ltv_amount ?? 600));
    const calc = tier.min_ltv_amount ? (tier.min_ltv_amount / 12).toFixed(2) : '0.00';
    setMinPurchaseOverride(
      tier.min_purchase_amount !== parseFloat(calc) ? String(tier.min_purchase_amount) : ''
    );
    setInitialQualificationAllowed(tier.initial_qualification_allowed ?? true);
  }, [tier.id, tier.name, tier.duration_months, tier.min_ltv_amount, tier.min_purchase_amount, tier.initial_qualification_allowed]);
  
  // Reset banner dismissed state when new action data arrives
  useEffect(() => {
    if (actionData?.action === 'update_tier') setTierBannerDismissed(false);
    if (actionData?.action === 'delete_tier') setDeleteBannerDismissed(false);
  }, [actionData]);

  // Handle redirect from action
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);
  
  return (
    <Page 
      title={tier.name}
      backAction={{
        content: 'Club Tiers',
        url: addSessionToUrl('/app/settings/club_tiers', session.id),
      }}
      secondaryActions={[
        ...getMainNavigationActions({
          sessionId: session.id,
          currentPath: location.pathname,
        }),
        ...(enrollmentCount > 0
          ? [{
              content: 'Delete Tier',
              destructive: true,
              disabled: true,
              helpText: 'Cannot delete a tier that has members.',
            }]
          : [{
              content: 'Delete Tier',
              destructive: true,
              onAction: () => {
                const promoCount = promotions.length;
                const promoWarning = promoCount > 0
                  ? ` Deleting this tier will also permanently delete its ${promoCount} promotion(s) in Commerce7.`
                  : '';
                if (confirm(`Are you sure you want to delete this tier?${promoWarning} This cannot be undone.`)) {
                  const formData = new FormData();
                  formData.append('action', 'delete_tier');
                  submit(formData, { method: 'post' });
                }
              },
            }]),
      ]}
    >
      <BlockStack gap={{ xs: "800", sm: "400" }}>
        {actionData?.action === 'delete_tier' && !deleteBannerDismissed && (
          <Banner
            tone={actionData.success ? 'success' : 'critical'}
            title={actionData.message}
            onDismiss={() => setDeleteBannerDismissed(true)}
          />
        )}
        {enrollmentCount > 0 && (
          <Banner tone="warning">
            This tier has members and cannot be deleted. Move or remove members first.
          </Banner>
        )}
        
        {/* Tier Information Section */}
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Tier Information
              </Text>
              <Text as="p" variant="bodyMd">
                Configure the tier name, duration, and minimum requirements. The minimum purchase amount is calculated automatically based on the annual LTV and duration.
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <Form
              method="post"
              onSubmit={(e) => {
                if (!validation.isValid) e.preventDefault();
              }}
            >
              <BlockStack gap="400">
                {actionData?.action === 'update_tier' && !tierBannerDismissed && (
                  <Banner
                    tone={actionData.success ? 'success' : 'critical'}
                    onDismiss={() => setTierBannerDismissed(true)}
                  >
                    {actionData.message}
                  </Banner>
                )}
                <TierDetailsForm
                tierName={tierName}
                durationMonths={durationMonths}
                minLtvAmount={minLtvAmount}
                upgradable={upgradable}
                initialQualificationAllowed={initialQualificationAllowed}
                minPurchaseOverride={minPurchaseOverride}
                calculatedMinPurchase={calculatedMinPurchase}
                onTierNameChange={setTierName}
                onDurationMonthsChange={setDurationMonths}
                onMinLtvAmountChange={setMinLtvAmount}
                onUpgradableChange={setUpgradable}
                onInitialQualificationAllowedChange={setInitialQualificationAllowed}
                onMinPurchaseOverrideChange={setMinPurchaseOverride}
                actionName="update_tier"
                useHiddenInputs={true}
                showCancelButton={true}
                cancelButtonUrl={addSessionToUrl('/app/settings/club_tiers', session.id)}
                submitButtonDisabled={
                  !validation.isValid || !tierDetailsChanged || isTierFormSubmitting
                }
                submitButtonLoading={isTierFormSubmitting}
                tierNameError={validation.errors.tierName}
                durationMonthsError={validation.errors.durationMonths}
                minLtvAmountError={validation.errors.minLtvAmount}
                minPurchaseOverrideError={validation.errors.minPurchaseOverride}
              />
              </BlockStack>
            </Form>
          </Card>
        </InlineGrid>
        {smUp ? <Divider /> : null}
        
        {/* Promotions Section */}
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Promotions
              </Text>
              <Text as="p" variant="bodyMd">
                Promotions are discounts and offers that automatically apply to members in this tier. Each tier can have multiple promotions.
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Promotions
              </Text>
              
              {promotions.length > 0 ? (
                <>
                  <List>
                    {promotions.map((promo) => (
                      <List.Item key={promo.id}>
                        <Link 
                          url={addSessionToUrl(`/app/settings/club_tiers/${tier.id}/promo/${promo.id}`, session.id)}
                          removeUnderline
                        >
                          {promo.title || `Promotion ${promo.crm_id}`}
                        </Link>
                      </List.Item>
                    ))}
                  </List>
                  <Box paddingBlockStart="200">
                    <Button 
                      url={addSessionToUrl(`/app/settings/club_tiers/${tier.id}/promo/new`, session.id)}
                      variant="primary"
                    >
                      Add Promo
                    </Button>
                  </Box>
                </>
              ) : (
                <BlockStack gap="300">
                  <Text variant="bodyMd" as="p" tone="subdued">
                    No promotions configured yet. Click &quot;Add Promo&quot; to create your first promotion for this tier.
                  </Text>
                  <Button 
                    url={addSessionToUrl(`/app/settings/club_tiers/${tier.id}/promo/new`, session.id)}
                    variant="primary"
                  >
                    Add Promo
                  </Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>
        {smUp ? <Divider /> : null}

        {/* Loyalty Section */}
        <InlineGrid columns={{ xs: '1fr', md: '2fr 5fr' }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: '400', sm: '0' }}
            paddingInlineEnd={{ xs: '400', sm: '0' }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Loyalty Rewards
              </Text>
              <Text as="p" variant="bodyMd">
                Configure points earning rate and welcome bonus for members in this tier. Members
                earn points on all purchases when loyalty is enabled.
              </Text>
            </BlockStack>
          </Box>
          <TierLoyaltySection
            loyalty={loyalty}
            tier={tier}
            actionResult={
              actionData?.action === 'toggle_loyalty'
                ? { success: actionData.success, message: actionData.message }
                : null
            }
          />
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}

