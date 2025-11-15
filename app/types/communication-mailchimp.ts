export interface MailchimpTemplateSeedResult {
  id: string;
  name: string;
  type?: string;
  folder_id?: number;
  created_at?: string;
  updated_at?: string;
  seededAt?: string;
}

export interface MailchimpAudienceSeedResult {
  id: string;
  web_id?: number;
  name: string;
  contact?: Record<string, unknown>;
  seededAt?: string;
}

export interface MailchimpProviderData {
  seededAt: string;
  serverPrefix?: string | null;
  marketingAccessToken?: string | null;
  includeMarketing?: boolean;
  audienceId?: string | null;
  audienceName?: string | null;
  audience?: MailchimpAudienceSeedResult;
  templates?: Record<string, MailchimpTemplateSeedResult | undefined>;
  journeys?: Record<string, { id?: string; name: string; status?: string; seededAt?: string }>;
}

