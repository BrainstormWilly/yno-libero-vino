import type { ActionFunctionArgs } from 'react-router';
import { crmManager } from '~/lib/crm';
import type { WebhookPayload } from '~/types/crm';

/**
 * Commerce7 webhook endpoint
 * POST /webhooks/c7
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const commerce7Provider = crmManager.getProvider('commerce7');
    
    // Validate webhook signature
    const isValid = await commerce7Provider.validateWebhook(request);
    
    if (!isValid) {
      console.error('Invalid Commerce7 webhook signature');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse webhook payload
    const body = await request.json();
    const topic = request.headers.get('x-commerce7-event') || body.event;
    const tenant = request.headers.get('x-commerce7-tenant') || body.tenantId;

    if (!topic) {
      return Response.json({ error: 'Missing webhook topic' }, { status: 400 });
    }

    const payload: WebhookPayload = {
      topic: topic as any, // Cast to WebhookTopic
      tenant: tenant || undefined,
      data: body.data || body,
      timestamp: new Date().toISOString()
    };

    // Process the webhook
    await commerce7Provider.processWebhook(payload);

    // Return success response
    return Response.json({ success: true, message: 'Webhook processed successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error processing Commerce7 webhook:', error);
    return Response.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// Loader to handle GET requests (Commerce7 may send verification requests)
export async function loader() {
  return Response.json({ message: 'Commerce7 webhook endpoint at /webhooks/c7' }, { status: 200 });
}

