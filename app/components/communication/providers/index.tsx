import KlaviyoEmailProvider from './KlaviyoEmailProvider';
import MailchimpEmailProvider from './MailchimpEmailProvider';
import LiberoVinoManagedEmailProvider from './LiberoVinoManagedEmailProvider';
import KlaviyoSMSProvider from './KlaviyoSMSProvider';
import MailchimpSMSProvider from './MailchimpSMSProvider';
import RedChirpSMSProvider from './RedChirpSMSProvider';
import LiberoVinoManagedSMSProvider from './LiberoVinoManagedSMSProvider';
import type { EmailProvider, SMSProvider } from './types';

export type { EmailProvider, SMSProvider, EmailProviderComponentProps, SMSProviderComponentProps } from './types';

export function getEmailProviderComponent(provider: EmailProvider) {
  switch (provider) {
    case 'klaviyo':
      return KlaviyoEmailProvider;
    case 'mailchimp':
      return MailchimpEmailProvider;
    case 'sendgrid':
      return LiberoVinoManagedEmailProvider;
    default:
      return LiberoVinoManagedEmailProvider;
  }
}

export function getSMSProviderComponent(provider: SMSProvider) {
  switch (provider) {
    case 'klaviyo':
      return KlaviyoSMSProvider;
    case 'mailchimp':
      return MailchimpSMSProvider;
    case 'redchirp':
      return RedChirpSMSProvider;
    case 'twilio':
      return LiberoVinoManagedSMSProvider;
    default:
      return LiberoVinoManagedSMSProvider;
  }
}

