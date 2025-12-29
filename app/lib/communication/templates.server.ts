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
  const isMonthlyStatus = template.includes('{{extension_status_block}}');
  
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
  if (usesNewTemplateFormat || isMonthlyStatus) {
    // Use powered-by-dark.png for club-signup and monthly-status template formats
    const poweredByUrl = await getPoweredByDarkImageUrl();
    const proxiedPoweredByUrl = convertImageUrlToProxy(poweredByUrl, requestUrl, sessionId);
    footerImageBlock = `<div style="max-width: 600px; margin: 0 auto; padding: 0;"><img src="${proxiedPoweredByUrl}" alt="Powered by LiberoVino" style="width: 600px; height: 80px; display: block; margin: 0 auto;" /></div>`;
  } else if (proxiedFooterUrl) {
    footerImageBlock = `<div style="width: 100%; text-align: center; margin-top: 40px;"><img src="${proxiedFooterUrl}" alt="${variables.client_name || 'Winery'}" style="max-width: 600px; height: auto;" /></div>`;
  }
  
  // Build custom content block
  const customContentBlock = customContent
    ? `<div style="margin: 20px 0; padding: 16px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;"><p style="margin: 0; font-size: 16px; line-height: 1.6; color: #202124;">${escapeHtml(customContent)}</p></div>`
    : '';
  
  // Check if this is a monthly-status template and build conditional blocks
  let extensionStatusBlock = '';
  let upgradeOfferBlock = '';
  let marketingProductsBlock = '';
  let statusBodyMessage = '';
  
  if (isMonthlyStatus) {
    // Build extension status block
    const isExtended = variables.is_extended === 'true' || variables.is_extended === 1 || variables.is_extended === '1';
    extensionStatusBlock = buildExtensionStatusBlock(
      isExtended,
      String(variables.client_name || 'Winery'),
      String(variables.expiration_formatted || ''),
      variables.extension_amount_needed ? Number(variables.extension_amount_needed) : undefined,
      variables.current_expiration ? String(variables.current_expiration) : undefined
    );
    
    // Build upgrade offer block (only if upgrade is available)
    const hasUpgrade = variables.has_upgrade === 'true' || variables.has_upgrade === 1 || variables.has_upgrade === '1';
    if (hasUpgrade && variables.upgrade_amount_needed && variables.upgrade_deadline && variables.upgrade_discount_percentage && variables.upgrade_expiration) {
      upgradeOfferBlock = buildUpgradeOfferBlock(
        Number(variables.upgrade_amount_needed),
        String(variables.upgrade_deadline),
        Number(variables.upgrade_discount_percentage),
        String(variables.upgrade_expiration)
      );
    }
    
    // Build marketing products block (if products provided)
    if (variables.marketing_products) {
      try {
        const products = typeof variables.marketing_products === 'string' 
          ? JSON.parse(variables.marketing_products) 
          : variables.marketing_products;
        marketingProductsBlock = buildMarketingProductsBlock(products);
      } catch (e) {
        // If parsing fails, skip products block
      }
    }
    
    // Build status body message
    statusBodyMessage = buildStatusBodyMessage(
      isExtended,
      hasUpgrade,
      variables.days_remaining ? Number(variables.days_remaining) : 0,
      variables.current_discount_percentage ? Number(variables.current_discount_percentage) : 0,
      variables.extension_amount_needed ? Number(variables.extension_amount_needed) : undefined,
      variables.extension_deadline ? String(variables.extension_deadline) : undefined
    );
  }
  
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
    extension_status_block: extensionStatusBlock,
    upgrade_offer_block: upgradeOfferBlock,
    marketing_products_block: marketingProductsBlock,
    status_body_message: statusBodyMessage,
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
 * Build extension status block for monthly status template
 * Shows different messages based on whether customer has extended or not
 */
function buildExtensionStatusBlock(
  isExtended: boolean,
  clientName: string,
  expirationFormatted: string,
  extensionAmountNeeded?: number,
  currentExpiration?: string
): string {
  const safeClientName = escapeHtml(clientName);
  const safeExpiration = escapeHtml(expirationFormatted);
  
  if (isExtended) {
    return `<h2 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold; color: #202124; text-align: center;">Way to go!</h2>
      <h3 style="margin: 0; font-size: 20px; font-weight: bold; color: #202124; text-align: center;">You&apos;ve extended your ${safeClientName} benefits until</h3>
      <h3 style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #202124; text-align: center;">${safeExpiration}</h3>`;
  } else {
    const amountText = extensionAmountNeeded ? `$${extensionAmountNeeded}` : 'the minimum amount';
    const expirationText = escapeHtml(currentExpiration || expirationFormatted);
    return `<h2 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold; color: #202124; text-align: center;">Don&apos;t miss out!</h2>
      <h3 style="margin: 0; font-size: 20px; font-weight: bold; color: #202124; text-align: center;">Extend your ${safeClientName} benefits by spending ${amountText}</h3>
      <h3 style="margin: 10px 0 0 0; font-size: 20px; font-weight: bold; color: #202124; text-align: center;">before ${expirationText}</h3>`;
  }
}

/**
 * Build upgrade offer block for monthly status template
 * Black box with white border showing upgrade opportunity
 */
function buildUpgradeOfferBlock(
  upgradeAmountNeeded: number,
  upgradeDeadline: string,
  upgradeDiscountPercentage: number,
  upgradeExpiration: string
): string {
  const safeDeadline = escapeHtml(upgradeDeadline);
  const safeExpiration = escapeHtml(upgradeExpiration);
  
  return `<div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #000000; border: 1px solid #ffffff;">
    <div style="height: 100%; width: 100%; border: 2px solid #ffffff; border-radius: 8px;">
      <div style="padding: 40px 10px;">
        <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold; color: #ffffff; text-align: center;">But wait. Spend</p>
        <p style="margin: 0; font-size: 64px; font-weight: bold; color: #ffffff; text-align: center; line-height: 1.2;">$${upgradeAmountNeeded}</p>
        <p style="margin: 20px 0 10px 0; font-size: 16px; color: #ffffff; text-align: center;">by</p>
        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #ffffff; text-align: center;">${safeDeadline}</p>
        <p style="margin: 20px 0 10px 0; font-size: 16px; color: #ffffff; text-align: center;">and upgrade your benefits to</p>
        <p style="margin: 0; font-size: 64px; font-weight: bold; color: #ffffff; text-align: center; line-height: 1.2;">${upgradeDiscountPercentage}% off</p>
        <p style="margin: 20px 0 10px 0; font-size: 16px; color: #ffffff; text-align: center;">off the store until</p>
        <p style="margin: 0; font-size: 32px; font-weight: bold; color: #ffffff; text-align: center;">${safeExpiration}</p>
      </div>
    </div>
  </div>`;
}

/**
 * Build marketing products block for monthly status template
 * Shows product suggestions if provided
 */
function buildMarketingProductsBlock(products?: Array<{ name: string; price: number; imageUrl: string; productUrl?: string }>): string {
  if (!products || products.length === 0) {
    return '';
  }
  
  const productItems = products.map(product => {
    const productLink = product.productUrl || '#';
    const priceText = `$${product.price.toFixed(2)}`;
    
    return `<div style="margin: 20px 0; padding: 16px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <div style="display: table; width: 100%;">
        <div style="display: table-cell; width: 120px; vertical-align: top; padding-right: 16px;">
          <a href="${productLink}" style="display: block;">
            <img src="${product.imageUrl}" alt="${escapeHtml(product.name)}" style="max-width: 120px; width: 100%; height: auto; border-radius: 4px;" />
          </a>
        </div>
        <div style="display: table-cell; vertical-align: top;">
          <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: bold; color: #202124;">
            <a href="${productLink}" style="color: #202124; text-decoration: none;">${escapeHtml(product.name)}</a>
          </h3>
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: #0066cc;">${priceText}</p>
        </div>
      </div>
    </div>`;
  }).join('');
  
  return `<div style="margin: 30px 0;">
    <h2 style="margin: 0 0 20px 0; font-size: 24px; font-weight: bold; color: #202124;">Featured Wines</h2>
    ${productItems}
  </div>`;
}

/**
 * Build status body message for monthly status template
 * Dynamic message based on extension and upgrade status
 */
function buildStatusBodyMessage(
  isExtended: boolean,
  hasUpgrade: boolean,
  daysRemaining: number,
  discountPercentage: number,
  extensionAmountNeeded?: number,
  extensionDeadline?: string
): string {
  const safeDeadline = extensionDeadline ? escapeHtml(extensionDeadline) : '';
  
  if (isExtended && hasUpgrade) {
    return `This is your monthly reminder of your ${discountPercentage}% off discount. You still have ${daysRemaining} days remaining on your current benefits.`;
  } else if (isExtended && !hasUpgrade) {
    return `This is your monthly reminder of your ${discountPercentage}% off discount. You still have ${daysRemaining} days to enjoy your current benefits.`;
  } else {
    const amountText = extensionAmountNeeded ? `$${extensionAmountNeeded}` : 'the minimum amount';
    const deadlineText = extensionDeadline ? `by ${safeDeadline}` : 'before your benefits expire';
    return `This is your monthly reminder of your ${discountPercentage}% off discount. You still have ${daysRemaining} days to extend your discount by spending at least ${amountText} ${deadlineText}.`;
  }
}

/**
 * Build upgrade message HTML block for monthly status template (legacy)
 * @deprecated Use buildUpgradeOfferBlock instead
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

