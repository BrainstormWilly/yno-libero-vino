import { type LoaderFunctionArgs } from 'react-router';
import { useLoaderData, useLocation } from 'react-router';
import { 
  Page, 
  Card, 
  Text, 
  BlockStack,
  InlineStack,
  Badge,
  List,
  Box,
  InlineGrid,
  Divider,
  useBreakpoints,
  Link,
} from '@shopify/polaris';
import { getAppSession } from '~/lib/sessions.server';
import { getMainNavigationActions } from '~/util/navigation';
import { addSessionToUrl } from '~/util/session';
import * as db from '~/lib/db/supabase.server';
import type { Database } from '~/types/supabase';

type ClubStage = Database['public']['Tables']['club_stages']['Row'];
type StagePromotion = Database['public']['Tables']['club_stage_promotions']['Row'];

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const clubProgram = await db.getClubProgram(session.clientId);
  
  // Get full tier details with promotions for display
  let tiersWithDetails: Array<{ stage: ClubStage; promotions: StagePromotion[] }> = [];
  if (clubProgram?.club_stages) {
    // Sort tiers by stage_order
    const sortedStages = [...clubProgram.club_stages].sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      return (a.stage_order || 0) - (b.stage_order || 0);
    });
    
    tiersWithDetails = await Promise.all(
      sortedStages.map(async (stage) => {
        const promotions = await db.getStagePromotions(stage.id);
        return { stage, promotions };
      })
    );
  }
  
  return {
    session,
    clubProgram,
    tiersWithDetails,
  };
}

export default function ClubTiersIndex() {
  const { session, clubProgram, tiersWithDetails } = useLoaderData<typeof loader>();
  const location = useLocation();
  const { smUp } = useBreakpoints();
  
  return (
    <Page 
      title="Club Tiers" 
      backAction={{
        content: 'Settings',
        url: addSessionToUrl('/app/settings', session.id),
      }}
      primaryAction={{
        content: 'Add Tier',
        url: addSessionToUrl('/app/settings/club_tiers/new', session.id),
      }}
      secondaryActions={getMainNavigationActions({
        sessionId: session.id,
        currentPath: location.pathname,
      })}
    >
      <BlockStack gap={{ xs: "800", sm: "400" }}>
        {/* Club Information Section */}
        {clubProgram && (
          <>
            <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
              <Box
                as="section"
                paddingInlineStart={{ xs: "400", sm: "0" }}
                paddingInlineEnd={{ xs: "400", sm: "0" }}
              >
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    Club Information
                  </Text>
                  <Text as="p" variant="bodyMd">
                    General information about your wine club program, including name and description.
                  </Text>
                </BlockStack>
              </Box>
              <Card roundedAbove="sm">
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h3">
                    Club Details
                  </Text>
                  <BlockStack gap="300">
                    <Text variant="bodyMd" as="p">
                      <strong>Club Name:</strong> {clubProgram.name}
                    </Text>
                    {clubProgram.description && (
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {clubProgram.description}
                      </Text>
                    )}
                  </BlockStack>
                </BlockStack>
              </Card>
            </InlineGrid>
            {smUp ? <Divider /> : null}
          </>
        )}

        {/* Tiers Section */}
        <InlineGrid columns={{ xs: "1fr", md: "2fr 5fr" }} gap="400">
          <Box
            as="section"
            paddingInlineStart={{ xs: "400", sm: "0" }}
            paddingInlineEnd={{ xs: "400", sm: "0" }}
          >
            <BlockStack gap="400">
              <Text as="h3" variant="headingMd">
                Membership Tiers
              </Text>
              <Text as="p" variant="bodyMd">
                Configure your membership tiers with their requirements, durations, and associated promotions. Each tier can have multiple promotions.
              </Text>
            </BlockStack>
          </Box>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Tiers
              </Text>
              
              {tiersWithDetails.length > 0 ? (
                <BlockStack gap="300">
                  {tiersWithDetails.map(({ stage, promotions }) => (
                    <Box key={stage.id} paddingBlockEnd="400">
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <Link 
                            url={addSessionToUrl(`/app/settings/club_tiers/${stage.id}`, session.id)}
                            removeUnderline
                          >
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {stage.name}
                            </Text>
                          </Link>
                          <Badge tone={stage.is_active ? 'success' : 'attention'}>
                            {stage.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </InlineStack>
                        
                        <BlockStack gap="100">
                          <Text variant="bodySm" as="p" tone="subdued">
                            <strong>Min Purchase:</strong> ${stage.min_purchase_amount ? stage.min_purchase_amount.toFixed(2) : '0.00'}
                          </Text>
                          <Text variant="bodySm" as="p" tone="subdued">
                            <strong>Duration:</strong> {stage.duration_months} month{stage.duration_months !== 1 ? 's' : ''}
                          </Text>
                          {promotions.length > 0 && (
                            <BlockStack gap="100">
                              <Text variant="bodySm" as="p" tone="subdued">
                                <strong>Promotions:</strong>
                              </Text>
                              <List>
                                {promotions.map((promo) => (
                                  <List.Item key={promo.id}>
                                    <Link 
                                      url={addSessionToUrl(`/app/settings/club_tiers/${stage.id}/promo/${promo.id}`, session.id)}
                                      removeUnderline
                                    >
                                      {promo.title || `Promotion ${promo.crm_id}`}
                                    </Link>
                                  </List.Item>
                                ))}
                              </List>
                            </BlockStack>
                          )}
                        </BlockStack>
                      </BlockStack>
                    </Box>
                  ))}
                  {/* Add dividers between tiers */}
                  {tiersWithDetails.map(({ stage }, index) => {
                    if (index < tiersWithDetails.length - 1) {
                      return (
                        <Box key={`divider-${stage.id}`} paddingBlockStart="400">
                          <Divider />
                        </Box>
                      );
                    }
                    return null;
                  })}
                </BlockStack>
              ) : (
                <Text variant="bodyMd" as="p" tone="subdued">
                  No tiers configured yet. Click &quot;Add Tier&quot; to create your first membership tier.
                </Text>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}

