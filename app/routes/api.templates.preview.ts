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
  let template = '';
  const dbTemplate = await db.getCommunicationTemplate(session.clientId, mapTemplateTypeToDbType(templateType), 'email');
  if (dbTemplate?.html_body) {
    template = dbTemplate.html_body;
  } else {
    template = loadBaseTemplate(templateType);
  }

  // Get sample data
  const sampleData = getSampleDataForPreview(templateType);
  
  // Get image URLs for preview
  // Use client's images if available, otherwise use defaults
  let headerUrl: string | null = null;
  let footerUrl: string | null = null;
  
  if (templateType === 'club-signup') {
    // For welcome template, use client's header image if available, otherwise null to show text fallback
    // Footer will use powered-by-dark.png automatically via renderSendGridTemplate
    headerUrl = client.email_header_image_url || null;
    footerUrl = null; // Will use powered-by-dark.png via the render function
  } else {
    // For other templates, use client's images or defaults
    headerUrl = client.email_header_image_url || await getDefaultHeaderImageUrl();
    footerUrl = client.email_footer_image_url || await getDefaultFooterImageUrl();
  }

  // Render template with sample data
  // Pass request URL and session ID to convert localhost image URLs to proxy URLs
  const html = await renderSendGridTemplate(
    template,
    sampleData,
    customContent || null,
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

