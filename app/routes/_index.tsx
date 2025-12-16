import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Link } from 'react-router';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  InlineStack,
  Banner,
  Icon
} from '@shopify/polaris';
import { StoreIcon, ChartDonutIcon } from '@shopify/polaris-icons';
import { getSubdomainInfo, getCrmUrl } from '~/util/subdomain';

export async function loader({ request }: LoaderFunctionArgs) {
  const subdomainInfo = getSubdomainInfo(request);
  
  // Create metadata for display purposes (not full provider instances)
  const providerMetadata = [
    { slug: 'shopify', name: 'Shopify' },
    { slug: 'commerce7', name: 'Commerce7' }
  ];
  
  // If we're on a CRM-specific subdomain, show only that CRM's content
  if (subdomainInfo.isValid && subdomainInfo.crmType) {
    const provider = providerMetadata.find(p => 
      subdomainInfo.crmType === 'shopify' ? p.slug === 'shopify' : p.slug === 'commerce7'
    );
    return { 
      providers: provider ? [provider] : providerMetadata,
      subdomainInfo,
      isSingleCrm: true
    };
  }
  
  // Otherwise show all providers (for www or no subdomain)
  return { 
    providers: providerMetadata,
    subdomainInfo,
    isSingleCrm: false
  };
}

export async function action({ request }: ActionFunctionArgs) {
  // Handle POST requests gracefully - likely bots/scanners probing the site
  if (request.method === "POST") {
    return new Response("Method Not Allowed", { 
      status: 405,
      headers: { "Allow": "GET" }
    });
  }
  return null;
}

export default function Index() {
  const { providers, subdomainInfo, isSingleCrm } = useLoaderData<typeof loader>();

  // Determine the background gradient based on subdomain
  const getBackgroundClass = () => {
    if (subdomainInfo.crmType === 'shopify') {
      return 'from-green-50 to-emerald-100';
    } else if (subdomainInfo.crmType === 'commerce7') {
      return 'from-purple-50 to-violet-100';
    }
    return 'from-blue-50 to-indigo-100';
  };

  // Get the title based on subdomain
  const getTitle = () => {
    if (isSingleCrm && providers.length > 0) {
      return `Yno Libero Vino - ${providers[0].name}`;
    }
    return 'Yno Libero Vino';
  };

  // Get the description based on subdomain
  const getDescription = () => {
    if (isSingleCrm && providers.length > 0) {
      return `Manage your ${providers[0].name} wine club and loyalty programs. Built with React Router v7, Supabase, and deployed on Heroku.`;
    }
    return 'A wine club and loyalty platform for Commerce7 and Shopify. Built with React Router v7, Supabase, and deployed on Heroku.';
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${getBackgroundClass()}`}>
      <Page title={getTitle()} fullWidth>
        <div className="container mx-auto px-4 py-16">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <Text variant="headingXl" as="h1" alignment="center">
              {getTitle()}
            </Text>
            <div className="mt-4 max-w-2xl mx-auto">
              <Text variant="headingMd" as="p" alignment="center" tone="subdued">
                {getDescription()}
              </Text>
            </div>
            {isSingleCrm && (
              <div className="mt-4">
                <Banner tone="info">
                  You are on the {providers[0].name}-specific subdomain ({subdomainInfo.subdomain}.yourdomain.com)
                </Banner>
              </div>
            )}
          </div>

          {/* CRM Provider Cards */}
          <div className={`grid ${isSingleCrm ? 'md:grid-cols-1 max-w-md' : 'md:grid-cols-2 max-w-4xl'} gap-8 mx-auto mb-12`}>
            {providers.map((provider: any) => (
              <Card key={provider.slug}>
                <BlockStack gap="400" align="center">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Icon source={provider.slug === 'shopify' ? StoreIcon : ChartDonutIcon} />
                  </div>
                  <BlockStack gap="200" align="center">
                    <Text variant="headingMd" as="h2">
                      {provider.name}
                    </Text>
                    <Text variant="bodyMd" tone="subdued" alignment="center" as="p">
                      Connect and manage your {provider.name} wine club and loyalty programs.
                    </Text>
                  </BlockStack>
                  <Link to={provider.slug === 'shopify' ? '/shp/auth' : '/app'}>
                    <Button variant="primary" size="large">
                      Connect {provider.name}
                    </Button>
                  </Link>
                </BlockStack>
              </Card>
            ))}
          </div>

          {/* Features Section */}
          <div className="max-w-2xl mx-auto">
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3" alignment="center">
                  Features
                </Text>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    'Unified Customer Management',
                    'Product Synchronization', 
                    'Order Tracking',
                    'Discount Management',
                    'Real-time Analytics',
                    'Multi-CRM Support'
                  ].map((feature) => (
                    <div key={feature} className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <Text variant="bodyMd" as="span">{feature}</Text>
                    </div>
                  ))}
                </div>
              </BlockStack>
            </Card>
          </div>
        </div>
      </Page>
    </div>
  );
}
