import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData } from 'react-router';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner
} from '@shopify/polaris';
import { StoreIcon } from '@shopify/polaris-icons';
import { crmManager } from '~/lib/crm';
import { getSubdomainInfo } from '~/util/subdomain';

export async function loader({ request }: LoaderFunctionArgs) {
  const subdomainInfo = getSubdomainInfo(request);
  
  // Optionally validate that we're on the correct subdomain
  const isCorrectSubdomain = subdomainInfo.crmType === 'shopify';
  
  return { 
    crmType: 'shopify',
    subdomainInfo,
    isCorrectSubdomain
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action') as string;

  try {
    if (action === 'install') {
      // Handle Shopify app installation
      const isAuthorized = await crmManager.authorizeInstall('shopify', request);
      if (isAuthorized) {
        return { success: true, message: 'Shopify app installation authorized' };
      } else {
        return { success: false, message: 'Shopify app installation failed' };
      }
    }

    if (action === 'authenticate') {
      // Handle Shopify authentication
      const auth = await crmManager.authenticate('shopify', request);
      return { success: true, auth };
    }

    return { success: false, message: 'Invalid action' };
  } catch (error) {
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Authentication failed' 
    };
  }
}

export default function ShopifyAuth() {
  const { crmType, subdomainInfo, isCorrectSubdomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <Page title="Connect Shopify" narrowWidth>
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400" align="center">
                {/* Header */}
                <BlockStack gap="200" align="center">
                  <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                    <StoreIcon />
                  </div>
                  <Text variant="headingMd" as="h1">
                    Connect Shopify
                  </Text>
                  <Text variant="bodyMd" tone="subdued" alignment="center" as="p">
                    Connect your Shopify store to start managing your CRM data
                  </Text>
                </BlockStack>

                {/* Subdomain Warning */}
                {!isCorrectSubdomain && subdomainInfo.crmType && (
                  <Banner tone="warning">
                    You're trying to access Shopify from the {subdomainInfo.subdomain} subdomain. 
                    For best experience, please use shp.yourdomain.com
                  </Banner>
                )}

                {/* Status Banner */}
                {actionData && (
                  <Banner
                    tone={(actionData as any).success ? 'success' : 'critical'}
                    title={(actionData as any).message}
                  />
                )}

                {/* Action Buttons */}
                <BlockStack gap="200">
                  <Form method="post">
                    <input type="hidden" name="action" value="install" />
                    <Button variant="primary" size="large" submit fullWidth>
                      Install Shopify App
                    </Button>
                  </Form>

                  <Text variant="bodyMd" alignment="center" tone="subdued" as="p">
                    or
                  </Text>

                  <Form method="post">
                    <input type="hidden" name="action" value="authenticate" />
                    <Button variant="secondary" size="large" submit fullWidth>
                      Authenticate Existing App
                    </Button>
                  </Form>
                </BlockStack>

                {/* Footer */}
                <div className="pt-6 border-t border-gray-200 w-full">
                  <Text variant="bodySm" alignment="center" tone="subdued" as="p">
                    By connecting, you agree to our terms of service and privacy policy.
                  </Text>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </div>
  );
}
