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

import { WelcomeBanner } from '~/components/WelcomeBanner';
import { getAppSession } from '~/lib/sessions.server';
import { addSessionToUrl } from '~/util/session';
import {
  isFirstVisit,
  getClientAndCheckSetup,
  getDevModeClient,
  updateOrganization,
  isDevMode
} from '~/lib/settings-helpers.server';

export async function loader({ request }: LoaderFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  
  // DEV MODE: Get fake dev client (already created by parent /app route)
  if (isDevMode(session.crmType)) {
    const client = await getDevModeClient(session.clientId);
    
    return {
      client,
      identifier: session.tenantShop,
      crmType: session.crmType,
      subdomainInfo: { crmType: session.crmType },
      isFirstVisit: isFirstVisit(client.created_at),
      session,
    };
  }
  
  // Get client and check if setup is complete
  const client = await getClientAndCheckSetup(session.clientId);
  
  return { 
    client,
    identifier: session.tenantShop,
    crmType: session.crmType,
    subdomainInfo: { crmType: session.crmType },
    isFirstVisit: isFirstVisit(client.created_at),
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
    const shopUrl = formData.get('shop_url') as string | null;

    if (!orgName || !orgContact) {
      return { 
        success: false, 
        message: 'Organization name and contact are required' 
      };
    }

    try {
      await updateOrganization(session.clientId, orgName, orgContact, shopUrl || null);
      
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
  const { client, identifier, crmType, isFirstVisit, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  // crmType should always be set at this point (validated in loader)
  const crmTypeStr = crmType || 'commerce7';
  const crmName = crmType === 'commerce7' ? 'Commerce7' : 'Shopify';

  return (
    <div className="container mx-auto px-4">
      <Page title="Settings" narrowWidth>
        <Layout>
          {/* Banners at Top */}
          <Layout.Section>
            <BlockStack gap="400">
              {/* Show welcome banner for first-time installs */}
              {isFirstVisit && (
                <WelcomeBanner orgName={client.org_name} crmName={crmName} />
              )}

              {/* Success/Error Messages */}
              {actionData && (
                <Banner 
                  tone={actionData.success ? 'success' : 'critical'} 
                  title={actionData.message}
                />
              )}
            </BlockStack>
          </Layout.Section>

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
                  <Button url={addSessionToUrl("/app/setup", session.id)}>
                    View Club Setup
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Marketing Products Link */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Marketing Products
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Manage showcase products for email marketing recommendations. These products will be included in monthly status emails for customers who have opted into marketing communications.
                </Text>
                <InlineStack gap="200">
                  <Button url={addSessionToUrl("/app/setup/marketing", session.id)}>
                    Manage Showcase Products
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Communication Settings Link */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Communication Settings
                </Text>
                <Text variant="bodyMd" as="p" tone="subdued">
                  Configure your email provider, monthly status notifications, and expiration warnings for member communications.
                </Text>
                <InlineStack gap="200">
                  <Button url={addSessionToUrl("/app/setup/communication", session.id)}>
                    Manage Communication
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

                    {/* Shop URL */}
                    <div>
                      <label htmlFor="shop_url" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        Shop URL
                      </label>
                      <input
                        type="url"
                        id="shop_url"
                        name="shop_url"
                        defaultValue={client.shop_url || (client.website_url ? `${client.website_url}/shop` : '')}
                        placeholder={client.website_url ? `${client.website_url}/shop` : 'https://example.com/shop'}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '1px solid #c9cccf',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                      <p style={{ marginTop: '4px', fontSize: '12px', color: '#6d7175' }}>
                        URL for &quot;Shop Now&quot; buttons in email templates. Defaults to your website URL + /shop
                      </p>
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

