import type { ActionFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { createClient } from '@supabase/supabase-js';
import { getSubdomainInfo } from '~/util/subdomain';
import type { Commerce7InstallPayload } from '~/types/commerce7';
import { createAppSession, withSession } from '~/lib/sessions.server';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Validates Commerce7 install request using Basic Auth
 */
function authorizeInstall(request: Request): boolean {
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
 * Loader - redirects GET requests to home
 */
export async function loader() {
  return redirect("/");
}

/**
 * Action - handles install webhook for both Commerce7 and Shopify
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return { success: false, error: 'Method not allowed' };
  }

  const { crmType } = getSubdomainInfo(request);
  
  // Route to appropriate CRM handler
  if (crmType === 'commerce7') {
    return handleC7Install(request);
  } else if (crmType === 'shopify') {
    return handleShopifyInstall(request);
  }
  
  return { success: false, error: 'Invalid CRM type' };
}

/**
 * Handles Commerce7 install webhook
 */
async function handleC7Install(request: Request) {
  // Validate Authorization
  if (!authorizeInstall(request)) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const payload = await request.json() as Commerce7InstallPayload;
    
    // Debug: Log the full payload to see what C7 is sending
    console.log('C7 Install Payload:', JSON.stringify(payload, null, 2));
    
    // Validate required fields
    if (!payload.tenantId || !payload.user) {
      return { 
        success: false, 
        error: 'Missing required fields: tenantId and user' 
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if client already exists
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_shop', payload.tenantId)
      .single();

    if (existingClient) {
      console.log(`Client already exists for tenant: ${payload.tenantId}`);
      return { success: true, message: 'Client already exists' };
    }

    // Extract organization name
    const orgName = payload['organization-name'] || payload.tenantId;
    console.log('Organization name from payload:', payload['organization-name']);
    console.log('Using org_name:', orgName);
    
    // Extract website URL if provided
    const websiteUrl = payload['organization-website'] || null;
    console.log('Organization website from payload:', payload['organization-website']);
    console.log('Using website_url:', websiteUrl);
    
    // Create new client
    const { data: newClient, error: insertError } = await supabase
      .from('clients')
      .insert({
        tenant_shop: payload.tenantId,
        crm_type: 'commerce7',
        org_name: orgName,
        org_contact: `${payload.user.firstName} ${payload.user.lastName}`.trim(),
        user_id: payload.user.id,
        user_email: payload.user.email,
        website_url: websiteUrl,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating client:', insertError);
      return { 
        success: false, 
        error: 'Failed to create client',
        details: insertError.message 
      };
    }

    console.log(`Successfully created client for tenant: ${payload.tenantId}`, newClient);

    // Create app session for the new client
    const sessionId = await createAppSession({
      clientId: newClient.id,
      tenantShop: payload.tenantId,
      crmType: 'commerce7',
      userName: `${payload.user.firstName} ${payload.user.lastName}`.trim(),
      userEmail: payload.user.email,
      theme: 'light',
    });

    // Generate app URL with session parameter
    // The /app loader will check setup_complete and redirect to /app/setup if needed
    const appUrl = withSession('/app', sessionId);

    return { 
      success: true, 
      message: 'Client created successfully',
      clientId: newClient.id,
      sessionId,
      redirectUrl: appUrl
    };

  } catch (error) {
    console.error('Error processing Commerce7 install:', error);
    return { 
      success: false, 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handles Shopify install webhook
 * TODO: Implement Shopify-specific install logic
 */
async function handleShopifyInstall(request: Request) {
  console.log('Shopify install webhook received');
  
  // TODO: Implement Shopify install flow
  // - Validate Shopify webhook signature
  // - Extract shop domain and access token
  // - Create client record
  
  return { 
    success: false, 
    error: 'Shopify install not yet implemented' 
  };
}

