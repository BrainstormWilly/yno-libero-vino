import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate, useLocation } from 'react-router';
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
    
    // Calculate min_purchase_amount from min_ltv_amount and duration_months
    const minPurchaseAmount = minLtvAmount * (durationMonths / 12);
    
    // Get current tier count for order
    const tierCount = clubProgram.club_stages?.length || 0;
    
    const newTiers = await db.createClubStages(clubProgram.id, [{
      name: tierName,
      durationMonths,
      minPurchaseAmount,
      minLtvAmount,
      stageOrder: tierCount + 1,
      tierType: 'discount',
    }]);
    
    // Redirect to the tier detail page
    return {
      success: true,
      redirect: addSessionToUrl(`/app/settings/club_tiers/${newTiers[0].id}`, session.id),
    };
  }
  
  return {
    success: false,
    message: 'Invalid action',
  };
}

export default function NewTier() {
  const { session, tierCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [tierName, setTierName] = useState('');
  const [durationMonths, setDurationMonths] = useState(3);
  const [minLtvAmount, setMinLtvAmount] = useState(600);
  
  // Handle redirect from action
  if (actionData?.redirect) {
    navigate(actionData.redirect);
    return null;
  }
  
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
            <input type="hidden" name="duration_months" value={String(durationMonths)} />
            <input type="hidden" name="min_ltv_amount" value={String(minLtvAmount)} />
            
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
                helpText="Minimum annual lifetime value required for this tier. The minimum purchase amount will be calculated automatically based on duration."
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

