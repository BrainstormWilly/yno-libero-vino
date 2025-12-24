import type { MetaFunction } from 'react-router';
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  Divider,
  Checkbox,
  Banner,
  Box,
} from '@shopify/polaris';
import { useState } from 'react';

export const meta: MetaFunction = () => {
  return [
    { title: 'SMS Opt-In Form Demo - LiberoVino' },
    { name: 'description', content: 'Demo of LiberoVino SMS opt-in form showing CTIA-compliant express consent' },
    { name: 'robots', content: 'index, follow' },
  ];
};

/**
 * Public demo page showing the SMS opt-in form
 * This page demonstrates CTIA-compliant express consent for Twilio verification
 */
export default function SMSOptInDemo() {
  // Demo state - checkboxes start unchecked (CTIA requirement)
  const [smsTransactional, setSmsTransactional] = useState(false);
  const [smsMarketing, setSmsMarketing] = useState(false);

  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Text variant="heading2xl" as="h1">
                SMS Opt-In Form Demo
              </Text>
              
              <Banner tone="info">
                <Text variant="bodyMd" as="p">
                  <strong>This is a demonstration page</strong> showing the SMS opt-in form used during wine club enrollment. 
                  This form demonstrates CTIA-compliant express consent collection.
                </Text>
              </Banner>

              <Divider />

              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Communication Preferences
                </Text>
                
                <Text variant="bodyMd" as="p" tone="subdued">
                  During wine club enrollment, customers can opt-in to SMS communications by checking the boxes below. 
                  All checkboxes are <strong>unchecked by default</strong> - customers must take affirmative action to opt-in.
                </Text>

                <Divider />

                <BlockStack gap="400">
                  <Text variant="headingSm" as="h3">SMS Text Message Preferences</Text>
                  
                  <Banner tone="info">
                    <Text variant="bodySm" as="p">
                      <strong>SMS Communications:</strong> By checking the boxes below, you agree to receive SMS text messages. 
                      Message frequency varies. Message and data rates may apply. Reply STOP to opt-out at any time. Reply HELP for help.
                    </Text>
                  </Banner>

                  {/* CTIA-Compliant Checkbox 1: Transactional */}
                  <Box padding="400" background="bg-surface-secondary">
                    <Checkbox
                      label="I agree to receive SMS text messages for account notifications (monthly membership status updates, expiration warnings, and tier upgrade notifications)"
                      checked={smsTransactional}
                      onChange={setSmsTransactional}
                      helpText="Message and data rates may apply. Reply STOP to opt out anytime."
                    />
                  </Box>

                  {/* CTIA-Compliant Checkbox 2: Marketing */}
                  <Box padding="400" background="bg-surface-secondary">
                    <Checkbox
                      label="I agree to receive SMS text messages for marketing (promotions, product suggestions, and special offers)"
                      checked={smsMarketing}
                      onChange={setSmsMarketing}
                      helpText="Message and data rates may apply. Reply STOP to opt out anytime."
                    />
                  </Box>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">CTIA Compliance Features</Text>
                  
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p">
                      ✓ <strong>Express Consent:</strong> Checkboxes explicitly state "I agree to receive SMS text messages"
                    </Text>
                    <Text variant="bodyMd" as="p">
                      ✓ <strong>Unchecked by Default:</strong> All checkboxes start unchecked - requires affirmative action
                    </Text>
                    <Text variant="bodyMd" as="p">
                      ✓ <strong>Clear Disclosure:</strong> Explicitly mentions "SMS text messages" and describes message types
                    </Text>
                    <Text variant="bodyMd" as="p">
                      ✓ <strong>Rates Disclosure:</strong> "Message and data rates may apply" included in help text
                    </Text>
                    <Text variant="bodyMd" as="p">
                      ✓ <strong>Opt-Out Instructions:</strong> "Reply STOP to opt out" clearly stated
                    </Text>
                    <Text variant="bodyMd" as="p">
                      ✓ <strong>Separate from Terms:</strong> SMS consent is separate from Terms of Service and Privacy Policy
                    </Text>
                  </BlockStack>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">Message Types</Text>
                  
                  <BlockStack gap="200">
                    <Text variant="bodyMd" as="p">
                      <strong>Account Notifications (Transactional):</strong>
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Monthly membership status updates, expiration warnings (7 days before expiration), tier upgrade notifications, 
                      and other account-related communications.
                    </Text>
                    
                    <Text variant="bodyMd" as="p">
                      <strong>Marketing:</strong>
                    </Text>
                    <Text variant="bodySm" as="p" tone="subdued">
                      Promotional offers, product suggestions, special discounts, and winery-specific marketing messages.
                    </Text>
                  </BlockStack>
                </BlockStack>

                <Divider />

                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">Opt-In Confirmation Process</Text>
                  
                  <Text variant="bodyMd" as="p">
                    After enrollment, customers who opt-in receive a confirmation SMS message:
                  </Text>
                  
                  <Box padding="400" background="bg-surface-secondary">
                    <Text variant="bodyMd" as="p" fontWeight="semibold">
                      Sample Confirmation Message:
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued" style={{ fontFamily: 'monospace', fontSize: '0.9em', marginTop: '0.5rem' }}>
                      [Winery Name]: You opted in to receive SMS text messages. Reply YES to confirm and receive account notifications 
                      (monthly status, expiration warnings) and marketing messages (promotions, product suggestions) via text. 
                      Message and data rates may apply. Reply STOP to opt out anytime.
                    </Text>
                  </Box>
                </BlockStack>

                <Divider />

                <Banner tone="warning">
                  <Text variant="bodySm" as="p">
                    <strong>Note:</strong> This is a demonstration page. The actual enrollment form is accessed through the 
                    wine club member portal after authentication. This page serves as proof of the opt-in mechanism for 
                    carrier verification purposes.
                  </Text>
                </Banner>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

