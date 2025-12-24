import type { Database } from '~/types/supabase';
// import type { EmailProvider, SMSProvider } from '~/types/communication';

export type { EmailProvider, SMSProvider } from '~/types/communication';

export type CommunicationConfig = Database['public']['Tables']['communication_configs']['Row'];

export interface EmailProviderComponentProps {
  existingConfig: CommunicationConfig | null;
  actionData: {
    success?: boolean;
    message?: string;
    confirmed?: boolean;
    testResult?: {
      success: boolean;
      message: string;
    } | null;
  } | null;
  session: {
    id: string;
    clientId: string;
  };
  client?: {
    id: string;
    email_header_image_url?: string | null;
    email_footer_image_url?: string | null;
  } | null;
  onBack: () => void;
  onContinue: () => void;
  hasSms: boolean;
}

export interface SMSProviderComponentProps {
  existingConfig: CommunicationConfig | null;
  actionData: {
    success?: boolean;
    message?: string;
    testResult?: {
      success: boolean;
      message: string;
    } | null;
  } | null;
  session: {
    id: string;
    clientId: string;
  };
  onBack: () => void;
  onContinue: () => void;
  hasEmail: boolean;
}
