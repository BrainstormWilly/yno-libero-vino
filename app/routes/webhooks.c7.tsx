import type { ActionFunctionArgs } from 'react-router';
import { crmManager } from '~/lib/crm';
import type { WebhookPayload, WebhookTopic } from '~/types/crm';

/**
 * Map Commerce7 webhook object + action to webhook topic
 * 
 * Commerce7 webhook object names (available):
 * Allocation, Cart, Club, Club Package, Club Membership, Collection, Customer,
 * Customer Address, Customer Credit Card, Coupon, Group, Product, Promotion,
 * Order, Reservation, Tag, Transaction Email
 * 
 * We normalize to lowercase for case-insensitive matching
 */
function mapC7WebhookToTopic(object: string, action: string): WebhookTopic | null {
  const normalizedObject = object.toLowerCase().trim();
  const normalizedAction = action.toLowerCase().trim();

  // Map object + action to topic
  // Note: Commerce7 sends "Club Membership" (with space), which normalizes to "club membership"
  const mapping: Record<string, Record<string, WebhookTopic>> = {
    'customer': {
      'update': 'customers/update',
    },
    'club': {
      'update': 'club/update',
      'delete': 'club/delete',
    },
    'club membership': {  // Commerce7 object name: "Club Membership"
      'update': 'club-membership/update',
      'delete': 'club-membership/delete',
    },
  };

  return mapping[normalizedObject]?.[normalizedAction] || null;
}

/**
 * Commerce7 webhook endpoint
 * POST /webhooks/c7
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Validate basic auth first (before signature validation)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      console.error('Missing or invalid Authorization header in Commerce7 webhook');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base64Credentials = authHeader.slice(6); // Remove 'Basic ' prefix
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    const expectedUsername = 'liberovino';
    const expectedPassword = process.env.COMMERCE7_WEBHOOK_PASSWORD;

    if (!expectedPassword) {
      console.error('COMMERCE7_WEBHOOK_PASSWORD not configured');
      return Response.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (username !== expectedUsername || password !== expectedPassword) {
      console.error('Invalid basic auth credentials in Commerce7 webhook');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse Commerce7 webhook payload format: { object, action, payload, tenantId, user }
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      console.error('Failed to parse Commerce7 webhook body as JSON:', error);
      return Response.json({ 
        error: 'Invalid JSON in webhook payload' 
      }, { status: 400 });
    }

    const { object, action, payload: payloadData, tenantId } = body;

    // Validate required fields
    if (!object || !action || !payloadData) {
      return Response.json({ 
        error: 'Invalid webhook format. Expected: { object, action, payload, tenantId }' 
      }, { status: 400 });
    }

    // Validate tenantId is present (required for provider instantiation)
    if (!tenantId) {
      console.error('Missing tenantId in Commerce7 webhook body');
      return Response.json({ error: 'Missing tenant information' }, { status: 400 });
    }

    // Create provider instance for this specific tenant
    // Basic Auth is already validated above - no additional validation needed
    const commerce7Provider = crmManager.getProvider('commerce7', tenantId);

    // Map Commerce7 object + action to webhook topic
    const topic = mapC7WebhookToTopic(object, action);
    if (!topic) {
      console.error(`Unhandled webhook: object="${object}", action="${action}"`);
      return Response.json({ 
        error: `Unhandled webhook type: ${object}/${action}` 
      }, { status: 400 });
    }

    const payload: WebhookPayload = {
      topic,
      tenant: tenantId,
      data: payloadData,
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

