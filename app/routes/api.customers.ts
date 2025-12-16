/**
 * Customers API Resource Route
 * 
 * Provides CRM-agnostic customer data and operations
 * Called via fetch from client components
 */

import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import { crmManager } from '~/lib/crm/index.server';
import * as db from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get('q');
  const id = url.searchParams.get('id');

  try {
    // Get the appropriate CRM provider based on session
    const provider = crmManager.getProvider(
      session.crmType,
      session.tenantShop,
      session.accessToken
    );

    // Search customers by query
    if (q) {
      if (q.length < 2) {
        return { customers: [] };
      }

      // Use getCustomersWithLTV to get customers with lifetime value calculated
      // Each provider handles its own currency conversion internally
      const customers = await provider.getCustomersWithLTV({ q });
      
      // Check which customers already exist in LiberoVino database
      const customersWithStatus = await Promise.all(
        customers.map(async (customer) => {
          const lvCustomer = await db.getCustomerByCrmId(session.clientId, customer.id);
          return {
            ...customer,
            inSystem: !!lvCustomer, // true if customer exists in LV database
          };
        })
      );
      
      return { customers: customersWithStatus };
    }

    // Get single customer by ID
    if (id) {
      const customer = await provider.getCustomer(id);
      return { customer };
    }

    // No query parameters - return empty
    return { customers: [] };
  } catch (error) {
    console.error('Error fetching customers:', error);
    return { 
      error: error instanceof Error ? error.message : 'Failed to fetch customers',
      customers: [] 
    };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const actionType = formData.get('action') as string;

  try {
    const provider = crmManager.getProvider(
      session.crmType,
      session.tenantShop,
      session.accessToken
    );

    // Create new customer
    if (actionType === 'create') {
      const email = formData.get('email') as string;
      const firstName = formData.get('firstName') as string;
      const lastName = formData.get('lastName') as string;
      const phone = formData.get('phone') as string | null;

      if (!email || !firstName || !lastName) {
        return {
          success: false,
          error: 'Email, first name, and last name are required',
        };
      }

      const customer = await provider.createCustomer({
        email,
        firstName,
        lastName,
        phone: phone || undefined,
      });

      return { success: true, customer };
    }

    return { success: false, error: 'Invalid action' };
  } catch (error) {
    console.error('Error in customer action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform action',
    };
  }
}
