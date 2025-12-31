/**
 * API endpoint for previewing email templates
 * Returns rendered HTML with sample data for preview
 */

import { type LoaderFunctionArgs } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import type { TemplateType } from '~/lib/communication/template-variables';
import { loadBaseTemplate, renderSendGridTemplate, getSampleDataForPreview } from '~/lib/communication/templates.server';
import { getDefaultHeaderImageUrl, getDefaultFooterImageUrl } from '~/lib/storage/sendgrid-images.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const templateType = url.searchParams.get('templateType') as TemplateType | null;
  const customContent = url.searchParams.get('customContent');
  const variation = url.searchParams.get('variation');

  if (!templateType) {
    return new Response(JSON.stringify({ error: 'Missing templateType parameter' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get client and check if they use SendGrid
  const client = await db.getClient(session.clientId);
  if (!client) {
    return new Response(JSON.stringify({ error: 'Client not found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const config = await db.getCommunicationConfig(session.clientId);
  if (config?.email_provider?.toLowerCase() !== 'sendgrid') {
    return new Response(JSON.stringify({ error: 'Preview only available for LiberoVino managed clients' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Load template from DB or base file
  // For expiring-soon variation, use expiration-warning template but check monthly-status custom content
  let template = '';
  let dbTemplateType = templateType;
  if (templateType === 'expiration-warning' && variation === 'expiring-soon') {
    // Use expiration-warning template, but also check for monthly-status custom content
    dbTemplateType = 'expiration-warning';
  }
  const dbTemplate = await db.getCommunicationTemplate(session.clientId, mapTemplateTypeToDbType(dbTemplateType), 'email');
  if (dbTemplate?.html_body) {
    template = dbTemplate.html_body;
  } else {
    template = loadBaseTemplate(templateType);
  }

  // Get sample data - use variation-specific data for monthly-status
  let sampleData = getSampleDataForPreview(templateType);
  if (templateType === 'monthly-status' && variation) {
    sampleData = getMonthlyStatusVariationData(variation);
  } else if (templateType === 'expiration-warning' && variation === 'expiring-soon') {
    sampleData = getExpiringSoonData();
  }
  
  // Get image URLs for preview
  // Use client's images if available, otherwise use defaults
  let headerUrl: string | null = null;
  let footerUrl: string | null = null;
  
  if (templateType === 'club-signup' || templateType === 'monthly-status' || templateType === 'expiration-warning' || templateType === 'upgrade' || templateType === 'expiration') {
    // For club-signup, monthly-status, expiration-warning, upgrade, and expiration templates, use client's header image if available, otherwise null to show text fallback
    // Footer will use powered-by-dark.png automatically via renderSendGridTemplate
    headerUrl = client.email_header_image_url || null;
    footerUrl = null; // Will use powered-by-dark.png via the render function
  } else {
    // For other templates, use client's images or defaults
    headerUrl = client.email_header_image_url || await getDefaultHeaderImageUrl();
    footerUrl = client.email_footer_image_url || await getDefaultFooterImageUrl();
  }

  // For expiring-soon variation, use monthly-status custom content if available
  let contentToUse = customContent;
  if (templateType === 'expiration-warning' && variation === 'expiring-soon') {
    if (!customContent) {
      // Check if there's custom content saved for monthly-status template
      const monthlyStatusTemplate = await db.getCommunicationTemplate(session.clientId, 'monthly_status', 'email');
      contentToUse = monthlyStatusTemplate?.custom_content || null;
    }
  }

  // Render template with sample data
  // Pass request URL and session ID to convert localhost image URLs to proxy URLs
  const html = await renderSendGridTemplate(
    template,
    sampleData,
    contentToUse || null,
    headerUrl,
    footerUrl,
    request.url,
    session.id
  );

  return { html };
}

/**
 * Map template type to database template type
 */
function mapTemplateTypeToDbType(templateType: TemplateType): string {
  const mapping: Record<TemplateType, string> = {
    'monthly-status': 'monthly_status',
    'expiration-warning': 'expiration_warning',
    'expiration': 'expiration',
    'upgrade': 'upgrade_available',
    'club-signup': 'welcome',
  };
  return mapping[templateType];
}

/**
 * Get variation-specific sample data for monthly-status template
 */
function getMonthlyStatusVariationData(variation: string): Record<string, string | number> {
  const baseData = {
    client_name: 'Liberty Wines',
    customer_first_name: 'John',
    shop_url: 'https://example.com/shop',
    header_block: '',
    footer_image_block: '',
    custom_content_block: '',
    extension_status_block: '',
    upgrade_offer_block: '',
    marketing_products_block: '',
    status_body_message: '',
  };

  switch (variation) {
    case 'not-extended':
      return {
        ...baseData,
        is_extended: 'false',
        expiration_formatted: 'May 23, 2026',
        current_expiration: 'May 23, 2026',
        extension_amount_needed: 150,
        extension_deadline: 'May 23, 2026',
        has_upgrade: 'false',
        current_discount_percentage: 10,
        days_remaining: 45,
      };
    case 'extended-no-upgrade':
      return {
        ...baseData,
        is_extended: 'true',
        expiration_formatted: 'Aug 23, 2026',
        current_expiration: 'May 23, 2026',
        extension_amount_needed: 150,
        extension_deadline: 'May 23, 2026',
        has_upgrade: 'false',
        current_discount_percentage: 10,
        days_remaining: 90,
      };
    case 'extended-upgradable':
      return {
        ...baseData,
        is_extended: 'true',
        expiration_formatted: 'Jun 23, 2026',
        current_expiration: 'May 23, 2026',
        extension_amount_needed: 150,
        extension_deadline: 'May 23, 2026',
        has_upgrade: 'true',
        upgrade_amount_needed: 608,
        upgrade_deadline: 'May 23, 2026',
        upgrade_discount_percentage: 15,
        upgrade_expiration: 'Oct 23, 2026',
        current_discount_percentage: 10,
        days_remaining: 60,
      };
    case 'post-expired':
      return {
        ...baseData,
        is_extended: 'false',
        is_expired: 'true',
        expiration_formatted: 'May 23, 2025',
        current_expiration: 'May 23, 2025',
        elapsed_time: '2 months',
        rejoin_amount: 150,
        discount_percentage: 10,
        duration_months: 3,
        has_upgrade: 'false',
        current_discount_percentage: 10,
        days_remaining: 0,
      };
    default:
      return baseData;
  }
}

/**
 * Get sample data for expiring soon variation (uses expiration-warning template)
 */
function getExpiringSoonData(): Record<string, string | number> {
  return {
    client_name: 'Liberty Wines',
    customer_first_name: 'John',
    days: 7,
    extension_amount: 150,
    discount_percentage: 10,
    extension_expiration: 'Oct 23, 2026',
    extension_months: 3,
    upgrade_amount: 500,
    upgrade_discount_percentage: 15,
    upgrade_months: 6,
    shop_url: 'https://example.com/shop',
    header_block: '',
    footer_image_block: '',
    custom_content_block: '',
    upgrade_message_block: '',
  };
}


