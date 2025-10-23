import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, redirect } from 'react-router';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  InlineStack
} from '@shopify/polaris';
import { createClient } from '@supabase/supabase-js';
import { getSubdomainInfo } from '~/util/subdomain';
import { WelcomeBanner } from '~/components/WelcomeBanner';
import { getAppSession } from '~/lib/sessions.server';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Consider a client "new" if created within the last 5 minutes
const NEW_CLIENT_THRESHOLD_MS = 5 * 60 * 1000;

export async function loader({ request }: LoaderFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  
  // DEV MODE: Get fake dev client (already created by parent /app route)
  if (process.env.NODE_ENV === 'development' && process.env.EMBEDDED_APP === 'no' && session.crmType === 'commerce7') {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', session.clientId)
      .single();
    
    if (!client) {
      throw new Error('Dev client not found');
    }
    
    const createdAt = new Date(client.created_at);
    const now = new Date();
    const isFirstVisit = (now.getTime() - createdAt.getTime()) < NEW_CLIENT_THRESHOLD_MS;
    
    return {
      client,
      identifier: session.tenantShop,
      crmType: session.crmType,
      subdomainInfo: { crmType: session.crmType },
      isFirstVisit,
      session,
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // Get client from session
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', session.clientId)
    .single();
  
  if (!client) {
    throw new Error('Client not found');
  }
  
  // Check if setup is complete - redirect to setup if not
  if (!client.setup_complete) {
    console.log('⚙️  Setup incomplete - redirecting to /app/setup');
    throw redirect('/app/setup');
  }
  
  const createdAt = new Date(client.created_at);
  const now = new Date();
  const isFirstVisit = (now.getTime() - createdAt.getTime()) < NEW_CLIENT_THRESHOLD_MS;
  
  return { 
    client,
    identifier: session.tenantShop,
    crmType: session.crmType,
    subdomainInfo: { crmType: session.crmType },
    isFirstVisit,
    session,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  
  const formData = await request.formData();
  const action = formData.get('action') as string;

  if (action === 'update_organization') {
    const orgName = formData.get('org_name') as string;
    const orgContact = formData.get('org_contact') as string;

    if (!orgName || !orgContact) {
      return { 
        success: false, 
        message: 'Organization name and contact are required' 
      };
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { error } = await supabase
        .from('clients')
        .update({ 
          org_name: orgName,
          org_contact: orgContact,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.clientId);
      
      if (error) {
        return { 
          success: false, 
          message: 'Failed to update organization details',
          error: error.message 
        };
      }
      
      return { 
        success: true, 
        message: 'Organization details updated successfully' 
      };
      
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  return { success: false, message: 'Invalid action' };
}

export default function Settings() {
  const { client, identifier, crmType, isFirstVisit } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  // crmType should always be set at this point (validated in loader)
  const crmTypeStr = crmType || 'commerce7';
  const crmName = crmType === 'commerce7' ? 'Commerce7' : 'Shopify';

  return (
    <div className="container mx-auto px-4">
      <Page title="Settings" narrowWidth>
        <Layout>
          {/* Show welcome banner for first-time installs */}
          {isFirstVisit && (
            <Layout.Section>
              <WelcomeBanner orgName={client.org_name} crmName={crmName} />
            </Layout.Section>
          )}

          {/* Success/Error Messages */}
          {actionData && (
            <Layout.Section>
              <Banner 
                tone={actionData.success ? 'success' : 'critical'} 
                title={actionData.message}
              >
                {actionData.error && (
                  <Text variant="bodyMd" as="p">
                    {actionData.error}
                  </Text>
                )}
              </Banner>
            </Layout.Section>
          )}

          {/* Club Setup Link */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Club Configuration
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Review and update your LiberoVino club setup, including tiers and loyalty points.
                </Text>
                <InlineStack gap="200">
                  <Button url="/app/setup">
                    View Club Setup
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Organization Details Form */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Organization Details
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Update your organization information. These details are used throughout the app.
                </Text>
                
                <Form method="post">
                  <input type="hidden" name="action" value="update_organization" />
                  <input type="hidden" name="identifier" value={identifier} />
                  <input type="hidden" name="crmType" value={crmTypeStr} />
                  
                  <BlockStack gap="400">
                    {/* Organization Name */}
                    <div>
                      <label htmlFor="org_name" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        Organization Name
                      </label>
                      <input
                        type="text"
                        id="org_name"
                        name="org_name"
                        defaultValue={client.org_name}
                        required
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #c9cccf',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    {/* Organization Contact */}
                    <div>
                      <label htmlFor="org_contact" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        Contact Person
                      </label>
                      <input
                        type="text"
                        id="org_contact"
                        name="org_contact"
                        defaultValue={client.org_contact}
                        required
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #c9cccf',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    {/* Read-only Email */}
                    <div>
                      <label htmlFor="user_email" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        Email
                      </label>
                      <input
                        type="email"
                        id="user_email"
                        value={client.user_email || ''}
                        disabled
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #c9cccf',
                          borderRadius: '8px',
                          fontSize: '14px',
                          backgroundColor: '#f6f6f7',
                          color: '#6d7175'
                        }}
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Text variant="bodySm" as="p" tone="subdued">
                          Email is synced from {crmName} and cannot be changed here.
                        </Text>
                      </div>
                    </div>

                    {/* Save Button */}
                    <InlineStack gap="200">
                      <Button variant="primary" submit>
                        Save Changes
                      </Button>
                      <Button url="/app">
                        Cancel
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </div>
  );
}

