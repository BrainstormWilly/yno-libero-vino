import { useState, useEffect, useMemo } from 'react';
import { Form } from 'react-router';
import { Card, Text, BlockStack, Checkbox, TextField, InlineStack, Button, Banner } from '@shopify/polaris';

export type LoyaltyActionResult = {
  success: boolean;
  message?: string;
  error?: string;
};

export type TierLoyaltyConfig = {
  id: string;
  club_stage_id: string;
  c7_loyalty_tier_id: string;
  earn_rate: number | null;
  initial_points_bonus: number | null;
  is_active: boolean | null;
  tier_title: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type TierForLoyalty = {
  is_active?: boolean | null;
};

type TierLoyaltySectionProps = {
  loyalty: TierLoyaltyConfig | null;
  tier: TierForLoyalty;
  /** When true, show banner to save tier details first (e.g. new tier in setup) */
  isNewTier?: boolean;
  /** Service response from toggle_loyalty action - shown inside the card for iframe scroll context */
  actionResult?: LoyaltyActionResult | null;
};

export function TierLoyaltySection({ loyalty, tier, isNewTier = false, actionResult }: TierLoyaltySectionProps) {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(!!loyalty);
  const [earnRate, setEarnRate] = useState(
    loyalty && loyalty.earn_rate !== null ? (loyalty.earn_rate * 100).toString() : '2'
  );
  const [bonusPoints, setBonusPoints] = useState(
    loyalty?.initial_points_bonus?.toString() ?? '0'
  );

  useEffect(() => {
    setLoyaltyEnabled(!!loyalty);
    setEarnRate(
      loyalty && loyalty.earn_rate !== null ? (loyalty.earn_rate * 100).toString() : '2'
    );
    setBonusPoints(loyalty?.initial_points_bonus?.toString() ?? '0');
  }, [loyalty]);

  useEffect(() => {
    if (actionResult) setBannerDismissed(false);
  }, [actionResult]);

  const showLoyaltyBanner = actionResult && !bannerDismissed;

  const loyaltyChanged = useMemo(
    () =>
      loyaltyEnabled !== !!loyalty ||
      (loyaltyEnabled &&
        (earnRate !==
          (loyalty && loyalty.earn_rate !== null ? (loyalty.earn_rate * 100).toString() : '2') ||
          bonusPoints !== (loyalty?.initial_points_bonus?.toString() ?? '0'))),
    [loyalty, loyaltyEnabled, earnRate, bonusPoints]
  );

  const tierActive = tier.is_active !== false;

  return (
    <section>
      <Form method="post">
        <input type="hidden" name="action" value="toggle_loyalty" />
        <input type="hidden" name="loyalty_enabled" value={loyaltyEnabled.toString()} />
        <input type="hidden" name="earn_rate" value={earnRate} />
        <input type="hidden" name="bonus_points" value={bonusPoints} />

        <Card>
          <BlockStack gap="400">
            {showLoyaltyBanner && (
              <Banner
                tone={actionResult.success ? 'success' : 'critical'}
                onDismiss={() => setBannerDismissed(true)}
              >
                {actionResult.success ? actionResult.message : actionResult.error ?? actionResult.message}
              </Banner>
            )}
            <Text variant="headingMd" as="h3">
              Loyalty Rewards
            </Text>

            <Checkbox
              label="Enable loyalty rewards for this tier"
              checked={loyaltyEnabled}
              onChange={setLoyaltyEnabled}
              helpText="Members automatically earn points on all purchases"
              disabled={!tierActive || isNewTier}
            />
            {isNewTier && (
              <Banner tone="info">
                Save tier details before configuring loyalty rewards.
              </Banner>
            )}

            {loyaltyEnabled && (
              <BlockStack gap="300">
                <Banner tone="info">
                  Members in this tier will automatically earn points on ALL purchases (not just
                  club purchases).
                </Banner>

                <TextField
                  label="Points Earn Rate (%)"
                  value={earnRate}
                  onChange={setEarnRate}
                  type="number"
                  suffix="%"
                  autoComplete="off"
                  helpText="Percentage of purchase amount earned as points (e.g., 2% means $100 purchase = 2 points)"
                  disabled={!tierActive}
                />

                <TextField
                  label="Welcome Bonus Points"
                  value={bonusPoints}
                  onChange={setBonusPoints}
                  type="number"
                  autoComplete="off"
                  helpText="Bonus points awarded when member joins this tier (optional)"
                  disabled={!tierActive}
                />

                {tierActive && (
                  <InlineStack align="end">
                    <Button submit variant="primary" disabled={!loyaltyChanged}>
                      Save Loyalty Config
                    </Button>
                  </InlineStack>
                )}
              </BlockStack>
            )}
          </BlockStack>
        </Card>
      </Form>
    </section>
  );
}
