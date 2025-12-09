/**
 * CRM Sync Queue Processing API Endpoint
 * 
 * Called by pg_net from the database cron job to process CRM sync queue items
 * This endpoint handles the actual CRM API calls (has access to env vars)
 */

import { type ActionFunctionArgs } from 'react-router';
import { getSupabaseClient } from '~/lib/db/supabase.server';
import { crmManager } from '~/lib/crm';
import { sendExpirationNotification, sendUpgradeNotification } from '~/lib/communication/membership-communications.server';

export async function action({ request }: ActionFunctionArgs) {
  // Verify this is coming from our internal system (pg_net)
  // In production, add authentication/authorization here
  const userAgent = request.headers.get('User-Agent');
  if (userAgent !== 'pg_net-cron-processor') {
    // For now, allow any request - but log a warning
    console.warn('⚠️  CRM sync endpoint called without expected User-Agent header');
  }

  try {
    const body = await request.json() as {
      queueId: string;
      clientId: string;
      actionType: 'cancel_membership' | 'upgrade_membership'; // Only cancellations and upgrades are queued
      crmType: 'commerce7' | 'shopify';
      tenantShop: string;
      stageId: string;
      clubId: string | null; // Commerce7 club ID (nullable for Shopify)
      membershipId?: string | null; // Commerce7 membership ID for cancellations
      customerCrmId: string;
      oldStageId?: string;
      oldClubId?: string | null;
    };

    // DEBUG: Log incoming request
    console.log('🔍 CRM Sync Request Body:', JSON.stringify(body, null, 2));
    console.log('🔍 Field Check:', {
      queueId: !!body.queueId,
      clientId: !!body.clientId,
      actionType: !!body.actionType,
      crmType: !!body.crmType,
      tenantShop: !!body.tenantShop,
      customerCrmId: !!body.customerCrmId,
    });

    const { queueId, clientId, actionType, crmType, tenantShop, stageId, clubId, membershipId, customerCrmId, oldStageId, oldClubId } = body;

    // Validate required fields
    if (!queueId || !clientId || !actionType || !crmType || !tenantShop || !customerCrmId) {
      console.error('❌ Missing required fields:', {
        queueId: !!queueId,
        clientId: !!clientId,
        actionType: !!actionType,
        crmType: !!crmType,
        tenantShop: !!tenantShop,
        customerCrmId: !!customerCrmId,
      });
      return {
        success: false,
        error: 'Missing required fields',
      };
    }

    // Validate CRM-specific requirements
    if (crmType === 'commerce7' && !clubId && actionType === 'upgrade_membership') {
      return {
        success: false,
        error: 'Commerce7 requires clubId for upgrade_membership operations',
      };
    }
    
    // For cancel_membership, we need either membershipId (preferred) or clubId for Commerce7
    if (crmType === 'commerce7' && actionType === 'cancel_membership' && !membershipId && !clubId) {
      return {
        success: false,
        error: 'Commerce7 cancel_membership requires either membershipId or clubId',
      };
    }

    // Get CRM provider
    // For Commerce7, we don't need accessToken
    // For Shopify, we'd need to get it from platform_sessions
    let provider;
    if (crmType === 'commerce7') {
      provider = crmManager.getProvider('commerce7', tenantShop);
    } else if (crmType === 'shopify') {
      // Get access token from platform_sessions
      const supabase = getSupabaseClient();
      const { data: session } = await supabase
        .from('platform_sessions')
        .select('access_token')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!session?.access_token) {
        return {
          success: false,
          error: 'No access token found for Shopify client',
        };
      }

      provider = crmManager.getProvider('shopify', tenantShop, session.access_token);
    } else {
      return {
        success: false,
        error: `Unknown CRM type: ${crmType}`,
      };
    }

    // Execute the sync action
    try {
      switch (actionType) {
        case 'cancel_membership':
          // Commerce7: Cancel membership using membershipId if available, otherwise use clubId
          // Shopify: Remove customer from promotions
          await provider.cancelTierMembership(stageId, clubId, customerCrmId, membershipId);
          
          // Send expiration notification after successful cancellation
          await sendExpirationNotification(clientId, customerCrmId, stageId);
          break;

        case 'upgrade_membership':
          if (!oldStageId) {
            return {
              success: false,
              error: 'Old stage ID required for upgrade_membership action',
            };
          }

          // Cancel old tier membership (oldClubId is nullable for Shopify)
          await provider.cancelTierMembership(oldStageId, oldClubId || null, customerCrmId);
          
          // Add new tier membership
          // Note: For Commerce7, we'll need to get addresses/payment from the enrollment
          // For now, this will need to be implemented
          await provider.addTierMembership(stageId, clubId, customerCrmId);
          
          // Send upgrade notification after successful CRM sync (consistent with cancellation flow)
          await sendUpgradeNotification(clientId, customerCrmId, oldStageId, stageId);
          break;

        default:
          return {
            success: false,
            error: `Unknown action type: ${actionType}. Only cancel_membership and upgrade_membership are queued.`,
          };
      }

      return {
        success: true,
        message: `Successfully processed ${actionType} for customer ${customerCrmId}`,
      };
    } catch (crmError) {
      const errorMessage = crmError instanceof Error ? crmError.message : String(crmError);
      console.error(`CRM API error for queue item ${queueId}:`, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  } catch (error) {
    console.error('Error processing CRM sync request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process sync request',
    };
  }
}

