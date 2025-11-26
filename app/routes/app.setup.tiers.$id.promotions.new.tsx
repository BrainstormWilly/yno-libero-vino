import { type ActionFunctionArgs } from 'react-router';
import { useActionData, useNavigate, useRouteLoaderData } from 'react-router';
import { useEffect } from 'react';
import { Page, BlockStack, Box, Button } from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import * as crm from '~/lib/crm';
import { PromotionForm } from '~/components/promotions/PromotionForm';
import type { Discount, PlatformType } from '~/types';
import type { loader as tierLayoutLoader } from './app.setup.tiers.$id';

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const formData = await request.formData();
  
  try {
    // Parse form data
    const title = formData.get('title') as string;
    const discountTarget = formData.get('discount_target') as 'product' | 'shipping';
    const discountType = formData.get('discount_type') as string;
    const discountAmount = parseFloat(formData.get('discount_amount') as string);
    const appliesTo = formData.get('applies_to') as string;
    const selectedIdsJson = formData.get('selected_ids') as string;
    const selectedIds = selectedIdsJson ? JSON.parse(selectedIdsJson) : [];
    const minCartAmount = formData.get('min_cart_amount') as string;
    
    if (!title || !discountAmount) {
      return {
        success: false,
        message: 'Title and discount amount are required',
      };
    }
    
    const tier = await db.getClubStageWithDetails(tierId);
    if (!tier?.c7_club_id) {
      return {
        success: false,
        message: 'Tier must be synced to C7 first. Save tier details to create C7 club.',
      };
    }
    
    // Build Discount object
    const discount: Discount = {
      title,
      platform: session.crmType as PlatformType,
      status: 'active',
      startsAt: new Date(),
      value: {
        type: (discountType === 'Percentage Off' || discountType === 'Free Shipping') ? 'percentage' : 'fixed-amount',
        percentage: discountType === 'Percentage Off' ? discountAmount : 
                    discountType === 'Free Shipping' ? 100 : undefined,
        amount: (discountType === 'Dollar Off' || discountType === 'Flat Rate') ? discountAmount * 100 : undefined,
      },
      appliesTo: {
        target: discountTarget,
        scope: appliesTo === 'Store' ? 'all' : 'specific',
        products: appliesTo === 'Product' ? selectedIds.map((id: string) => ({ id })) : [],
        collections: appliesTo === 'Collection' ? selectedIds.map((id: string) => ({ id })) : [],
      },
      customerSegments: [],
      minimumRequirement: {
        type: minCartAmount ? 'amount' : 'none',
        amount: minCartAmount ? parseFloat(minCartAmount) * 100 : undefined,
      },
    };
    
    // Create in CRM
    const createdPromotion = await crm.createPromotion(
      session,
      discount,
      tier.c7_club_id
    );
    
    // Save to DB
    await db.createStagePromotions(tierId, [{
      crmId: createdPromotion.id,
      crmType: session.crmType,
      title: createdPromotion.title,
    }]);
    
    return {
      success: true,
      redirect: addSessionToUrl(`/app/setup/tiers/${tierId}`, session.id),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create promotion',
    };
  }
}

export default function NewPromotion() {
  const parentData = useRouteLoaderData<typeof tierLayoutLoader>('routes/app.setup.tiers.$id');
  if (!parentData) throw new Error('Parent loader data not found');
  
  const { tier, session } = parentData;
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  // Handle redirect
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);
  
  return (
    <Page title="New Promotion">
      <BlockStack gap="400">
        {/* Navigation Button at Top */}
        <Box paddingBlockEnd="400">
          <Button
            onClick={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}`, session.id))}
          >
            ← Back to Tier
          </Button>
        </Box>

        <PromotionForm
          mode="create"
          session={session}
          onCancel={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}`, session.id))}
          actionData={actionData}
        />
      </BlockStack>
    </Page>
  );
}

