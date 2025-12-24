/**
 * API endpoint for downloading email templates for Klaviyo/Mailchimp
 * Returns HTML file with provider-specific variable syntax
 */

import { type LoaderFunctionArgs } from 'react-router';
import { getAppSession } from '~/lib/sessions.server';
import type { TemplateType } from '~/lib/communication/template-variables';
import { downloadTemplateForProvider } from '~/lib/communication/templates.server';

const VALID_TEMPLATE_TYPES: TemplateType[] = ['monthly-status', 'expiration-warning', 'expiration', 'upgrade'];
const VALID_PROVIDERS = ['klaviyo', 'mailchimp'] as const;

export async function loader({ request, params }: LoaderFunctionArgs) {
  const session = await getAppSession(request);
  if (!session) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const templateType = params.templateType as TemplateType;
  if (!VALID_TEMPLATE_TYPES.includes(templateType)) {
    throw new Response('Invalid template type', { status: 400 });
  }

  const url = new URL(request.url);
  const provider = url.searchParams.get('provider');
  
  if (!provider || !VALID_PROVIDERS.includes(provider as any)) {
    throw new Response('Invalid provider. Must be klaviyo or mailchimp', { status: 400 });
  }

  try {
    const html = await downloadTemplateForProvider(
      templateType,
      provider as 'klaviyo' | 'mailchimp'
    );

    const templateName = templateType.replace('-', '_');
    const filename = `liberovino_${templateName}_${provider}.html`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error generating template download:', error);
    throw new Response('Failed to generate template', { status: 500 });
  }
}

