export type CommunicationChannel = 'email' | 'sms';

export type EmailProvider = 'klaviyo' | 'mailchimp' | 'sendgrid';
export type SMSProvider = 'klaviyo' | 'mailchimp' | 'redchirp' | 'twilio';

export interface EmailParams {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
  fromEmail?: string;
  fromName?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  tags?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  response?: unknown;
}

export interface SMSParams {
  to: string;
  message: string;
  fromNumber?: string;
  tags?: string[];
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  response?: unknown;
}

export interface TrackEventParams {
  event: string;
  customer: {
    email?: string;
    phone?: string;
    id?: string;
    properties?: Record<string, unknown>;
  };
  properties?: Record<string, unknown>;
  time?: Date | string;
}

export interface TrackEventResult {
  success: boolean;
  response?: unknown;
}

export interface UpdateProfileParams {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  properties?: Record<string, unknown>;
}

export interface TestEmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface CommunicationProvider {
  name: string;
  supportsEmail: boolean;
  supportsSMS: boolean;

  sendEmail(params: EmailParams): Promise<EmailResult>;
  sendSMS?(params: SMSParams): Promise<SMSResult>;
  trackEvent?(params: TrackEventParams): Promise<TrackEventResult>;
  updateProfile?(params: UpdateProfileParams): Promise<void>;
  getTestEmailContent?(): TestEmailContent;
}
