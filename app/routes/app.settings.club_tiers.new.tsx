import { type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from 'react-router';
import { useLoaderData, Form, useActionData, useLocation, useNavigation } from 'react-router';
import { useState, useMemo } from 'react';
import { 
  Page, 
  Card, 
  BlockStack,
  Banner,
} from '@shopify/polaris';
import { getAppSession } from '~/lib/sessions.server';
import { getMainNavigationActions } from '~/util/navigation';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import * as crm from '~/lib/crm/index.server';
import TierDetailsForm from '~/components/TierDetailsForm';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const clubProgram = await db.getClubProgram(session.clientId);
  if (!clubProgram) {
    throw new Error('Club program not found');
  }
  
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
      return { success: false, message: 'Club program not found' };
    }

    const tierName = (formData.get('tier_name') as string)?.trim() ?? '';
    const durationMonthsRaw = formData.get('duration_months') as string;
    const minLtvAmountRaw = formData.get('min_ltv_amount') as string;
    const durationMonths = parseInt(durationMonthsRaw, 10);
    const minLtvAmount = parseFloat(minLtvAmountRaw);
    const overrideRaw = formData.get('min_purchase_amount_override') as string;
    const initialQualificationAllowed = formData.get('initial_qualification_allowed') !== 'false';
    const upgradable = formData.get('upgradable') !== 'false';

    if (!tierName) {
      return { success: false, message: 'Tier name is required.' };
    }
    if (Number.isNaN(durationMonths) || durationMonths < 1 || durationMonths > 12) {
      return { success: false, message: 'Duration must be between 1 and 12 months.' };
    }
    if (Number.isNaN(minLtvAmount) || minLtvAmount <= 0) {
      return { success: false, message: 'Minimum Annual LTV is required and must be greater than 0.' };
    }
    if (initialQualificationAllowed && overrideRaw !== '' && overrideRaw != null) {
      const overrideNum = parseFloat(overrideRaw);
      if (Number.isNaN(overrideNum)) {
        return { success: false, message: 'Initial purchase amount must be a number.' };
      }
      if (overrideNum > minLtvAmount) {
        return {
          success: false,
          message: 'Initial purchase amount cannot exceed Minimum Annual LTV.',
        };
      }
    }

    const calculated = minLtvAmount / 12;
    const minPurchaseAmount =
      overrideRaw !== '' && overrideRaw != null && !Number.isNaN(parseFloat(overrideRaw))
        ? Math.max(0, parseFloat(overrideRaw))
        : calculated;

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
    const newTier = newTiers[0];

    // Sync tier to C7 so promos can be added immediately
    if (session.crmType === 'commerce7') {
      const provider = crm.crmManager.getProvider(session.crmType, session.tenantShop, session.accessToken);
      const result = await provider.upsertClub({
        id: newTier.id,
        name: tierName,
        c7ClubId: null,
      });
      await db.updateClubStage(newTier.id, { c7ClubId: result.crmClubId });
    }

    return redirect(addSessionToUrl(`/app/settings/club_tiers/${newTier.id}`, session.id));
  }
  
  return { success: false, message: 'Invalid action' };
}

const INITIAL_TIER_NAME = '';
const INITIAL_DURATION = '3';
const INITIAL_MIN_LTV = '600';
const INITIAL_OVERRIDE = '';
const INITIAL_QUALIFICATION = true;
const INITIAL_UPGRADABLE = true;

export default function NewTier() {
  const { session, tierCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigation = useNavigation();
  
  const [tierName, setTierName] = useState('');
  const [durationMonths, setDurationMonths] = useState('3');
  const [minLtvAmount, setMinLtvAmount] = useState('600');
  const [minPurchaseOverride, setMinPurchaseOverride] = useState('');
  const [initialQualificationAllowed, setInitialQualificationAllowed] = useState(true);
  const [upgradable, setUpgradable] = useState(true);
  
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
    if (!Number.isNaN(minLtvNum) && minLtvNum > 0) return (minLtvNum / 12).toFixed(2);
    return '0.00';
  }, [minLtvNum]);

  const isTierDirty =
    tierName !== INITIAL_TIER_NAME ||
    durationMonths !== INITIAL_DURATION ||
    minLtvAmount !== INITIAL_MIN_LTV ||
    minPurchaseOverride !== INITIAL_OVERRIDE ||
    initialQualificationAllowed !== INITIAL_QUALIFICATION ||
    upgradable !== INITIAL_UPGRADABLE;
  const isSubmitting = navigation.state === 'submitting';

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
          <Form
            method="post"
            onSubmit={(e) => {
              if (!validation.isValid) e.preventDefault();
            }}
          >
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
              actionName="create_tier"
              useHiddenInputs={true}
              showCancelButton={true}
              cancelButtonUrl={addSessionToUrl('/app/settings/club_tiers', session.id)}
              submitButtonLabel="Create Tier"
              submitButtonDisabled={!validation.isValid || !isTierDirty || isSubmitting}
              submitButtonLoading={isSubmitting}
              tierNameHelpText={`Enter a descriptive name (e.g. LV Tier ${tierCount + 1})`}
              tierNameError={validation.errors.tierName}
              durationMonthsError={validation.errors.durationMonths}
              minLtvAmountError={validation.errors.minLtvAmount}
              minPurchaseOverrideError={validation.errors.minPurchaseOverride}
            />
          </Form>
        </Card>
      </BlockStack>
    </Page>
  );
}
