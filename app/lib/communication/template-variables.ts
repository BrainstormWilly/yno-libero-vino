/**
 * Template variable definitions and sample data for email templates
 * All templates use base {{variable}} syntax, which is then converted to provider-specific formats
 */

export type TemplateType = 'monthly-status' | 'expiration-warning' | 'expiration' | 'upgrade' | 'club-signup';

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
    { key: 'client_name', description: 'Winery/client organization name', sampleValue: 'Liberty Wines' },
    { key: 'customer_first_name', description: 'Customer first name', sampleValue: 'John' },
    { key: 'is_extended', description: 'Whether customer has extended benefits (true/false)', sampleValue: 'true' },
    { key: 'expiration_formatted', description: 'Formatted expiration date (e.g., "Jun 23, 2026")', sampleValue: 'Jun 23, 2026' },
    { key: 'current_expiration', description: 'Current expiration date if not extended (e.g., "May 23, 2026")', sampleValue: 'May 23, 2026' },
    { key: 'extension_amount_needed', description: 'Amount needed to extend benefits', sampleValue: 150 },
    { key: 'extension_deadline', description: 'Deadline to extend benefits (if not extended)', sampleValue: 'May 23, 2026' },
    { key: 'has_upgrade', description: 'Whether upgrade is available (true/false)', sampleValue: 'true' },
    { key: 'upgrade_amount_needed', description: 'Amount needed to upgrade (e.g., 608)', sampleValue: 608 },
    { key: 'upgrade_deadline', description: 'Deadline to upgrade (e.g., "May 23, 2026")', sampleValue: 'May 23, 2026' },
    { key: 'upgrade_discount_percentage', description: 'Discount percentage for upgrade tier', sampleValue: 15 },
    { key: 'upgrade_expiration', description: 'Expiration date if upgraded (e.g., "Oct 23, 2026")', sampleValue: 'Oct 23, 2026' },
    { key: 'current_discount_percentage', description: 'Current discount percentage', sampleValue: 10 },
    { key: 'days_remaining', description: 'Number of days remaining', sampleValue: 60 },
    { key: 'shop_url', description: 'URL to the winery shop', sampleValue: 'https://example.com/shop' },
    { key: 'marketing_products', description: 'JSON array of product suggestions (optional)', sampleValue: '[]' },
    { key: 'header_block', description: 'HTML block for header (image or client name text fallback)', sampleValue: '' },
    { key: 'footer_image_block', description: 'HTML block for powered-by footer image', sampleValue: '' },
    { key: 'custom_content_block', description: 'HTML block for custom text content (optional)', sampleValue: '' },
    { key: 'extension_status_block', description: 'HTML block for extension status (built automatically)', sampleValue: '' },
    { key: 'upgrade_offer_block', description: 'HTML block for upgrade offer (built automatically, empty if no upgrade)', sampleValue: '' },
    { key: 'marketing_products_block', description: 'HTML block for product suggestions (built automatically, empty if no products)', sampleValue: '' },
    { key: 'status_body_message', description: 'Dynamic status body message (built automatically)', sampleValue: '' },
  ],
  sampleData: {
    client_name: 'Liberty Wines',
    customer_first_name: 'John',
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
    shop_url: 'https://example.com/shop',
    marketing_products: '[]',
    header_block: '',
    footer_image_block: '',
    custom_content_block: '',
    extension_status_block: '',
    upgrade_offer_block: '',
    marketing_products_block: '',
    status_body_message: '',
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

const CLUB_SIGNUP_VARIABLES: TemplateVariableSet = {
  templateType: 'club-signup',
  variables: [
    { key: 'client_name', description: 'Winery/client organization name', sampleValue: 'Liberty Wines' },
    { key: 'customer_first_name', description: 'Customer first name', sampleValue: 'John' },
    { key: 'discount_percentage', description: 'Discount percentage offered', sampleValue: 10 },
    { key: 'expiration_formatted', description: 'Formatted expiration date (e.g., "Oct 23, 2026")', sampleValue: 'Oct 23, 2026' },
    { key: 'tier_upgrade_min_purchase', description: 'Minimum purchase amount to reach next tier', sampleValue: 500 },
    { key: 'next_tier_name', description: 'Next tier name (e.g., "Tier 2")', sampleValue: 'Tier 2' },
    { key: 'next_tier_discount_percentage', description: 'Next tier discount percentage', sampleValue: 15 },
    { key: 'shop_url', description: 'URL to the winery shop', sampleValue: 'https://example.com/shop' },
    { key: 'header_block', description: 'HTML block for header (image or client name text fallback)', sampleValue: '' },
    { key: 'footer_image_block', description: 'HTML block for powered-by footer image', sampleValue: '' },
    { key: 'custom_content_block', description: 'HTML block for custom text content (optional)', sampleValue: '' },
  ],
  sampleData: {
    client_name: 'Liberty Wines',
    customer_first_name: 'John',
    discount_percentage: 10,
    expiration_formatted: 'Oct 23, 2026',
    tier_upgrade_min_purchase: 500,
    next_tier_name: 'Tier 2',
    next_tier_discount_percentage: 15,
    shop_url: 'https://example.com/shop',
    header_block: '',
    footer_image_block: '',
    custom_content_block: '',
  },
};

export const TEMPLATE_VARIABLE_SETS: Record<TemplateType, TemplateVariableSet> = {
  'monthly-status': MONTHLY_STATUS_VARIABLES,
  'expiration-warning': EXPIRATION_WARNING_VARIABLES,
  'expiration': EXPIRATION_VARIABLES,
  'upgrade': UPGRADE_VARIABLES,
  'club-signup': CLUB_SIGNUP_VARIABLES,
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

