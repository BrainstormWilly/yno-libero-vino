import { type LoaderFunctionArgs, redirect } from 'react-router';
import { useLoaderData, useLocation, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  InlineStack,
  Link,
  List
} from '@shopify/polaris';
import { getAppSession } from '~/lib/sessions.server';
import { getClient, getClubProgram, getSupabaseClient, getCommunicationConfig, getShowcaseProducts, getStagePromotions, getTierLoyaltyConfig } from '~/lib/db/supabase.server';
import { getMainNavigationActions } from '~/util/navigation';
import { addSessionToUrl } from '~/util/session';
import UpgradesChart, { type UpgradesChartData } from '~/components/charts/UpgradesChart';
import ExtensionsChart, { type ExtensionsChartData } from '~/components/charts/ExtensionsChart';
import UpgradeFrequencyChart, { type UpgradeFrequencyChartData } from '~/components/charts/UpgradeFrequencyChart';
import DateRangePicker, { type DateRangeOption } from '~/components/charts/DateRangePicker';

export async function loader({ request }: LoaderFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  const client = session ? await getClient(session.clientId) : null;
  
  // Fetch tier count and member count
  let tierCount = 0;
  let memberCount = 0;
  let totalCustomers = 0;
  let totalLoyaltyPoints = 0;
  
  // Setup completion status
  let clubsTiersComplete = false;
  let communicationComplete = false;
  let marketingComplete = false;
  let hasMarketingEnabled = false;
  let communicationProvider: string | null = null;
  let clubProgram: Awaited<ReturnType<typeof getClubProgram>> = null;
  
  if (client) {
    const supabase = getSupabaseClient();
    
    // Get total customers count
    const { count: customersCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);
    totalCustomers = customersCount || 0;
    
    // Get total loyalty points (sum of lifetime points)
    const { data: loyaltyData } = await supabase
      .from('customers')
      .select('loyalty_points_lifetime')
      .eq('client_id', client.id);
    totalLoyaltyPoints = loyaltyData?.reduce((sum, customer) => sum + (customer.loyalty_points_lifetime || 0), 0) || 0;
    
    // Get club program to count tiers
    clubProgram = await getClubProgram(client.id);
    if (clubProgram && clubProgram.club_stages) {
      tierCount = clubProgram.club_stages.length;
      
      // Get member count (active enrollments)
      if (tierCount > 0) {
        const stageIds = clubProgram.club_stages.map(stage => stage.id);
        
        const { count } = await supabase
          .from('club_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .in('club_stage_id', stageIds);
        
        memberCount = count || 0;
      }
      
      // Check if clubs/tiers section is complete
      if (tierCount > 0) {
        const tiersWithPromos = await Promise.all(
          clubProgram.club_stages.map(async (stage) => {
            const promotions = await getStagePromotions(stage.id);
            return { stage, hasPromos: promotions.length > 0 };
          })
        );
        clubsTiersComplete = tiersWithPromos.every(t => t.hasPromos);
      }
    }
    
    // Check communication (fetch once, use for both completion check and provider name)
    const communicationConfig = await getCommunicationConfig(client.id);
    communicationComplete = !!communicationConfig?.email_provider;
    if (communicationConfig?.email_provider) {
      communicationProvider = communicationConfig.email_provider;
    } else if (communicationConfig?.sms_provider) {
      communicationProvider = communicationConfig.sms_provider;
    }
    
    // Check marketing (showcase products)
    const showcaseProducts = await getShowcaseProducts(client.id, { activeOnly: false });
    hasMarketingEnabled = showcaseProducts.length > 0;
    marketingComplete = hasMarketingEnabled;
  }
  
  // Check if loyalty points are configured (any tier has loyalty config)
  let hasLoyaltyPoints = false;
  if (clubProgram && clubProgram.club_stages && clubProgram.club_stages.length > 0) {
    const loyaltyChecks = await Promise.all(
      clubProgram.club_stages.map(stage => getTierLoyaltyConfig(stage.id))
    );
    hasLoyaltyPoints = loyaltyChecks.some(config => config !== null);
  }
  
  return { 
    client,
    session,
    tierCount,
    memberCount,
    totalCustomers,
    totalLoyaltyPoints,
    setupComplete: client?.setup_complete || false,
    completionStatus: {
      clubsTiers: clubsTiersComplete,
      communication: communicationComplete,
      marketing: marketingComplete,
      hasMarketingEnabled,
    },
    communicationProvider,
    hasLoyaltyPoints,
  };
}

export default function AppDashboard() {
  const { client, session, tierCount, memberCount, totalCustomers, totalLoyaltyPoints, setupComplete, completionStatus, communicationProvider, hasLoyaltyPoints } = useLoaderData<typeof loader>();
  const location = useLocation();
  const navigate = useNavigate();
  const crmType = session?.crmType || 'commerce7';
  const identifier = session?.tenantShop || 'unknown';
  
  // Extract first name from userName (e.g., "William Langley" -> "William")
  const firstName = session?.userName?.split(' ')[0] || 'there';
  
  // Format tier and member counts with proper pluralization
  const tierText = tierCount === 1 ? 'tier' : 'tiers';
  const memberText = memberCount === 1 ? 'member' : 'members';
  
  // Build list of missing setup items
  const missingItems: string[] = [];
  if (!completionStatus.clubsTiers) {
    missingItems.push('Club tiers and promotions');
  }
  if (!completionStatus.communication) {
    missingItems.push('Communication provider');
  }
  // Only warn about marketing if they have communication set AND marketing enabled (has products)
  // If they have comm but no products (marketing not enabled), don't warn about marketing
  // Note: If hasMarketingEnabled is true, marketingComplete is also true (having products = complete),
  // so marketing won't appear in missing items, which is correct behavior

  // Chart data state
  const [dateRange, setDateRange] = useState<string>('30d');
  const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption | null>(null);
  const [upgradesData, setUpgradesData] = useState<UpgradesChartData[]>([]);
  const [extensionsData, setExtensionsData] = useState<ExtensionsChartData[]>([]);
  const [upgradeFrequencyData, setUpgradeFrequencyData] = useState<UpgradeFrequencyChartData[]>([]);
  const [chartsLoading, setChartsLoading] = useState(true);

  // Initialize date range
  useEffect(() => {
    const defaultOption: DateRangeOption = {
      label: 'Last 30 days',
      value: '30d',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(),
    };
    setDateRangeOption(defaultOption);
  }, []);

  // Fetch chart data when date range changes
  useEffect(() => {
    if (!dateRangeOption || !session?.id) return;

    const fetchChartData = async () => {
      setChartsLoading(true);
      try {
        const sessionParam = `?session=${session.id}`;
        const startDate = dateRangeOption.startDate.toISOString();
        const endDate = dateRangeOption.endDate.toISOString();
        const dateParams = `&startDate=${startDate}&endDate=${endDate}`;

        // Fetch upgrades data
        const upgradesResponse = await fetch(
          `/api/dashboard/charts${sessionParam}&type=upgrades${dateParams}`
        );
        const upgradesResult = await upgradesResponse.json();
        if (upgradesResult.data) {
          setUpgradesData(upgradesResult.data);
        }

        // Fetch extensions data
        const extensionsResponse = await fetch(
          `/api/dashboard/charts${sessionParam}&type=extensions${dateParams}`
        );
        const extensionsResult = await extensionsResponse.json();
        if (extensionsResult.data) {
          setExtensionsData(extensionsResult.data);
        }

        // Fetch upgrade frequency data
        const frequencyResponse = await fetch(
          `/api/dashboard/charts${sessionParam}&type=upgrade-frequency${dateParams}`
        );
        const frequencyResult = await frequencyResponse.json();
        if (frequencyResult.data) {
          setUpgradeFrequencyData(frequencyResult.data);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        setChartsLoading(false);
      }
    };

    fetchChartData();
  }, [dateRangeOption, session?.id]);

  const handleDateRangeChange = (value: string, option: DateRangeOption) => {
    setDateRange(value);
    setDateRangeOption(option);
  };

  const theme = session?.theme || 'light';
  const logoSrc = theme === 'dark' 
    ? '/yno-lv-logo-dark.png' 
    : '/yno-lv-logo-light.png';

  return (
    <Page 
      title="Dashboard" 
      primaryAction={{
        content: 'Add Member',
        onAction: () => navigate(addSessionToUrl('/app/members/new', session?.id || '')),
      }}
      secondaryActions={getMainNavigationActions({
        sessionId: session?.id || '',
        currentPath: location.pathname,
      })}
    >
        <Layout>
          {/* Welcome Section */}
          <Layout.Section>
            {!setupComplete ? (
              <Banner tone="warning" title="Complete your setup to get started">
                <BlockStack gap="300">
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <img 
                      src={logoSrc} 
                      alt="LiberoVino Logo" 
                      style={{ maxHeight: '60px', width: 'auto' }}
                    />
                  </div>
                  <Text variant="bodyMd" as="p">
                    Your LiberoVino setup is incomplete. Please complete the following to unlock all features:
                  </Text>
                  {missingItems.length > 0 && (
                    <List type="bullet">
                      {missingItems.map((item, index) => (
                        <List.Item key={index}>{item}</List.Item>
                      ))}
                    </List>
                  )}
                  <Text variant="bodyMd" as="p">
                    <Link url={addSessionToUrl('/app/settings', session?.id || '')}>
                      Go to Settings to complete setup
                    </Link>
                  </Text>
                </BlockStack>
              </Banner>
            ) : (
              <Banner tone="success" title={`Welcome back, ${firstName}!`}>
                <BlockStack gap="200">
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <img 
                      src={logoSrc} 
                      alt="LiberoVino Logo" 
                      style={{ maxHeight: '60px', width: 'auto' }}
                    />
                  </div>
                  <Text variant="bodyMd" as="p">
                    Your LiberoVino account is fully operational. {client?.org_name || 'Your organization'} currently has {tierCount} club {tierText} with {memberCount} {memberText}. Keep up the wine club evolution!
                  </Text>
                  <Text variant="bodyMd" as="p">
                    By the way. How is your tasting room outreach program? Need some help tracking referral performance? Check out <Link url="https://www.commerce7.com/partners/apps/yno-neighborly/" external>Yno Neighborly</Link> in your Commerce7 app store.
                  </Text>
                </BlockStack>
              </Banner>
            )}
          </Layout.Section>

          {/* Quick Stats */}
          <Layout.Section>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h2">
                📊 Quick Stats
              </Text>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Club Members
                    </Text>
                    <Text variant="heading2xl" as="p">
                      {memberCount}
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Active memberships
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text variant="headingMd" as="h3">
                      Loyalty Points
                    </Text>
                    <Text variant="heading2xl" as="p">
                      {totalLoyaltyPoints.toLocaleString()}
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
                      {totalCustomers}
                    </Text>
                    <Text variant="bodySm" tone="subdued" as="p">
                      In your database
                    </Text>
                  </BlockStack>
                </Card>
              </div>
            </BlockStack>
          </Layout.Section>

          {/* ROI Charts - Only show if setup is complete */}
          {setupComplete && (
            <Layout.Section>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  📈 ROI Metrics
                </Text>
                <Card>
                  <BlockStack gap="400">
                    <DateRangePicker
                      value={dateRange}
                      onChange={handleDateRangeChange}
                    />
                    {chartsLoading ? (
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Loading chart data...
                      </Text>
                    ) : (
                      <BlockStack gap="400">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <Card>
                            <BlockStack gap="300">
                              <Text variant="headingMd" as="h3">
                                Upgrades Over Time
                              </Text>
                              <UpgradesChart data={upgradesData} />
                            </BlockStack>
                          </Card>
                          <Card>
                            <BlockStack gap="300">
                              <Text variant="headingMd" as="h3">
                                Extensions Over Time
                              </Text>
                              <ExtensionsChart data={extensionsData} />
                            </BlockStack>
                          </Card>
                        </div>
                        <Card>
                          <BlockStack gap="300">
                            <Text variant="headingMd" as="h3">
                              Upgrade Frequency
                            </Text>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Number of customers by upgrade count
                            </Text>
                            <UpgradeFrequencyChart data={upgradeFrequencyData} />
                          </BlockStack>
                        </Card>
                      </BlockStack>
                    )}
                  </BlockStack>
                </Card>
              </BlockStack>
            </Layout.Section>
          )}

          {/* Organization Info */}
          <Layout.Section>
            <BlockStack gap="400">
              <Text variant="headingLg" as="h2">
                ⚙️ Account Information
              </Text>
              <Card>
                <BlockStack gap="300">
                  <Text variant="bodyMd" as="p">
                    <strong>{crmType === 'commerce7' ? 'Tenant ID' : 'Shop Domain'}:</strong> {identifier}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Contact:</strong> {client?.org_contact || 'Not set'}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Email:</strong> {client?.user_email || 'Not set'}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Communication Provider:</strong> {communicationProvider || 'Not configured'}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Club Tiers:</strong> {tierCount} {tierCount === 1 ? 'tier' : 'tiers'}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    <strong>Loyalty Points:</strong> {hasLoyaltyPoints ? 'Enabled' : 'Not configured'}
                  </Text>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

