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
    { key: 'is_expired', description: 'Whether customer membership has expired (true/false)', sampleValue: 'false' },
    { key: 'elapsed_time', description: 'Time elapsed since expiration (e.g., "2 months", "45 days")', sampleValue: '2 months' },
    { key: 'rejoin_amount', description: 'Amount needed to rejoin (for expired customers)', sampleValue: 150 },
    { key: 'discount_percentage', description: 'Discount percentage for rejoining', sampleValue: 10 },
    { key: 'duration_months', description: 'Duration of benefits in months (for rejoining)', sampleValue: 3 },
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
    is_expired: 'false',
    elapsed_time: '2 months',
    rejoin_amount: 150,
    discount_percentage: 10,
    duration_months: 3,
  },
};

const EXPIRATION_WARNING_VARIABLES: TemplateVariableSet = {
  templateType: 'expiration-warning',
  variables: [
    { key: 'client_name', description: 'Winery/client organization name', sampleValue: 'Liberty Wines' },
    { key: 'customer_first_name', description: 'Customer first name', sampleValue: 'John' },
    { key: 'days', description: 'Number of days until expiration (displayed in alert)', sampleValue: 7 },
    { key: 'extension_amount', description: 'Amount needed to extend benefits', sampleValue: 150 },
    { key: 'discount_percentage', description: 'Current discount percentage', sampleValue: 10 },
    { key: 'extension_expiration', description: 'New expiration date if extended (e.g., "Oct 23, 2026")', sampleValue: 'Oct 23, 2026' },
    { key: 'extension_months', description: 'Number of months extension provides', sampleValue: 3 },
    { key: 'upgrade_amount', description: 'Amount needed to upgrade (optional)', sampleValue: 500 },
    { key: 'upgrade_discount_percentage', description: 'Upgrade discount percentage (optional)', sampleValue: 15 },
    { key: 'upgrade_months', description: 'Number of months upgrade provides (optional)', sampleValue: 6 },
    { key: 'shop_url', description: 'URL to the winery shop', sampleValue: 'https://example.com/shop' },
    { key: 'header_block', description: 'HTML block for header (image or client name text fallback)', sampleValue: '' },
    { key: 'footer_image_block', description: 'HTML block for powered-by footer image', sampleValue: '' },
    { key: 'custom_content_block', description: 'HTML block for custom text content (optional)', sampleValue: '' },
    { key: 'upgrade_message_block', description: 'HTML block for upgrade message (built automatically, empty if no upgrade)', sampleValue: '' },
  ],
  sampleData: {
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
  },
};

const EXPIRATION_VARIABLES: TemplateVariableSet = {
  templateType: 'expiration',
  variables: [
    { key: 'client_name', description: 'Winery/client organization name', sampleValue: 'Liberty Wines' },
    { key: 'customer_first_name', description: 'Customer first name', sampleValue: 'John' },
    { key: 'rejoin_amount', description: 'Amount needed to rejoin (e.g., 150)', sampleValue: 150 },
    { key: 'discount_percentage', description: 'Discount percentage for rejoining', sampleValue: 10 },
    { key: 'duration_months', description: 'Duration of benefits in months', sampleValue: 3 },
    { key: 'shop_url', description: 'URL to the winery shop', sampleValue: 'https://example.com/shop' },
    { key: 'header_block', description: 'HTML block for header (image or client name text fallback)', sampleValue: '' },
    { key: 'footer_image_block', description: 'HTML block for powered-by footer image', sampleValue: '' },
    { key: 'custom_content_block', description: 'HTML block for custom text content (optional)', sampleValue: '' },
  ],
  sampleData: {
    client_name: 'Liberty Wines',
    customer_first_name: 'John',
    rejoin_amount: 150,
    discount_percentage: 10,
    duration_months: 3,
    shop_url: 'https://example.com/shop',
    header_block: '',
    footer_image_block: '',
    custom_content_block: '',
  },
};

const UPGRADE_VARIABLES: TemplateVariableSet = {
  templateType: 'upgrade',
  variables: [
    { key: 'client_name', description: 'Winery/client organization name', sampleValue: 'Liberty Wines' },
    { key: 'customer_first_name', description: 'Customer first name', sampleValue: 'John' },
    { key: 'new_tier_discount_percentage', description: 'New tier discount percentage', sampleValue: 15 },
    { key: 'new_tier_duration_months', description: 'New tier duration in months', sampleValue: 7 },
    { key: 'expiration_formatted', description: 'Formatted expiration date for new tier (e.g., "Dec 23, 2026")', sampleValue: 'Dec 23, 2026' },
    { key: 'next_tier_upgrade_amount', description: 'Amount needed to reach next tier (optional)', sampleValue: 1000 },
    { key: 'next_tier_discount_percentage', description: 'Next tier discount percentage (optional)', sampleValue: 20 },
    { key: 'shop_url', description: 'URL to the winery shop', sampleValue: 'https://example.com/shop' },
    { key: 'header_block', description: 'HTML block for header (image or client name text fallback)', sampleValue: '' },
    { key: 'footer_image_block', description: 'HTML block for powered-by footer image', sampleValue: '' },
    { key: 'custom_content_block', description: 'HTML block for custom text content (optional)', sampleValue: '' },
  ],
  sampleData: {
    client_name: 'Liberty Wines',
    customer_first_name: 'John',
    new_tier_discount_percentage: 15,
    new_tier_duration_months: 7,
    expiration_formatted: 'Dec 23, 2026',
    next_tier_upgrade_amount: 1000,
    next_tier_discount_percentage: 20,
    shop_url: 'https://example.com/shop',
    header_block: '',
    footer_image_block: '',
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

