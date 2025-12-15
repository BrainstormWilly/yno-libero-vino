import { createHash } from 'node:crypto';

import { MAILCHIMP_MERGE_FIELDS, MAILCHIMP_TAGS } from '~/lib/communication/mailchimp.constants';
import type {
  CommunicationProvider,
  EmailParams,
  EmailResult,
  TestEmailContent,
  TrackEventParams,
  TrackEventResult,
  UpdateProfileParams,
} from '~/types/communication';

interface MailchimpProviderOptions {
  serverPrefix: string;
  defaultFromEmail: string;
  defaultFromName?: string;
  marketingAccessToken?: string | null;
  audienceId?: string | null;
}

interface MailchimpProviderData {
  marketingAccessToken?: string | null;
  serverPrefix?: string | null;
  audienceId?: string | null;
  audienceName?: string | null;
}

export class MailchimpProvider implements CommunicationProvider {
  public readonly name = 'Mailchimp';
  public readonly supportsEmail = true;
  public readonly supportsSMS = false;

  private readonly serverPrefix: string;
  private readonly defaultFromEmail: string;
  private readonly defaultFromName?: string;
  private readonly marketingAccessToken?: string | null;
  private readonly audienceId?: string | null;

  constructor(options: MailchimpProviderOptions) {
    if (!options.serverPrefix) {
      throw new Error('Mailchimp provider requires a data center/server prefix (e.g., us21).');
    }

    if (!options.defaultFromEmail) {
      throw new Error('Mailchimp provider requires a default from email address.');
    }

    this.serverPrefix = options.serverPrefix;
    this.defaultFromEmail = options.defaultFromEmail;
    this.defaultFromName = options.defaultFromName;
    this.marketingAccessToken = options.marketingAccessToken;
    this.audienceId = options.audienceId;
  }

  static parseProviderData(data: unknown): MailchimpProviderData {
    if (!data || typeof data !== 'object') return {};
    const parsed = data as Record<string, unknown>;
    return {
      marketingAccessToken: typeof parsed.marketingAccessToken === 'string' ? parsed.marketingAccessToken : null,
      serverPrefix: typeof parsed.serverPrefix === 'string' ? parsed.serverPrefix : null,
      audienceId: typeof parsed.audienceId === 'string' ? parsed.audienceId : null,
      audienceName: typeof parsed.audienceName === 'string' ? parsed.audienceName : null,
    };
  }

  async sendEmail(params: EmailParams): Promise<EmailResult> {
    throw new Error(
      'Mailchimp direct sends are not supported. Configure flows to deliver email automations.'
    );
  }

  async trackEvent(params: TrackEventParams): Promise<TrackEventResult> {
    if (!params.customer.email) {
      throw new Error('Mailchimp trackEvent requires customer.email');
    }

    if (!this.marketingAccessToken) {
      throw new Error('Mailchimp marketing access token not configured.');
    }

    if (!this.audienceId) {
      throw new Error('Mailchimp audience/list ID not configured.');
    }

    const email = params.customer.email;
    const emailHash = this.hashEmail(email);
    
    console.log('[Mailchimp trackEvent] Starting:', {
      email,
      event: params.event,
      audienceId: this.audienceId,
      serverPrefix: this.serverPrefix,
    });

    // Build merge fields including event-specific date field
    const mergeFields = this.buildMergeFields(params.customer.properties);
    if (params.event) {
      const eventMergeField = this.getEventMergeField(params.event);
      if (eventMergeField) {
        const today = new Date();
        const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        mergeFields[eventMergeField] = dateValue;
        console.log('[Mailchimp trackEvent] Including event merge field in member update:', {
          email,
          event: params.event,
          mergeField: eventMergeField,
          dateValue,
        });
      }
    }

    const body: Record<string, unknown> = {
      email_address: email,
      status_if_new: 'subscribed',
      status: 'subscribed',
      merge_fields: mergeFields,
    };

    try {
      const memberResponse = await this.requestMarketing(
        `/lists/${this.audienceId}/members/${emailHash}`,
        {
          method: 'PUT',
          body: JSON.stringify(body),
        }
      );
      
      const memberData = await memberResponse.json();
      console.log('[Mailchimp trackEvent] Member updated/created:', {
        email,
        memberId: memberData.id,
        status: memberData.status,
        tagsCount: memberData.tags?.length || 0,
        tags: memberData.tags?.map((t: { name: string; status: string }) => `${t.name} (${t.status})`) || [],
        mergeFields: memberData.merge_fields,
        timestamp: new Date().toISOString(),
      });
      
      // Important: Verify member is subscribed (required for flows to trigger)
      if (memberData.status !== 'subscribed') {
        console.warn('[Mailchimp trackEvent] WARNING: Member status is not "subscribed":', {
          email,
          status: memberData.status,
          message: 'Flows typically only trigger for subscribed members. Consider updating member status.',
        });
      }

      if (params.event) {
        await this.applyTag(email, params.event);
        // Merge field is already updated in the member creation/update above
        // But verify it was set correctly
        await this.verifyEventMergeField(email, params.event);
      }

      return { success: true };
    } catch (error) {
      console.error('[Mailchimp trackEvent] Error:', {
        email,
        event: params.event,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateProfile(params: UpdateProfileParams): Promise<string | null> {
    if (!this.marketingAccessToken || !this.audienceId) return null;

    const body: Record<string, unknown> = {
      email_address: params.email,
      status_if_new: 'subscribed',
      status: 'subscribed',
      merge_fields: this.buildMergeFields({
        first_name: params.firstName,
        last_name: params.lastName,
        ...params.properties,
      }),
    };

    await this.requestMarketing(
      `/lists/${this.audienceId}/members/${this.hashEmail(params.email)}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );
    
    // Mailchimp doesn't return a profile ID in the same way, return null
    return null;
  }

  private async applyTag(email: string, tag: string) {
    const emailHash = this.hashEmail(email);
    
    // First, check if tag exists and remove it to allow re-triggering
    // This enables recurring events to work (Mailchimp "Tag added" only fires once)
    try {
      const memberResponse = await this.requestMarketing(
        `/lists/${this.audienceId}/members/${emailHash}?fields=tags`,
        { method: 'GET' }
      );
      const memberData = await memberResponse.json();
      const existingTags = memberData.tags || [];
      const hasTag = existingTags.some((t: { name: string }) => t.name === tag);
      
      if (hasTag) {
        // Remove the tag first so we can re-add it to trigger the flow
        console.log('[Mailchimp applyTag] Tag exists, removing first to allow re-trigger:', { email, tag });
        await this.requestMarketing(
          `/lists/${this.audienceId}/members/${emailHash}/tags`,
          {
            method: 'POST',
            body: JSON.stringify({
              tags: [{ name: tag, status: 'inactive' }]
            })
          }
        );
        // Small delay to ensure Mailchimp processes the removal
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.warn('[Mailchimp applyTag] Could not check/remove existing tag (non-fatal):', {
        email,
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue - tag might not exist, which is fine
    }
    
    // Now add the tag (this will trigger "Tag added" event)
    const tagPayload = {
      tags: [
        {
          name: tag,
          status: 'active',
        },
      ],
    };

    console.log('[Mailchimp applyTag] Applying tag:', {
      email,
      tag,
      audienceId: this.audienceId,
      payload: tagPayload,
    });

    try {
      const response = await this.requestMarketing(
        `/lists/${this.audienceId}/members/${emailHash}/tags`,
        {
          method: 'POST',
          body: JSON.stringify(tagPayload),
        }
      );

      // Mailchimp tag endpoint returns empty body on success, so check response status
      const responseText = await response.text();
      console.log('[Mailchimp applyTag] Tag applied successfully:', {
        email,
        tag,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText || '(empty)',
      });

      // Verify the tag was actually applied by fetching member tags
      await this.verifyTagApplied(email, tag);
    } catch (error) {
      console.error('[Mailchimp applyTag] Error applying tag:', {
        email,
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async verifyTagApplied(email: string, expectedTag: string) {
    try {
      const emailHash = this.hashEmail(email);
      
      // Get full member info to check status and tags
      const memberResponse = await this.requestMarketing(
        `/lists/${this.audienceId}/members/${emailHash}?fields=id,email_address,status,tags`,
        {
          method: 'GET',
        }
      );

      const memberData = await memberResponse.json();
      const tags = memberData.tags || [];
      const tagNames = tags.map((t: { name: string; status: string }) => t.name);
      const tagDetails = tags.map((t: { name: string; status: string }) => `${t.name} (${t.status})`);
      
      console.log('[Mailchimp verifyTag] Member verification:', {
        email,
        memberId: memberData.id,
        status: memberData.status,
        expectedTag,
        actualTags: tagNames,
        tagDetails,
        tagFound: tagNames.includes(expectedTag),
        timestamp: new Date().toISOString(),
      });

      if (!tagNames.includes(expectedTag)) {
        console.warn('[Mailchimp verifyTag] WARNING: Expected tag not found after application:', {
          email,
          expectedTag,
          actualTags: tagNames,
        });
      } else {
        console.log('[Mailchimp verifyTag] ✓ Tag verified successfully. Flow should trigger if:', {
          email,
          tag: expectedTag,
          checklist: [
            '1. Flow is published/active in Mailchimp',
            '2. Flow trigger is set to "Tag added" with exact name: ' + expectedTag,
            '3. Member status is "subscribed" (current: ' + memberData.status + ')',
            '4. No additional flow conditions/filters are blocking',
            '5. Flow delay/scheduling allows immediate sending',
          ],
          note: 'For recurring events, LiberoVino removes and re-adds tags to allow "Tag added" triggers to fire multiple times.',
        });
      }
    } catch (error) {
      console.warn('[Mailchimp verifyTag] Could not verify tag (non-fatal):', {
        email,
        expectedTag,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - this is just for verification
    }
  }

  /**
   * Gets the merge field name for an event tag.
   */
  private getEventMergeField(eventTag: string): string | null {
    const eventKey = Object.entries(MAILCHIMP_TAGS).find(([, tag]) => tag === eventTag)?.[0];
    if (!eventKey) {
      return null;
    }
    return MAILCHIMP_MERGE_FIELDS[eventKey as keyof typeof MAILCHIMP_MERGE_FIELDS] || null;
  }

  /**
   * Verifies that the merge field was set correctly after member update.
   */
  private async verifyEventMergeField(email: string, eventTag: string): Promise<void> {
    if (!this.marketingAccessToken || !this.audienceId) {
      return; // Silently skip if not configured
    }

    const mergeFieldName = this.getEventMergeField(eventTag);
    if (!mergeFieldName) {
      return; // No merge field for this event
    }

    const emailHash = this.hashEmail(email);
    const today = new Date();
    const expectedDateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    try {
      // Verify the merge field was set correctly
      const memberResponse = await this.requestMarketing(
        `/lists/${this.audienceId}/members/${emailHash}?fields=merge_fields`,
        { method: 'GET' }
      );
      const memberData = await memberResponse.json();
      const actualValue = memberData.merge_fields?.[mergeFieldName];

      console.log('[Mailchimp verifyEventMergeField] Merge field verification:', {
        email,
        eventTag,
        mergeFieldName,
        expected: expectedDateValue,
        actual: actualValue,
        verified: actualValue === expectedDateValue,
      });

      if (actualValue !== expectedDateValue) {
        console.warn('[Mailchimp verifyEventMergeField] WARNING: Merge field value mismatch:', {
          email,
          mergeFieldName,
          expected: expectedDateValue,
          actual: actualValue,
        });
      }
    } catch (error) {
      console.error('[Mailchimp verifyEventMergeField] Failed to verify merge field:', {
        email,
        eventTag,
        mergeFieldName,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - verification is non-critical
    }
  }

  private buildMergeFields(properties?: Record<string, unknown>) {
    if (!properties) return {};

    const mergeFields: Record<string, unknown> = {};
    const firstName =
      (properties.firstName as string) ||
      (properties.first_name as string) ||
      (properties.FNAME as string);
    const lastName =
      (properties.lastName as string) ||
      (properties.last_name as string) ||
      (properties.LNAME as string);

    if (firstName) mergeFields.FNAME = firstName;
    if (lastName) mergeFields.LNAME = lastName;

    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined || value === null) continue;
      if (['firstName', 'first_name', 'FNAME', 'lastName', 'last_name', 'LNAME'].includes(key)) {
        continue;
      }
      mergeFields[key.toUpperCase()] = value;
    }

    return mergeFields;
  }

  private hashEmail(email: string) {
    return createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  }

  private async requestMarketing(path: string, init: RequestInit) {
    if (!this.marketingAccessToken) {
      throw new Error('Mailchimp marketing access token is not configured.');
    }

    const url = `https://${this.serverPrefix}.api.mailchimp.com/3.0${path}`;
    
    console.log('[Mailchimp API] Request:', {
      method: init.method || 'GET',
      url,
      path,
      hasBody: !!init.body,
    });

    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.marketingAccessToken}`,
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Mailchimp Marketing API error (${response.status} ${response.statusText})`;
      
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage += `: ${errorJson.title || errorJson.detail || errorBody}`;
        if (errorJson.errors) {
          errorMessage += ` Errors: ${JSON.stringify(errorJson.errors)}`;
        }
      } catch {
        errorMessage += `: ${errorBody}`;
      }
      
      console.error('[Mailchimp API] Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
        url,
      });
      
      throw new Error(errorMessage);
    }

    return response;
  }

  getTestEmailContent(): TestEmailContent {
    return {
      subject: 'LiberoVino Test Email',
      html: '<p>This is a test message triggered from your LiberoVino integration. 🎉</p><p>If you received the corresponding Mailchimp automation, your communication setup is working.</p>',
      text: 'This is a test message triggered from your LiberoVino integration. If you received the corresponding Mailchimp automation, your communication setup is working.',
    };
  }
}

