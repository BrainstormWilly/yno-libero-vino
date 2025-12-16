/**
 * Collections API Resource Route
 * 
 * Provides CRM-agnostic collection data from Commerce7 or Shopify
 * Called via useFetcher from client components
 */

import { type LoaderFunctionArgs } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import { crmManager } from '~/lib/crm/index.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const limit = parseInt(url.searchParams.get('limit') || '25');

  try {
    // Get the appropriate CRM provider based on session
    const provider = crmManager.getProvider(
      session.crmType,
      session.tenantShop,
      session.accessToken
    );

    // Call the provider's getCollections method
    // Both Commerce7 and Shopify providers implement this
    const collections = await provider.getCollections({ q, limit });

    return { collections };
  } catch (error) {
    console.error('Error fetching collections:', error);
    return { 
      error: error instanceof Error ? error.message : 'Failed to fetch collections',
      collections: [] 
    };
  }
}

