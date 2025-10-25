import { type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { useLoaderData, Form, useActionData, redirect, useNavigate } from 'react-router';
import { useState, useEffect, useMemo } from 'react';
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
import { createDefaultDiscount, type Discount, type SerializedDiscount, serializeDiscount, parseDiscount } from '~/types/discount';
import ProductCollectionSelector from '~/components/ProductCollectionSelector';
import { notifyParentOfHeightChange, setupAutoResize, scrollToTop } from '~/util/iframe-helper';
import { useCrmProvider } from '~/hooks/useCrmProvider';
import { Commerce7Provider } from '~/lib/crm/commerce7.server';
import { addSessionToUrl } from '~/util/session';
import { createTierTagAndCoupon, syncTierTagAndCoupon } from '~/lib/tier-helpers.server';
import { fromC7Coupon } from '~/types/discount-commerce7';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface TierFormData {
  id: string; // temp ID for form tracking
  name: string;
  discountPercentage: string;
  durationMonths: string;
  minPurchaseAmount: string;
  description?: string;
  discount?: Discount; // Unified discount for C7/Shopify (in React state)
  showDiscountForm?: boolean; // Toggle to show/hide discount configuration
}

// When parsed from JSON, discount dates become strings
interface TierFormDataSerialized extends Omit<TierFormData, 'discount'> {
  discount?: SerializedDiscount;
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Trust that parent /app route already checked authorization
  const session = await getAppSession(request);
  if (!session) {
    throw new Error('Session not found - should have been caught by parent route');
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // DEV MODE: Get fake dev client (already created by parent /app route)
  if (process.env.NODE_ENV === 'development' && process.env.EMBEDDED_APP === 'no' && session.crmType === 'commerce7') {
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
  
  // Fetch actual discount data from C7 for existing tiers
  let tiersWithDiscounts = existingProgram?.club_stages || [];
  if (existingProgram?.club_stages && session.crmType === 'commerce7') {
    const provider = new Commerce7Provider(session.tenantShop);
    
    tiersWithDiscounts = await Promise.all(
      existingProgram.club_stages.map(async (stage: any) => {
        if (stage.platform_discount_id) {
          try {
            // Fetch the full C7 coupon data
            const c7CouponData = await provider.getC7CouponFull(stage.platform_discount_id);
            
            // Convert to unified Discount type
            let discount: Discount;
            try {
              discount = fromC7Coupon(c7CouponData) as Discount;
              
              // Enrich collections with titles (fromC7Coupon only gives us IDs)
              if (discount.appliesTo?.collections && discount.appliesTo.collections.length > 0) {
                const enrichedCollections = await Promise.all(
                  discount.appliesTo.collections.map(async (collectionRef) => {
                    // Handle case where collectionRef might be a string instead of an object
                    const collectionId = typeof collectionRef === 'string' ? collectionRef : collectionRef.id;
                    
                    if (!collectionId) {
                      console.warn('Collection reference missing ID:', collectionRef);
                      return { id: '' }; // Return empty ID to avoid crashes
                    }
                    
                    try {
                      // Fetch the full collection data from C7 to get the title
                      const collection = await provider.getCollection(collectionId);
                      return { id: collectionId, title: collection.title };
                    } catch (error) {
                      console.warn(`Failed to fetch collection ${collectionId}:`, error);
                      return { id: collectionId }; // Keep just the ID if fetch fails
                    }
                  })
                );
                discount.appliesTo.collections = enrichedCollections;
              }
              
              // Enrich products with titles (fromC7Coupon only gives us IDs)
              if (discount.appliesTo?.products && discount.appliesTo.products.length > 0) {
                const enrichedProducts = await Promise.all(
                  discount.appliesTo.products.map(async (productRef) => {
                    // Handle case where productRef might be a string instead of an object
                    const productId = typeof productRef === 'string' ? productRef : productRef.id;
                    
                    if (!productId) {
                      console.warn('Product reference missing ID:', productRef);
                      return { id: '' }; // Return empty ID to avoid crashes
                    }
                    
                    try {
                      // Fetch the full product data from C7 to get the title
                      const product = await provider.getProduct(productId);
                      return { id: productId, title: product.title };
                    } catch (error) {
                      console.warn(`Failed to fetch product ${productId}:`, error);
                      return { id: productId }; // Keep just the ID if fetch fails
                    }
                  })
                );
                discount.appliesTo.products = enrichedProducts;
              }
            } catch (conversionError) {
              console.error(`Conversion error for ${stage.name}:`, conversionError);
              throw conversionError;
            }
            
            // Serialize for transmission (dates to strings)
            const serializedDiscount = serializeDiscount(discount);
            
            return {
              ...stage,
              discountData: serializedDiscount,
            };
          } catch (error) {
            console.error(`Failed to fetch discount for tier ${stage.name}:`, error);
            console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
            return stage;
          }
        }
        return stage;
      })
    );
  }
  
  return {
    session,
    client,
    existingProgram: existingProgram ? {
      ...existingProgram,
      club_stages: tiersWithDiscounts,
    } : null,
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
      
      const tiers: TierFormDataSerialized[] = JSON.parse(tiersJson);
      
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
        // Store discount code and title for reference
        discount_code: tier.discount?.code,
        discount_title: tier.discount?.title,
      }));
      
      const { data: createdTiers, error: tiersError } = await supabase
        .from('club_stages')
        .insert(tierInserts)
        .select();
      
      if (tiersError || !createdTiers) {
        // Rollback club program
        await supabase.from('club_programs').delete().eq('id', clubProgram.id);
        return {
          success: false,
          message: 'Failed to create tiers',
          error: tiersError?.message
        };
      }
      
      // Create tags and discounts in Commerce7/Shopify for each tier
      const discountCreationErrors: string[] = [];
      
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const createdTier = createdTiers[i];
        
        if (tier.discount) {
          try {
            const discount = parseDiscount(tier.discount);
            
            if (session.crmType === 'commerce7') {
              // Create customer tag and coupon together
              const provider = new Commerce7Provider(session.tenantShop);
              const result = await createTierTagAndCoupon(
                provider,
                tier.name,
                discount
              );
              
              // Store the tag ID, coupon ID, and codes back to the tier
              await supabase
                .from('club_stages')
                .update({ 
                  platform_tag_id: result.tagId,
                  platform_discount_id: result.couponId,
                  discount_code: result.couponCode,
                  discount_title: result.couponTitle,
                })
                .eq('id', createdTier.id);
            } else if (session.crmType === 'shopify') {
              // TODO: Implement Shopify discount creation
              throw new Error('Shopify discount creation not yet implemented');
            }
          } catch (error) {
            const errorMsg = `Failed to create discount for tier "${tier.name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMsg);
            discountCreationErrors.push(errorMsg);
          }
        }
      }
      
      // If any discounts failed to create, warn but don't fail the whole setup
      if (discountCreationErrors.length > 0) {
        console.warn('Some discounts failed to create:', discountCreationErrors);
        // You could optionally return a warning message here
        // but we'll let the setup continue since the tiers were created
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
      
      // Redirect to settings with success toast
      let successMessage = 'Club setup completed successfully!';
      if (discountCreationErrors.length > 0) {
        successMessage += ` (${discountCreationErrors.length} coupon creation(s) failed - see console)`;
      }
      
      const settingsUrl = addSessionToUrl('/app/settings', session.id) + 
        `&toast=${encodeURIComponent(successMessage)}&toastType=success`;
      
      throw redirect(settingsUrl);
    }
    
    if (action === 'update_setup') {
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
      
      const tiers: TierFormDataSerialized[] = JSON.parse(tiersJson);
      
      if (tiers.length === 0) {
        return {
          success: false,
          message: 'You must create at least one tier'
        };
      }
      
      // Get existing program
      const { data: existingProgram } = await supabase
        .from('club_programs')
        .select('*, club_stages(*)')
        .eq('client_id', session.clientId)
        .single();
      
      if (!existingProgram) {
        return {
          success: false,
          message: 'No existing club program found. Please use initial setup instead.'
        };
      }
      
      // Update club program
      const { error: updateProgramError } = await supabase
        .from('club_programs')
        .update({
          name: clubName,
          description: clubDescription,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingProgram.id);
      
      if (updateProgramError) {
        return {
          success: false,
          message: 'Failed to update club program',
          error: updateProgramError.message
        };
      }
      
      // Handle tier updates (add/update/delete)
      const existingTierIds = new Set<string>(existingProgram.club_stages.map((s: any) => s.id));
      const updatedTierIds = new Set<string>();
      const discountUpdateErrors: string[] = [];
      
      // Process each tier from the form
      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        
        // Check if this is an existing tier (UUID format) or new one (tier-xxx format)
        const isExistingTier = tier.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        
        if (isExistingTier && existingTierIds.has(tier.id)) {
          // UPDATE existing tier
          updatedTierIds.add(tier.id);
          
          const { error: updateTierError } = await supabase
            .from('club_stages')
            .update({
              name: tier.name,
              discount_percentage: parseFloat(tier.discountPercentage),
              duration_months: parseInt(tier.durationMonths),
              min_purchase_amount: parseFloat(tier.minPurchaseAmount),
              stage_order: i + 1,
              discount_code: tier.discount?.code,
              discount_title: tier.discount?.title,
              updated_at: new Date().toISOString()
            })
            .eq('id', tier.id);
          
          if (updateTierError) {
            console.error(`Failed to update tier ${tier.name}:`, updateTierError);
            continue;
          }
          
          // Sync Commerce7 tag and coupon (handles all edge cases)
          if (tier.discount && session.crmType === 'commerce7') {
            try {
              const existingTier = existingProgram.club_stages.find((s: any) => s.id === tier.id);
              const discount = parseDiscount(tier.discount);
              const provider = new Commerce7Provider(session.tenantShop);
              
              // Sync will verify what exists in C7 and create/update as needed
              const result = await syncTierTagAndCoupon(
                provider,
                tier.name,
                discount,
                existingTier?.platform_tag_id,
                existingTier?.platform_discount_id
              );
              
              // Update database with current IDs
              await supabase
                .from('club_stages')
                .update({ 
                  platform_tag_id: result.tagId,
                  platform_discount_id: result.couponId,
                  discount_code: result.couponCode,
                  discount_title: result.couponTitle,
                })
                .eq('id', tier.id);
            } catch (error) {
              const errorMsg = `Failed to sync coupon for tier "${tier.name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.error(errorMsg);
              discountUpdateErrors.push(errorMsg);
            }
          }
        } else {
          // CREATE new tier
          const { data: newTier, error: createTierError } = await supabase
            .from('club_stages')
            .insert({
              club_program_id: existingProgram.id,
              name: tier.name,
              discount_percentage: parseFloat(tier.discountPercentage),
              duration_months: parseInt(tier.durationMonths),
              min_purchase_amount: parseFloat(tier.minPurchaseAmount),
              stage_order: i + 1,
              is_active: true,
              discount_code: tier.discount?.code,
              discount_title: tier.discount?.title,
            })
            .select()
            .single();
          
          if (createTierError || !newTier) {
            console.error(`Failed to create new tier ${tier.name}:`, createTierError);
            continue;
          }
          
          updatedTierIds.add(newTier.id);
          
          // Create Commerce7 tag and coupon for new tier
          if (tier.discount && session.crmType === 'commerce7') {
            try {
              const discount = parseDiscount(tier.discount);
              const provider = new Commerce7Provider(session.tenantShop);
              const result = await createTierTagAndCoupon(
                provider,
                tier.name,
                discount
              );
              
              await supabase
                .from('club_stages')
                .update({ 
                  platform_tag_id: result.tagId,
                  platform_discount_id: result.couponId,
                  discount_code: result.couponCode,
                  discount_title: result.couponTitle,
                })
                .eq('id', newTier.id);
            } catch (error) {
              const errorMsg = `Failed to create coupon for new tier "${tier.name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
              console.error(errorMsg);
              discountUpdateErrors.push(errorMsg);
            }
          }
        }
      }
      
      // DELETE tiers that were removed
      const tiersToDelete = Array.from(existingTierIds).filter(id => !updatedTierIds.has(id));
      for (const tierIdToDelete of tiersToDelete) {
        const tierToDelete = existingProgram.club_stages.find((s: any) => s.id === tierIdToDelete);
        
        // Delete Commerce7 coupon and tag if they exist
        if (session.crmType === 'commerce7') {
          const provider = new Commerce7Provider(session.tenantShop);
          
          // Delete coupon
          if (tierToDelete?.platform_discount_id) {
            try {
              await provider.deleteC7Coupon(tierToDelete.platform_discount_id);
            } catch (error) {
              console.error(`Failed to delete coupon for tier "${tierToDelete?.name}":`, error);
            }
          }
          
          // Delete tag
          if (tierToDelete?.platform_tag_id) {
            try {
              await provider.deleteTag(tierToDelete.platform_tag_id);
            } catch (error) {
              console.error(`Failed to delete tag for tier "${tierToDelete?.name}":`, error);
            }
          }
        }
        
        // Delete the tier from database
        await supabase
          .from('club_stages')
          .delete()
          .eq('id', tierIdToDelete);
      }
      
      // Update loyalty point rules
      const { error: updateLoyaltyError } = await supabase
        .from('loyalty_point_rules')
        .update({
          points_per_dollar: parseFloat(pointsPerDollar || '1'),
          min_membership_days: parseInt(minMembershipDays || '365'),
          point_dollar_value: parseFloat(pointDollarValue || '0.01'),
          min_points_for_redemption: parseInt(minPointsRedemption || '100'),
          updated_at: new Date().toISOString()
        })
        .eq('client_id', session.clientId);
      
      if (updateLoyaltyError) {
        return {
          success: false,
          message: 'Failed to update loyalty rules',
          error: updateLoyaltyError.message
        };
      }
      
      // Build success message
      let successMessage = 'Club setup updated successfully!';
      if (discountUpdateErrors.length > 0) {
        successMessage += ` (${discountUpdateErrors.length} coupon update(s) failed - see console)`;
      }
      
      // Redirect to settings with success toast
      const url = new URL(request.url);
      const sessionId = url.searchParams.get('session');
      const settingsUrl = sessionId 
        ? `/app/settings?session=${sessionId}&toast=${encodeURIComponent(successMessage)}&toastType=success`
        : `/app/settings?toast=${encodeURIComponent(successMessage)}&toastType=success`;
      
      throw redirect(settingsUrl);
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
  const { client, existingProgram, loyaltyRules, hasSetup, session } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const crm = useCrmProvider(session);
  
  // Determine if we're in edit mode
  const isEditMode = !!existingProgram;
  
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  
  // Form state
  const [clubName, setClubName] = useState(existingProgram?.name || `${client.org_name} Wine Club`);
  const [clubDescription, setClubDescription] = useState(
    existingProgram?.description || 
    'Liberate your wine buying experience. Enjoy member pricing on your schedule - no forced shipments, no surprises.'
  );
  
  // Helper to create initial discount for a tier
  const createTierDiscount = (tierName: string, discountPercent: string): Discount => {
    const discount = createDefaultDiscount(session.crmType === 'commerce7' ? 'commerce7' : 'shopify');
    const cleanName = tierName.toUpperCase().replace(/\s+/g, '');
    return {
      ...discount,
      code: `${cleanName}${discountPercent}`,
      title: `${tierName} Tier - ${discountPercent}% Off`,
      value: {
        type: 'percentage',
        percentage: parseFloat(discountPercent) || 0,
      },
      status: 'scheduled', // Set initial status
    };
  };
  
  const [tiers, setTiers] = useState<TierFormData[]>(
    existingProgram?.club_stages?.map((stage: any) => ({
      id: stage.id, // Use actual UUID for existing tiers
      name: stage.name,
      discountPercentage: stage.discount_percentage.toString(),
      durationMonths: stage.duration_months.toString(),
      minPurchaseAmount: stage.min_purchase_amount.toString(),
      description: '',
      // Use fetched discount data if available, otherwise create default
      discount: stage.discountData 
        ? parseDiscount(stage.discountData)
        : createTierDiscount(stage.name, stage.discount_percentage.toString()),
      showDiscountForm: false,
    })) || [
      {
        id: 'tier-1',
        name: 'Bronze',
        discountPercentage: '10',
        durationMonths: '3',
        minPurchaseAmount: '150',
        description: 'Start your liberation journey',
        discount: createTierDiscount('Bronze', '10'),
        showDiscountForm: false,
      }
    ]
  );
  
  const [pointsPerDollar, setPointsPerDollar] = useState(
    loyaltyRules?.points_per_dollar?.toString() || '1'
  );
  const [minMembershipDays, setMinMembershipDays] = useState(
    loyaltyRules?.min_membership_days?.toString() || '365'
  );
  const [pointDollarValue, setPointDollarValue] = useState(
    loyaltyRules?.point_dollar_value?.toString() || '0.01'
  );
  const [minPointsRedemption, setMinPointsRedemption] = useState(
    loyaltyRules?.min_points_for_redemption?.toString() || '100'
  );
  
  // Collections are now handled by useCrmProvider (like products)
  
  const progressPercent = (currentStep / totalSteps) * 100;
  
  // Setup auto-resize for embedded iframe on mount
  useEffect(() => {
    setupAutoResize();
  }, []);
  
  // Notify parent of height changes when step changes
  useEffect(() => {
    scrollToTop();
    // Small delay to ensure DOM has updated
    setTimeout(() => {
      notifyParentOfHeightChange();
    }, 100);
  }, [currentStep]);
  
  // Notify when tier forms expand/collapse or tiers are added/removed
  useEffect(() => {
    notifyParentOfHeightChange();
  }, [tiers.length, tiers.map(t => t.showDiscountForm).join(',')]);
  
  // Notify when products/collections are loaded
  useEffect(() => {
    if ((crm.products && crm.products.length > 0) || (crm.collections && crm.collections.length > 0)) {
      notifyParentOfHeightChange();
    }
  }, [crm.products?.length, crm.collections?.length]);
  
  const addTier = () => {
    const newDiscount: Discount = {
      ...createDefaultDiscount(session.crmType === 'commerce7' ? 'commerce7' : 'shopify'),
      status: 'scheduled',
    };
    setTiers([...tiers, {
      id: `tier-${Date.now()}`,
      name: '',
      discountPercentage: '',
      durationMonths: '',
      minPurchaseAmount: '',
      description: '',
      discount: newDiscount,
      showDiscountForm: false,
    }]);
    // Notify parent of height change after tier is added
    setTimeout(() => {
      notifyParentOfHeightChange();
    }, 150);
  };
  
  const removeTier = (id: string) => {
    setTiers(tiers.filter(t => t.id !== id));
    // Notify parent of height change after tier is removed
    setTimeout(() => {
      notifyParentOfHeightChange();
    }, 150);
  };
  
  const updateTier = (id: string, field: keyof TierFormData, value: string) => {
    setTiers(tiers.map(t => {
      if (t.id !== id) return t;
      
      const updated = { ...t, [field]: value };
      
      // Sync tier fields with discount
      if (updated.discount) {
        if (field === 'name' && value) {
          const cleanName = value.toUpperCase().replace(/\s+/g, '');
          updated.discount.code = `${cleanName}${updated.discountPercentage || ''}`;
          updated.discount.title = `${value} Tier - ${updated.discountPercentage || 0}% Off`;
        } else if (field === 'discountPercentage' && value) {
          updated.discount.value = {
            type: 'percentage',
            percentage: parseFloat(value) || 0,
          };
          if (updated.name) {
            const cleanName = updated.name.toUpperCase().replace(/\s+/g, '');
            updated.discount.code = `${cleanName}${value}`;
            updated.discount.title = `${updated.name} Tier - ${value}% Off`;
          }
        } else if (field === 'minPurchaseAmount' && value) {
          // Update discount minimum requirement
          updated.discount.minimumRequirement = {
            type: 'amount',
            amount: Math.round(parseFloat(value) * 100), // Convert to cents
          };
        }
      }
      
      return updated;
    }));
  };
  
  const updateTierDiscount = (id: string, discount: Discount) => {
    setTiers(tiers.map(t => t.id === id ? { ...t, discount } : t));
  };
  
  const toggleDiscountForm = (id: string) => {
    setTiers(tiers.map(t => 
      t.id === id ? { ...t, showDiscountForm: !t.showDiscountForm } : t
    ));
    // Notify parent of height change after a short delay to let DOM update
    setTimeout(() => {
      notifyParentOfHeightChange();
    }, 150);
  };
  
  // Load products from platform
  const loadProducts = async (q?: string) => {
    crm.getProducts({ q, limit: 25 });
  };
  
  // Load collections from platform
  const loadCollections = async (q?: string) => {
    crm.getCollections({ q, limit: 25 });
  };
  
  // Notify parent when products finish loading
  useEffect(() => {
    if (!crm.productsLoading && crm.products) {
      setTimeout(() => {
        notifyParentOfHeightChange();
      }, 150);
    }
  }, [crm.productsLoading, crm.products]);
  
  // Notify parent when collections finish loading
  useEffect(() => {
    if (!crm.collectionsLoading && crm.collections) {
      setTimeout(() => {
        notifyParentOfHeightChange();
      }, 150);
    }
  }, [crm.collectionsLoading, crm.collections]);
  
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
      title={isEditMode ? "Edit Club Setup" : "LiberoVino Club Setup"}
      backAction={{ content: 'Cancel', onAction: () => navigate(addSessionToUrl('/app', session.id)) }}
    >
      <div style={{ paddingBottom: '80px' }}>
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
                      
                      <Divider />
                      
                      {/* Discount Configuration */}
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <BlockStack gap="100">
                            <Text variant="headingMd" as="h4">
                              Discount Settings
                            </Text>
                            {tier.discount && !tier.showDiscountForm && (
                              <Text variant="bodyMd" as="p" tone="subdued">
                                Code: <strong>{tier.discount.code || '(auto-generated)'}</strong> • 
                                {' '}{tier.discount.value?.percentage || 0}% off
                                {tier.discount.minimumRequirement?.type === 'amount' && 
                                  ` • $${((tier.discount.minimumRequirement.amount || 0) / 100).toFixed(2)} minimum`}
                              </Text>
                            )}
                          </BlockStack>
                          <Button 
                            size="slim"
                            onClick={() => toggleDiscountForm(tier.id)}
                          >
                            {tier.showDiscountForm ? 'Hide Details' : 'Configure Discount'}
                          </Button>
                        </InlineStack>
                        
                        {tier.showDiscountForm && tier.discount && (
                          <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                            <BlockStack gap="400">
                              <BlockStack gap="300">
                                <TextField
                                  label="Discount Code"
                                  value={tier.discount.code}
                                  onChange={(value) => {
                                    const updated = { ...tier.discount!, code: value.toUpperCase().replace(/\s/g, '') };
                                    updateTierDiscount(tier.id, updated);
                                  }}
                                  helpText="Code customers will use (automatically uppercase, no spaces)"
                                  autoComplete="off"
                                />
                                
                                <TextField
                                  label="Internal Title"
                                  value={tier.discount.title}
                                  onChange={(value) => {
                                    const updated = { ...tier.discount!, title: value };
                                    updateTierDiscount(tier.id, updated);
                                  }}
                                  helpText="Internal name for tracking"
                                  autoComplete="off"
                                />
                                
                                <Text variant="bodyMd" as="p" tone="subdued">
                                  <strong>Note:</strong> Discount percentage is synced with the tier discount above. 
                                  Minimum purchase requirement is also synced with tier minimum.
                                </Text>
                              </BlockStack>
                              
                              <Divider />
                              
                              {/* Product & Collection Selector */}
                              <ProductCollectionSelector
                                discount={tier.discount}
                                onUpdateDiscount={(updatedDiscount) => updateTierDiscount(tier.id, updatedDiscount)}
                                availableProducts={crm.products || []}
                                availableCollections={crm.collections || []}
                                onLoadProducts={loadProducts}
                                onLoadCollections={loadCollections}
                                isLoading={crm.productsLoading || crm.collectionsLoading}
                              />
                              
                              <Divider />
                              
                              <Banner tone="info">
                                <Text as="p">
                                  This discount will be created in your {session.crmType === 'commerce7' ? 'Commerce7' : 'Shopify'} account when you complete setup. 
                                  Customers will be added to the discount as they join this tier.
                                </Text>
                              </Banner>
                            </BlockStack>
                          </Box>
                        )}
                      </BlockStack>
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
                        {tier.discount && (
                          <>
                            <Text variant="bodySm" as="p" tone="subdued">
                              💳 Discount Code: <strong>{tier.discount.code}</strong>
                            </Text>
                            {tier.discount.appliesTo.all && (
                              <Text variant="bodySm" as="p" tone="subdued">
                                ✅ Applies to all products
                              </Text>
                            )}
                            {!tier.discount.appliesTo.all && (
                              <>
                                {tier.discount.appliesTo.products.length > 0 && (
                                  <Text variant="bodySm" as="p" tone="subdued">
                                    📦 {tier.discount.appliesTo.products.length} product(s) selected
                                  </Text>
                                )}
                                {tier.discount.appliesTo.collections.length > 0 && (
                                  <Text variant="bodySm" as="p" tone="subdued">
                                    📚 {tier.discount.appliesTo.collections.length} collection(s) selected
                                  </Text>
                                )}
                              </>
                            )}
                          </>
                        )}
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
                  <input type="hidden" name="action" value={isEditMode ? "update_setup" : "complete_setup"} />
                  <input type="hidden" name="club_name" value={clubName} />
                  <input type="hidden" name="club_description" value={clubDescription} />
                  <input type="hidden" name="tiers" value={JSON.stringify(tiers.map(t => ({
                    ...t,
                    discount: t.discount ? serializeDiscount(t.discount) : undefined
                  })))} />
                  <input type="hidden" name="points_per_dollar" value={pointsPerDollar} />
                  <input type="hidden" name="min_membership_days" value={minMembershipDays} />
                  <input type="hidden" name="point_dollar_value" value={pointDollarValue} />
                  <input type="hidden" name="min_points_redemption" value={minPointsRedemption} />
                  <Button variant="primary" submit>
                    {isEditMode ? 'Update Setup 💾' : 'Complete Setup ✨'}
                  </Button>
                </Form>
              )}
            </InlineStack>
          </Card>
        </Layout.Section>
      </Layout>
      </div>
    </Page>
  );
}

