import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, redirect, useNavigate } from 'react-router';
import { useState } from 'react';
import { 
  Page, 
  Layout, 
  Card, 
  Button, 
  Text, 
  BlockStack,
  Banner,
  InlineStack,
  ProgressBar,
  TextField,
  Box,
  Divider,
} from '@shopify/polaris';
import { createClient } from '@supabase/supabase-js';
import { getAppSession } from '~/lib/sessions.server';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TierFormData {
  id: string; // temp ID for form tracking
  name: string;
  discountPercentage: string;
  durationMonths: string;
  minPurchaseAmount: string;
  description?: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // DEV MODE: Get fake dev client (already created by parent /app route)
  if (process.env.NODE_ENV === 'development' && process.env.EMBEDDED_APP === 'no') {
    let { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', session.clientId)
      .single();
    
    // Check if client already has a club program setup
    const { data: existingProgram } = await supabase
      .from('club_programs')
      .select('*, club_stages(*)')
      .eq('client_id', client?.id || session.clientId)
      .single();
    
    // Check if loyalty rules exist
    const { data: loyaltyRules } = await supabase
      .from('loyalty_point_rules')
      .select('*')
      .eq('client_id', client?.id || session.clientId)
      .single();
    
    return { 
      session,
      client,
      existingProgram,
      loyaltyRules,
      hasSetup: !!existingProgram && !!loyaltyRules,
    };
  }
  
  // Check if client already has a club program setup
  const { data: existingProgram } = await supabase
    .from('club_programs')
    .select('*, club_stages(*)')
    .eq('client_id', session.clientId)
    .single();
  
  // Check if loyalty rules exist
  const { data: loyaltyRules } = await supabase
    .from('loyalty_point_rules')
    .select('*')
    .eq('client_id', session.clientId)
    .single();
  
  // Get client info
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', session.clientId)
    .single();
  
  return { 
    session,
    client,
    existingProgram,
    loyaltyRules,
    hasSetup: !!existingProgram && !!loyaltyRules,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  const formData = await request.formData();
  const action = formData.get('action') as string;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    if (action === 'complete_setup') {
      // Parse all the setup data
      const clubName = formData.get('club_name') as string;
      const clubDescription = formData.get('club_description') as string;
      const tiersJson = formData.get('tiers') as string;
      const pointsPerDollar = formData.get('points_per_dollar') as string;
      const minMembershipDays = formData.get('min_membership_days') as string;
      const pointDollarValue = formData.get('point_dollar_value') as string;
      const minPointsRedemption = formData.get('min_points_redemption') as string;
      
      if (!clubName || !tiersJson) {
        return { 
          success: false, 
          message: 'Club name and at least one tier are required' 
        };
      }
      
      const tiers: TierFormData[] = JSON.parse(tiersJson);
      
      if (tiers.length === 0) {
        return {
          success: false,
          message: 'You must create at least one tier'
        };
      }
      
      // Create club program
      const { data: clubProgram, error: clubError } = await supabase
        .from('club_programs')
        .insert({
          client_id: session.clientId,
          name: clubName,
          description: clubDescription,
          is_active: true,
        })
        .select()
        .single();
      
      if (clubError || !clubProgram) {
        return {
          success: false,
          message: 'Failed to create club program',
          error: clubError?.message
        };
      }
      
      // Create tiers
      const tierInserts = tiers.map((tier, index) => ({
        club_program_id: clubProgram.id,
        name: tier.name,
        discount_percentage: parseFloat(tier.discountPercentage),
        duration_months: parseInt(tier.durationMonths),
        min_purchase_amount: parseFloat(tier.minPurchaseAmount),
        stage_order: index + 1,
        is_active: true,
      }));
      
      const { error: tiersError } = await supabase
        .from('club_stages')
        .insert(tierInserts);
      
      if (tiersError) {
        // Rollback club program
        await supabase.from('club_programs').delete().eq('id', clubProgram.id);
        return {
          success: false,
          message: 'Failed to create tiers',
          error: tiersError.message
        };
      }
      
      // Create loyalty point rules
      const { error: loyaltyError } = await supabase
        .from('loyalty_point_rules')
        .insert({
          client_id: session.clientId,
          points_per_dollar: parseFloat(pointsPerDollar || '1'),
          min_membership_days: parseInt(minMembershipDays || '365'),
          point_dollar_value: parseFloat(pointDollarValue || '0.01'),
          min_points_for_redemption: parseInt(minPointsRedemption || '100'),
          is_active: true,
        });
      
      if (loyaltyError) {
        // Rollback everything
        await supabase.from('club_stages').delete().eq('club_program_id', clubProgram.id);
        await supabase.from('club_programs').delete().eq('id', clubProgram.id);
        return {
          success: false,
          message: 'Failed to create loyalty rules',
          error: loyaltyError.message
        };
      }
      
      // Mark setup as complete in clients table
      await supabase
        .from('clients')
        .update({ 
          setup_complete: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.clientId);
      
      return redirect('/app');
    }
    
    return { success: false, message: 'Invalid action' };
    
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export default function Setup() {
  const { client, existingProgram, hasSetup } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // Form state
  const [clubName, setClubName] = useState(existingProgram?.name || `${client.org_name} Wine Club`);
  const [clubDescription, setClubDescription] = useState(
    existingProgram?.description || 
    'Liberate your wine buying experience. Enjoy member pricing on your schedule - no forced shipments, no surprises.'
  );
  
  const [tiers, setTiers] = useState<TierFormData[]>(
    existingProgram?.club_stages?.map((stage: any, index: number) => ({
      id: `tier-${index}`,
      name: stage.name,
      discountPercentage: stage.discount_percentage.toString(),
      durationMonths: stage.duration_months.toString(),
      minPurchaseAmount: stage.min_purchase_amount.toString(),
      description: '',
    })) || [
      {
        id: 'tier-1',
        name: 'Bronze',
        discountPercentage: '10',
        durationMonths: '3',
        minPurchaseAmount: '150',
        description: 'Start your liberation journey',
      }
    ]
  );
  
  const [pointsPerDollar, setPointsPerDollar] = useState('1');
  const [minMembershipDays, setMinMembershipDays] = useState('365');
  const [pointDollarValue, setPointDollarValue] = useState('0.01');
  const [minPointsRedemption, setMinPointsRedemption] = useState('100');
  
  const progressPercent = (currentStep / totalSteps) * 100;
  
  const addTier = () => {
    setTiers([...tiers, {
      id: `tier-${Date.now()}`,
      name: '',
      discountPercentage: '',
      durationMonths: '',
      minPurchaseAmount: '',
      description: '',
    }]);
  };
  
  const removeTier = (id: string) => {
    setTiers(tiers.filter(t => t.id !== id));
  };
  
  const updateTier = (id: string, field: keyof TierFormData, value: string) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, [field]: value } : t));
  };
  
  const moveTier = (index: number, direction: 'up' | 'down') => {
    const newTiers = [...tiers];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex >= 0 && swapIndex < tiers.length) {
      [newTiers[index], newTiers[swapIndex]] = [newTiers[swapIndex], newTiers[index]];
      setTiers(newTiers);
    }
  };
  
  const canProceed = () => {
    switch (currentStep) {
      case 1: return true; // Welcome
      case 2: return clubName.length > 0;
      case 3: return tiers.length > 0 && tiers.every(t => 
        t.name && t.discountPercentage && t.durationMonths && t.minPurchaseAmount
      );
      case 4: return pointsPerDollar && minMembershipDays && pointDollarValue;
      case 5: return true; // Review
      default: return false;
    }
  };

  return (
    <Page
      title="LiberoVino Club Setup"
      backAction={{ content: 'Cancel', onAction: () => navigate('/app') }}
    >
      <Layout>
        {/* Progress Bar */}
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between">
                <Text variant="bodyMd" as="p" tone="subdued">
                  Step {currentStep} of {totalSteps}
                </Text>
                <Text variant="bodyMd" as="p" fontWeight="semibold">
                  {progressPercent.toFixed(0)}% Complete
                </Text>
              </InlineStack>
              <ProgressBar progress={progressPercent} size="small" tone="primary" />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Error Messages */}
        {actionData && !actionData.success && (
          <Layout.Section>
            <Banner tone="critical" title={actionData.message}>
              {actionData.error && <Text as="p">{actionData.error}</Text>}
            </Banner>
          </Layout.Section>
        )}

        {/* Step Content */}
        <Layout.Section>
          {currentStep === 1 && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Welcome to LiberoVino! 🍷
                </Text>
                
                <Text variant="bodyLg" as="p">
                  You're about to set up a revolutionary wine club experience that liberates your members from traditional club constraints.
                </Text>
                
                <Divider />
                
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">
                    What Makes LiberoVino Different?
                  </Text>
                  
                  <BlockStack gap="200">
                    <Box>
                      <Text variant="bodyMd" as="p" fontWeight="semibold">✨ Member Freedom</Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        No forced shipments. Members buy when they're ready, within their duration window.
                      </Text>
                    </Box>
                    
                    <Box>
                      <Text variant="bodyMd" as="p" fontWeight="semibold">📈 Tier Progression</Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Members advance through tiers by purchasing more, unlocking better discounts.
                      </Text>
                    </Box>
                    
                    <Box>
                      <Text variant="bodyMd" as="p" fontWeight="semibold">⏰ Duration-Based Benefits</Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Members extend their duration with each purchase. No "expiration" pressure.
                      </Text>
                    </Box>
                    
                    <Box>
                      <Text variant="bodyMd" as="p" fontWeight="semibold">🎁 Loyalty Rewards</Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        After 1 year, members earn points on every purchase for additional rewards.
                      </Text>
                    </Box>
                  </BlockStack>
                </BlockStack>
                
                <Divider />
                
                <Text variant="bodyMd" as="p" tone="subdued">
                  This setup will take about 5 minutes. Let's liberate your wine club!
                </Text>
              </BlockStack>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Name Your Club
                </Text>
                
                <Text variant="bodyMd" as="p" tone="subdued">
                  Give your club a name that reflects your winery's personality. This is what members will see when they join.
                </Text>
                
                <TextField
                  label="Club Name"
                  value={clubName}
                  onChange={setClubName}
                  autoComplete="off"
                  helpText="Example: Sunset Ridge Wine Club, The Reserve Society"
                />
                
                <TextField
                  label="Club Description"
                  value={clubDescription}
                  onChange={setClubDescription}
                  multiline={4}
                  autoComplete="off"
                  helpText="Describe the liberation experience. This appears on your club page and member communications."
                />
                
                <Banner tone="info">
                  <Text as="p">
                    <strong>Pro Tip:</strong> Emphasize freedom and benefits. Example: "Enjoy premium wines on your schedule. No forced shipments, just great wine when you want it."
                  </Text>
                </Banner>
              </BlockStack>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Create Your Tiers
                </Text>
                
                <Text variant="bodyMd" as="p" tone="subdued">
                  Define membership tiers with different benefits. Members advance by purchasing more wine. You can create as many tiers as you like!
                </Text>
                
                <Banner tone="info">
                  <Text as="p">
                    <strong>Flexibility:</strong> Create parallel tiers (e.g., "6-Month Standard" and "6-Month Premium + Free Shipping") or progressive tiers (Bronze → Silver → Gold).
                  </Text>
                </Banner>
                
                <Divider />
                
                {tiers.map((tier, index) => (
                  <Card key={tier.id}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingMd" as="h3">
                          Tier {index + 1}
                        </Text>
                        <InlineStack gap="200">
                          {index > 0 && (
                            <Button size="slim" onClick={() => moveTier(index, 'up')}>
                              ↑ Move Up
                            </Button>
                          )}
                          {index < tiers.length - 1 && (
                            <Button size="slim" onClick={() => moveTier(index, 'down')}>
                              ↓ Move Down
                            </Button>
                          )}
                          {tiers.length > 1 && (
                            <Button 
                              size="slim" 
                              tone="critical" 
                              onClick={() => removeTier(tier.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </InlineStack>
                      </InlineStack>
                      
                      <TextField
                        label="Tier Name"
                        value={tier.name}
                        onChange={(value) => updateTier(tier.id, 'name', value)}
                        placeholder="e.g., Bronze, Premium, VIP"
                        autoComplete="off"
                      />
                      
                      <InlineStack gap="400">
                        <Box minWidth="150px">
                          <TextField
                            label="Discount %"
                            type="number"
                            value={tier.discountPercentage}
                            onChange={(value) => updateTier(tier.id, 'discountPercentage', value)}
                            suffix="%"
                            autoComplete="off"
                          />
                        </Box>
                        <Box minWidth="150px">
                          <TextField
                            label="Duration"
                            type="number"
                            value={tier.durationMonths}
                            onChange={(value) => updateTier(tier.id, 'durationMonths', value)}
                            suffix="months"
                            autoComplete="off"
                          />
                        </Box>
                        <Box minWidth="200px">
                          <TextField
                            label="Min Purchase"
                            type="number"
                            value={tier.minPurchaseAmount}
                            onChange={(value) => updateTier(tier.id, 'minPurchaseAmount', value)}
                            prefix="$"
                            autoComplete="off"
                          />
                        </Box>
                      </InlineStack>
                      
                      <TextField
                        label="Benefits Description (Optional)"
                        value={tier.description}
                        onChange={(value) => updateTier(tier.id, 'description', value)}
                        placeholder="e.g., Free shipping, exclusive access to library wines"
                        autoComplete="off"
                      />
                    </BlockStack>
                  </Card>
                ))}
                
                <Button onClick={addTier} fullWidth>
                  + Add Another Tier
                </Button>
              </BlockStack>
            </Card>
          )}

          {currentStep === 4 && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Loyalty Points Configuration
                </Text>
                
                <Text variant="bodyMd" as="p" tone="subdued">
                  After members reach 1 year of cumulative membership, they'll start earning loyalty points on every purchase.
                </Text>
                
                <Banner tone="info">
                  <Text as="p">
                    <strong>Why 1 Year?</strong> This creates a compound incentive - members get tier benefits immediately, then unlock points after showing loyalty. It encourages long-term engagement.
                  </Text>
                </Banner>
                
                <Divider />
                
                <InlineStack gap="400">
                  <Box minWidth="200px">
                    <TextField
                      label="Points Per Dollar"
                      type="number"
                      value={pointsPerDollar}
                      onChange={setPointsPerDollar}
                      helpText="Points earned per $1 spent"
                      autoComplete="off"
                    />
                  </Box>
                  
                  <Box minWidth="200px">
                    <TextField
                      label="Days to Start Earning"
                      type="number"
                      value={minMembershipDays}
                      onChange={setMinMembershipDays}
                      helpText="Cumulative membership days"
                      autoComplete="off"
                    />
                  </Box>
                </InlineStack>
                
                <InlineStack gap="400">
                  <Box minWidth="200px">
                    <TextField
                      label="Point Dollar Value"
                      type="number"
                      value={pointDollarValue}
                      onChange={setPointDollarValue}
                      prefix="$"
                      helpText="Value of each point ($0.01 = 100 pts = $1)"
                      autoComplete="off"
                    />
                  </Box>
                  
                  <Box minWidth="200px">
                    <TextField
                      label="Min Points for Redemption"
                      type="number"
                      value={minPointsRedemption}
                      onChange={setMinPointsRedemption}
                      helpText="Minimum points needed to redeem"
                      autoComplete="off"
                    />
                  </Box>
                </InlineStack>
                
                <Banner>
                  <Text as="p">
                    <strong>Example:</strong> With these defaults, a member spending $100 earns 100 points worth $1. They need 100 points minimum to redeem.
                  </Text>
                </Banner>
              </BlockStack>
            </Card>
          )}

          {currentStep === 5 && (
            <Card>
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">
                  Review & Launch
                </Text>
                
                <Text variant="bodyMd" as="p" tone="subdued">
                  Review your club configuration below. You can edit these settings later from your dashboard.
                </Text>
                
                <Divider />
                
                {/* Club Overview */}
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">Club Details</Text>
                  <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p" fontWeight="semibold">{clubName}</Text>
                      <Text variant="bodyMd" as="p" tone="subdued">{clubDescription}</Text>
                    </BlockStack>
                  </Box>
                </BlockStack>
                
                {/* Tiers Overview */}
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">Membership Tiers ({tiers.length})</Text>
                  {tiers.map((tier, index) => (
                    <Box key={tier.id} background="bg-surface-secondary" padding="300" borderRadius="200">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" as="p" fontWeight="semibold">
                          {index + 1}. {tier.name}
                        </Text>
                        <Text variant="bodyMd" as="p" tone="subdued">
                          {tier.discountPercentage}% discount • {tier.durationMonths} months duration • ${tier.minPurchaseAmount} min purchase
                        </Text>
                        {tier.description && (
                          <Text variant="bodySm" as="p" tone="subdued">
                            {tier.description}
                          </Text>
                        )}
                      </BlockStack>
                    </Box>
                  ))}
                </BlockStack>
                
                {/* Loyalty Points Overview */}
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h3">Loyalty Points</Text>
                  <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                    <BlockStack gap="100">
                      <Text variant="bodyMd" as="p">
                        {pointsPerDollar} point(s) per dollar after {minMembershipDays} days
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Point value: ${pointDollarValue} • Min redemption: {minPointsRedemption} points
                      </Text>
                    </BlockStack>
                  </Box>
                </BlockStack>
                
                <Banner tone="success">
                  <BlockStack gap="200">
                    <Text as="p" fontWeight="semibold">
                      Ready to Liberate Your Wine Club! 🎉
                    </Text>
                    <Text as="p">
                      Click "Complete Setup" below to activate your LiberoVino club. Your members will experience wine buying freedom like never before.
                    </Text>
                  </BlockStack>
                </Banner>
              </BlockStack>
            </Card>
          )}
        </Layout.Section>

        {/* Navigation Buttons */}
        <Layout.Section>
          <Card>
            <InlineStack align="space-between">
              <Button
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                disabled={currentStep === 1}
              >
                ← Previous
              </Button>
              
              {currentStep < totalSteps ? (
                <Button
                  variant="primary"
                  onClick={() => setCurrentStep(currentStep + 1)}
                  disabled={!canProceed()}
                >
                  Next →
                </Button>
              ) : (
                <Form method="post">
                  <input type="hidden" name="action" value="complete_setup" />
                  <input type="hidden" name="club_name" value={clubName} />
                  <input type="hidden" name="club_description" value={clubDescription} />
                  <input type="hidden" name="tiers" value={JSON.stringify(tiers)} />
                  <input type="hidden" name="points_per_dollar" value={pointsPerDollar} />
                  <input type="hidden" name="min_membership_days" value={minMembershipDays} />
                  <input type="hidden" name="point_dollar_value" value={pointDollarValue} />
                  <input type="hidden" name="min_points_redemption" value={minPointsRedemption} />
                  <Button variant="primary" submit>
                    Complete Setup ✨
                  </Button>
                </Form>
              )}
            </InlineStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

