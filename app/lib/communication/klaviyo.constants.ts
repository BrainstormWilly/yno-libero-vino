export const KLAVIYO_METRICS = {
  CLUB_SIGNUP: 'LiberoVino.ClubSignup',
  MONTHLY_STATUS: 'LiberoVino.MonthlyStatus',
  MONTHLY_STATUS_PROMO: 'LiberoVino.MonthlyStatusPromo',
  EXPIRATION_WARNING: 'LiberoVino.ExpirationWarning',
  EXPIRATION_NOTICE: 'LiberoVino.ExpirationNotice',
  ANNUAL_RESIGN: 'LiberoVino.AnnualResign',
  SALES_BLAST: 'LiberoVino.SalesBlast',
  TEST: 'LiberoVino.TestMetric',
} as const;

export type KlaviyoMetricKey = keyof typeof KLAVIYO_METRICS;

export const TRANSACTIONAL_METRICS: KlaviyoMetricKey[] = [
  'CLUB_SIGNUP',
  'MONTHLY_STATUS',
  'EXPIRATION_WARNING',
  'EXPIRATION_NOTICE',
];

export const MARKETING_METRICS: KlaviyoMetricKey[] = [
  'MONTHLY_STATUS_PROMO',
  'ANNUAL_RESIGN',
  'SALES_BLAST',
];

export const KLAVIYO_TEMPLATES = {
  CLUB_SIGNUP: 'LiberoVino – Club Signup Welcome',
  MONTHLY_STATUS: 'LiberoVino – Monthly Status Update',
  MONTHLY_STATUS_PROMO: 'LiberoVino – Monthly Status Promo',
  EXPIRATION_WARNING: 'LiberoVino – Expiration Warning',
  EXPIRATION_NOTICE: 'LiberoVino – Expiration Notice',
  ANNUAL_RESIGN: 'LiberoVino – Annual Re-Sign',
  SALES_BLAST: 'LiberoVino – Sales Spotlight',
  TEST: 'LiberoVino – Test Message',
} as const;

export type KlaviyoTemplateKey = keyof typeof KLAVIYO_TEMPLATES;

export const KLAVIYO_FLOWS = {
  CLUB_SIGNUP: 'LiberoVino – Club Signup Welcome',
  MONTHLY_STATUS: 'LiberoVino – Monthly Status Update',
  MONTHLY_STATUS_PROMO: 'LiberoVino – Monthly Status Promo',
  EXPIRATION_WARNING: 'LiberoVino – Expiration Warning',
  EXPIRATION_NOTICE: 'LiberoVino – Expiration Notice',
  ANNUAL_RESIGN: 'LiberoVino – Annual Re-Sign Opportunity',
  SALES_BLAST: 'LiberoVino – Sales Spotlight',
  TEST: 'LiberoVino – Test Flow',
} as const;

export type KlaviyoFlowKey = keyof typeof KLAVIYO_FLOWS;
