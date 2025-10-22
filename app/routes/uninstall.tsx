import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { createClient } from '@supabase/supabase-js';
import { getSubdomainInfo } from '~/util/subdomain';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Validates Commerce7 uninstall request using Basic Auth
 */
function authorizeC7Uninstall(request: Request): boolean {
  const auth = request.headers.get("Authorization");
  if (!auth) {
    console.error('Missing Authorization header');
    return false;
  }

  try {
    const base64 = auth.replace("Basic ", "");
    const [username, password] = Buffer.from(base64, "base64").toString().split(":");
    
    const expectedUser = process.env.COMMERCE7_USER;
    const expectedPass = process.env.COMMERCE7_PASSWORD;
    
    if (!expectedUser || !expectedPass) {
      console.error('Missing COMMERCE7_USER or COMMERCE7_PASSWORD env vars');
      return false;
    }
    
    if (username !== expectedUser || password !== expectedPass) {
      console.error('Invalid Commerce7 credentials');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating Commerce7 auth:', error);
    return false;
  }
}

/**
 * Validates Shopify uninstall webhook using HMAC signature
 */
async function validateShopifyWebhook(request: Request): Promise<boolean> {
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256');
  if (!hmacHeader) {
    console.error('Missing x-shopify-hmac-sha256 header');
    return false;
  }

  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) {
    console.error('SHOPIFY_API_SECRET not configured');
    return false;
  }

  try {
    const body = await request.text();
    const hash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');

    return hash === hmacHeader;
  } catch (error) {
    console.error('Shopify webhook validation error:', error);
    return false;
  }
}

/**
 * Loader - redirects GET requests to home
 */
export async function loader() {
  return redirect("/");
}

/**
 * Action - handles uninstall webhook for both Commerce7 and Shopify
 * 
 * This endpoint is called when a winery uninstalls the app.
 * It will destroy all data related to the client, including:
 * - Client record
 * - Platform sessions
 * - Customers and club enrollments
 * - Orders, products, discounts
 * - Loyalty points and rewards
 * - Communication logs and preferences
 * - CRM sync queue
 * 
 * All related data is automatically deleted via CASCADE constraints.
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return { success: false, error: 'Method not allowed' };
  }

  const { crmType } = getSubdomainInfo(request);
  
  // Route to appropriate CRM handler
  if (crmType === 'commerce7') {
    return handleC7Uninstall(request);
  } else if (crmType === 'shopify') {
    return handleShopifyUninstall(request);
  }
  
  return { success: false, error: 'Invalid CRM type' };
}

/**
 * Handles Commerce7 uninstall webhook
 */
async function handleC7Uninstall(request: Request) {
  // Validate Authorization
  if (!authorizeC7Uninstall(request)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const payload = await request.json();
    const tenantId = payload.tenantId;
    
    if (!tenantId) {
      return { 
        success: false, 
        error: 'Missing required field: tenantId' 
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the client record
    const { data: client, error: findError } = await supabase
      .from('clients')
      .select('id, org_name, tenant_shop')
      .eq('tenant_shop', tenantId)
      .eq('crm_type', 'commerce7')
      .single();

    if (findError || !client) {
      console.warn(`Client not found for tenant: ${tenantId}`);
      // Return success even if client not found - idempotent operation
      return { 
        success: true, 
        message: 'Client not found or already deleted' 
      };
    }

    console.log(`Uninstalling Commerce7 client: ${client.org_name} (${client.id}) for tenant: ${tenantId}`);

    // Delete the client record
    // This will CASCADE delete all related data via database constraints
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id);

    if (deleteError) {
      console.error('Error deleting client:', deleteError);
      return { 
        success: false, 
        error: 'Failed to delete client data',
        details: deleteError.message 
      };
    }

    console.log(`✓ Successfully uninstalled Commerce7 client: ${client.org_name} (${client.id})`);
    console.log(`✓ All related data for client ${client.id} has been deleted via CASCADE`);

    return { 
      success: true, 
      message: 'Client and all related data deleted successfully',
      clientId: client.id,
      tenantId: tenantId
    };

  } catch (error) {
    console.error('Error processing Commerce7 uninstall:', error);
    return { 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handles Shopify uninstall webhook
 */
async function handleShopifyUninstall(request: Request) {
  // Clone the request so we can read the body for both validation and parsing
  const clonedRequest = request.clone();
  
  // Validate webhook signature
  const isValid = await validateShopifyWebhook(request);
  
  if (!isValid) {
    console.error('Invalid Shopify webhook signature');
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const payload = await clonedRequest.json();
    const shop = request.headers.get('x-shopify-shop-domain') || payload.domain || payload.myshopify_domain;
    
    if (!shop) {
      return { 
        success: false, 
        error: 'Missing shop domain' 
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the client record
    const { data: client, error: findError } = await supabase
      .from('clients')
      .select('id, org_name, tenant_shop')
      .eq('tenant_shop', shop)
      .eq('crm_type', 'shopify')
      .single();

    if (findError || !client) {
      console.warn(`Client not found for shop: ${shop}`);
      // Return success even if client not found - idempotent operation
      return { 
        success: true, 
        message: 'Client not found or already deleted' 
      };
    }

    console.log(`Uninstalling Shopify client: ${client.org_name} (${client.id}) for shop: ${shop}`);

    // Delete the client record
    // This will CASCADE delete all related data via database constraints
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', client.id);

    if (deleteError) {
      console.error('Error deleting client:', deleteError);
      return { 
        success: false, 
        error: 'Failed to delete client data',
        details: deleteError.message 
      };
    }

    console.log(`✓ Successfully uninstalled Shopify client: ${client.org_name} (${client.id})`);
    console.log(`✓ All related data for client ${client.id} has been deleted via CASCADE`);

    return { 
      success: true, 
      message: 'Client and all related data deleted successfully',
      clientId: client.id,
      shop: shop
    };

  } catch (error) {
    console.error('Error processing Shopify uninstall:', error);
    return { 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

