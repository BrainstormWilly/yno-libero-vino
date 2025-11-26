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
  if (!draft || !draft.customer || !draft.addressVerified) {
    throw new Response('Address not verified', { status: 400 });
  }
  
  // Get the appropriate CRM provider
  const provider = crmManager.getProvider(
    session.crmType,
    session.tenantShop,
    session.accessToken
  );
  
  // Get existing credit cards
  const creditCards = await provider.getCustomerCreditCards(draft.customer.crmId);
  
  return {
    session,
    draft,
    creditCards,
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
  
  // Get existing credit cards (needed for use_existing action)
  const creditCards = actionType === 'use_existing' 
    ? await provider.getCustomerCreditCards(draft.customer.crmId)
    : [];
  
  try {
    if (actionType === 'use_existing') {
      // Use existing payment method
      const paymentId = formData.get('payment_id') as string;
      
      if (!paymentId) {
        return { success: false, error: 'Payment method ID required' };
      }
      
      // Find the selected credit card details
      const selectedCard = creditCards.find((c: any) => c.id === paymentId);
      
      // Update draft with payment method ID and details
      await db.updateEnrollmentDraft(session.id, {
        ...draft,
        customer: {
          ...draft.customer!,
          paymentMethodId: paymentId,
        },
        payment: selectedCard ? {
          last4: selectedCard.last4,
          brand: selectedCard.type,
          expiryMonth: selectedCard.expiryMonth?.toString(),
          expiryYear: selectedCard.expiryYear?.toString(),
        } : undefined,
        paymentVerified: true,
      });
      
      throw redirectWithSession('/app/members/new/review', session.id);
    } else if (actionType === 'add_new') {
      // Create new credit card
      const cardholderName = formData.get('cardholder_name') as string;
      const cardNumber = formData.get('card_number') as string;
      const expiryMonth = formData.get('expiry_month') as string;
      const expiryYear = formData.get('expiry_year') as string;
      const cvv = formData.get('cvv') as string;
      
      if (!cardholderName || !cardNumber || !expiryMonth || !expiryYear || !cvv) {
        return {
          success: false,
          error: 'All card fields are required',
        };
      }
      
      const paymentMethod = await provider.createCustomerCreditCard(draft.customer.crmId, {
        cardholderName,
        cardNumber,
        expiryMonth,
        expiryYear,
        cvv,
        isDefault: true,
      });
      
      // Update draft with payment method ID and details
      await db.updateEnrollmentDraft(session.id, {
        ...draft,
        customer: {
          ...draft.customer!,
          paymentMethodId: paymentMethod.id!,
        },
        payment: {
          last4: cardNumber.replace(/\D/g, '').slice(-4), // Last 4 digits
          brand: paymentMethod.type || 'Card',
          expiryMonth,
          expiryYear,
        },
        paymentVerified: true,
      });
      
      throw redirectWithSession('/app/members/new/review', session.id);
    }
    
    return { success: false, error: 'Invalid action' };
  } catch (error) {
    // Re-throw Response objects (redirects)
    if (error instanceof Response) {
      throw error;
    }
    
    console.error('Payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process payment method',
    };
  }
}

export default function PaymentVerification() {
  const { draft, creditCards, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  const [showAddForm, setShowAddForm] = useState(creditCards.length === 0);
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvv, setCvv] = useState('');
  
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
            Step 4: Payment Verification
          </Text>
          <Text variant="bodyMd" as="p">
            {creditCards.length > 0 
              ? 'Use an existing payment method or add a new one.'
              : 'Add a payment method for this customer.'}
          </Text>
          <Banner tone="warning">
            <Text variant="bodySm" as="p">
              <strong>Security Note:</strong> Card information is transmitted securely to Commerce7. 
              This application does not store credit card details.
            </Text>
          </Banner>
        </BlockStack>
      </Card>
      
      {/* Existing Payment Methods */}
      {creditCards.length > 0 && !showAddForm && (
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">
              Existing Payment Methods
            </Text>
            
            {creditCards.map((card: any, index: number) => (
              <div key={card.id || index}>
                {index > 0 && <Divider />}
                <BlockStack gap="300">
                  <Text variant="bodyMd" as="p">
                    {card.type || 'Card'} ending in {card.last4 || '****'}
                    {card.expiryMonth && card.expiryYear && (
                      <><br />Expires: {card.expiryMonth}/{card.expiryYear}</>
                    )}
                  </Text>
                  <Form method="post">
                    <input type="hidden" name="action" value="use_existing" />
                    <input type="hidden" name="payment_id" value={card.id || ''} />
                    <Button submit>Use This Card</Button>
                  </Form>
                </BlockStack>
              </div>
            ))}
            
            <Divider />
            
            <Button onClick={() => setShowAddForm(true)}>
              Add New Payment Method
            </Button>
          </BlockStack>
        </Card>
      )}
      
      {/* Add New Payment Method Form */}
      {showAddForm && (
        <Card>
          <Form method="post">
            <input type="hidden" name="action" value="add_new" />
            <input type="hidden" name="cardholder_name" value={cardholderName} />
            <input type="hidden" name="card_number" value={cardNumber} />
            <input type="hidden" name="expiry_month" value={expiryMonth} />
            <input type="hidden" name="expiry_year" value={expiryYear} />
            <input type="hidden" name="cvv" value={cvv} />
            
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h3">
                  {creditCards.length > 0 ? 'Add New Payment Method' : 'Payment Information'}
                </Text>
                {creditCards.length > 0 && (
                  <Button onClick={() => setShowAddForm(false)}>Cancel</Button>
                )}
              </InlineStack>
              
              <TextField
                label="Cardholder Name"
                value={cardholderName}
                onChange={setCardholderName}
                autoComplete="cc-name"
                requiredIndicator
              />
              
              <TextField
                label="Card Number"
                value={cardNumber}
                onChange={setCardNumber}
                autoComplete="cc-number"
                placeholder="4111 1111 1111 1111"
                requiredIndicator
              />
              
              <InlineStack gap="200">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Expiry Month"
                    value={expiryMonth}
                    onChange={setExpiryMonth}
                    autoComplete="cc-exp-month"
                    placeholder="MM"
                    maxLength={2}
                    requiredIndicator
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Expiry Year"
                    value={expiryYear}
                    onChange={setExpiryYear}
                    autoComplete="cc-exp-year"
                    placeholder="YYYY"
                    maxLength={4}
                    requiredIndicator
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="CVV"
                    value={cvv}
                    onChange={setCvv}
                    autoComplete="cc-csc"
                    placeholder="123"
                    maxLength={4}
                    requiredIndicator
                  />
                </div>
              </InlineStack>
              
              <Box paddingBlockStart="400">
                <Button
                  variant="primary"
                  submit
                  disabled={!cardholderName || !cardNumber || !expiryMonth || !expiryYear || !cvv}
                  size="large"
                >
                  Continue to Review →
                </Button>
              </Box>
            </BlockStack>
          </Form>
        </Card>
      )}
    </BlockStack>
  );
}

