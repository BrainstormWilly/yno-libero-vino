import { Badge, ProgressBar, BlockStack, InlineStack, Text, Box } from '@shopify/polaris';
import type { BadgeProps } from '@shopify/polaris';

interface SetupWizardProps {
  currentRoute: string;
  progressData: {
    hasClubProgram: boolean;
    hasTier: boolean;
    hasPromo: boolean;
    hasCommConfig: boolean;
  };
  progress: number;
}

export default function SetupWizard({ currentRoute, progressData, progress }: SetupWizardProps) {
  // Determine which step is current based on route
  const isClubDetails = currentRoute === '/app/setup' || currentRoute === '/app/setup/';
  const isClubTiers = currentRoute.startsWith('/app/setup/tiers') && !currentRoute.includes('/promotions');
  const isTierPromotions = currentRoute.includes('/app/setup/tiers') && currentRoute.includes('/promotions');
  const isCommunications = currentRoute.includes('/app/setup/communication') || currentRoute.includes('/app/setup/marketing');

  // Helper to get badge props for a step (Polaris Tone has no 'default'; use 'read-only' for saved/not-current)
  const getBadgeProps = (isSaved: boolean, isCurrent: boolean): Pick<BadgeProps, 'tone' | 'progress'> => {
    const progress: BadgeProps['progress'] = isSaved ? 'complete' : 'incomplete';
    if (isCurrent) {
      return { tone: 'success', progress };
    }
    const tone: BadgeProps['tone'] = isSaved ? 'read-only' : 'critical';
    return { tone, progress };
  };

  return (
    <Box paddingBlockEnd="400">
      <BlockStack gap="300">
        {/* Badges */}
        <InlineStack gap="300" align="start" wrap>
          <Badge {...getBadgeProps(progressData.hasClubProgram, isClubDetails)}>
            Club Details
          </Badge>
          <Badge {...getBadgeProps(progressData.hasTier, isClubTiers)}>
            Club Tiers
          </Badge>
          <Badge {...getBadgeProps(progressData.hasPromo, isTierPromotions)}>
            Tier Promotions
          </Badge>
          <Badge {...getBadgeProps(progressData.hasCommConfig, isCommunications)}>
            Communications
          </Badge>
        </InlineStack>

        {/* Progress Bar */}
        <BlockStack gap="200">
          <ProgressBar 
            progress={progress} 
            size="small"
            tone="primary"
          />
          <Text variant="bodySm" as="p" tone="subdued">
            {progress}% complete
          </Text>
        </BlockStack>
      </BlockStack>
    </Box>
  );
}
