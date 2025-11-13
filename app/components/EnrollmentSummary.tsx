import { Card, BlockStack, Text, Badge, InlineGrid, Box, Divider } from '@shopify/polaris';
import type { EnrollmentDraft } from '~/lib/db/supabase.server';

interface EnrollmentSummaryProps {
  draft: EnrollmentDraft | null;
  currentStep: 'qualify' | 'customer' | 'address' | 'payment' | 'review';
}

export default function EnrollmentSummary({ draft, currentStep }: EnrollmentSummaryProps) {
  const isStepActive = (step: string) => step === currentStep;
  
  return (
    <BlockStack gap="400">
      {/* Customer Card */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                Customer
              </Text>
              {draft?.customer && (
                <Badge tone={draft.customer.isExisting ? 'info' : 'attention'}>
                  {draft.customer.isExisting ? 'Existing' : 'New'}
                </Badge>
              )}
              {isStepActive('qualify') && <Badge tone="info">Current</Badge>}
            </InlineGrid>
          </Box>
          
          {!draft?.customer && (
            <Text as="p" variant="bodySm" tone="subdued">
              Not selected
            </Text>
          )}
          
          {draft?.customer && (
            <BlockStack gap="200">
              <Text as="p" variant="headingSm">
                {draft.customer.firstName} {draft.customer.lastName}
              </Text>
              <dl className="noIndent">
                <dd>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    <strong>Email:</strong> {draft.customer.email}
                  </Text>
                </dd>
                {draft.customer.phone && (
                  <dd>
                    <Text as="span" variant="bodyMd" tone="subdued">
                      <strong>Phone:</strong> {draft.customer.phone}
                    </Text>
                  </dd>
                )}
                {draft.customer.ltv !== undefined && (
                  <dd>
                    <Text as="span" variant="bodyMd">
                      <strong>LTV:</strong> ${draft.customer.ltv.toFixed(2)}
                    </Text>
                  </dd>
                )}
              </dl>
            </BlockStack>
          )}
        </BlockStack>
      </Card>
      
      {/* Tier Card */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                Selected Tier
              </Text>
              {draft?.tier && (
                <Badge tone={draft.tier.qualified ? 'success' : 'attention'}>
                  {draft.tier.qualified ? 'Qualified' : 'Not Qualified'}
                </Badge>
              )}
              {isStepActive('qualify') && <Badge tone="info">Current</Badge>}
            </InlineGrid>
          </Box>
          
          {!draft?.tier && (
            <Text as="p" variant="bodySm" tone="subdued">
              Not selected
            </Text>
          )}
          
          {draft?.tier && (
            <BlockStack gap="200">
              <Text as="p" variant="headingSm">
                {draft.tier.name}
              </Text>
              <dl className="noIndent">
                <dd>
                  <Text as="span" variant="bodyMd">
                    <strong>Duration:</strong> {draft.tier.durationMonths} months
                  </Text>
                </dd>
                <dd>
                  <Text as="span" variant="bodyMd">
                    <strong>Min Purchase:</strong> ${draft.tier.minPurchaseAmount}
                  </Text>
                </dd>
                <dd>
                  <Text as="span" variant="bodyMd">
                    <strong>Customer:</strong> ${draft.tier.purchaseAmount.toFixed(2)}
                  </Text>
                </dd>
              </dl>
            </BlockStack>
          )}
        </BlockStack>
      </Card>
      
      {/* Address Card */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                Address
              </Text>
              {draft?.addressVerified ? (
                <Badge tone="success">Verified ✓</Badge>
              ) : (
                <Badge>Not Added</Badge>
              )}
              {isStepActive('address') && <Badge tone="info">Current</Badge>}
            </InlineGrid>
          </Box>
          
          {!draft?.addressVerified && (
            <Text as="p" variant="bodySm" tone="subdued">
              Address required for enrollment
            </Text>
          )}
          
          {draft?.addressVerified && draft?.address?.billing && (
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                <strong>Billing:</strong>
              </Text>
              <dl className="noIndent">
                <dd>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {draft.address.billing.address1}
                  </Text>
                </dd>
                {draft.address.billing.address2 && (
                  <dd>
                    <Text as="span" variant="bodySm" tone="subdued">
                      {draft.address.billing.address2}
                    </Text>
                  </dd>
                )}
                <dd>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {draft.address.billing.city}, {draft.address.billing.state} {draft.address.billing.zip}
                  </Text>
                </dd>
              </dl>
              
              {draft.address.shipping && (
                <>
                  <Text as="p" variant="bodyMd">
                    <strong>Shipping:</strong>
                  </Text>
                  <dl className="noIndent">
                    <dd>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {draft.address.shipping.address1}
                      </Text>
                    </dd>
                    {draft.address.shipping.address2 && (
                      <dd>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {draft.address.shipping.address2}
                        </Text>
                      </dd>
                    )}
                    <dd>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {draft.address.shipping.city}, {draft.address.shipping.state} {draft.address.shipping.zip}
                      </Text>
                    </dd>
                  </dl>
                </>
              )}
            </BlockStack>
          )}
        </BlockStack>
      </Card>
      
      {/* Payment Card */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                Payment
              </Text>
              {draft?.paymentVerified ? (
                <Badge tone="success">Verified ✓</Badge>
              ) : (
                <Badge>Not Added</Badge>
              )}
              {isStepActive('payment') && <Badge tone="info">Current</Badge>}
            </InlineGrid>
          </Box>
          
          {!draft?.paymentVerified && (
            <Text as="p" variant="bodySm" tone="subdued">
              Payment method required for enrollment
            </Text>
          )}
          
          {draft?.paymentVerified && draft?.payment && (
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd">
                <strong>{draft.payment.brand || 'Card'} •••• {draft.payment.last4}</strong>
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Expires: {draft.payment.expiryMonth}/{draft.payment.expiryYear}
              </Text>
            </BlockStack>
          )}
        </BlockStack>
      </Card>

      {/* Communication Preferences */}
      <Card>
        <BlockStack gap="400">
          <Box paddingBlockEnd="200">
            <InlineGrid columns="1fr auto">
              <Text as="h2" variant="headingMd">
                Communication
              </Text>
              {draft?.preferences?.unsubscribedAll ? (
                <Badge tone="critical">Unsubscribed</Badge>
              ) : (
                <Badge tone="success">Active</Badge>
              )}
            </InlineGrid>
          </Box>

          {!draft?.preferences && (
            <Text as="p" variant="bodySm" tone="subdued">
              Preferences will be set during enrollment.
            </Text>
          )}

          {draft?.preferences && (
            <BlockStack gap="200">
              <Text as="p" variant="bodySm">
                <strong>Email</strong>
              </Text>
              <dl className="noIndent">
                <dd>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Monthly status: {draft.preferences.emailMonthlyStatus ? 'On' : 'Off'}
                  </Text>
                </dd>
                <dd>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Duration reminders: {draft.preferences.emailExpirationWarnings ? 'On' : 'Off'}
                  </Text>
                </dd>
                <dd>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Promotions: {draft.preferences.emailPromotions ? 'On' : 'Off'}
                  </Text>
                </dd>
              </dl>

              <Divider />

              <Text as="p" variant="bodySm">
                <strong>SMS</strong>
              </Text>
              <dl className="noIndent">
                <dd>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Monthly status: {draft.preferences.smsMonthlyStatus ? 'On' : 'Off'}
                  </Text>
                </dd>
                <dd>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Duration reminders: {draft.preferences.smsExpirationWarnings ? 'On' : 'Off'}
                  </Text>
                </dd>
                <dd>
                  <Text as="span" variant="bodySm" tone="subdued">
                    Promotions: {draft.preferences.smsPromotions ? 'On' : 'Off'}
                  </Text>
                </dd>
              </dl>
            </BlockStack>
          )}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

