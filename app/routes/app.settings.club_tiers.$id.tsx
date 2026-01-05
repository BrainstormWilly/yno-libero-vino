import { type LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';

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
  
  return {
    session,
    tier,
    promotions,
  };
}

export default function TierLayout() {
  // This is a layout route that provides context for nested routes
  // The actual content is rendered by the index route or nested routes
  return <Outlet />;
}

