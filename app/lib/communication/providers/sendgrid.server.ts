import type {
  CommunicationProvider,
  EmailParams,
  EmailResult,
  SMSParams,
  SMSResult,
  TestEmailContent,
  TrackEventParams,
  TrackEventResult,
  UpdateProfileParams,
} from '~/types/communication';

interface SendGridProviderOptions {
  apiKey: string;
  defaultFromEmail: string;
  defaultFromName?: string;
}

export class SendGridProvider implements CommunicationProvider {
  public readonly name = 'SendGrid';
  public readonly supportsEmail = true;
  public readonly supportsSMS = false;

  private readonly apiKey: string;
  private readonly defaultFromEmail: string;
  private readonly defaultFromName?: string;

  constructor(options: SendGridProviderOptions) {
    if (!options.apiKey) {
      throw new Error('SendGrid provider requires an API key.');
    }

    if (!options.defaultFromEmail) {
      throw new Error('SendGrid provider requires a default from email address.');
    }

    this.apiKey = options.apiKey;
    this.defaultFromEmail = options.defaultFromEmail;
    this.defaultFromName = options.defaultFromName;
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    const fromEmail = params.fromEmail ?? this.defaultFromEmail;
    const fromName = params.fromName ?? this.defaultFromName;

    // Debug logging for API key (first 10 chars only for security)
    const apiKeyPreview = this.apiKey ? `${this.apiKey.substring(0, 10)}...` : 'MISSING';
    console.info('[SendGrid.sendEmail] Using API key:', apiKeyPreview, 'Length:', this.apiKey?.length);

    const content: Array<{ type: string; value: string }> = [];
    if (params.text) {
      content.push({ type: 'text/plain', value: params.text });
    }
    content.push({ type: 'text/html', value: params.html });

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [
              {
                email: params.to,
                name: params.toName ?? params.to,
              },
            ],
            dynamic_template_data: params.templateData,
            subject: params.subject,
          },
        ],
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject: params.subject,
        content,
        template_id: params.templateId,
        categories: params.tags,
      }),
    });

    const responseBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `SendGrid API error (${response.status} ${response.statusText}): ${responseBody}`
      );
    }

    return {
      success: true,
      response: responseBody,
    };
  }

  async sendSMS(_params: SMSParams): Promise<SMSResult> {
    throw new Error('SendGrid SMS is not supported by this provider.');
  }

  async trackEvent(_params: TrackEventParams): Promise<TrackEventResult> {
    return { success: false };
  }

  async updateProfile(_params: UpdateProfileParams): Promise<string | null> {
    // SendGrid does not manage profiles in the same way; no-op for fallback provider.
    return null;
  }

  getTestEmailContent(): TestEmailContent {
    return {
      subject: 'LiberoVino Test Email',
      html: '<p>This is a test message from your LiberoVino integration. 🎉</p><p>If you received this email, your configuration is working correctly.</p>',
      text: 'This is a test message from your LiberoVino integration. If you received this email, your configuration is working correctly.',
    };
  }
}
