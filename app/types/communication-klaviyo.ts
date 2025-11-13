import type {
  KlaviyoFlowKey,
  KlaviyoMetricKey,
  KlaviyoTemplateKey,
} from '~/lib/communication/klaviyo.constants';

export interface KlaviyoTemplateSeedInput {
  name: string;
  subject: string;
  html: string;
  text?: string;
  previewText?: string;
  editorType?: 'HTML' | 'TEXT';
}

export interface KlaviyoTemplateSeedResult {
  id: string;
  name: string;
  subject: string;
  editorType: string;
  createdAt: string | null;
  updatedAt: string | null;
  seededAt?: string;
  updated?: boolean;
}

export interface KlaviyoMetricSeedResult {
  id: string;
  name: string;
  createdAt: string | null;
  seededAt?: string;
}

export interface KlaviyoFlowSeedResult {
  id: string;
  name: string;
  status: 'draft' | 'live' | 'manual' | 'paused';
  channel: 'email' | 'sms' | 'push';
  messageId?: string | null;
  templateId?: string;
  metricId?: string;
  createdAt: string | null;
  updatedAt: string | null;
  seededAt?: string;
}

export interface KlaviyoProviderData {
  seededAt: string;
  includeMarketing: boolean;
  metrics: Partial<Record<KlaviyoMetricKey, KlaviyoMetricSeedResult>>;
  templates: Partial<Record<KlaviyoTemplateKey, KlaviyoTemplateSeedResult>>;
  flows: Partial<Record<KlaviyoFlowKey, KlaviyoFlowSeedResult>>;
}
