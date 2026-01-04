import { type LoaderFunctionArgs } from 'react-router';
import { Outlet, useLoaderData } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const clubProgram = await db.getClubProgram(session.clientId);
  
  return {
    session,
    clubProgram,
  };
}

export default function ClubTiersLayout() {
  const { session, clubProgram } = useLoaderData<typeof loader>();
  
  return <Outlet context={{ session, clubProgram }} />;
}

