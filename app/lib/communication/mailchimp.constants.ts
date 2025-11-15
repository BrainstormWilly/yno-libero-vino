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
export const MAILCHIMP_JOURNEY_NAMES = KLAVIYO_FLOWS;

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

