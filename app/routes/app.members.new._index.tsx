import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Badge,
  Banner,
  Autocomplete,
  Icon,
  Divider,
} from '@shopify/polaris';
import { SearchIcon } from '@shopify/polaris-icons';

import { getAppSession, redirectWithSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import { crmManager } from '~/lib/crm';
import { addSessionToUrl } from '~/util/session';
import { useDebounce } from '~/hooks/useDebounce';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  // Get all tiers
  const clubProgram = await db.getClubProgram(session.clientId);
  if (!clubProgram || !clubProgram.club_stages) {
    throw new Response('No club program found', { status: 404 });
  }
  
  return {
    session,
    tiers: clubProgram.club_stages,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found');
  }
  
  const formData = await request.formData();
  const tierId = formData.get('tier_id') as string;
  const customerCrmId = formData.get('customer_crm_id') as string | null;
  const manualPurchaseAmount = formData.get('manual_purchase_amount') as string | null;
  
  if (!tierId) {
    return { success: false, error: 'Please select a tier' };
  }
  
  const tier = await db.getClubStageWithDetails(tierId);
  if (!tier) {
    return { success: false, error: 'Invalid tier selected' };
  }
  
  try {
    // Get the appropriate CRM provider
    const provider = crmManager.getProvider(
      session.crmType,
      session.tenantShop,
      session.accessToken
    );
    
    if (customerCrmId) {
      // Existing customer selected - get customer with LTV calculated
      const customer = await provider.getCustomerWithLTV(customerCrmId);
      const ltv = customer.ltv || 0;
      
      // Check if customer exists in LV database
      const lvCustomer = await db.getCustomerByCrmId(session.clientId, customerCrmId);
      const preferences = lvCustomer
        ? await db.getCommunicationPreferences(lvCustomer.id)
        : db.getDefaultCommunicationPreferences();
      
      // Save to draft
      await db.updateEnrollmentDraft(session.id, {
        customer: {
          id: lvCustomer?.id,
          crmId: customerCrmId,
          email: customer.email,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          ltv,
          isExisting: true,
        },
        tier: {
          id: tier.id,
          name: tier.name,
          qualified: ltv >= tier.min_purchase_amount,
          purchaseAmount: ltv,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
        },
        preferences,
        addressVerified: false, // Reset - even existing customers need to verify address for enrollment
        paymentVerified: false, // Reset - need to verify payment for enrollment
      });
      
      // Existing customer goes to address step
      throw redirectWithSession('/app/members/new/address', session.id);
    } else {
      // New customer with manual purchase amount
      const purchaseAmount = parseFloat(manualPurchaseAmount || '0');
      
      // Save to draft (clear previous enrollment data when selecting a new tier)
      await db.updateEnrollmentDraft(session.id, {
        tier: {
          id: tier.id,
          name: tier.name,
          qualified: purchaseAmount >= tier.min_purchase_amount,
          purchaseAmount,
          durationMonths: tier.duration_months,
          minPurchaseAmount: tier.min_purchase_amount,
        },
        preferences: db.getDefaultCommunicationPreferences(),
        addressVerified: false, // Reset address verification when selecting new tier
        paymentVerified: false, // Reset payment verification when selecting new tier
      });
      
      // New customer goes to customer details step
      throw redirectWithSession('/app/members/new/customer', session.id);
    }
  } catch (error) {
    // Re-throw Response objects (redirects)
    if (error instanceof Response) {
      throw error;
    }
    
    console.error('Tier qualification error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process selection',
    };
  }
}

export default function QualifyTier() {
  const { session, tiers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  
  // Customer search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Manual purchase amount for new customers
  const [manualPurchaseAmount, setManualPurchaseAmount] = useState('');
  
  // Selected tier
  const [selectedTierId, setSelectedTierId] = useState('');
  
  // Calculate purchase amount to use for qualification
  const purchaseAmountForQualification = selectedCustomer?.ltv || parseFloat(manualPurchaseAmount || '0');
  
  // Search for customers when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.length >= 2 && !selectedCustomer) {
      handleSearchCustomers(debouncedSearchQuery);
    } else if (debouncedSearchQuery.length < 2) {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery, selectedCustomer]);
  
  const handleSearchCustomers = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/customers?q=${encodeURIComponent(query)}&session=${session.id}`
      );
      const data = await response.json();
      setSearchResults(data.customers || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setSearchQuery('');
    setSearchResults([]);
    setManualPurchaseAmount(''); // Clear manual entry
  };
  
  const handleClearCustomer = () => {
    setSelectedCustomer(null);
  };
  
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
            Step 1: Select Customer & Tier
          </Text>
          <Text variant="bodyMd" as="p">
            Search for an existing customer or enter a purchase amount for a new customer, 
            then select the tier they qualify for.
          </Text>
        </BlockStack>
      </Card>
      
      {/* Customer Lookup Section */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Customer Lookup (Optional)
          </Text>
          
          {!selectedCustomer && (
            <Autocomplete
              options={searchResults.map((c) => ({
                value: c.id,
                label: `${c.firstName} ${c.lastName} (${c.email}) - LTV: $${c.ltv.toFixed(2)}`,
              }))}
              selected={[]}
              onSelect={([selection]) => {
                const customer = searchResults.find((c) => c.id === selection);
                if (customer) handleSelectCustomer(customer);
              }}
              textField={
                <Autocomplete.TextField
                  label="Search for existing customer"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by name or email"
                  autoComplete="off"
                  prefix={<Icon source={SearchIcon} />}
                  helpText="Search for an existing customer to auto-populate their purchase history"
                />
              }
              loading={isSearching}
            />
          )}
          
          {selectedCustomer && (
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <div>
                  <Text variant="headingSm" as="p">
                    {selectedCustomer.firstName} {selectedCustomer.lastName}
                  </Text>
                  <Text variant="bodySm" as="p" tone="subdued">
                    {selectedCustomer.email}
                  </Text>
                  <Text variant="bodySm" as="p">
                    <strong>LTV:</strong> ${selectedCustomer.ltv.toFixed(2)}
                  </Text>
                </div>
                <Button onClick={handleClearCustomer}>Change Customer</Button>
              </InlineStack>
            </BlockStack>
          )}
          
          <Divider />
          
          <TextField
            label="Or enter purchase amount for new customer"
            type="number"
            value={manualPurchaseAmount}
            onChange={setManualPurchaseAmount}
            prefix="$"
            autoComplete="off"
            helpText="For new customers, enter their estimated purchase history"
            disabled={!!selectedCustomer}
          />
        </BlockStack>
      </Card>
      
      {/* Tier Selection Section */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Select Tier
          </Text>
          
          {purchaseAmountForQualification > 0 && (
            <Banner tone="info">
              Customer has ${purchaseAmountForQualification.toFixed(2)} in purchases. 
              Tiers are marked as qualified or not qualified based on this amount.
            </Banner>
          )}
          
          <Form method="post">
            <input type="hidden" name="tier_id" value={selectedTierId} />
            <input type="hidden" name="customer_crm_id" value={selectedCustomer?.id || ''} />
            <input type="hidden" name="manual_purchase_amount" value={manualPurchaseAmount} />
            
            <BlockStack gap="300">
              {tiers.map((tier) => {
                const qualified = purchaseAmountForQualification >= tier.min_purchase_amount;
                const isSelected = selectedTierId === tier.id;
                
                return (
                  <div
                    key={tier.id}
                    onClick={() => setSelectedTierId(tier.id)}
                    style={{
                      cursor: 'pointer',
                      padding: '16px',
                      border: isSelected ? '2px solid #008060' : '1px solid #e1e3e5',
                      borderRadius: '8px',
                      backgroundColor: isSelected ? '#f6f6f7' : 'transparent',
                    }}
                  >
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="200">
                        <Text variant="headingSm" as="h4">
                          {tier.name}
                        </Text>
                        <Text variant="bodySm" as="p">
                          {tier.duration_months} months · Requires ${tier.min_purchase_amount}
                        </Text>
                        {purchaseAmountForQualification > 0 && (
                          <Text variant="bodySm" as="p" tone="subdued">
                            Customer: ${purchaseAmountForQualification.toFixed(2)} 
                            {qualified ? ` (${(purchaseAmountForQualification - tier.min_purchase_amount).toFixed(2)} over minimum)` : ` (${(tier.min_purchase_amount - purchaseAmountForQualification).toFixed(2)} short)`}
                          </Text>
                        )}
                      </BlockStack>
                      {purchaseAmountForQualification > 0 && (
                        <Badge tone={qualified ? 'success' : 'attention'}>
                          {qualified ? 'Qualified' : 'Not Qualified'}
                        </Badge>
                      )}
                    </InlineStack>
                  </div>
                );
              })}
              
              <Button
                variant="primary"
                submit
                disabled={!selectedTierId}
                size="large"
              >
                Continue to {selectedCustomer ? 'Address' : 'Customer Details'} →
              </Button>
            </BlockStack>
          </Form>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

