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
                <dt className="srOnly">Email</dt>
                <dd>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {draft.customer.email}
                  </Text>
                </dd>
                {draft.customer.phone && (
                  <>
                    <dt className="srOnly">Phone</dt>
                    <dd>
                      <Text as="span" variant="bodyMd" tone="subdued">
                        {draft.customer.phone}
                      </Text>
                    </dd>
                  </>
                )}
                {draft.customer.ltv !== undefined && (
                  <>
                    <dt className="srOnly">LTV</dt>
                    <dd>
                      <Text as="span" variant="bodyMd">
                        <strong>LTV:</strong> ${draft.customer.ltv.toFixed(2)}
                      </Text>
                    </dd>
                  </>
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
                <dt className="srOnly">Duration</dt>
                <dd>
                  <Text as="span" variant="bodyMd">
                    <strong>Duration:</strong> {draft.tier.durationMonths} months
                  </Text>
                </dd>
                <dt className="srOnly">Min Purchase</dt>
                <dd>
                  <Text as="span" variant="bodyMd">
                    <strong>Min Purchase:</strong> ${draft.tier.minPurchaseAmount}
                  </Text>
                </dd>
                <dt className="srOnly">Customer Purchase</dt>
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
          
          <Text as="p" variant="bodySm" tone="subdued">
            {draft?.addressVerified 
              ? 'Customer address verified' 
              : 'Address required for enrollment'}
          </Text>
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
          
          <Text as="p" variant="bodySm" tone="subdued">
            {draft?.paymentVerified 
              ? 'Payment method verified' 
              : 'Payment method required for enrollment'}
          </Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

