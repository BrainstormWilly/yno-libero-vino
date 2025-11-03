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
  if (!tier) {
    throw new Response('Tier not found', { status: 404 });
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

      {/* Summary Panel - Right Side */}
      <Layout.Section variant="oneThird">
        <aside>
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
