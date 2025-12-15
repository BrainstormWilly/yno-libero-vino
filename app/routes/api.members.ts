/**
 * Members API Resource Route
 * 
 * Provides member enrollment and management operations
 * Called via fetch from client components
 */

import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get('clientId');

  try {
    // Get all enrollments for a client
    if (clientId) {
      const enrollments = await db.getEnrollmentsByClientId(clientId);
      return { enrollments };
    }

    return { enrollments: [] };
  } catch (error) {
    console.error('Error fetching members:', error);
    return { 
      error: error instanceof Error ? error.message : 'Failed to fetch members',
      enrollments: [] 
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
    // Cancel a membership
    if (actionType === 'cancel') {
      const enrollmentId = formData.get('enrollmentId') as string;

      if (!enrollmentId) {
        return {
          success: false,
          error: 'Enrollment ID is required',
        };
      }

      await db.updateEnrollmentStatus(enrollmentId, 'cancelled');

      return { success: true };
    }

    return { success: false, error: 'Invalid action' };
  } catch (error) {
    console.error('Error in member action:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to perform action',
    };
  }
}
