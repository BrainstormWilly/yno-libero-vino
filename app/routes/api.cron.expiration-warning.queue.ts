/**
 * Expiration Warning Queue Processing API Endpoint
 * 
 * Called by pg_net from the database cron job to process individual expiration warning queue items
 * This endpoint handles sending expiration warning notifications for a single customer/enrollment
 */

import { type ActionFunctionArgs } from 'react-router';
import { sendExpirationWarningNotification } from '~/lib/communication/membership-communications.server';

export async function action({ request }: ActionFunctionArgs) {
  // Verify this is coming from our internal system (pg_net)
  const userAgent = request.headers.get('User-Agent');
  if (userAgent !== 'pg_net-cron-processor') {
    // For now, allow any request - but log a warning
    console.warn('⚠️  Expiration warning queue endpoint called without expected User-Agent header');
  }

  try {
    const body = await request.json() as {
      queueId: string;
      clientId: string;
      customerId: string;
      enrollmentId: string;
    };

    const { queueId, clientId, customerId, enrollmentId } = body;

    // Validate required fields
    if (!queueId || !clientId || !customerId || !enrollmentId) {
      return {
        success: false,
        error: 'Missing required fields: queueId, clientId, customerId, and enrollmentId are required',
      };
    }

    // Send expiration warning notification for this customer/enrollment
    try {
      await sendExpirationWarningNotification(clientId, customerId, enrollmentId);

      return {
        success: true,
        message: `Successfully sent expiration warning notification for customer ${customerId}`,
      };
    } catch (notificationError) {
      const errorMessage = notificationError instanceof Error ? notificationError.message : String(notificationError);
      console.error(`Expiration warning notification error for queue item ${queueId}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    console.error('Error processing expiration warning queue request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process queue request',
    };
  }
}

