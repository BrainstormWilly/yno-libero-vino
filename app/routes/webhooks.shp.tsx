import type { ActionFunctionArgs } from 'react-router';
import { json } from 'react-router';
import { crmManager } from '~/lib/crm';
import type { WebhookPayload } from '~/types/crm';

/**
 * Shopify webhook endpoint
 * POST /webhooks/shp
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const shopifyProvider = crmManager.getProvider('shopify');
    
    // Validate webhook signature
    const isValid = await shopifyProvider.validateWebhook(request);
    
    if (!isValid) {
      console.error('Invalid Shopify webhook signature');
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse webhook payload
    const body = await request.json();
    const topic = request.headers.get('x-shopify-topic');
    const shop = request.headers.get('x-shopify-shop-domain');

    if (!topic) {
      return json({ error: 'Missing webhook topic' }, { status: 400 });
    }

    const payload: WebhookPayload = {
      topic: topic as any, // Cast to WebhookTopic
      shop: shop || undefined,
      data: body,
      timestamp: new Date().toISOString()
    };

    // Process the webhook
    await shopifyProvider.processWebhook(payload);

    // Return success response
    return json({ success: true, message: 'Webhook processed successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error processing Shopify webhook:', error);
    return json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}

// Loader to handle GET requests (Shopify may send verification requests)
export async function loader() {
  return json({ message: 'Shopify webhook endpoint at /webhooks/shp' }, { status: 200 });
}

