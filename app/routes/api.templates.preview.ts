/**
 * API endpoint for previewing email templates
 * Returns rendered HTML with sample data for preview
 */

import { type LoaderFunctionArgs, json } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import * as db from '~/lib/db/supabase.server';
import type { TemplateType } from '~/lib/communication/template-variables';
import { loadBaseTemplate, renderSendGridTemplate, getSampleDataForPreview } from '~/lib/communication/templates.server';
import { getDefaultHeaderImageUrl, getDefaultFooterImageUrl } from '~/lib/storage/sendgrid-images.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const templateType = url.searchParams.get('templateType') as TemplateType | null;
  const customContent = url.searchParams.get('customContent');

  if (!templateType) {
    throw new Response('Missing templateType parameter', { status: 400 });
  }

  // Get client and check if they use SendGrid
  const client = await db.getClient(session.clientId);
  if (!client) {
    throw new Response('Client not found', { status: 404 });
  }

  const config = await db.getCommunicationConfig(session.clientId);
  if (config?.email_provider?.toLowerCase() !== 'sendgrid') {
    throw new Response('Preview only available for SendGrid clients', { status: 400 });
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
  
  // Get default image URLs for preview
  const headerUrl = await getDefaultHeaderImageUrl();
  const footerUrl = await getDefaultFooterImageUrl();

  // Render template with sample data
  const html = await renderSendGridTemplate(
    template,
    sampleData,
    customContent || null,
    headerUrl,
    footerUrl
  );

  return json({ html });
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
  };
  return mapping[templateType];
}

