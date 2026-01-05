import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate, useLocation } from 'react-router';
import { useEffect } from 'react';
import { Page, BlockStack, Box, Button, Banner } from '@shopify/polaris';

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
  const promoId = params.promo_id!;
  
  const tier = await db.getClubStageWithDetails(tierId);
  if (!tier) {
    throw new Response('Tier not found', { status: 404 });
  }
  
  const promotion = await db.getStagePromotion(promoId);
  if (!promotion) {
    throw new Response('Promotion not found', { status: 404 });
  }
  
  // Verify promotion belongs to this tier
  if (promotion.club_stage_id !== tierId) {
    throw new Response('Promotion does not belong to this tier', { status: 404 });
  }
  
  // Fetch promotion details from CRM
  let discount: Discount | null = null;
  try {
    discount = await crm.getPromotion(session, promotion.crm_id);
  } catch (error) {
    console.warn('Failed to fetch promotion from CRM:', error);
  }
  
  return {
    session,
    tier,
    promotion,
    discount,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const promoId = params.promo_id!;
  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  
  try {
    if (actionType === 'delete_promotion') {
      const promotion = await db.getStagePromotion(promoId);
      
      if (promotion) {
        // Delete from CRM
        await crm.deletePromotion(session, promotion.crm_id);
      }
      
      // Delete from DB
      await db.deleteStagePromotion(promoId);
      
      return {
        success: true,
        redirect: addSessionToUrl(`/app/settings/club_tiers/${tierId}`, session.id),
      };
    }
    
    if (actionType === 'update_promotion') {
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
      
      const promotion = await db.getStagePromotion(promoId);
      if (!promotion) {
        return { success: false, message: 'Promotion not found' };
      }
      
      const tier = await db.getClubStageWithDetails(tierId);
      if (!tier?.c7_club_id) {
        return { success: false, message: 'Tier not synced to C7' };
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
      
      // Update in CRM
      await crm.updatePromotion(
        session,
        promotion.crm_id,
        discount,
        tier.c7_club_id
      );
      
      // Update title in DB cache
      await db.updateStagePromotion(promoId, { title });
      
      return {
        success: true,
        message: 'Promotion updated',
        redirect: addSessionToUrl(`/app/settings/club_tiers/${tierId}`, session.id),
      };
    }
    
    return { success: false, message: 'Invalid action' };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default function PromotionDetail() {
  const { session, tier, promotion, discount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Handle redirect
  useEffect(() => {
    if (actionData?.success && actionData.redirect) {
      navigate(actionData.redirect);
    }
  }, [actionData, navigate]);
  
  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this promotion? This action cannot be undone.')) {
      const form = document.createElement('form');
      form.method = 'post';
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'action';
      input.value = 'delete_promotion';
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  };
  
  return (
    <Page 
      title={promotion.title || 'Promotion'}
      backAction={{
        content: tier.name,
        url: addSessionToUrl(`/app/settings/club_tiers/${tier.id}`, session.id),
      }}
      primaryAction={{
        content: 'Back to Club Tiers',
        url: addSessionToUrl('/app/settings/club_tiers', session.id),
      }}
      secondaryActions={[
        ...getMainNavigationActions({
          sessionId: session.id,
          currentPath: location.pathname,
        }),
        {
          content: 'Delete Promotion',
          destructive: true,
          onAction: handleDelete,
        },
      ]}
    >
      <BlockStack gap="400">
        {/* Banners */}
        {actionData && !actionData.success && (
          <Banner tone="critical" title={actionData.message} />
        )}

        {actionData && actionData.success && actionData.message && (
          <Banner tone="success" title={actionData.message} />
        )}

        {discount ? (
          <PromotionForm
            mode="edit"
            initialDiscount={discount}
            session={session}
            onCancel={() => navigate(addSessionToUrl(`/app/settings/club_tiers/${tier.id}`, session.id))}
            onDelete={handleDelete}
            actionData={actionData}
          />
        ) : (
          <Banner tone="warning" title="Could not load promotion details from CRM. The promotion may have been deleted." />
        )}
      </BlockStack>
    </Page>
  );
}

