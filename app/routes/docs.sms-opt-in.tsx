import type { MetaFunction } from 'react-router';
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Divider,
  List,
  Banner,
} from '@shopify/polaris';

export const meta: MetaFunction = () => {
  return [
    { title: 'SMS Opt-In Process - LiberoVino' },
    { name: 'description', content: 'Documentation of LiberoVino SMS communication opt-in process for TCPA compliance' },
  ];
};

export default function SMSOptInDocs() {
  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="500">
              <Text variant="heading2xl" as="h1">
                SMS Communication Opt-In Process
              </Text>
              
              <Text variant="bodyMd" as="p" tone="subdued">
                This page documents how LiberoVino collects SMS consent from wine club members
                in compliance with TCPA (Telephone Consumer Protection Act) requirements.
              </Text>

              <Divider />

              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  How Customers Opt-In
                </Text>
                
                <Text variant="bodyMd" as="p">
                  During wine club enrollment, customers can opt-in to SMS communications by checking
                  one or both of the following options:
                </Text>

                <List type="bullet">
                  <List.Item>
                    <Text variant="bodyMd" fontWeight="semibold" as="span">
                      SMS Transactional
                    </Text>
                    {' '}
                    - Monthly membership status updates and expiration warnings
                  </List.Item>
                  <List.Item>
                    <Text variant="bodyMd" fontWeight="semibold" as="span">
                      SMS Marketing
                    </Text>
                    {' '}
                    - Promotions and product suggestions via SMS
                  </List.Item>
                </List>

                <Banner tone="info">
                  <Text variant="bodyMd" as="p">
                    Transactional emails (monthly status and expiration warnings) are automatically
                    sent to all members as part of their membership. Only SMS communications require
                    explicit opt-in.
                  </Text>
                </Banner>
              </BlockStack>

              <Divider />

              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Opt-In Confirmation Message
                </Text>
                
                <Text variant="bodyMd" as="p">
                  After enrollment, customers who have opted in receive a TCPA-compliant opt-in
                  request message via SMS:
                </Text>

                <Card background="bg-surface-secondary" padding="500">
                  <BlockStack gap="300">
                    <Text variant="bodyMd" fontWeight="semibold" as="p">
                      Sample Message:
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      <code style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                        {'{Winery Name}: Thanks for joining! Reply YES to receive SMS updates about your membership. Msg & data rates may apply. Reply STOP to opt-out anytime.'}
                      </code>
                    </Text>
                  </BlockStack>
                </Card>

                <Text variant="bodyMd" as="p">
                  This message includes:
                </Text>

                <List type="bullet">
                  <List.Item>Clear identification of the sender (winery name)</List.Item>
                  <List.Item>Purpose of the messages (membership updates)</List.Item>
                  <List.Item>Message and data rates disclosure</List.Item>
                  <List.Item>Opt-out instructions (STOP command)</List.Item>
                </List>
              </BlockStack>

              <Divider />

              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Confirmation Process
                </Text>
                
                <Text variant="bodyMd" as="p">
                  Customers confirm their opt-in by replying <strong>YES</strong> to the opt-in
                  request message. Once confirmed, SMS communications are enabled for their account.
                </Text>

                <Text variant="bodyMd" as="p">
                  The opt-in confirmation is timestamped and stored in the customer's communication
                  preferences, including:
                </Text>

                <List type="bullet">
                  <List.Item>Opt-in timestamp</List.Item>
                  <List.Item>Opt-in method (signup form, text reply, etc.)</List.Item>
                  <List.Item>Opt-in source (enrollment page URL)</List.Item>
                  <List.Item>Confirmation timestamp</List.Item>
                </List>
              </BlockStack>

              <Divider />

              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Opt-Out Process
                </Text>
                
                <Text variant="bodyMd" as="p">
                  Customers can opt-out at any time by replying with any of the following commands:
                </Text>

                <List type="bullet">
                  <List.Item><strong>STOP</strong></List.Item>
                  <List.Item><strong>UNSUBSCRIBE</strong></List.Item>
                  <List.Item><strong>QUIT</strong></List.Item>
                  <List.Item><strong>CANCEL</strong></List.Item>
                </List>

                <Text variant="bodyMd" as="p">
                  Opt-out is processed immediately, and no further SMS messages are sent to the
                  customer's phone number. The customer's SMS preferences are updated in their
                  account, and they can opt back in at any time through their member portal.
                </Text>

                <Banner tone="warning">
                  <Text variant="bodyMd" as="p">
                    <strong>Important:</strong> Opt-out applies to all SMS communications (both
                    transactional and marketing). Customers cannot selectively opt-out of only
                    marketing messages while keeping transactional messages.
                  </Text>
                </Banner>
              </BlockStack>

              <Divider />

              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Message Categories
                </Text>
                
                <Text variant="bodyMd" as="p">
                  LiberoVino sends SMS messages in the following categories:
                </Text>

                <List type="bullet">
                  <List.Item>
                    <Text variant="bodyMd" fontWeight="semibold" as="span">
                      Account Notifications
                    </Text>
                    {' '}
                    - Monthly membership status updates, expiration warnings, tier upgrade
                    notifications, and other account-related communications
                  </List.Item>
                  <List.Item>
                    <Text variant="bodyMd" fontWeight="semibold" as="span">
                      Marketing
                    </Text>
                    {' '}
                    - Product suggestions, promotional offers, and winery-specific marketing
                    messages (requires separate opt-in)
                  </List.Item>
                </List>
              </BlockStack>

              <Divider />

              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  TCPA Compliance
                </Text>
                
                <Text variant="bodyMd" as="p">
                  LiberoVino's SMS opt-in process is designed to comply with TCPA requirements:
                </Text>

                <List type="bullet">
                  <List.Item>
                    <strong>Express Written Consent:</strong> Customers must explicitly opt-in via
                    checkbox during enrollment
                  </List.Item>
                  <List.Item>
                    <strong>Clear Disclosure:</strong> Opt-in message clearly states the purpose
                    and frequency of messages
                  </List.Item>
                  <List.Item>
                    <strong>Rates Disclosure:</strong> Message and data rates are disclosed
                  </List.Item>
                  <List.Item>
                    <strong>Opt-Out Instructions:</strong> Clear instructions on how to opt-out
                    are provided in every message
                  </List.Item>
                  <List.Item>
                    <strong>Immediate Opt-Out:</strong> Opt-out requests are processed immediately
                  </List.Item>
                  <List.Item>
                    <strong>No Purchase Required:</strong> Opt-out is free and does not require
                    any purchase or action beyond replying STOP
                  </List.Item>
                </List>
              </BlockStack>

              <Divider />

              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Contact Information
                </Text>
                
                <Text variant="bodyMd" as="p">
                  For questions about SMS communications or to update your preferences, please
                  contact your winery directly or visit your member portal.
                </Text>

                <Text variant="bodyMd" as="p" tone="subdued">
                  This documentation is maintained by LiberoVino. Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

