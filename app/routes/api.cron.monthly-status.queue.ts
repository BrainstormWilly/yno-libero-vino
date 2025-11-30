/**
 * Monthly Status Queue Processing API Endpoint
 * 
 * Called by pg_net from the database cron job to process individual monthly status queue items
 * This endpoint handles sending monthly status notifications for a single customer
 */

import { type ActionFunctionArgs } from 'react-router';
import { sendMonthlyStatusNotification } from '~/lib/communication/membership-communications.server';

export async function action({ request }: ActionFunctionArgs) {
  // Verify this is coming from our internal system (pg_net)
  const userAgent = request.headers.get('User-Agent');
  if (userAgent !== 'pg_net-cron-processor') {
    // For now, allow any request - but log a warning
    console.warn('⚠️  Monthly status queue endpoint called without expected User-Agent header');
  }

  try {
    const body = await request.json() as {
      queueId: string;
      clientId: string;
      customerId: string;
    };

    const { queueId, clientId, customerId } = body;

    // Validate required fields
    if (!queueId || !clientId || !customerId) {
      return {
        success: false,
        error: 'Missing required fields: queueId, clientId, and customerId are required',
      };
    }

    // Send monthly status notification for this customer
    try {
      await sendMonthlyStatusNotification(clientId, customerId);

      return {
        success: true,
        message: `Successfully sent monthly status notification for customer ${customerId}`,
      };
    } catch (notificationError) {
      const errorMessage = notificationError instanceof Error ? notificationError.message : String(notificationError);
      console.error(`Monthly status notification error for queue item ${queueId}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    console.error('Error processing monthly status queue request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process queue request',
    };
  }
}

