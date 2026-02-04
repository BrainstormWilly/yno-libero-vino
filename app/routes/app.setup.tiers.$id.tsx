/**
 * Layout wrapper for tier editor and nested promotion routes
 * Provides tier context and TierSummary sidebar to all child routes
 */

import { type LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { Layout } from '@shopify/polaris';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import TierSummary from '~/components/TierSummary';

type EnrichedPromotion = {
  id: string;
  club_stage_id: string;
  crm_id: string;
  crm_type: string;
  title: string | null;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  c7Data?: any;
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const tierId = params.id!;
  const tier = await db.getClubStageWithDetails(tierId);
  
  // If tier doesn't exist, it's a new tier - return default values
  if (!tier) {
    const existingProgram = await db.getClubProgram(session.clientId);
    if (!existingProgram) {
      throw new Response('Club program not found', { status: 404 });
    }
    
    // Return default tier structure for new tier
    const defaultMinLtv = 600; // $600 annual LTV
    const defaultDuration = 3; // 3 months
    const calculatedMinPurchase = defaultMinLtv / 12; // $50
    
    return {
      session,
      tier: {
        id: tierId,
        club_program_id: existingProgram.id,
        name: '',
        duration_months: defaultDuration,
        min_purchase_amount: calculatedMinPurchase,
        min_ltv_amount: defaultMinLtv,
        stage_order: null,
        tier_type: 'discount',
        upgradable: true,
        initial_qualification_allowed: true,
        is_active: true,
        c7_club_id: null,
        created_at: null,
        updated_at: null,
      } as any,
      promotions: [],
      loyalty: null,
      isNewTier: true,
    };
  }
  
  const promotions = await db.getStagePromotions(tierId);
  const loyalty = await db.getTierLoyaltyConfig(tierId);
  
  // Enrich promotions with C7 data
  let enrichedPromotions = promotions;
  if (session.crmType === 'commerce7' && tier.c7_club_id) {
    const provider = new Commerce7Provider(session.tenantShop);
    enrichedPromotions = await Promise.all(
      promotions.map(async (promo) => {
        try {
          const c7Promo = await provider.getPromotion(promo.crm_id);
          return { ...promo, c7Data: c7Promo };
        } catch (error) {
          return promo;
        }
      })
    );
  }
  
  return {
    session,
    tier,
    promotions: enrichedPromotions as EnrichedPromotion[],
    loyalty,
    isNewTier: false,
  };
}

export default function TierLayout() {
  const { tier, promotions, loyalty } = useLoaderData<typeof loader>();
  
  return (
    <Layout>
      {/* Main Content - Left Side */}
      <Layout.Section>
        <main>
          <Outlet />
        </main>
      </Layout.Section>

      {/* Summary Panel - Right Side - aligned with top of Tier Details card */}
      <Layout.Section variant="oneThird">
        <aside className="md:pt-35">
          <TierSummary 
            tier={tier} 
            promotions={promotions.map(p => ({
              id: p.id,
              title: p.title || p.c7Data?.title || 'Untitled Promotion',
              c7Data: p.c7Data,
            }))}
            loyalty={loyalty && loyalty.earn_rate !== null && loyalty.initial_points_bonus !== null ? {
              earn_rate: loyalty.earn_rate,
              initial_points_bonus: loyalty.initial_points_bonus,
            } : null}
          />
        </aside>
      </Layout.Section>
    </Layout>
  );
}
