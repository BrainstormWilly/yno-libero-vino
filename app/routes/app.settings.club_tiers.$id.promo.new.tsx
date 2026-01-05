import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useActionData, useNavigate, useLoaderData } from 'react-router';
import { useEffect } from 'react';
import { Page, BlockStack, Box, Button } from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { addSessionToUrl } from '~/util/session';
import { getMainNavigationActions } from '~/util/navigation';
import * as db from '~/lib/db/supabase.server';
import * as crm from '~/lib/crm/index.server';
import { PromotionForm } from '~/components/promotions/PromotionForm';
import type { Discount, PlatformType } from '~/types';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const tier = await db.getClubStageWithDetails(tierId);
  
  if (!tier) {
    throw new Response('Tier not found', { status: 404 });
  }
  
  return {
    session,
    tier,
  };
}

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
    const usageLimitType = formData.get('usage_limit_type') as 'Unlimited' | 'Customer' | 'Store';
    const usageLimitStr = formData.get('usage_limit') as string;
    const usageLimit = usageLimitStr && usageLimitType !== 'Unlimited' ? parseInt(usageLimitStr) : null;
    
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
      platformData: {
        usageLimitType,
        usageLimit,
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
      redirect: addSessionToUrl(`/app/settings/club_tiers/${tierId}`, session.id),
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create promotion',
    };
  }
}

export default function NewPromotion() {
  const { session, tier } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  // Handle redirect
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);
  
  return (
    <Page 
      title="Add Promotion"
      backAction={{
        content: tier.name,
        url: addSessionToUrl(`/app/settings/club_tiers/${tier.id}`, session.id),
      }}
      secondaryActions={getMainNavigationActions({
        sessionId: session.id,
        currentPath: `/app/settings/club_tiers/${tier.id}/promo/new`,
      })}
    >
      <BlockStack gap="400">
        <PromotionForm
          mode="create"
          session={session}
          onCancel={() => navigate(addSessionToUrl(`/app/settings/club_tiers/${tier.id}`, session.id))}
          actionData={actionData}
        />
      </BlockStack>
    </Page>
  );
}

