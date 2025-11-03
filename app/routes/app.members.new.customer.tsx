import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData } from 'react-router';
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
} from '@shopify/polaris';

import { getAppSession, redirectWithSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { crmManager } from '~/lib/crm';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import { addSessionToUrl } from '~/util/session';

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
    return Response.redirect(addSessionToUrl('/app/members/new/address', session.id));
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
    
    // createCustomerWithAddress is Commerce7-specific for now
    if (!(provider instanceof Commerce7Provider)) {
      return {
        success: false,
        error: 'Customer creation with address is currently only supported for Commerce7',
      };
    }
    
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
    
    // Update draft with customer info and billing address
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
      addressVerified: true, // Billing address created
    });
    
    return redirectWithSession('/app/members/new/address', session.id);
  } catch (error) {
    console.error('Customer creation error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create customer',
    };
  }
}

export default function CustomerDetails() {
  const { draft } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  
  return (
    <BlockStack gap="500">
      {/* Error Banner */}
      {actionData && !actionData.success && (
        <Banner tone="critical" title="Error">
          {actionData.error}
        </Banner>
      )}
      
      {/* Instructions */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd" as="h2">
            Step 2: Customer & Billing Address
          </Text>
          <Text variant="bodyMd" as="p">
            Create a new customer account with billing address. This information will be saved in Commerce7.
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
            
            <Button
              variant="primary"
              submit
              disabled={!email || !firstName || !lastName || !address1 || !city || !state || !zip}
              size="large"
            >
              Continue to Additional Addresses →
            </Button>
          </BlockStack>
        </Form>
      </Card>
    </BlockStack>
  );
}

