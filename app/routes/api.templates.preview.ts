/**
 * API endpoint for previewing email templates
 * Returns rendered HTML with sample data for preview
 */

import { type LoaderFunctionArgs } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import type { TemplateType } from '~/lib/communication/template-variables';
import { 
  loadBaseTemplate, 
  renderSendGridTemplate, 
  getSampleDataForPreview,
  convertTemplateForKlaviyo,
  convertTemplateForMailchimp,
  renderTemplate
} from '~/lib/communication/templates.server';
import { getDefaultHeaderImageUrl, getDefaultFooterImageUrl, getPoweredByDarkImageUrl } from '~/lib/storage/sendgrid-images.server';

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
  const includeMarketing = url.searchParams.get('includeMarketing') === 'true';
  const providerParam = url.searchParams.get('provider')?.toLowerCase();

  if (!templateType) {
    return new Response(JSON.stringify({ error: 'Missing templateType parameter' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Get client and communication config
  const client = await db.getClient(session.clientId);
  if (!client) {
    return new Response(JSON.stringify({ error: 'Client not found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const config = await db.getCommunicationConfig(session.clientId);
  const emailProvider = config?.email_provider?.toLowerCase() || providerParam;
  
  // Determine which provider to use for preview
  // If provider param is provided, use it (for KV/MC previews)
  // Otherwise, use the client's configured provider (for SendGrid)
  const provider = providerParam || emailProvider;
  
  if (!provider || !['sendgrid', 'klaviyo', 'mailchimp'].includes(provider)) {
    return new Response(JSON.stringify({ error: 'Invalid or missing provider' }), { 
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
  
  // If includeMarketing is true, fetch showcase products and add to sample data
  if (includeMarketing && (templateType === 'monthly-status' || templateType === 'expiration-warning')) {
    const showcaseProducts = await db.getShowcaseProducts(session.clientId, { activeOnly: true, limit: 3 });
    if (showcaseProducts.length > 0) {
      // Get discount percentage from sample data for price calculations
      const discountPercentage = sampleData.current_discount_percentage ? Number(sampleData.current_discount_percentage) : 0;
      
      // Format products for marketing products block
      const formattedProducts = showcaseProducts.map(product => ({
        name: product.title,
        price: product.price ? product.price / 100 : 0, // Convert cents to dollars
        imageUrl: product.image_url,
        productUrl: product.product_url,
        description: 'A dense, mid-palate richness, complexity and a delicious finish. Dark red cherry fruit and sinfully deep mocha flavors that finish with a spicy note of black pepper.', // Sample description for preview
      }));
      sampleData.marketing_products = JSON.stringify(formattedProducts);
    }
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

  // Render template - use SendGrid renderer for all providers for preview
  // (The actual templates in zip files have provider-specific syntax)
  let html: string;
  
  if (provider === 'sendgrid') {
    // SendGrid: Use client's images and custom content
    html = await renderSendGridTemplate(
      template,
      sampleData,
      contentToUse || null,
      headerUrl,
      footerUrl,
      request.url,
      session.id
    );
  } else {
    // Klaviyo/Mailchimp: Use default images for preview
    // (Clients will edit templates themselves, so we just show a visual preview)
    const defaultHeaderUrl = await getDefaultHeaderImageUrl();
    const defaultFooterUrl = await getPoweredByDarkImageUrl();
    
    html = await renderSendGridTemplate(
      template,
      sampleData,
      null, // No custom content for KV/MC previews
      defaultHeaderUrl, // Use default header for preview
      defaultFooterUrl, // Use powered-by-dark footer
      request.url,
      session.id
    );
  }

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
    upgrade_info_block: '',
    marketing_products_block: '',
    status_body_message: '',
  };

  switch (variation) {
    case 'active-no-upgrade':
      return {
        ...baseData,
        is_extended: 'false', // Could be true or false - doesn't matter, we just care about time remaining
        expiration_formatted: 'May 23, 2026',
        current_expiration: 'May 23, 2026',
        extension_amount_needed: 150,
        extension_deadline: 'May 23, 2026',
        has_upgrade: 'false',
        current_discount_percentage: 10,
        days_remaining: 45, // More than expire threshold (e.g., 7 days)
      };
    case 'active-with-upgrade':
      return {
        ...baseData,
        is_extended: 'false', // Could be true or false - doesn't matter
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
        days_remaining: 60, // More than expire threshold
      };
    case 'expired':
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


