import { type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from 'react-router';
import { useLoaderData, Form, useActionData, useLocation } from 'react-router';
import { useState } from 'react';
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
  Checkbox,
} from '@shopify/polaris';
import { getAppSession } from '~/lib/sessions.server';
import { getMainNavigationActions } from '~/util/navigation';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const clubProgram = await db.getClubProgram(session.clientId);
  if (!clubProgram) {
    throw new Error('Club program not found');
  }
  
  // Get current tier count for order
  const tierCount = clubProgram.club_stages?.length || 0;
  
  return {
    session,
    clubProgram,
    tierCount,
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
    const clubProgram = await db.getClubProgram(session.clientId);
    if (!clubProgram) {
      return {
        success: false,
        message: 'Club program not found',
      };
    }
    
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
    
    // Get current tier count for order
    const tierCount = clubProgram.club_stages?.length || 0;
    
    const newTiers = await db.createClubStages(clubProgram.id, [{
      name: tierName,
      durationMonths,
      minPurchaseAmount,
      minLtvAmount,
      stageOrder: tierCount + 1,
      tierType: 'discount',
      initialQualificationAllowed,
      upgradable,
    }]);
    
    // Redirect to the tier detail page
    return redirect(addSessionToUrl(`/app/settings/club_tiers/${newTiers[0].id}`, session.id));
  }
  
  return {
    success: false,
    message: 'Invalid action',
  };
}

export default function NewTier() {
  const { session, tierCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  
  const [tierName, setTierName] = useState('');
  const [durationMonths, setDurationMonths] = useState('3');
  const [minLtvAmount, setMinLtvAmount] = useState('600');
  const [minPurchaseOverride, setMinPurchaseOverride] = useState('');
  const [initialQualificationAllowed, setInitialQualificationAllowed] = useState(true);
  const [upgradable, setUpgradable] = useState(true);
  
  const durationNum = durationMonths === '' ? 0 : parseInt(durationMonths, 10) || 0;
  const minLtvNum = minLtvAmount === '' ? 0 : parseFloat(minLtvAmount) || 0;
  const calculatedMinPurchase = (minLtvNum / 12).toFixed(2);
  
  return (
    <Page 
      title="Add Tier" 
      backAction={{
        content: 'Club Tiers',
        url: addSessionToUrl('/app/settings/club_tiers', session.id),
      }}
      secondaryActions={getMainNavigationActions({
        sessionId: session.id,
        currentPath: location.pathname,
      })}
    >
      <BlockStack gap="400">
        {actionData && !actionData.success && (
          <Banner tone="critical" title={actionData.message} />
        )}
        
        <Card>
          <Form method="post">
            <input type="hidden" name="action" value="create_tier" />
            <input type="hidden" name="tier_name" value={tierName} />
            <input type="hidden" name="duration_months" value={durationMonths === '' ? '3' : durationMonths} />
            <input type="hidden" name="min_ltv_amount" value={minLtvAmount === '' ? '600' : minLtvAmount} />
            <input type="hidden" name="min_purchase_amount_override" value={initialQualificationAllowed ? minPurchaseOverride : ''} />
            <input type="hidden" name="initial_qualification_allowed" value={initialQualificationAllowed ? 'true' : 'false'} />
            <input type="hidden" name="upgradable" value={upgradable ? 'true' : 'false'} />
            
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Tier Information
              </Text>
              
              <TextField
                label="Tier Name"
                id="tier_name"
                value={tierName}
                onChange={setTierName}
                autoComplete="off"
                placeholder={`New Tier ${tierCount + 1}`}
                helpText="Enter a descriptive name for this membership tier"
              />
              
              <TextField
                label="Duration (months)"
                id="duration_months"
                value={durationMonths ?? ''}
                onChange={(value) => setDurationMonths(value == null ? '' : String(value))}
                autoComplete="off"
                helpText="How long the membership lasts (1-24 months). Whole numbers only."
              />
              
              <TextField
                label="Minimum Annual LTV"
                id="min_ltv_amount"
                value={minLtvAmount ?? ''}
                onChange={(value) => setMinLtvAmount(value == null ? '' : String(value))}
                autoComplete="off"
                prefix="$"
                helpText="Minimum annual lifetime value required for this tier. The minimum purchase amount will be calculated automatically based on duration."
              />
              
              <Checkbox
                label="Available for initial signup"
                checked={initialQualificationAllowed}
                onChange={setInitialQualificationAllowed}
                disabled={!upgradable}
                helpText={!upgradable
                  ? 'Must be checked when tier is not upgradable (so members can join at signup).'
                  : 'When unchecked, this tier can only be applied via upgrade, not at initial signup.'}
              />
              
              {initialQualificationAllowed && (
                <TextField
                  label="Initial purchase amount"
                  id="min_purchase_amount_override"
                  value={minPurchaseOverride}
                  onChange={(value) => setMinPurchaseOverride(value == null ? '' : String(value))}
                  autoComplete="off"
                  prefix="$"
                  placeholder={calculatedMinPurchase}
                  helpText="Leave blank to use suggested value (ALTV ÷ 12). Set a value to override."
                />
              )}
              
              <Checkbox
                label="Upgradable"
                checked={upgradable}
                onChange={setUpgradable}
                disabled={!initialQualificationAllowed}
                helpText={!initialQualificationAllowed
                  ? 'Must be checked for upgrade-only tiers (so members can reach this tier).'
                  : 'When checked, members in lower tiers can upgrade to this tier. Uncheck for top-tier only.'}
              />
              
              <Box paddingBlockStart="200">
                <InlineStack gap="200">
                  <Button variant="primary" submit>
                    Create Tier
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
      </BlockStack>
    </Page>
  );
}

