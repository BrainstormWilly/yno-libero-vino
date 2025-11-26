import {
  KLAVIYO_FLOWS,
  KLAVIYO_TEMPLATES,
  MARKETING_METRICS,
  TRANSACTIONAL_METRICS,
  type KlaviyoMetricKey,
  type KlaviyoTemplateKey,
} from '~/lib/communication/klaviyo.constants';

export type MailchimpSequenceKey = KlaviyoMetricKey;
export type MailchimpTemplateKey = KlaviyoTemplateKey;

export const MAILCHIMP_SEQUENCE_ORDER: MailchimpSequenceKey[] = [
  ...TRANSACTIONAL_METRICS,
  ...MARKETING_METRICS,
  'TEST',
];

export const MAILCHIMP_TEMPLATE_NAMES = KLAVIYO_TEMPLATES;
export const MAILCHIMP_FLOW_NAMES = KLAVIYO_FLOWS;

export const MAILCHIMP_TAGS: Record<MailchimpSequenceKey, string> = {
  CLUB_SIGNUP: 'LiberoVino::ClubSignup',
  MONTHLY_STATUS: 'LiberoVino::MonthlyStatus',
  MONTHLY_STATUS_PROMO: 'LiberoVino::MonthlyStatusPromo',
  EXPIRATION_WARNING: 'LiberoVino::ExpirationWarning',
  EXPIRATION_NOTICE: 'LiberoVino::ExpirationNotice',
  ANNUAL_RESIGN: 'LiberoVino::AnnualResign',
  SALES_BLAST: 'LiberoVino::SalesBlast',
  TEST: 'LiberoVino::Test',
};

/**
 * Merge fields for tracking when recurring events were last sent.
 * These date fields can trigger Mailchimp flows based on date updates.
 * Note: Mailchimp limits merge field tags to 10 characters, so names are shortened.
 * All fields are prefixed with "LV" to avoid conflicts with other integrations.
 */
export const MAILCHIMP_MERGE_FIELDS: Record<MailchimpSequenceKey, string> = {
  CLUB_SIGNUP: 'LVSIGNUP', // 8 chars
  MONTHLY_STATUS: 'LVMONTH', // 7 chars
  MONTHLY_STATUS_PROMO: 'LVMONPRO', // 8 chars
  EXPIRATION_WARNING: 'LVWARN', // 6 chars
  EXPIRATION_NOTICE: 'LVNOTICE', // 8 chars
  ANNUAL_RESIGN: 'LVRESIGN', // 8 chars
  SALES_BLAST: 'LVBLAST', // 7 chars
  TEST: 'LVTEST', // 6 chars
};

/**
 * Merge fields that should be created during seeding.
 * All merge fields are date fields (MM/DD/YYYY format in Mailchimp).
 */
export const MAILCHIMP_MERGE_FIELD_DEFINITIONS = Object.entries(MAILCHIMP_MERGE_FIELDS).map(
  ([eventKey, fieldName]) => ({
    tag: eventKey as MailchimpSequenceKey,
    name: fieldName,
    type: 'date' as const,
    public: false,
    required: false,
    default_value: '',
    help_text: `Last date when ${MAILCHIMP_TAGS[eventKey as MailchimpSequenceKey]} was triggered`,
  })
);

