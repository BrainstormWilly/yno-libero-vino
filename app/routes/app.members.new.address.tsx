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
  Box,
} from '@shopify/polaris';

import { getAppSession, redirectWithSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { crmManager } from '~/lib/crm';
import { addSessionToUrl } from '~/util/session';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Get draft
  const draft = await db.getEnrollmentDraft(session.id);
  if (!draft || !draft.customer) {
    throw new Response('No customer selected', { status: 400 });
  }
  
  // Get the appropriate CRM provider
  const provider = crmManager.getProvider(
    session.crmType,
    session.tenantShop,
    session.accessToken
  );
  
  // Get existing addresses
  const addresses = await provider.getCustomerAddresses(draft.customer.crmId);
  
  return {
    session,
    draft,
    addresses,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  
  const draft = await db.getEnrollmentDraft(session.id);
  if (!draft || !draft.customer) {
    return { success: false, error: 'No customer in draft' };
  }
  
  // Get the appropriate CRM provider
  const provider = crmManager.getProvider(
    session.crmType,
    session.tenantShop,
    session.accessToken
  );
  
  try {
    if (actionType === 'use_existing') {
      // Use existing address - get the ID from form data
      const addressId = formData.get('address_id') as string;
      
      if (!addressId) {
        return { success: false, error: 'Address ID required' };
      }
      
      // Fetch addresses from C7 to get full details
      const addresses = await provider.getCustomerAddresses(draft.customer.crmId);
      const address = addresses.find((a: any) => a.id === addressId);
      
      // Update draft with address IDs and full details
      await db.updateEnrollmentDraft(session.id, {
        ...draft,
        customer: {
          ...draft.customer!,
          billingAddressId: draft.customer!.billingAddressId || addressId,
          shippingAddressId: addressId,
        },
        address: {
          billing: draft.address?.billing || (address ? {
            address1: address.address1,
            address2: address.address2,
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: address.country || 'US',
          } : undefined),
          shipping: address ? {
            address1: address.address1,
            address2: address.address2,
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: address.country || 'US',
          } : undefined,
        },
        addressVerified: true,
      });
      
      throw redirectWithSession('/app/members/new/payment', session.id);
    } else if (actionType === 'add_shipping') {
      // Add shipping address (different from billing)
      const address1 = formData.get('address_1') as string;
      const address2 = formData.get('address_2') as string;
      const city = formData.get('city') as string;
      const state = formData.get('state') as string;
      const zip = formData.get('zip') as string;
      const phone = formData.get('phone') as string;
      
      if (!address1 || !city || !state || !zip) {
        return {
          success: false,
          error: 'Address line 1, city, state, and ZIP are required',
        };
      }
      
      const shippingAddress = await provider.createCustomerAddress(draft.customer.crmId, {
        firstName: draft.customer.firstName,
        lastName: draft.customer.lastName,
        address1,
        address2: address2 || undefined,
        city,
        state,
        zip,
        country: 'US',
        phone: phone || draft.customer.phone || undefined,
        isDefault: false, // Shipping address
      });
      
      // Update draft with shipping address ID and full details
      await db.updateEnrollmentDraft(session.id, {
        ...draft,
        customer: {
          ...draft.customer!,
          shippingAddressId: shippingAddress.id!,
        },
        address: {
          ...draft.address,
          shipping: {
            address1,
            address2: address2 || undefined,
            city,
            state,
            zip,
            country: 'US',
          },
        },
        addressVerified: true,
      });
      
      throw redirectWithSession('/app/members/new/payment', session.id);
    } else if (actionType === 'use_billing') {
      // Use billing address for shipping (new customers only)
      if (!draft.customer.billingAddressId) {
        return { success: false, error: 'No billing address found' };
      }
      
      // Already set shippingAddressId = billingAddressId in customer creation
      // Shipping address details same as billing
      await db.updateEnrollmentDraft(session.id, {
        ...draft,
        address: {
          ...draft.address,
          // Shipping same as billing (already set in customer creation)
        },
        addressVerified: true,
      });
      
      throw redirectWithSession('/app/members/new/payment', session.id);
    }
    
    return { success: false, error: 'Invalid action' };
  } catch (error) {
    // Re-throw Response objects (redirects)
    if (error instanceof Response) {
      throw error;
    }
    
    console.error('Address error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process address',
    };
  }
}

export default function AddressVerification() {
  const { draft, addresses, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  const isNewCustomer = !draft.customer?.isExisting;
  const hasExistingAddresses = addresses.length > 0;
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [phone, setPhone] = useState(draft.customer?.phone || '');
  
  return (
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
            Step 3: Address Verification
          </Text>
          {isNewCustomer ? (
            <Text variant="bodyMd" as="p">
              Billing address created. Add a different shipping address if needed, or use the billing address.
            </Text>
          ) : (
            <Text variant="bodyMd" as="p">
              {hasExistingAddresses 
                ? 'Select an existing address or add a new one.' 
                : 'This customer has no addresses. Please add one to continue.'}
            </Text>
          )}
        </BlockStack>
      </Card>
      
      {/* Use Billing Address (New Customers Only) */}
      {isNewCustomer && !showAddForm && (
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">
              Shipping Address
            </Text>
            <Text variant="bodyMd" as="p">
              Use the billing address for shipping, or add a different shipping address.
            </Text>
            <Form method="post">
              <input type="hidden" name="action" value="use_billing" />
              <Button submit>Use Billing Address for Shipping</Button>
            </Form>
            <Divider />
            <Button onClick={() => setShowAddForm(true)}>
              Add Different Shipping Address
            </Button>
          </BlockStack>
        </Card>
      )}
      
      {/* Existing Addresses (Existing Customers Only) */}
      {!isNewCustomer && addresses.length > 0 && !showAddForm && (
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">
              Existing Addresses
            </Text>
            
            {addresses.map((address: any, index: number) => (
              <div key={address.id || index}>
                {index > 0 && <Divider />}
                <BlockStack gap="300">
                  <Text variant="bodyMd" as="p">
                    {address.address1}
                    {address.address2 && <><br />{address.address2}</>}
                    <br />
                    {address.city}, {address.state} {address.zip}
                  </Text>
                  <Form method="post">
                    <input type="hidden" name="action" value="use_existing" />
                    <input type="hidden" name="address_id" value={address.id || ''} />
                    <Button submit>Use This Address</Button>
                  </Form>
                </BlockStack>
              </div>
            ))}
            
            <Divider />
            
            <Button onClick={() => setShowAddForm(true)}>
              Add New Address
            </Button>
          </BlockStack>
        </Card>
      )}
      
      {/* No Addresses (Existing Customer) */}
      {!isNewCustomer && addresses.length === 0 && !showAddForm && (
        <Card>
          <BlockStack gap="400">
            <Banner tone="warning">
              This customer has no addresses in Commerce7. Please add one to continue.
            </Banner>
            <Button onClick={() => setShowAddForm(true)}>
              Add Address
            </Button>
          </BlockStack>
        </Card>
      )}
      
      {/* Add New Address Form */}
      {showAddForm && (
        <Card>
          <Form method="post">
            <input type="hidden" name="action" value="add_shipping" />
            <input type="hidden" name="address_1" value={address1} />
            <input type="hidden" name="address_2" value={address2} />
            <input type="hidden" name="city" value={city} />
            <input type="hidden" name="state" value={state} />
            <input type="hidden" name="zip" value={zip} />
            <input type="hidden" name="phone" value={phone} />
            
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  {isNewCustomer ? 'Shipping Address' : 'Add Address'}
                </Text>
                {(isNewCustomer || addresses.length > 0) && (
                  <Button onClick={() => setShowAddForm(false)}>Cancel</Button>
                )}
              </InlineStack>
              
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
              
              <TextField
                label="Phone"
                type="tel"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
              />
              
              <Box paddingBlockStart="400">
                <Button
                  variant="primary"
                  submit
                  disabled={!address1 || !city || !state || !zip}
                  size="large"
                >
                  Continue to Payment →
                </Button>
              </Box>
            </BlockStack>
          </Form>
        </Card>
      )}
    </BlockStack>
  );
}

