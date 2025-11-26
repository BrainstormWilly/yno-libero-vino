import type {
  CommunicationProvider,
  SMSParams,
  SMSResult,
} from '~/types/communication';

import { normalizePhoneNumber } from '~/util/phone.utils';

interface TwilioProviderOptions {
  accountSid: string;
  authToken: string;
  defaultFromNumber?: string | null;
}

export class TwilioProvider implements CommunicationProvider {
  public readonly name = 'Twilio';
  public readonly supportsEmail = false;
  public readonly supportsSMS = true;

  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly defaultFromNumber?: string | null;
  private readonly baseUrl: string;

  constructor(options: TwilioProviderOptions) {
    if (!options.accountSid) {
      throw new Error('Twilio provider requires an account SID.');
    }
    if (!options.authToken) {
      throw new Error('Twilio provider requires an auth token.');
    }

    this.accountSid = options.accountSid;
    this.authToken = options.authToken;
    this.defaultFromNumber = options.defaultFromNumber;
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;
  }

  async sendSMS(params: SMSParams): Promise<SMSResult> {
    const fromNumber = params.fromNumber ?? this.defaultFromNumber;

    if (!fromNumber) {
      throw new Error('Twilio sendSMS requires a fromNumber value.');
    }

    // Twilio requires phone numbers in E.164 format (e.g., +15551234567)
    const to = normalizePhoneNumber(params.to);
    const from = normalizePhoneNumber(fromNumber);

    const url = `${this.baseUrl}/Messages.json`;
    const body = new URLSearchParams({
      From: from,
      To: to,
      Body: params.message,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Twilio API error (${response.status} ${response.statusText}): ${JSON.stringify(data)}`
      );
    }

    return {
      success: true,
      messageId: data.sid,
      response: data,
    };
  }

  // Stub methods required by interface
  async sendEmail(_params: never): Promise<never> {
    throw new Error('Twilio does not support email.');
  }
}

