/**
 * Template variable definitions and sample data for email templates
 * All templates use base {{variable}} syntax, which is then converted to provider-specific formats
 */

export type TemplateType = 'monthly-status' | 'expiration-warning' | 'expiration' | 'upgrade';

export interface TemplateVariable {
  key: string;
  description: string;
  sampleValue: string | number;
}

export interface TemplateVariableSet {
  templateType: TemplateType;
  variables: TemplateVariable[];
  sampleData: Record<string, string | number>;
}

/**
 * Variable syntax mapping:
 * - SendGrid: {{variable}} → {{variable}} (no change)
 * - Klaviyo: {{variable}} → {{person.variable}}
 * - Mailchimp: {{variable}} → *|UPPERCASE_TAG|* (via convertMergeTags)
 */

const MONTHLY_STATUS_VARIABLES: TemplateVariableSet = {
  templateType: 'monthly-status',
  variables: [
    { key: 'client_name', description: 'Winery/client organization name', sampleValue: 'LiberoVino Winery' },
    { key: 'customer_first_name', description: 'Customer first name', sampleValue: 'John' },
    { key: 'tier_name', description: 'Current membership tier name', sampleValue: 'Silver' },
    { key: 'status_message', description: 'Formatted status message based on days remaining', sampleValue: 'Your membership is active and valid until December 31, 2025.' },
    { key: 'tier_duration_months', description: 'Tier duration in months', sampleValue: 6 },
    { key: 'tier_min_purchase_amount', description: 'Minimum purchase amount required for tier', sampleValue: 150.00 },
    { key: 'days_remaining', description: 'Number of days until membership expires', sampleValue: 45 },
    { key: 'expiration_formatted', description: 'Formatted expiration date (e.g., "December 31, 2025")', sampleValue: 'December 31, 2025' },
    { key: 'upgrade_message', description: 'HTML block for upgrade offer (optional, empty if no upgrade available)', sampleValue: '' },
    { key: 'header_image_block', description: 'HTML block for header image (optional, empty if no image)', sampleValue: '' },
    { key: 'footer_image_block', description: 'HTML block for footer image (optional, empty if no image)', sampleValue: '' },
    { key: 'custom_content_block', description: 'HTML block for custom text content (optional, empty if no custom content)', sampleValue: '' },
  ],
  sampleData: {
    client_name: 'LiberoVino Winery',
    customer_first_name: 'John',
    tier_name: 'Silver',
    status_message: 'Your membership is active and valid until December 31, 2025.',
    tier_duration_months: 6,
    tier_min_purchase_amount: 150.00,
    days_remaining: 45,
    expiration_formatted: 'December 31, 2025',
    upgrade_message: '<div style="margin-top:24px; padding:16px; background-color:#f8f9fa; border-left:4px solid #0066cc;"><h3 style="margin-top:0; color:#0066cc;">Upgrade to Gold!</h3><p>Purchase $300.00 to unlock the Gold tier benefits.</p></div>',
    header_image_block: '<div style="width: 100%; text-align: center; margin-bottom: 20px;"><img src="https://example.com/header.png" alt="LiberoVino Winery" style="max-width: 600px; height: auto;" /></div>',
    footer_image_block: '<div style="width: 100%; text-align: center; margin-top: 40px;"><img src="https://example.com/footer.png" alt="LiberoVino Winery" style="max-width: 600px; height: auto;" /></div>',
    custom_content_block: '',
  },
};

const EXPIRATION_WARNING_VARIABLES: TemplateVariableSet = {
  templateType: 'expiration-warning',
  variables: [
    { key: 'client_name', description: 'Winery/client organization name', sampleValue: 'LiberoVino Winery' },
    { key: 'customer_first_name', description: 'Customer first name', sampleValue: 'John' },
    { key: 'tier_name', description: 'Current membership tier name', sampleValue: 'Silver' },
    { key: 'tier_min_purchase_amount', description: 'Minimum purchase amount required to renew', sampleValue: 150.00 },
    { key: 'days_remaining', description: 'Number of days until membership expires', sampleValue: 7 },
    { key: 'days_remaining_text', description: 'Formatted days remaining text (e.g., "7 days" or "1 day")', sampleValue: '7 days' },
    { key: 'expiration_formatted', description: 'Formatted expiration date (e.g., "December 31, 2025")', sampleValue: 'December 31, 2025' },
    { key: 'header_image_block', description: 'HTML block for header image (optional, empty if no image)', sampleValue: '' },
    { key: 'footer_image_block', description: 'HTML block for footer image (optional, empty if no image)', sampleValue: '' },
    { key: 'custom_content_block', description: 'HTML block for custom text content (optional, empty if no custom content)', sampleValue: '' },
  ],
  sampleData: {
    client_name: 'LiberoVino Winery',
    customer_first_name: 'John',
    tier_name: 'Silver',
    tier_min_purchase_amount: 150.00,
    days_remaining: 7,
    days_remaining_text: '7 days',
    expiration_formatted: 'December 31, 2025',
    header_image_block: '<div style="width: 100%; text-align: center; margin-bottom: 20px;"><img src="https://example.com/header.png" alt="LiberoVino Winery" style="max-width: 600px; height: auto;" /></div>',
    footer_image_block: '<div style="width: 100%; text-align: center; margin-top: 40px;"><img src="https://example.com/footer.png" alt="LiberoVino Winery" style="max-width: 600px; height: auto;" /></div>',
    custom_content_block: '',
  },
};

const EXPIRATION_VARIABLES: TemplateVariableSet = {
  templateType: 'expiration',
  variables: [
    { key: 'client_name', description: 'Winery/client organization name', sampleValue: 'LiberoVino Winery' },
    { key: 'customer_first_name', description: 'Customer first name', sampleValue: 'John' },
    { key: 'tier_name', description: 'Membership tier name that expired', sampleValue: 'Silver' },
    { key: 'tier_min_purchase_amount', description: 'Minimum purchase amount required to renew', sampleValue: 150.00 },
    { key: 'expiration_formatted', description: 'Formatted expiration date (e.g., "December 31, 2025")', sampleValue: 'December 31, 2025' },
    { key: 'header_image_block', description: 'HTML block for header image (optional, empty if no image)', sampleValue: '' },
    { key: 'footer_image_block', description: 'HTML block for footer image (optional, empty if no image)', sampleValue: '' },
    { key: 'custom_content_block', description: 'HTML block for custom text content (optional, empty if no custom content)', sampleValue: '' },
  ],
  sampleData: {
    client_name: 'LiberoVino Winery',
    customer_first_name: 'John',
    tier_name: 'Silver',
    tier_min_purchase_amount: 150.00,
    expiration_formatted: 'December 31, 2025',
    header_image_block: '<div style="width: 100%; text-align: center; margin-bottom: 20px;"><img src="https://example.com/header.png" alt="LiberoVino Winery" style="max-width: 600px; height: auto;" /></div>',
    footer_image_block: '<div style="width: 100%; text-align: center; margin-top: 40px;"><img src="https://example.com/footer.png" alt="LiberoVino Winery" style="max-width: 600px; height: auto;" /></div>',
    custom_content_block: '',
  },
};

const UPGRADE_VARIABLES: TemplateVariableSet = {
  templateType: 'upgrade',
  variables: [
    { key: 'client_name', description: 'Winery/client organization name', sampleValue: 'LiberoVino Winery' },
    { key: 'customer_first_name', description: 'Customer first name', sampleValue: 'John' },
    { key: 'old_tier_name', description: 'Previous tier name', sampleValue: 'Silver' },
    { key: 'new_tier_name', description: 'New tier name after upgrade', sampleValue: 'Gold' },
    { key: 'new_tier_duration_months', description: 'New tier duration in months', sampleValue: 12 },
    { key: 'new_tier_min_purchase_amount', description: 'New tier minimum purchase amount', sampleValue: 300.00 },
    { key: 'expiration_formatted', description: 'Formatted expiration date for new tier (e.g., "December 31, 2025")', sampleValue: 'December 31, 2025' },
    { key: 'header_image_block', description: 'HTML block for header image (optional, empty if no image)', sampleValue: '' },
    { key: 'footer_image_block', description: 'HTML block for footer image (optional, empty if no image)', sampleValue: '' },
    { key: 'custom_content_block', description: 'HTML block for custom text content (optional, empty if no custom content)', sampleValue: '' },
  ],
  sampleData: {
    client_name: 'LiberoVino Winery',
    customer_first_name: 'John',
    old_tier_name: 'Silver',
    new_tier_name: 'Gold',
    new_tier_duration_months: 12,
    new_tier_min_purchase_amount: 300.00,
    expiration_formatted: 'December 31, 2025',
    header_image_block: '<div style="width: 100%; text-align: center; margin-bottom: 20px;"><img src="https://example.com/header.png" alt="LiberoVino Winery" style="max-width: 600px; height: auto;" /></div>',
    footer_image_block: '<div style="width: 100%; text-align: center; margin-top: 40px;"><img src="https://example.com/footer.png" alt="LiberoVino Winery" style="max-width: 600px; height: auto;" /></div>',
    custom_content_block: '',
  },
};

export const TEMPLATE_VARIABLE_SETS: Record<TemplateType, TemplateVariableSet> = {
  'monthly-status': MONTHLY_STATUS_VARIABLES,
  'expiration-warning': EXPIRATION_WARNING_VARIABLES,
  'expiration': EXPIRATION_VARIABLES,
  'upgrade': UPGRADE_VARIABLES,
};

/**
 * Get template variables for a specific template type
 */
export function getTemplateVariables(templateType: TemplateType): TemplateVariable[] {
  return TEMPLATE_VARIABLE_SETS[templateType].variables;
}

/**
 * Get sample data for a specific template type
 */
export function getTemplateSampleData(templateType: TemplateType): Record<string, string | number> {
  return TEMPLATE_VARIABLE_SETS[templateType].sampleData;
}

/**
 * Convert variable syntax for different providers
 */
export function convertVariableSyntax(variable: string, provider: 'sendgrid' | 'klaviyo' | 'mailchimp'): string {
  switch (provider) {
    case 'sendgrid':
      return variable; // No change
    case 'klaviyo':
      return `person.${variable}`;
    case 'mailchimp':
      // Convert to uppercase and replace dots/underscores with underscores
      return variable.replace(/\./g, '_').replace(/\W+/g, '_').toUpperCase();
    default:
      return variable;
  }
}

