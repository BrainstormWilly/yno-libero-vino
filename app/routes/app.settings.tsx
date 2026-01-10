import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, useActionData, useLocation, useSubmit } from 'react-router';
import { useState } from 'react';
import { 
  Page, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  InlineStack,
  Badge,
  List,
  Box,
  InlineGrid,
  Divider,
  useBreakpoints,
  Link,
  TextField,
  Form,
  FormLayout
} from '@shopify/polaris';

import { WelcomeBanner } from '~/components/WelcomeBanner';
import { getAppSession } from '~/lib/sessions.server';
import { getMainNavigationActions } from '~/util/navigation';
import { addSessionToUrl } from '~/util/session';
import {
  isFirstVisit,
  getClientAndCheckSetup,
  getDevModeClient,
  updateOrganization,
  isDevMode
} from '~/lib/settings-helpers.server';
import * as db from '~/lib/db/supabase.server';
import type { Database } from '~/types/supabase';

type ClubStage = Database['public']['Tables']['club_stages']['Row'];

export async function loader({ request }: LoaderFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  
  // DEV MODE: Get fake dev client (already created by parent /app route)
  if (isDevMode(session.crmType)) {
    const client = await getDevModeClient(session.clientId);
    
    // Check completion status for dev mode too
    const clubProgram = await db.getClubProgram(session.clientId);
    const communicationConfig = await db.getCommunicationConfig(session.clientId);
    const showcaseProducts = await db.getShowcaseProducts(session.clientId, { activeOnly: false });
    
    // Get full tier details with promotions for display
    let tiersWithDetails: Array<{ stage: ClubStage; promotionCount: number }> = [];
    if (clubProgram?.club_stages) {
      tiersWithDetails = await Promise.all(
        clubProgram.club_stages.map(async (stage) => {
          const promotions = await db.getStagePromotions(stage.id);
          return { stage, promotionCount: promotions.length };
        })
      );
    }
    
    // Check if clubs/tiers section is complete
    let clubsTiersComplete = false;
    let clubsTiersDetails = '';
    if (clubProgram) {
      const hasTiers = clubProgram.club_stages && clubProgram.club_stages.length > 0;
      if (hasTiers) {
        const tiersWithPromos = await Promise.all(
          clubProgram.club_stages.map(async (stage) => {
            const promotions = await db.getStagePromotions(stage.id);
            return { stage, hasPromos: promotions.length > 0 };
          })
        );
        const allTiersHavePromos = tiersWithPromos.every(t => t.hasPromos);
        clubsTiersComplete = allTiersHavePromos;
        clubsTiersDetails = allTiersHavePromos 
          ? `Complete: ${clubProgram.club_stages.length} tier(s) with promotions configured`
          : `${clubProgram.club_stages.length} tier(s) configured, but some are missing promotions`;
      } else {
        clubsTiersDetails = 'Club info configured, but no tiers created yet';
      }
    } else {
      clubsTiersDetails = 'Not started';
    }
    
    const communicationComplete = !!communicationConfig?.email_provider;
    const communicationDetails = communicationComplete
      ? `Provider: ${communicationConfig.email_provider}`
      : 'No provider configured';
    
    const marketingComplete = showcaseProducts.length > 0;
    const marketingDetails = marketingComplete
      ? `${showcaseProducts.length} showcase product(s) configured`
      : 'No showcase products configured';
    
    return {
      client,
      identifier: session.tenantShop,
      crmType: session.crmType,
      subdomainInfo: { crmType: session.crmType },
      isFirstVisit: isFirstVisit(client.created_at),
      session,
      clubProgram: clubProgram || null,
      tiersWithDetails: tiersWithDetails || [],
      communicationConfig: communicationConfig || null,
      showcaseProducts: showcaseProducts || [],
      completionStatus: {
        clubsTiers: {
          complete: clubsTiersComplete,
          details: clubsTiersDetails,
        },
        communication: {
          complete: communicationComplete,
          details: communicationDetails,
        },
        marketing: {
          complete: marketingComplete,
          details: marketingDetails,
        },
      },
    };
  }
  
  // Get client and check if setup is complete
  const client = await getClientAndCheckSetup(session.clientId);
  
  // Check completion status for each section
  const clubProgram = await db.getClubProgram(session.clientId);
  const communicationConfig = await db.getCommunicationConfig(session.clientId);
  const showcaseProducts = await db.getShowcaseProducts(session.clientId, { activeOnly: false });
  
  // Get full tier details with promotions for display
  let tiersWithDetails: Array<{ stage: ClubStage; promotionCount: number }> = [];
  if (clubProgram?.club_stages) {
    tiersWithDetails = await Promise.all(
      clubProgram.club_stages.map(async (stage) => {
        const promotions = await db.getStagePromotions(stage.id);
        return { stage, promotionCount: promotions.length };
      })
    );
  }
  
  // Check if clubs/tiers section is complete
  let clubsTiersComplete = false;
  let clubsTiersDetails = '';
  if (clubProgram) {
    const hasTiers = clubProgram.club_stages && clubProgram.club_stages.length > 0;
    if (hasTiers) {
      // Check if tiers have promotions
      const tiersWithPromos = await Promise.all(
        clubProgram.club_stages.map(async (stage) => {
          const promotions = await db.getStagePromotions(stage.id);
          return { stage, hasPromos: promotions.length > 0 };
        })
      );
      const allTiersHavePromos = tiersWithPromos.every(t => t.hasPromos);
      clubsTiersComplete = allTiersHavePromos;
      clubsTiersDetails = allTiersHavePromos 
        ? `Complete: ${clubProgram.club_stages.length} tier(s) with promotions configured`
        : `${clubProgram.club_stages.length} tier(s) configured, but some are missing promotions`;
    } else {
      clubsTiersDetails = 'Club info configured, but no tiers created yet';
    }
  } else {
    clubsTiersDetails = 'Not started';
  }
  
  // Check if communication section is complete
  const communicationComplete = !!communicationConfig?.email_provider;
  const communicationDetails = communicationComplete
    ? `Provider: ${communicationConfig.email_provider}`
    : 'No provider configured';
  
  // Check if marketing section is complete
  const marketingComplete = showcaseProducts.length > 0;
  const marketingDetails = marketingComplete
    ? `${showcaseProducts.length} showcase product(s) configured`
    : 'No showcase products configured';
  
  return { 
    client,
    identifier: session.tenantShop,
    crmType: session.crmType,
    subdomainInfo: { crmType: session.crmType },
    isFirstVisit: isFirstVisit(client.created_at),
    session,
    clubProgram: clubProgram || null,
    tiersWithDetails: tiersWithDetails || [],
    communicationConfig: communicationConfig || null,
    showcaseProducts: showcaseProducts || [],
    completionStatus: {
      clubsTiers: {
        complete: clubsTiersComplete,
        details: clubsTiersDetails,
      },
      communication: {
        complete: communicationComplete,
        details: communicationDetails,
      },
      marketing: {
        complete: marketingComplete,
        details: marketingDetails,
      },
    },
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
  const {
    client,
    identifier,
    crmType,
    isFirstVisit,
    session,
    completionStatus,
    clubProgram,
    tiersWithDetails,
    communicationConfig,
    showcaseProducts,
  } = useLoaderData<typeof loader>();
  const location = useLocation();
  const actionData = useActionData<typeof action>();
  const { smUp } = useBreakpoints();
  const submit = useSubmit();
  
  // crmType should always be set at this point (validated in loader)
  const crmTypeStr = crmType || 'commerce7';
  const crmName = crmType === 'commerce7' ? 'Commerce7' : 'Shopify';
  const [orgName, setOrgName] = useState(client.org_name);
  const [orgContact, setOrgContact] = useState(client.org_contact);
  const [shopUrl, setShopUrl] = useState(client.shop_url || (client.website_url ? `${client.website_url}/shop` : ''));

  const handleSubmitOrg = () => {
    const formData = new FormData();
    formData.append('action', 'update_organization');
    formData.append('org_name', orgName);
    formData.append('org_contact', orgContact);
    formData.append('shop_url', shopUrl);
    formData.append('identifier', identifier);
    formData.append('crmType', crmTypeStr);
    submit(formData, { method: 'put' });
  }

  return (
    <Page 
      title="Settings" 
      secondaryActions={getMainNavigationActions({
        sessionId: session?.id || '',
        currentPath: location.pathname,
      })}
    >
      <BlockStack gap={{ xs: "800", sm: "400" }}>
        {/* Banners at Top */}
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

        {/* Organization Details Section */}
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Organization Details
              </Text>
              <Text as="p" variant="bodyMd">
                Update your organization information. These details are used throughout the app for branding and contact purposes.
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <Form onSubmit={handleSubmitOrg}>
              <FormLayout>
                <FormLayout.Group>
                  <TextField
                    label="Organization Name"
                    value={orgName}
                    onChange={setOrgName}
                    autoComplete="off"
                    requiredIndicator
                  />
                  <TextField
                    label="Contact Person"
                    value={orgContact}
                    onChange={setOrgContact}
                    autoComplete="off"
                    requiredIndicator
                  />
                  <TextField
                    label="Shop URL"
                    value={shopUrl}
                    onChange={setShopUrl}
                    autoComplete="off"
                    helpText="URL for &quot;Shop Now&quot; buttons in email templates. Defaults to your website URL + /shop"
                    requiredIndicator
                  />
                  <TextField
                    label="Email"
                    value={client.user_email || ''}
                    onChange={() => {}}
                    autoComplete="off"
                    helpText="Email is synced from CRM and cannot be changed here."
                    requiredIndicator
                    disabled
                  />
                  <Button variant="primary" submit>
                    Save Changes
                  </Button>
                </FormLayout.Group>
              </FormLayout>
            </Form>
          </Card>
        </InlineGrid>
        {smUp ? <Divider /> : null}

        {/* Club Tiers Section */}
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Club Tiers
              </Text>
              <Text as="p" variant="bodyMd">
                Configure your club program, membership tiers, and promotions. Define the structure of your wine club with different membership levels, benefits, and promotional offers.
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  Club Tiers Configuration
                </Text>
                <Badge tone={completionStatus.clubsTiers.complete ? 'success' : 'attention'}>
                  {completionStatus.clubsTiers.complete ? 'Complete' : 'Incomplete'}
                </Badge>
              </InlineStack>
              <Text variant="bodyMd" as="p" tone="subdued">
                {completionStatus.clubsTiers.details}
              </Text>
              
              {clubProgram && (
                <BlockStack gap="300">
                  <Text variant="bodyMd" as="p">
                    <strong>Club Name:</strong> {clubProgram.name}
                  </Text>
                  {clubProgram.description && (
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {clubProgram.description}
                    </Text>
                  )}
                  
                  {tiersWithDetails.length > 0 && (
                    <BlockStack gap="200">
                      <Text variant="bodyMd" as="p">
                        <strong>Tiers:</strong>
                      </Text>
                      <List>
                        {tiersWithDetails.map(({ stage, promotionCount }) => (
                          <List.Item key={stage.id}>
                            <Link url={addSessionToUrl(`/app/settings/club_tiers/${stage.id}`, session.id)} removeUnderline>
                              {stage.name}
                            </Link>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {' '}({promotionCount} promotion{promotionCount !== 1 ? 's' : ''})
                            </Text>
                          </List.Item>
                        ))}
                      </List>
                    </BlockStack>
                  )}
                </BlockStack>
              )}
              
              <InlineStack gap="200">
                <Button 
                  url={addSessionToUrl('/app/settings/club_tiers', session.id)} 
                  variant="primary"
                >
                  Manage Club Tiers
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </InlineGrid>
        {smUp ? <Divider /> : null}

        {/* Communication Section */}
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Communication
              </Text>
              <Text as="p" variant="bodyMd">
                Configure your email provider, monthly status notifications, and expiration warnings for member communications. Set up automated emails to keep members informed about their membership status.
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  Communication Settings
                </Text>
                <Badge tone={completionStatus.communication.complete ? 'success' : 'attention'}>
                  {completionStatus.communication.complete ? 'Complete' : 'Incomplete'}
                </Badge>
              </InlineStack>
              <Text variant="bodyMd" as="p" tone="subdued">
                {completionStatus.communication.details}
              </Text>
              {communicationConfig && (
                <BlockStack gap="300">
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Communication Channels:
                    </Text>
                    <List>
                      <List.Item>
                        <InlineStack gap="200" align="start" blockAlign="center">
                          <Text as="span" variant="bodyMd">
                            <strong>Email:</strong>
                          </Text>
                          {communicationConfig.email_provider ? (
                            <Badge tone="success">{communicationConfig.email_provider}</Badge>
                          ) : (
                            <Badge tone="attention">Not configured</Badge>
                          )}
                        </InlineStack>
                      </List.Item>
                      <List.Item>
                        <InlineStack gap="200" align="start" blockAlign="center">
                          <Text as="span" variant="bodyMd">
                            <strong>SMS:</strong>
                          </Text>
                          {communicationConfig.sms_provider ? (
                            <Badge tone="success">{communicationConfig.sms_provider}</Badge>
                          ) : (
                            <Badge tone="attention">Not configured</Badge>
                          )}
                        </InlineStack>
                      </List.Item>
                      <List.Item>
                        <InlineStack gap="200" align="start" blockAlign="center">
                          <Text as="span" variant="bodyMd">
                            <strong>Marketing:</strong>
                          </Text>
                          {showcaseProducts && showcaseProducts.length > 0 ? (
                            <Badge tone="success">{`Enabled (${showcaseProducts.length} product${showcaseProducts.length !== 1 ? 's' : ''})`}</Badge>
                          ) : (
                            <Badge tone="attention">Not configured</Badge>
                          )}
                        </InlineStack>
                      </List.Item>
                    </List>
                  </BlockStack>
                  
                  {communicationConfig.email_provider && (
                    <BlockStack gap="200">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">
                        Email Settings:
                      </Text>
                      <List>
                        <List.Item>
                          <Text as="span" variant="bodyMd">
                            Monthly status: {communicationConfig.send_monthly_status ? (
                              <Badge tone="success">Enabled</Badge>
                            ) : (
                              <Badge tone="attention">Disabled</Badge>
                            )}
                          </Text>
                        </List.Item>
                        <List.Item>
                          <Text as="span" variant="bodyMd">
                            Expiration warnings: {communicationConfig.send_expiration_warnings ? (
                              <Badge tone="success">Enabled</Badge>
                            ) : (
                              <Badge tone="attention">Disabled</Badge>
                            )}
                            {communicationConfig.send_expiration_warnings && communicationConfig.warning_days_before && (
                              <Text as="span" variant="bodySm" tone="subdued">
                                {' '}({String(communicationConfig.warning_days_before)} day{communicationConfig.warning_days_before !== 1 ? 's' : ''} before)
                              </Text>
                            )}
                          </Text>
                        </List.Item>
                      </List>
                    </BlockStack>
                  )}
                </BlockStack>
              )}
              <InlineStack gap="200">
                <Button 
                  url={addSessionToUrl('/app/settings/communication', session.id)} 
                  variant="primary"
                >
                  Manage Communication
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </InlineGrid>
        {smUp ? <Divider /> : null}

        {/* Marketing Section */}
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Marketing
              </Text>
              <Text as="p" variant="bodyMd">
                Manage showcase products for email marketing recommendations. These products will be included in monthly status emails for customers who have opted into marketing communications.
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  Marketing Products
                </Text>
                <Badge tone={completionStatus.marketing.complete ? 'success' : 'attention'}>
                  {completionStatus.marketing.complete ? 'Complete' : 'Incomplete'}
                </Badge>
              </InlineStack>
              <Text variant="bodyMd" as="p" tone="subdued">
                {completionStatus.marketing.details}
              </Text>
              {showcaseProducts && showcaseProducts.length > 0 && (
                <BlockStack gap="200">
                  <Text variant="bodyMd" as="p">
                    <strong>Showcase Products:</strong>
                  </Text>
                  <List>
                    {showcaseProducts.slice(0, 5).map((product) => (
                      <List.Item key={product.id}>
                        {product.title || `Product ${product.crm_product_id}`}
                      </List.Item>
                    ))}
                  </List>
                  {showcaseProducts.length > 5 && (
                    <Text variant="bodySm" as="p" tone="subdued">
                      and {showcaseProducts.length - 5} more...
                    </Text>
                  )}
                </BlockStack>
              )}
              <InlineStack gap="200">
                <Button 
                  url={addSessionToUrl('/app/settings/marketing', session.id)} 
                  variant="primary"
                >
                  Manage Marketing
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}

