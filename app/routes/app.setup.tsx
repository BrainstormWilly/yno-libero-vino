/**
 * Parent layout for multi-route setup wizard
 * Provides session context to all child routes via Outlet
 * 
 * Routes:
 * - /setup (index) - Welcome + Club Name/Description
 * - /setup/tiers - Tier summary cards
 * - /setup/tiers/:id - Edit specific tier
 * - /setup/communication - Communication provider setup
 * - /setup/review - Final review and submit
 */

import { type LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const communicationConfig = await db.getCommunicationConfig(session.clientId);
  
  return {
    session,
    communicationConfig,
  };
}

export default function SetupLayout() {
  return <Outlet />;
}
