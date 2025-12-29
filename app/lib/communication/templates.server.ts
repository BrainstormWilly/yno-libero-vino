/**
 * Email Template Helper Functions
 * Handles loading, rendering, and converting email templates for different providers
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import type { TemplateType } from './template-variables';
import { getTemplateVariables as getTemplateVars, getTemplateSampleData } from './template-variables';
import { convertMergeTags } from './mailchimp-seeding.server';
import { getDefaultHeaderImageUrl, getDefaultFooterImageUrl, getPoweredByDarkImageUrl } from '~/lib/storage/sendgrid-images.server';

const TEMPLATES_BASE_PATH = join(process.cwd(), 'public', 'templates', 'emails', 'base');

/**
 * Load base template from file system
 * @param templateType - Template type (e.g., 'monthly-status') or template file name (e.g., 'welcome')
 */
export function loadBaseTemplate(templateType: TemplateType | string): string {
  const templateFileName = `${templateType}.html`;
  const templatePath = join(TEMPLATES_BASE_PATH, templateFileName);
  
  try {
    return readFileSync(templatePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to load template ${templateType}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Render template with simple string replacement for {{variable}} syntax
 * Handles optional blocks by replacing them with empty string if value is empty/null
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  let rendered = template;
  
  // Replace all {{variable}} placeholders
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    const replacement = value != null ? String(value) : '';
    rendered = rendered.replace(placeholder, replacement);
  }
  
  return rendered;
}

/**
 * Render SendGrid template with variables, custom content, and image URLs
 * @param templateOrType - Either a template string (from DB) or template type (to load base template)
 */
/**
 * Convert localhost image URLs to proxy URLs to avoid CORS issues
 */
function convertImageUrlToProxy(imageUrl: string | null | undefined, requestUrl?: string, sessionId?: string): string | null {
  if (!imageUrl) return null;
  
  // Check if URL is localhost (development/local Supabase)
  if (imageUrl.includes('127.0.0.1') || imageUrl.includes('localhost')) {
    // Extract base URL from request if available
    let baseUrl = 'http://localhost:3000';
    if (requestUrl) {
      try {
        const url = new URL(requestUrl);
        baseUrl = `${url.protocol}//${url.host}`;
      } catch (e) {
        // Fallback to default
      }
    }
    
    // Build proxy URL with session if available
    const proxyUrl = sessionId 
      ? `${baseUrl}/api/images/proxy?session=${sessionId}&url=${encodeURIComponent(imageUrl)}`
      : `${baseUrl}/api/images/proxy?url=${encodeURIComponent(imageUrl)}`;
    
    return proxyUrl;
  }
  
  return imageUrl;
}

export async function renderSendGridTemplate(
  templateOrType: TemplateType | string,
  variables: Record<string, string | number>,
  customContent: string | null | undefined,
  headerUrl: string | null | undefined,
  footerUrl: string | null | undefined,
  requestUrl?: string,
  sessionId?: string
): Promise<string> {
  // Load template - if it's a string, use it directly (from DB), otherwise load from file
  const template = typeof templateOrType === 'string' && templateOrType.includes('<!doctype html>')
    ? templateOrType
    : loadBaseTemplate(templateOrType as TemplateType);
  
  // Check if template uses new header_block pattern (conditional header image/text)
  const usesHeaderBlock = template.includes('{{header_block}}');
  const usesNewTemplateFormat = usesHeaderBlock && template.includes('{{footer_image_block}}');
  
  // Convert image URLs to proxy URLs if needed (for CORS)
  const proxiedHeaderUrl = convertImageUrlToProxy(headerUrl, requestUrl, sessionId);
  const proxiedFooterUrl = convertImageUrlToProxy(footerUrl, requestUrl, sessionId);
  
  // Build header block - conditional image or text fallback
  let headerBlock = '';
  if (usesHeaderBlock) {
    if (proxiedHeaderUrl) {
      headerBlock = `<div style="width: 100%; max-width: 600px; margin: 0 auto;"><img src="${proxiedHeaderUrl}" alt="${variables.client_name || 'Winery'}" style="max-width: 600px; width: 100%; height: auto; display: block;" /></div>`;
    } else {
      // Fallback to client name text
      headerBlock = `<div style="width: 100%; max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center; background-color: #ffffff;"><h1 style="margin: 0; font-family: 'Brush Script MT', 'Lucida Handwriting', cursive; font-size: 48px; font-weight: normal; color: #202124;">${variables.client_name || 'Winery'}</h1></div>`;
    }
  } else {
    // Legacy header_image_block behavior
    headerBlock = proxiedHeaderUrl
      ? `<div style="width: 100%; text-align: center; margin-bottom: 20px;"><img src="${proxiedHeaderUrl}" alt="${variables.client_name || 'Winery'}" style="max-width: 600px; height: auto;" /></div>`
      : '';
  }
  
  // Build footer image block
  let footerImageBlock = '';
  if (usesNewTemplateFormat) {
    // Use powered-by-dark.png for club-signup template format
    const poweredByUrl = await getPoweredByDarkImageUrl();
    const proxiedPoweredByUrl = convertImageUrlToProxy(poweredByUrl, requestUrl, sessionId);
    footerImageBlock = `<div style="width: 100%; text-align: center; margin-top: 40px;"><img src="${proxiedPoweredByUrl}" alt="Powered by LiberoVino" style="width: 600px; height: 80px; display: block; margin: 0 auto;" /></div>`;
  } else if (proxiedFooterUrl) {
    footerImageBlock = `<div style="width: 100%; text-align: center; margin-top: 40px;"><img src="${proxiedFooterUrl}" alt="${variables.client_name || 'Winery'}" style="max-width: 600px; height: auto;" /></div>`;
  }
  
  // Build custom content block
  const customContentBlock = customContent
    ? `<div style="margin: 20px 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;"><p style="margin: 0; font-size: 16px; line-height: 1.6; color: #202124;">${escapeHtml(customContent)}</p></div>`
    : '';
  
  // Remove Klaviyo-specific placeholders (not used in SendGrid) before rendering
  const processedTemplate = template
    .replace('{{highlight_content}}', '')
    .replace('{{secondary_content}}', '');
  
  // Add blocks to variables
  const allVariables = {
    ...variables,
    header_block: headerBlock,
    header_image_block: headerBlock, // Keep for backward compatibility
    footer_image_block: footerImageBlock,
    custom_content_block: customContentBlock,
  };
  
  return renderTemplate(processedTemplate, allVariables);
}

/**
 * Convert template from base {{variable}} syntax to Klaviyo {{person.variable}} format
 */
export function convertTemplateForKlaviyo(html: string): string {
  // Replace {{variable}} with {{person.variable}}
  // Handle special blocks that shouldn't be converted
  return html.replace(/\{\{([a-z_]+)\}\}/g, (match, variable) => {
    // Skip conversion for special blocks (they'll be handled differently)
    if (variable.includes('_block') || variable.includes('_message')) {
      return match;
    }
    return `{{person.${variable}}}`;
  });
}

/**
 * Convert template from base {{variable}} syntax to Mailchimp *|TAG|* format
 * Uses the existing convertMergeTags function from mailchimp-seeding
 */
export function convertTemplateForMailchimp(html: string): string {
  // Use the existing convertMergeTags function
  return convertMergeTags(html);
}

/**
 * Get template variables for a template type
 */
export function getTemplateVariables(templateType: TemplateType) {
  return getTemplateVars(templateType);
}

/**
 * Generate downloadable template for Klaviyo or Mailchimp
 */
export async function downloadTemplateForProvider(
  templateType: TemplateType,
  provider: 'klaviyo' | 'mailchimp'
): Promise<string> {
  let template = loadBaseTemplate(templateType);
  
  // Get default image URLs
  const headerUrl = await getDefaultHeaderImageUrl();
  const footerUrl = await getDefaultFooterImageUrl();
  const clientName = 'Your Winery'; // Generic placeholder
  
  // Build image blocks with actual URLs
  const headerImageBlock = `<div style="width: 100%; text-align: center; margin-bottom: 20px;"><img src="${headerUrl}" alt="${clientName}" style="max-width: 600px; height: auto;" /></div>`;
  const footerImageBlock = `<div style="width: 100%; text-align: center; margin-top: 40px;"><img src="${footerUrl}" alt="${clientName}" style="max-width: 600px; height: auto;" /></div>`;
  
  // Replace image blocks with actual URLs
  template = template.replace('{{header_image_block}}', headerImageBlock);
  template = template.replace('{{footer_image_block}}', footerImageBlock);
  template = template.replace('{{custom_content_block}}', '');
  
  // Convert variable syntax based on provider
  if (provider === 'klaviyo') {
    template = convertTemplateForKlaviyo(template);
  } else if (provider === 'mailchimp') {
    template = convertTemplateForMailchimp(template);
  }
  
  return template;
}

/**
 * Escape HTML to prevent injection (for custom content)
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Build upgrade message HTML block for monthly status template
 */
export function buildUpgradeMessage(nextTier: { name: string; minPurchaseAmount: number } | null): string {
  if (!nextTier) {
    return '';
  }
  
  return `<div style="margin-top:24px; padding:16px; background-color:#f8f9fa; border-left:4px solid #0066cc;">
    <h3 style="margin-top:0; color:#0066cc;">Upgrade to ${nextTier.name}!</h3>
    <p>Purchase $${nextTier.minPurchaseAmount.toFixed(2)} to unlock the ${nextTier.name} tier benefits.</p>
  </div>`;
}

/**
 * Get sample data for preview
 */
export function getSampleDataForPreview(templateType: TemplateType): Record<string, string | number> {
  return getTemplateSampleData(templateType);
}

