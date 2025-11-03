import { type LoaderFunctionArgs, redirect } from 'react-router';
import { useLoaderData } from 'react-router';
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
import { getAppSession } from '~/lib/sessions.server';
import { getClient } from '~/lib/db/supabase.server';

export async function loader({ request }: LoaderFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  const client = session ? await getClient(session.clientId) : null;
  
  // Check if setup is complete - redirect to setup if not
  if (client && !client.setup_complete) {
    console.log('⚙️  Setup incomplete - redirecting to /app/setup');
    throw redirect('/app/setup');
  }
  
  return { 
    client,
    session
  };
}

export default function AppDashboard() {
  const { client, session } = useLoaderData<typeof loader>();
  const crmType = session?.crmType || 'commerce7';
  const identifier = session?.tenantShop || 'unknown';

  return (
    <div className="container mx-auto px-4">
      <Page title="Dashboard" narrowWidth>
        <Layout>
          {/* Welcome Section */}
          <Layout.Section>
            <Banner tone="success" title={`Welcome back, ${client?.org_name}!`}>
              <Text variant="bodyMd" as="p">
                Your wine club and loyalty platform is ready to use. [[memory:10077916]]
              </Text>
            </Banner>
          </Layout.Section>

          {/* Quick Stats */}
          <Layout.Section>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h2">
                Quick Stats
              </Text>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Club Members [[memory:10077916]]
                    </Text>
                    <Text variant="heading2xl" as="p">
                      0
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Active memberships [[memory:10077916]]
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Loyalty Points
                    </Text>
                    <Text variant="heading2xl" as="p">
                      0
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Total points earned
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Total Customers
                    </Text>
                    <Text variant="heading2xl" as="p">
                      0
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      In your database
                    </Text>
                  </BlockStack>
                </Card>
              </div>
            </BlockStack>
          </Layout.Section>

          {/* Quick Actions */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Quick Actions
                </Text>
                <BlockStack gap="300">
                  <InlineStack gap="200">
                    <Button variant="primary" disabled>
                      Sync Customers
                    </Button>
                    <Button disabled>
                      View Club Members
                    </Button>
                    <Button disabled>
                      Manage Loyalty Rewards
                    </Button>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Organization Info */}
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">
                  Organization Details
                </Text>
                <Text variant="bodyMd" as="p">
                  <strong>{crmType === 'commerce7' ? 'Tenant ID' : 'Shop Domain'}:</strong> {identifier}
                </Text>
                <Text variant="bodyMd" as="p">
                  <strong>Contact:</strong> {client?.org_contact}
                </Text>
                <Text variant="bodyMd" as="p">
                  <strong>Email:</strong> {client?.user_email}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </div>
  );
}

