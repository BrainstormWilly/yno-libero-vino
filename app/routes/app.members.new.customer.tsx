import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate } from 'react-router';
import { useState } from 'react';
import {
  Card,
  Button,
  Text,
  BlockStack,
  TextField,
  InlineStack,
  Banner,
  Divider,
  Checkbox,
  Modal,
  Box,
} from '@shopify/polaris';

import { getAppSession, redirectWithSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { crmManager } from '~/lib/crm';
import { addSessionToUrl } from '~/util/session';
import { DEFAULT_COMMUNICATION_PREFERENCES } from '~/lib/communication/preferences';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Get draft
  const draft = await db.getEnrollmentDraft(session.id);
  if (!draft || !draft.tier) {
    throw new Response('No tier selected', { status: 400 });
  }
  
  // If customer already exists in draft, redirect to address
  if (draft.customer?.isExisting) {
    throw Response.redirect(addSessionToUrl('/app/members/new/address', session.id));
  }
  
  return {
    session,
    draft,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const firstName = formData.get('first_name') as string;
  const lastName = formData.get('last_name') as string;
  const phone = formData.get('phone') as string;
  const address1 = formData.get('address_1') as string;
  const address2 = formData.get('address_2') as string;
  const city = formData.get('city') as string;
  const state = formData.get('state') as string;
  const zip = formData.get('zip') as string;
  const parseBool = (value: FormDataEntryValue | null) => value === 'true';
  const unsubscribedAll = parseBool(formData.get('pref_unsubscribed_all'));
  const preferences = unsubscribedAll
    ? {
        emailMonthlyStatus: false,
        emailExpirationWarnings: false,
        emailPromotions: false,
        smsMonthlyStatus: false,
        smsExpirationWarnings: false,
        smsPromotions: false,
        unsubscribedAll: true,
      }
    : {
        emailMonthlyStatus: parseBool(formData.get('pref_email_monthly_status')),
        emailExpirationWarnings: parseBool(formData.get('pref_email_expiration_warnings')),
        emailPromotions: parseBool(formData.get('pref_email_promotions')),
        smsMonthlyStatus: parseBool(formData.get('pref_sms_monthly_status')),
        smsExpirationWarnings: parseBool(formData.get('pref_sms_expiration_warnings')),
        smsPromotions: parseBool(formData.get('pref_sms_promotions')),
        unsubscribedAll: false,
      };
  
  if (!email || !firstName || !lastName || !address1 || !city || !state || !zip) {
    return {
      success: false,
      error: 'Email, name, and complete billing address are required',
    };
  }
  
  try {
    // Get the appropriate CRM provider
    const provider = crmManager.getProvider(
      session.crmType,
      session.tenantShop,
      session.accessToken
    );
    
    // Create customer + billing address in one call
    const result = await provider.createCustomerWithAddress({
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      address: {
        address1,
        address2: address2 || undefined,
        city,
        state,
        zip,
        country: 'US',
        isDefault: true, // Billing address
      },
    });
    
    // Update draft with customer info and billing address (with full details)
    const draft = await db.getEnrollmentDraft(session.id);
    await db.updateEnrollmentDraft(session.id, {
      ...draft,
      customer: {
        crmId: result.customer.id,
        email: result.customer.email,
        firstName: result.customer.firstName,
        lastName: result.customer.lastName,
        phone: result.customer.phone,
        ltv: draft?.tier?.purchaseAmount || 0,
        isExisting: false,
        billingAddressId: result.billingAddressId,
        shippingAddressId: result.billingAddressId, // Default to billing
      },
      address: {
        billing: {
          address1,
          address2: address2 || undefined,
          city,
          state,
          zip,
          country: 'US',
        },
        // Shipping same as billing initially
      },
      preferences,
      addressVerified: true, // Billing address created
    });
    
    throw redirectWithSession('/app/members/new/address', session.id);
  } catch (error) {
    // Re-throw Response objects (redirects)
    if (error instanceof Response) {
      throw error;
    }
    
    console.error('Customer creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create customer',
    };
  }
}

export default function CustomerDetails() {
  const { draft, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const defaultPreferences = draft?.preferences ?? DEFAULT_COMMUNICATION_PREFERENCES;
  const [emailMonthlyStatus, setEmailMonthlyStatus] = useState(defaultPreferences.emailMonthlyStatus);
  const [emailExpirationWarnings, setEmailExpirationWarnings] = useState(
    defaultPreferences.emailExpirationWarnings
  );
  const [emailPromotions, setEmailPromotions] = useState(defaultPreferences.emailPromotions);
  const [smsMonthlyStatus, setSmsMonthlyStatus] = useState(defaultPreferences.smsMonthlyStatus);
  const [smsExpirationWarnings, setSmsExpirationWarnings] = useState(
    defaultPreferences.smsExpirationWarnings
  );
  const [smsPromotions, setSmsPromotions] = useState(defaultPreferences.smsPromotions);
  const [unsubscribedAll, setUnsubscribedAll] = useState(defaultPreferences.unsubscribedAll);
  const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);

  const handlePreferenceChange = (setter: (value: boolean) => void) => (value: boolean) => {
    if (unsubscribedAll && value) {
      setUnsubscribedAll(false);
    }
    setter(value);
  };

  const confirmUnsubscribeAll = () => {
    setUnsubscribedAll(true);
    setEmailMonthlyStatus(false);
    setEmailExpirationWarnings(false);
    setEmailPromotions(false);
    setSmsMonthlyStatus(false);
    setSmsExpirationWarnings(false);
    setSmsPromotions(false);
    setShowUnsubscribeModal(false);
  };

  const cancelUnsubscribeAll = () => {
    setShowUnsubscribeModal(false);
    setUnsubscribedAll(false);
  };

  const handleUnsubscribedAllChange = (value: boolean) => {
    if (value) {
      setShowUnsubscribeModal(true);
    } else {
      setUnsubscribedAll(false);
    }
  };
  
  return (
    <>
      <BlockStack gap="500">
        {/* Banners at Top */}
        {actionData && !actionData.success && (
          <Banner tone="critical" title="Error">
            {actionData.error}
          </Banner>
        )}

        {/* Navigation Button at Top */}
        <Box paddingBlockEnd="400">
          <Button onClick={() => navigate(addSessionToUrl('/app/members', session.id))}>
            ← Back to Members
          </Button>
        </Box>
        
        {/* Instructions */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">
              Step 2: Customer & Billing Address
            </Text>
            <Text variant="bodyMd" as="p">
              Create a new customer account with billing address. This information will be saved in the connected CRM.
            </Text>
            {draft?.tier && (
              <Banner tone="info">
                Enrolling in: <strong>{draft.tier.name}</strong> ({draft.tier.durationMonths} months)
              </Banner>
            )}
          </BlockStack>
        </Card>
        
        {/* Customer + Address Form */}
        <Card>
          <Form method="post">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h3">
                Customer Information
              </Text>
              
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                requiredIndicator
              />
              
              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="First Name"
                    value={firstName}
                    onChange={setFirstName}
                    autoComplete="given-name"
                    requiredIndicator
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Last Name"
                    value={lastName}
                    onChange={setLastName}
                    autoComplete="family-name"
                    requiredIndicator
                  />
                </div>
              </InlineStack>
              
              <TextField
                label="Phone"
                type="tel"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
              />
              
              <Divider />
              
              <Text variant="headingMd" as="h3">
                Communication Preferences
              </Text>
              <Text variant="bodySm" as="p" tone="subdued">
                Confirm with the member how they would like to hear from the winery. Preferences sync to LiberoVino and Klaviyo.
              </Text>
              
              <Checkbox
                label="Email monthly status updates"
                checked={emailMonthlyStatus}
                onChange={handlePreferenceChange(setEmailMonthlyStatus)}
                helpText="Sends the monthly liberation status email seeded in Klaviyo."
                disabled={unsubscribedAll}
              />
              <Checkbox
                label="Email duration reminders"
                checked={emailExpirationWarnings}
                onChange={handlePreferenceChange(setEmailExpirationWarnings)}
                helpText="Alerts members before their duration ends so they can extend on their schedule."
                disabled={unsubscribedAll}
              />
              <Checkbox
                label="Email promotions and spotlights"
                checked={emailPromotions}
                onChange={handlePreferenceChange(setEmailPromotions)}
                helpText="Includes optional marketing flows like Sales Spotlight and Annual Re-Sign."
                disabled={unsubscribedAll}
              />
              
              <Divider />
              
              <Checkbox
                label="SMS monthly status updates"
                checked={smsMonthlyStatus}
                onChange={handlePreferenceChange(setSmsMonthlyStatus)}
                disabled={unsubscribedAll}
              />
              <Checkbox
                label="SMS duration reminders"
                checked={smsExpirationWarnings}
                onChange={handlePreferenceChange(setSmsExpirationWarnings)}
                disabled={unsubscribedAll}
              />
              <Checkbox
                label="SMS promotions"
                checked={smsPromotions}
                onChange={handlePreferenceChange(setSmsPromotions)}
                disabled={unsubscribedAll}
              />
              
              <Divider />
              
              <Checkbox
                label="Unsubscribe from all communications"
                checked={unsubscribedAll}
                onChange={handleUnsubscribedAllChange}
                helpText="Overrides the individual settings above."
              />
              
              <Divider />
              
              <Text variant="headingMd" as="h3">
                Billing Address
              </Text>
              
              <TextField
                label="Address Line 1"
                value={address1}
                onChange={setAddress1}
                autoComplete="address-line1"
                requiredIndicator
              />
              
              <TextField
                label="Address Line 2"
                value={address2}
                onChange={setAddress2}
                autoComplete="address-line2"
              />
              
              <InlineStack gap="200">
                <div style={{ flex: 2 }}>
                  <TextField
                    label="City"
                    value={city}
                    onChange={setCity}
                    autoComplete="address-level2"
                    requiredIndicator
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="State"
                    value={state}
                    onChange={setState}
                    autoComplete="address-level1"
                    placeholder="CA"
                    requiredIndicator
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="ZIP"
                    value={zip}
                    onChange={setZip}
                    autoComplete="postal-code"
                    requiredIndicator
                  />
                </div>
              </InlineStack>
              
              <input type="hidden" name="email" value={email} />
              <input type="hidden" name="first_name" value={firstName} />
              <input type="hidden" name="last_name" value={lastName} />
              <input type="hidden" name="phone" value={phone} />
              <input type="hidden" name="address_1" value={address1} />
              <input type="hidden" name="address_2" value={address2} />
              <input type="hidden" name="city" value={city} />
              <input type="hidden" name="state" value={state} />
              <input type="hidden" name="zip" value={zip} />
              <input
                type="hidden"
                name="pref_email_monthly_status"
                value={emailMonthlyStatus ? 'true' : 'false'}
              />
              <input
                type="hidden"
                name="pref_email_expiration_warnings"
                value={emailExpirationWarnings ? 'true' : 'false'}
              />
              <input
                type="hidden"
                name="pref_email_promotions"
                value={emailPromotions ? 'true' : 'false'}
              />
              <input
                type="hidden"
                name="pref_sms_monthly_status"
                value={smsMonthlyStatus ? 'true' : 'false'}
              />
              <input
                type="hidden"
                name="pref_sms_expiration_warnings"
                value={smsExpirationWarnings ? 'true' : 'false'}
              />
              <input
                type="hidden"
                name="pref_sms_promotions"
                value={smsPromotions ? 'true' : 'false'}
              />
              <input
                type="hidden"
                name="pref_unsubscribed_all"
                value={unsubscribedAll ? 'true' : 'false'}
              />
              
              <Box paddingBlockStart="400">
                <Button
                  variant="primary"
                  submit
                  disabled={!email || !firstName || !lastName || !address1 || !city || !state || !zip}
                  size="large"
                >
                  Continue to Additional Addresses →
                </Button>
              </Box>
            </BlockStack>
          </Form>
        </Card>
      </BlockStack>

      <Modal
        open={showUnsubscribeModal}
        onClose={cancelUnsubscribeAll}
        title="Unsubscribe from all communications?"
        primaryAction={{
          content: 'Unsubscribe from all',
          destructive: true,
          onAction: confirmUnsubscribeAll,
        }}
        secondaryActions={[{
          content: 'Keep transactional updates',
          onAction: cancelUnsubscribeAll,
        }]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              Unsubscribing will turn off monthly status emails and duration warnings. Without those
              reminders, the member’s duration can lapse without notice and their benefits will end.
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              Choose “Keep transactional updates” if you still want LiberoVino to send required
              membership notifications while opting out of marketing.
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}

