/**
 * Monthly Status Notifications API Endpoint
 * 
 * Called by pg_net from the database cron job to send monthly status notifications
 * This endpoint processes all active members for a given client
 */

import { type ActionFunctionArgs } from 'react-router';
import { processMonthlyStatusForClient } from '~/lib/communication/membership-communications.server';

export async function action({ request }: ActionFunctionArgs) {
  // Verify this is coming from our internal system (pg_net)
  const userAgent = request.headers.get('User-Agent');
  if (userAgent !== 'pg_net-cron-processor') {
    // For now, allow any request - but log a warning
    console.warn('⚠️  Monthly status endpoint called without expected User-Agent header');
  }

  try {
    const body = await request.json() as {
      clientId: string;
    };

    const { clientId } = body;

    // Validate required fields
    if (!clientId) {
      return {
        success: false,
        error: 'Missing required field: clientId',
      };
    }

    // Process monthly status for all active members of this client
    const result = await processMonthlyStatusForClient(clientId);

    return {
      success: true,
      message: `Processed monthly status for ${result.processed} members with ${result.errors} errors`,
      processed: result.processed,
      errors: result.errors,
    };
  } catch (error) {
    console.error('Error processing monthly status notifications:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process monthly status notifications',
    };
  }
}

