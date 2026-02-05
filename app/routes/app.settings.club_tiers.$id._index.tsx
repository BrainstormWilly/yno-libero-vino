import { type ActionFunctionArgs } from 'react-router';
import { useRouteLoaderData, Form, useActionData, useLocation, useNavigate, useSubmit } from 'react-router';
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
import type { loader as tierLayoutLoader } from './app.settings.club_tiers.$id';
import TierDetailsForm from '~/components/TierDetailsForm';

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  
  if (actionType === 'update_tier') {
    const tierName = formData.get('tier_name') as string;
    const durationMonths = parseInt(formData.get('duration_months') as string) || 3;
    const minLtvAmount = parseFloat(formData.get('min_ltv_amount') as string) || 600;
    const overrideRaw = formData.get('min_purchase_amount_override') as string;
    const initialQualificationAllowed = formData.get('initial_qualification_allowed') !== 'false';
    const upgradable = formData.get('upgradable') !== 'false';
    
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
    
    return {
      success: true,
      message: 'Tier updated successfully',
    };
  }
  
  if (actionType === 'delete_tier') {
    const enrollmentCount = await db.getEnrollmentCountForStage(tierId);
    if (enrollmentCount > 0) {
      return {
        success: false,
        message: 'Cannot delete a tier that has members. Move or remove members first.',
      };
    }

    const promotions = await db.getStagePromotions(tierId);
    for (const promo of promotions) {
      if (promo.crm_type === 'commerce7' && promo.crm_id) {
        try {
          await crm.deletePromotion(session, promo.crm_id);
        } catch (err) {
          console.error('Failed to delete C7 promotion:', promo.crm_id, err);
          return {
            success: false,
            message: `Failed to delete promotion in Commerce7: ${err instanceof Error ? err.message : 'Unknown error'}. Tier was not deleted.`,
          };
        }
      }
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
  
  return {
    success: false,
    message: 'Invalid action',
  };
}

export default function TierDetail() {
  const parentData = useRouteLoaderData<typeof tierLayoutLoader>('routes/app.settings.club_tiers.$id');
  if (!parentData) throw new Error('Parent loader data not found');
  
  const { session, tier, promotions, enrollmentCount } = parentData;
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const { smUp } = useBreakpoints();
  
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
  
  const _durationNum = durationMonths === '' ? 0 : parseInt(durationMonths, 10) || 0;
  const minLtvNum = minLtvAmount === '' ? 0 : parseFloat(minLtvAmount) || 0;
  const calculatedMinPurchase = useMemo(() => {
    if (minLtvNum > 0) {
      return (minLtvNum / 12).toFixed(2);
    }
    return '0.00';
  }, [minLtvNum]);
  
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
        {actionData && (
          <Banner tone={actionData.success ? 'success' : 'critical'} title={actionData.message} />
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
            <Form method="post">
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
              />
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
      </BlockStack>
    </Page>
  );
}

