import type { ActionFunctionArgs } from 'react-router';
import { crmManager } from '~/lib/crm/index.server';
import type { WebhookPayload, WebhookTopic } from '~/types/crm';
import * as db from '~/lib/db/supabase.server';

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
 * POST /api/webhooks/c7
 * 
 * Security Measures (Basic Auth not available from Commerce7):
 * 1. Tenant Validation - Verifies tenantId exists in our database (403 if unknown)
 * 2. Self-Triggered Blocking - Ignores webhooks from our own API user to prevent loops
 * 3. Payload Validation - Validates required fields in webhook payload
 * 4. Topic Validation - Only processes known webhook topics
 * 
 * Additional Security Recommendations:
 * - Use HTTPS only (enforce at deployment/infrastructure level)
 * - Monitor webhook logs for suspicious activity
 * - Consider rate limiting at infrastructure level
 * - IP whitelisting if Commerce7 provides static IP ranges
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
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

    const { object, action, payload: payloadData, tenantId, user } = body;

    // Block webhooks triggered by our own API calls
    // When we make API calls to Commerce7 (e.g., updating clubs, memberships), 
    // Commerce7 sends webhooks back with user=bill@ynoguy.com.
    // We should ignore these to prevent duplicate processing and notification loops.
    // Example scenario: We update a club in C7 → C7 sends webhook → We'd update again → Loop
    const selfTriggeredUser = process.env.COMMERCE7_API_USER || 'bill@ynoguy.com';
    if (user === selfTriggeredUser && process.env.NODE_ENV === 'production') {
      console.info(`Ignoring webhook triggered by our own API call: ${object}/${action} (user: ${user})`);
      return Response.json({ 
        success: true, 
        message: 'Webhook ignored - triggered by our own API call' 
      }, { status: 200 });
    }

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

    // Security: Verify tenant exists in our database
    // This ensures only legitimate Commerce7 tenants can trigger webhooks
    const client = await db.getClientbyCrmIdentifier('commerce7', tenantId);
    if (!client) {
      console.warn(`Unauthorized webhook attempt from unknown tenant: ${tenantId}`);
      return Response.json({ error: 'Unauthorized tenant' }, { status: 403 });
    }

    // Create provider instance for this specific tenant
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
  return Response.json({ message: 'Commerce7 webhook endpoint at /api/webhooks/c7' }, { status: 200 });
}

