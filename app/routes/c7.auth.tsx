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
import { ChartDonutIcon } from '@shopify/polaris-icons';
import { crmManager } from '~/lib/crm';
import { getSubdomainInfo } from '~/util/subdomain';

export async function loader({ request }: LoaderFunctionArgs) {
  const subdomainInfo = getSubdomainInfo(request);
  
  // Optionally validate that we're on the correct subdomain
  // If you want to enforce strict subdomain routing, you can redirect here
  const isCorrectSubdomain = subdomainInfo.crmType === 'commerce7';
  
  return { 
    crmType: 'commerce7',
    subdomainInfo,
    isCorrectSubdomain
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('action') as string;

  try {
    if (action === 'install') {
      // Handle Commerce7 app installation
      const isAuthorized = await crmManager.authorizeInstall('commerce7', request);
      if (isAuthorized) {
        return { success: true, message: 'Commerce7 app installation authorized' };
      } else {
        return { success: false, message: 'Commerce7 app installation failed' };
      }
    }

    if (action === 'authenticate') {
      // Handle Commerce7 authentication
      const auth = await crmManager.authenticate('commerce7', request);
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

export default function Commerce7Auth() {
  const { crmType, subdomainInfo, isCorrectSubdomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-violet-100">
      <Page title="Connect Commerce7" narrowWidth>
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400" align="center">
                {/* Header */}
                <BlockStack gap="200" align="center">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full flex items-center justify-center">
                    <ChartDonutIcon />
                  </div>
                  <Text variant="headingMd" as="h1">
                    Connect Commerce7
                  </Text>
                  <Text variant="bodyMd" tone="subdued" alignment="center" as="p">
                    Connect your Commerce7 account to start managing your CRM data
                  </Text>
                </BlockStack>

                {/* Subdomain Warning */}
                {!isCorrectSubdomain && subdomainInfo.crmType && (
                  <Banner tone="warning">
                    You're trying to access Commerce7 from the {subdomainInfo.subdomain} subdomain. 
                    For best experience, please use c7.yourdomain.com
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
                      Install Commerce7 App
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
