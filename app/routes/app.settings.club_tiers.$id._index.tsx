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
  TextField,
  InlineStack,
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
import type { loader as tierLayoutLoader } from './app.settings.club_tiers.$id';

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
    
    // Calculate min_purchase_amount from min_ltv_amount and duration_months
    const minPurchaseAmount = minLtvAmount * (durationMonths / 12);
    
    await db.updateClubStage(tierId, {
      name: tierName,
      durationMonths,
      minPurchaseAmount,
      minLtvAmount,
    });
    
    return {
      success: true,
      message: 'Tier updated successfully',
    };
  }
  
  if (actionType === 'delete_tier') {
    // Delete tier and redirect to tiers list
    await db.deleteClubStage(tierId);
    
    const redirectUrl = addSessionToUrl('/app/settings/club_tiers', session.id);
    
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
  
  const { session, tier, promotions } = parentData;
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigate = useNavigate();
  const submit = useSubmit();
  const { smUp } = useBreakpoints();
  
  const [tierName, setTierName] = useState(tier.name);
  const [durationMonths, setDurationMonths] = useState(tier.duration_months);
  const [minLtvAmount, setMinLtvAmount] = useState(tier.min_ltv_amount || 600);
  
  // Calculate min_purchase_amount from min_ltv_amount and duration_months
  const calculatedMinPurchase = useMemo(() => {
    if (minLtvAmount > 0 && durationMonths > 0) {
      return (minLtvAmount * (durationMonths / 12)).toFixed(2);
    }
    return '0.00';
  }, [minLtvAmount, durationMonths]);
  
  // Reset form if tier data changes
  useEffect(() => {
    setTierName(tier.name);
    setDurationMonths(tier.duration_months);
    setMinLtvAmount(tier.min_ltv_amount || 600);
  }, [tier]);
  
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
        {
          content: 'Delete Tier',
          destructive: true,
          onAction: () => {
            if (confirm('Are you sure you want to delete this tier? This action cannot be undone.')) {
              const formData = new FormData();
              formData.append('action', 'delete_tier');
              submit(formData, { method: 'post' });
            }
          },
        },
      ]}
    >
      <BlockStack gap={{ xs: "800", sm: "400" }}>
        {actionData && (
          <Banner tone={actionData.success ? 'success' : 'critical'} title={actionData.message} />
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
              <input type="hidden" name="action" value="update_tier" />
              <input type="hidden" name="tier_name" value={tierName} />
              <input type="hidden" name="duration_months" value={String(durationMonths)} />
              <input type="hidden" name="min_ltv_amount" value={String(minLtvAmount)} />
              
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">
                  Tier Details
                </Text>
                
                <TextField
                  label="Tier Name"
                  id="tier_name"
                  value={tierName}
                  onChange={setTierName}
                  autoComplete="off"
                  helpText="Enter a descriptive name for this membership tier"
                />
                
                <TextField
                  label="Duration (months)"
                  id="duration_months"
                  type="number"
                  value={String(durationMonths)}
                  onChange={(value) => setDurationMonths(parseInt(value) || 3)}
                  min={1}
                  max={24}
                  autoComplete="off"
                  helpText="How long the membership lasts (1-24 months)"
                />
                
                <TextField
                  label="Minimum Annual LTV"
                  id="min_ltv_amount"
                  type="number"
                  value={minLtvAmount.toString()}
                  onChange={(value) => setMinLtvAmount(parseFloat(value) || 600)}
                  min={0}
                  step={0.01}
                  autoComplete="off"
                  prefix="$"
                  helpText="Minimum annual lifetime value required for this tier"
                />
                
                <Box paddingBlockStart="200">
                  <Text variant="bodySm" as="p" tone="subdued">
                    <strong>Calculated Min Purchase:</strong> ${calculatedMinPurchase}
                  </Text>
                </Box>
                
                <Box paddingBlockStart="200">
                  <InlineStack gap="200">
                    <Button variant="primary" submit>
                      Save Changes
                    </Button>
                    <Button 
                      url={addSessionToUrl('/app/settings/club_tiers', session.id)}
                    >
                      Cancel
                    </Button>
                  </InlineStack>
                </Box>
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
      </BlockStack>
    </Page>
  );
}

