/**
 * Communication Preferences Form Component
 * Reusable form for managing customer communication preferences
 * Used in both admin member detail page and customer-facing preference page
 */

import { useState, useEffect } from 'react';
import { Form } from 'react-router';
import {
  Card,
  Text,
  BlockStack,
  Checkbox,
  Divider,
  Banner,
  InlineStack,
  Button,
} from '@shopify/polaris';
import type { CommunicationPreferences } from '~/lib/communication/preferences';

interface CommunicationPreferencesFormProps {
  preferences: CommunicationPreferences;
  customerId: string;
  actionUrl?: string; // Optional custom action URL (defaults to current route)
  showSmsOptInStatus?: boolean; // Whether to show SMS opt-in status info
  readOnly?: boolean; // If true, form is read-only (for customer view before confirmation)
}

export function CommunicationPreferencesForm({
  preferences,
  customerId,
  actionUrl,
  showSmsOptInStatus = true,
  readOnly = false,
}: CommunicationPreferencesFormProps) {
  // Form state for communication preferences
  const [formState, setFormState] = useState({
    emailMarketing: preferences.emailMarketing ?? false,
    smsTransactional: preferences.smsTransactional ?? false,
    smsMarketing: preferences.smsMarketing ?? false,
    unsubscribedAll: preferences.unsubscribedAll ?? false,
  });

  // Update form state when preferences change (e.g., after successful save)
  useEffect(() => {
    setFormState({
      emailMarketing: preferences.emailMarketing ?? false,
      smsTransactional: preferences.smsTransactional ?? false,
      smsMarketing: preferences.smsMarketing ?? false,
      unsubscribedAll: preferences.unsubscribedAll ?? false,
    });
  }, [preferences]);

  // Determine if SMS preferences should be disabled
  const smsDisabled = !preferences.smsOptInConfirmedAt && !preferences.smsOptInMethod;

  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h2">
          Communication Preferences
        </Text>

        {preferences.unsubscribedAll && (
          <Banner tone="critical">
            Customer has unsubscribed from all communications.
          </Banner>
        )}

        <Banner tone="info">
          <Text variant="bodySm" as="p">
            <strong>Transactional emails are automatic:</strong> Monthly status updates and expiration warnings are required for membership management and will be sent automatically.
          </Text>
        </Banner>

        <Form method="post" action={actionUrl}>
          <input type="hidden" name="action" value="update_preferences" />
          <input type="hidden" name="customer_id" value={customerId} />

          <BlockStack gap="400">
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">Email Preferences</Text>
              <Checkbox
                label="Marketing"
                checked={formState.emailMarketing}
                disabled={readOnly || formState.unsubscribedAll}
                onChange={(checked) =>
                  setFormState({ ...formState, emailMarketing: checked })
                }
                helpText="Product suggestions and LiberoVino-specific promotions."
              />
              <input
                type="hidden"
                name="email_marketing"
                value={formState.emailMarketing ? 'true' : 'false'}
              />
            </BlockStack>

            <Divider />

            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">SMS Preferences</Text>
              {showSmsOptInStatus && preferences.smsOptInMethod && (
                <Text variant="bodySm" as="p" tone="subdued">
                  Opt-in method: {preferences.smsOptInMethod.replace('_', ' ')}
                  {preferences.smsOptInConfirmedAt && ' (Confirmed)'}
                  {preferences.smsOptInRequestSentAt &&
                    !preferences.smsOptInConfirmedAt &&
                    ' (Pending confirmation)'}
                </Text>
              )}

              {!readOnly && (
                <Banner tone="info">
                  <Text variant="bodySm" as="p">
                    <strong>SMS Communications:</strong> By checking the boxes below, you agree to receive SMS text messages. 
                    Message frequency varies. Message and data rates may apply. Reply STOP to opt-out at any time. Reply HELP for help.
                  </Text>
                </Banner>
              )}

              <Checkbox
                label="I agree to receive SMS text messages for account notifications (monthly membership status updates, expiration warnings, and tier upgrade notifications)"
                checked={formState.smsTransactional}
                disabled={readOnly || formState.unsubscribedAll || smsDisabled}
                onChange={(checked) =>
                  setFormState({ ...formState, smsTransactional: checked })
                }
                helpText="Message and data rates may apply. Reply STOP to opt out anytime."
              />
              <input
                type="hidden"
                name="sms_transactional"
                value={formState.smsTransactional ? 'true' : 'false'}
              />

              <Checkbox
                label="I agree to receive SMS text messages for marketing (promotions, product suggestions, and special offers)"
                checked={formState.smsMarketing}
                disabled={readOnly || formState.unsubscribedAll || smsDisabled}
                onChange={(checked) =>
                  setFormState({ ...formState, smsMarketing: checked })
                }
                helpText="Message and data rates may apply. Reply STOP to opt out anytime."
              />
              <input
                type="hidden"
                name="sms_marketing"
                value={formState.smsMarketing ? 'true' : 'false'}
              />
            </BlockStack>

            <Divider />

            <Checkbox
              label="Unsubscribe from all communications"
              checked={formState.unsubscribedAll}
              disabled={readOnly}
              onChange={(checked) =>
                setFormState({ ...formState, unsubscribedAll: checked })
              }
            />
            <input
              type="hidden"
              name="unsubscribed_all"
              value={formState.unsubscribedAll ? 'true' : 'false'}
            />

            {!readOnly && (
              <InlineStack align="end">
                <Button submit>Save Preferences</Button>
              </InlineStack>
            )}
          </BlockStack>
        </Form>
      </BlockStack>
    </Card>
  );
}
