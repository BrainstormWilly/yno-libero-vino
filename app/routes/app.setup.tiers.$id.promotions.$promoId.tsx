import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate, useRouteLoaderData } from 'react-router';
import { useEffect } from 'react';
import { Page, BlockStack, Box, Button, Banner } from '@shopify/polaris';

import { getAppSession } from '~/lib/sessions.server';
import { setupAutoResize } from '~/util/iframe-helper';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import * as crm from '~/lib/crm';
import { PromotionForm } from '~/components/promotions/PromotionForm';
import type { Discount, PlatformType } from '~/types';
import type { loader as tierLayoutLoader } from './app.setup.tiers.$id';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const promoId = params.promoId!;
  
  const allPromotions = await db.getStagePromotions(tierId);
  const promotion = allPromotions.find(p => p.id === promoId);
  
  if (!promotion) {
    throw new Response('Promotion not found', { status: 404 });
  }
  
  // Fetch promotion details from CRM
  let discount: Discount | null = null;
  try {
    discount = await crm.getPromotion(session, promotion.crm_id);
  } catch (error) {
    console.warn('Failed to fetch promotion from CRM:', error);
  }
  
  return {
    discount,
    promotionId: promotion.id,
    crmId: promotion.crm_id,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const promoId = params.promoId!;
  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  
  try {
    if (actionType === 'delete_promotion') {
      const promotion = (await db.getStagePromotions(tierId)).find(p => p.id === promoId);
      
      if (promotion) {
        // Delete from CRM
        await crm.deletePromotion(session, promotion.crm_id);
      }
      
      // Delete from DB
      const supabase = db.getSupabaseClient();
      await supabase.from('club_stage_promotions').delete().eq('id', promoId);
      
      return {
        success: true,
        redirect: addSessionToUrl(`/app/setup/tiers/${tierId}`, session.id),
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
      
      const promotion = (await db.getStagePromotions(tierId)).find(p => p.id === promoId);
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
      };
      
      // Update in CRM
      await crm.updatePromotion(
        session,
        promotion.crm_id,
        discount,
        tier.c7_club_id
      );
      
      // Update title in DB cache
      const supabase = db.getSupabaseClient();
      await supabase
        .from('club_stage_promotions')
        .update({ title })
        .eq('id', promoId);
      
      return {
        success: true,
        message: 'Promotion updated',
        redirect: addSessionToUrl(`/app/setup/tiers/${tierId}`, session.id),
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

export default function EditPromotion() {
  const { discount } = useLoaderData<typeof loader>();
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
  
  const handleDelete = () => {
    // Submit delete form
    const form = document.createElement('form');
    form.method = 'post';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'action';
    input.value = 'delete_promotion';
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  };
  
  return (
    <Page title="Edit Promotion">
      <BlockStack gap="400">
        {/* Navigation Button at Top */}
        <Box paddingBlockEnd="400">
          <Button
            onClick={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}`, session.id))}
          >
            ← Back to Tier
          </Button>
        </Box>

        {/* Banners at Top */}
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
            onCancel={() => navigate(addSessionToUrl(`/app/setup/tiers/${tier.id}`, session.id))}
            onDelete={handleDelete}
            actionData={actionData}
          />
        ) : (
          <Form method="post">
            <input type="hidden" name="action" value="delete_promotion" />
          </Form>
        )}
      </BlockStack>
    </Page>
  );
}

