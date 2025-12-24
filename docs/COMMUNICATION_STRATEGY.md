# Customer Communication Strategy

## Overview

Automated monthly notifications to wine club members about their status, with customizable content per winery and support for multiple communication platforms.

## Communication Platforms

### Email Providers
- **Mailchimp** - Popular email marketing platform
- **Klaviyo** - E-commerce focused email/SMS
- **SendGrid** - Transactional email (backup/alternative)

### SMS Providers
- **Mailchimp SMS** - Integrated with email
- **Klaviyo SMS** - Integrated with email
- **Twilio** - General SMS platform (LiberoVino-managed fallback)

## Architecture: Provider Pattern

Similar to CRM providers, we'll use an abstraction layer for communications.

### Communication Provider Interface

```typescript
export interface CommunicationProvider {
  name: string;
  type: 'email' | 'sms' | 'both';
  
  // Send operations
  sendEmail(params: EmailParams): Promise<EmailResult>;
  sendSMS(params: SMSParams): Promise<SMSResult>;
  
  // Template management
  createTemplate(template: EmailTemplate): Promise<string>;
  updateTemplate(templateId: string, template: EmailTemplate): Promise<void>;
  
  // List management (for segmentation)
  addToList(listId: string, contact: Contact): Promise<void>;
  removeFromList(listId: string, contactId: string): Promise<void>;
  
  // Tracking
  getDeliveryStatus(messageId: string): Promise<DeliveryStatus>;
}

export interface EmailParams {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  tags?: string[];
}

export interface SMSParams {
  to: string;  // Phone number
  from?: string;
  message: string;
  tags?: string[];
}

export interface Contact {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  customFields?: Record<string, any>;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  variables: string[];  // e.g., ['first_name', 'discount_percentage', 'days_remaining']
}
```

## Database Schema

### 1. `communication_configs` (Per Client)

```sql
CREATE TABLE communication_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Email Provider
  email_provider VARCHAR(50) CHECK (email_provider IN ('mailchimp', 'klaviyo', 'sendgrid')),
  email_api_key TEXT,
  email_from_address VARCHAR(255),
  email_from_name VARCHAR(255),
  email_list_id VARCHAR(255),  -- For Mailchimp/Klaviyo list
  provider_data JSONB DEFAULT '{}'::jsonb,
  
  -- SMS Provider
  sms_provider VARCHAR(50) CHECK (sms_provider IN ('mailchimp', 'twilio', 'klaviyo')),
  sms_api_key TEXT,
  sms_from_number VARCHAR(50),
  
  -- Settings
  send_monthly_status BOOLEAN DEFAULT true,
  send_expiration_warnings BOOLEAN DEFAULT true,
  warning_days_before INTEGER DEFAULT 7,  -- Warn 7 days before expiration
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(client_id)
);
```

### 2. `communication_templates` (Winery-Specific)

```sql
CREATE TABLE communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Template Info
  template_type VARCHAR(50) NOT NULL CHECK (
    template_type IN (
      'monthly_status',
      'expiration_warning',
      'upgrade_available',
      'points_earned',
      'reward_available',
      'welcome',
      'renewal_reminder'
    )
  ),
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'sms')),
  
  -- Content (customizable per winery)
  subject VARCHAR(500),  -- For email
  html_body TEXT,        -- For email
  text_body TEXT,        -- For SMS or email fallback
  
  -- Provider-specific
  provider_template_id VARCHAR(255),  -- ID in Mailchimp/Klaviyo
  
  -- Variables available in template
  available_variables JSONB,  -- Store metadata about what can be used
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(client_id, template_type, channel)
);
```

### 3. `communication_log` (Audit Trail)

```sql
CREATE TABLE communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  
  -- Communication Details
  template_type VARCHAR(50) NOT NULL,
  channel VARCHAR(10) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  
  -- Recipient
  to_address VARCHAR(255) NOT NULL,  -- Email or phone
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked')
  ),
  
  -- Provider Details
  provider_message_id VARCHAR(255),
  error_message TEXT,
  
  -- Metadata
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comm_log_customer_id ON communication_log(customer_id);
CREATE INDEX idx_comm_log_status ON communication_log(status);
CREATE INDEX idx_comm_log_template_type ON communication_log(template_type);
CREATE INDEX idx_comm_log_sent_at ON communication_log(sent_at);
```

### 4. `communication_preferences` (Customer Opt-in/out)

```sql
CREATE TABLE communication_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE UNIQUE,
  
  -- Preferences
  email_monthly_status BOOLEAN DEFAULT true,
  email_expiration_warnings BOOLEAN DEFAULT true,
  email_promotions BOOLEAN DEFAULT true,
  
  sms_monthly_status BOOLEAN DEFAULT false,
  sms_expiration_warnings BOOLEAN DEFAULT true,
  sms_promotions BOOLEAN DEFAULT false,
  
  -- Unsubscribe
  unsubscribed_all BOOLEAN DEFAULT false,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_comm_prefs_customer_id ON communication_preferences(customer_id);
```

## Monthly Status Notification

### Template Variables

Variables dynamically injected into templates:

```typescript
interface MonthlyStatusVariables {
  // Customer info
  first_name: string;
  last_name: string;
  
  // Club status
  current_stage: string;           // "Silver"
  discount_percentage: number;     // 15
  expires_at: string;             // "July 1, 2025"
  days_remaining: number;         // 45
  
  // Purchase requirements
  min_purchase_amount: number;    // 150.00
  next_stage: string | null;      // "Gold" or null
  next_stage_discount: number | null;  // 20
  next_stage_amount: number | null;    // 300.00
  
  // Loyalty points
  points_balance: number;         // 1,250
  points_earned_this_month: number;  // 180
  is_earning_points: boolean;    // true/false
  
  // Suggested purchase (future AI)
  suggested_wines: Array<{
    name: string;
    price: number;
    image_url: string;
  }>;
  
  // Winery info
  winery_name: string;
  winery_logo_url: string;
  shop_url: string;
}
```

### Example Email Template

```html
<!-- Mailchimp/Klaviyo template with merge tags -->
<html>
<body>
  <img src="{{winery_logo_url}}" alt="{{winery_name}}" />
  
  <h1>Hi {{first_name}},</h1>
  
  <p>Your {{winery_name}} wine club status for this month:</p>
  
  <div class="status-card">
    <h2>{{current_stage}} Member</h2>
    <p class="discount">{{discount_percentage}}% Discount Active</p>
    <p class="expiration">
      {{#if days_remaining > 30}}
        Valid until {{expires_at}}
      {{else}}
        ⚠️ Expires in {{days_remaining}} days on {{expires_at}}
      {{/if}}
    </p>
  </div>
  
  {{#if next_stage}}
  <div class="upgrade-offer">
    <h3>Upgrade to {{next_stage}}!</h3>
    <p>Purchase ${{next_stage_amount}} to get {{next_stage_discount}}% off</p>
  </div>
  {{/if}}
  
  <div class="renewal-reminder">
    <p>To keep your discount active, purchase at least ${{min_purchase_amount}} 
       before {{expires_at}}</p>
  </div>
  
  {{#if is_earning_points}}
  <div class="points-status">
    <h3>Loyalty Points</h3>
    <p>Current Balance: {{points_balance}} points</p>
    <p>Earned this month: {{points_earned_this_month}} points</p>
    <a href="{{shop_url}}/loyalty-rewards">Browse Rewards →</a>
  </div>
  {{/if}}
  
  <!-- Winery's custom content here -->
  {{custom_content}}
  
  <div class="cta">
    <a href="{{shop_url}}" class="button">Shop Now</a>
  </div>
  
  <p class="footer">
    <a href="{{unsubscribe_url}}">Unsubscribe</a>
  </p>
</body>
</html>
```

### Example SMS Template

```
Hi {{first_name}}! Your {{winery_name}} {{current_stage}} membership ({{discount_percentage}}% off) expires in {{days_remaining}} days. Purchase ${{min_purchase_amount}}+ to renew. Shop: {{shop_url}}
```

## Monthly Cron Job

```typescript
// Run on 1st of each month at 9 AM
async function sendMonthlyStatusNotifications() {
  console.log('Starting monthly status notifications...');
  
  // Get all clients with communication enabled
  const clients = await db.clients.findMany({
    where: { is_active: true },
    include: {
      communication_config: true
    }
  });
  
  for (const client of clients) {
    if (!client.communication_config?.send_monthly_status) {
      continue;
    }
    
    // Get all active club members for this client
    const activeMembers = await db.customers.findMany({
      where: {
        client_id: client.id,
        is_club_member: true
      },
      include: {
        club_enrollments: {
          where: { status: 'active' },
          include: { club_stage: true }
        },
        communication_preferences: true
      }
    });
    
    console.log(`Processing ${activeMembers.length} members for ${client.org_name}`);
    
    for (const customer of activeMembers) {
      // Check preferences
      if (customer.communication_preferences?.unsubscribed_all) {
        continue;
      }
      
      // Get current enrollment
      const enrollment = customer.club_enrollments[0];
      if (!enrollment) continue;
      
      // Calculate status data
      const statusData = await calculateCustomerStatus(customer, enrollment);
      
      // Send email if opted in
      if (customer.communication_preferences?.email_monthly_status !== false) {
        await sendMonthlyStatusEmail(client, customer, statusData);
      }
      
      // Send SMS if opted in
      if (customer.communication_preferences?.sms_monthly_status === true) {
        await sendMonthlyStatusSMS(client, customer, statusData);
      }
      
      // Small delay to respect rate limits
      await sleep(100);
    }
  }
  
  console.log('Monthly notifications complete');
}

// Schedule
cron.schedule('0 9 1 * *', sendMonthlyStatusNotifications);  // 1st of month, 9 AM
```

## Status Calculation

```typescript
async function calculateCustomerStatus(customer, enrollment) {
  const stage = enrollment.club_stage;
  const program = await db.club_programs.findById(stage.club_program_id);
  
  // Calculate days remaining
  const expiresAt = new Date(enrollment.expires_at);
  const now = new Date();
  const daysRemaining = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  
  // Get next stage (if any)
  const nextStage = await db.club_stages.findOne({
    where: {
      club_program_id: program.id,
      stage_order: stage.stage_order + 1,
      is_active: true
    }
  });
  
  // Calculate points earned this month
  const pointsThisMonth = await db.point_transactions.aggregate({
    where: {
      customer_id: customer.id,
      transaction_type: 'earned',
      created_at: {
        gte: startOfMonth(now)
      }
    },
    _sum: { points: true }
  });
  
  return {
    // Customer
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    
    // Club status
    current_stage: stage.name,
    discount_percentage: stage.discount_percentage,
    discount_code: stage.discount_code,
    expires_at: expiresAt.toLocaleDateString(),
    expires_at_iso: expiresAt.toISOString(),
    days_remaining: daysRemaining,
    is_expiring_soon: daysRemaining <= 30,
    
    // Purchase requirements
    min_purchase_amount: stage.min_purchase_amount,
    
    // Upgrade path
    next_stage: nextStage?.name || null,
    next_stage_discount: nextStage?.discount_percentage || null,
    next_stage_amount: nextStage?.min_purchase_amount || null,
    has_upgrade_available: !!nextStage,
    
    // Loyalty
    points_balance: customer.loyalty_points_balance,
    points_lifetime: customer.loyalty_points_lifetime,
    points_earned_this_month: pointsThisMonth._sum.points || 0,
    is_earning_points: customer.loyalty_earning_active,
    
    // Winery
    winery_name: client.org_name,
    winery_logo_url: client.logo_url || null,
    shop_url: getShopUrl(client),
    
    // Suggested purchases (placeholder for AI)
    suggested_wines: []  // TODO: AI-driven recommendations
  };
}
```

## Klaviyo Automation Seeding

- When a client selects Klaviyo during setup, we automatically:
  - Seed custom metrics for every transactional trigger (`CLUB_SIGNUP`, `MONTHLY_STATUS`, `EXPIRATION_WARNING`, `EXPIRATION_NOTICE`).
  - Optionally seed marketing triggers (`MONTHLY_STATUS_PROMO`, `ANNUAL_RESIGN`, `SALES_BLAST`) when the "Enable promotional Klaviyo flows" toggle is selected.
  - Create a dedicated flow per metric with a ready-to-edit email message and attach the seeded metric as the trigger.
  - Create HTML + text templates that follow the LiberoVino liberated tone and populate them with our dynamic placeholders.
- Klaviyo resource identifiers are persisted in `communication_configs.provider_data`:

```json
{
  "seededAt": "2025-11-12T19:42:00.000Z",
  "includeMarketing": true,
  "metrics": {
    "MONTHLY_STATUS": { "id": "metric_123", "name": "LiberoVino.MonthlyStatus" }
  },
  "flows": {
    "MONTHLY_STATUS": { "id": "flow_456", "metricId": "metric_123", "templateId": "template_789" }
  },
  "templates": {
    "MONTHLY_STATUS": { "id": "template_789", "subject": "{{ first_name }}, your {{ current_stage }} benefits remain wide open" }
  }
}
```

- Re-run seeding at any time via:

```
npm run klaviyo:seed <client-id> [--marketing]
```

  - Uses the stored API key/from info in `communication_configs`.
  - `--marketing` reseeds the optional marketing flows.
  - Safe to re-run; templates update in place, flows are idempotent.

## Mailchimp Automation Seeding

- When a client selects Mailchimp during setup, we automatically:
  - Create or find the Mailchimp audience (list) named "LiberoVino Members" (or custom name if provided).
  - Seed email templates for every transactional trigger (`CLUB_SIGNUP`, `MONTHLY_STATUS`, `EXPIRATION_WARNING`, `EXPIRATION_NOTICE`).
  - Optionally seed marketing templates (`MONTHLY_STATUS_PROMO`, `ANNUAL_RESIGN`, `SALES_BLAST`) when marketing is enabled.
  - Create date merge fields for tracking when each event was last triggered (e.g., `LVMONTH`, `LVWARN`). Note: Mailchimp limits merge field tags to 10 characters, so names are shortened. All fields are prefixed with "LV" to avoid conflicts.
  - Templates use Mailchimp merge tag syntax (`*|FNAME|*`, `*|LNAME|*`, etc.) and follow the LiberoVino liberated tone.
- Mailchimp resource identifiers are persisted in `communication_configs.provider_data`:

```json
{
  "seededAt": "2025-11-12T19:42:00.000Z",
  "includeMarketing": true,
  "serverPrefix": "us21",
  "marketingAccessToken": "...",
  "audienceId": "abc123def456",
  "audienceName": "LiberoVino Members",
  "templates": {
    "MONTHLY_STATUS": { "id": "template_789", "name": "LiberoVino – Monthly Status" }
  }
}
```

- **Important**: Mailchimp flows must be created and activated manually in the Mailchimp UI. LiberoVino only:
  - Creates templates (which can be used in flows)
  - Applies tags to trigger flows (e.g., `LiberoVino::MonthlyStatus`)
  - Updates merge fields with dates (for date-based flow triggers)
- Flow setup in Mailchimp:
  - Create a flow with trigger "Tag added" or "Tag is" matching the tag name (e.g., `LiberoVino::MonthlyStatus`).
  - For recurring events, configure flows to trigger on merge field date updates or use date-based conditions.
  - Use the seeded templates in your flow email steps.
  - Ensure the flow is published/active to receive triggers.

## Provider Implementations

### Mailchimp Provider

Mailchimp uses a tag-based and merge field-based approach rather than direct email sending:

```typescript
export class MailchimpProvider implements CommunicationProvider {
  name = 'Mailchimp';
  type = 'email' as const;
  
  // Mailchimp does not support direct email sends
    // Instead, we apply tags and update merge fields to trigger flows
  async sendEmail(params: EmailParams): Promise<EmailResult> {
    throw new Error(
      'Mailchimp direct sends are not supported. Configure flows to deliver email automations.'
    );
  }
  
  async trackEvent(params: TrackEventParams): Promise<TrackEventResult> {
    // 1. Create or update member in audience
    const emailHash = this.hashEmail(params.customer.email);
    await this.requestMarketing(
      `/lists/${this.audienceId}/members/${emailHash}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          email_address: params.customer.email,
          status: 'subscribed',
          status_if_new: 'subscribed',
          merge_fields: this.buildMergeFields(params.customer.properties),
        }),
      }
    );
    
    // 2. Apply tag to trigger flow (if event tag provided)
    if (params.event) {
      await this.applyTag(params.customer.email, params.event);
    }
    
    // 3. Update merge field with current date (for recurring events)
    if (params.event) {
      await this.updateEventMergeField(params.customer.email, params.event);
    }
    
    return { success: true };
  }
  
  private async applyTag(email: string, tag: string): Promise<void> {
    // Apply tag to member (triggers "Tag added" flow events)
    const emailHash = this.hashEmail(email);
    await this.requestMarketing(
      `/lists/${this.audienceId}/members/${emailHash}/tags`,
      {
        method: 'POST',
        body: JSON.stringify({
          tags: [{ name: tag, status: 'active' }],
        }),
      }
    );
  }
  
  private async updateEventMergeField(email: string, eventTag: string): Promise<void> {
    // Update merge field with today's date (YYYY-MM-DD format)
    // This enables date-based flow triggers for recurring events
    const mergeFieldName = this.getMergeFieldForEvent(eventTag);
    const today = new Date();
    const dateValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const emailHash = this.hashEmail(email);
    await this.requestMarketing(
      `/lists/${this.audienceId}/members/${emailHash}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          merge_fields: {
            [mergeFieldName]: dateValue,
          },
        }),
      }
    );
  }
}
```

**Key Points:**
- **Tags**: Applied to members to trigger "Tag added" flow events. One-time events (like `CLUB_SIGNUP`) work well with tag triggers.
- **Merge Fields**: Date fields (e.g., `LVMONTH`, `LVTEST`) are updated with the current date (YYYY-MM-DD format) when events occur. These are used for tracking purposes. Note: Mailchimp limits merge field tags to 10 characters, so names are shortened. All fields are prefixed with "LV" to avoid conflicts.
- **Flows**: Must be configured in Mailchimp UI to trigger on tags or merge field updates. LiberoVino only provides the data triggers.
- **Templates**: Created via API during seeding and can be used in flow email steps.

### Klaviyo Provider

```typescript
export class KlaviyoProvider implements CommunicationProvider {
  name = 'Klaviyo';
  type = 'both' as const;
  
  async sendEmail(params: EmailParams): Promise<EmailResult> {
    const response = await fetch('https://a.klaviyo.com/api/v1/campaign', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${params.config.email_api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_id: params.templateId,
        to: params.to,
        context: params.templateData
      })
    });
    
    const result = await response.json();
    
    return {
      success: true,
      messageId: result.id,
      provider: 'klaviyo'
    };
  }
  
  async sendSMS(params: SMSParams): Promise<SMSResult> {
    // Klaviyo also handles SMS
    const response = await fetch('https://a.klaviyo.com/api/v1/sms', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${params.config.sms_api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone_number: params.to,
        message: params.message,
        from_number: params.from
      })
    });
    
    const result = await response.json();
    
    return {
      success: true,
      messageId: result.id,
      provider: 'klaviyo'
    };
  }
}
```

## Communication Manager

```typescript
export class CommunicationManager {
  private providers: Map<string, CommunicationProvider> = new Map();
  
  constructor() {
    this.providers.set('mailchimp', new MailchimpProvider());
    this.providers.set('klaviyo', new KlaviyoProvider());
    this.providers.set('sendgrid', new SendGridProvider());
    this.providers.set('twilio', new TwilioProvider());
  }
  
  async sendMonthlyStatus(client, customer, statusData) {
    const config = await db.communication_configs.findByClientId(client.id);
    
    if (!config) {
      console.log(`No communication config for client ${client.id}`);
      return;
    }
    
    // Send email
    if (config.email_provider && customer.email) {
      const emailProvider = this.providers.get(config.email_provider);
      const template = await db.communication_templates.findOne({
        where: {
          client_id: client.id,
          template_type: 'monthly_status',
          channel: 'email'
        }
      });
      
      try {
        const result = await emailProvider.sendEmail({
          to: customer.email,
          subject: template.subject,
          templateId: template.provider_template_id,
          templateData: statusData,
          config: config
        });
        
        // Log success
        await db.communication_log.create({
          client_id: client.id,
          customer_id: customer.id,
          template_type: 'monthly_status',
          channel: 'email',
          provider: config.email_provider,
          to_address: customer.email,
          status: 'sent',
          provider_message_id: result.messageId,
          sent_at: new Date()
        });
      } catch (error) {
        // Log failure
        await db.communication_log.create({
          client_id: client.id,
          customer_id: customer.id,
          template_type: 'monthly_status',
          channel: 'email',
          provider: config.email_provider,
          to_address: customer.email,
          status: 'failed',
          error_message: error.message
        });
      }
    }
    
    // Send SMS
    if (config.sms_provider && customer.phone) {
      const smsProvider = this.providers.get(config.sms_provider);
      const template = await db.communication_templates.findOne({
        where: {
          client_id: client.id,
          template_type: 'monthly_status',
          channel: 'sms'
        }
      });
      
      // Replace variables in SMS template
      const message = replaceVariables(template.text_body, statusData);
      
      try {
        const result = await smsProvider.sendSMS({
          to: customer.phone,
          from: config.sms_from_number,
          message: message,
          config: config
        });
        
        await db.communication_log.create({
          client_id: client.id,
          customer_id: customer.id,
          template_type: 'monthly_status',
          channel: 'sms',
          provider: config.sms_provider,
          to_address: customer.phone,
          status: 'sent',
          provider_message_id: result.messageId,
          sent_at: new Date()
        });
      } catch (error) {
        // Log and continue
        console.error('SMS send failed:', error);
      }
    }
  }
}
```

## Expiration Warning (7 Days Before)

```typescript
// Run daily to check for upcoming expirations
async function sendExpirationWarnings() {
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + 7);  // 7 days from now
  
  const expiringEnrollments = await db.club_enrollments.findMany({
    where: {
      status: 'active',
      expires_at: {
        gte: new Date(),
        lte: warningDate
      }
    },
    include: {
      customer: {
        include: { communication_preferences: true }
      },
      club_stage: true
    }
  });
  
  for (const enrollment of expiringEnrollments) {
    // Check if we already sent warning
    const alreadySent = await db.communication_log.findFirst({
      where: {
        customer_id: enrollment.customer_id,
        template_type: 'expiration_warning',
        created_at: {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)  // Last 14 days
        }
      }
    });
    
    if (alreadySent) continue;
    
    // Send warning
    const statusData = await calculateCustomerStatus(
      enrollment.customer, 
      enrollment
    );
    
    await communicationManager.sendExpirationWarning(
      client,
      enrollment.customer,
      statusData
    );
  }
}

// Schedule daily at 10 AM
cron.schedule('0 10 * * *', sendExpirationWarnings);
```

## Admin UI for Template Management

### Template Editor

```typescript
export default function TemplateEditor() {
  const [template, setTemplate] = useState({
    template_type: 'monthly_status',
    channel: 'email',
    subject: 'Your {{current_stage}} Wine Club Status',
    html_body: '...',
    custom_content: ''  // Winery-specific section
  });
  
  const availableVariables = [
    { key: 'first_name', description: 'Customer first name' },
    { key: 'current_stage', description: 'Club tier (Bronze, Silver, Gold)' },
    { key: 'discount_percentage', description: 'Current discount %' },
    { key: 'expires_at', description: 'Expiration date' },
    { key: 'days_remaining', description: 'Days until expiration' },
    { key: 'min_purchase_amount', description: 'Minimum to renew' },
    { key: 'points_balance', description: 'Current loyalty points' },
    // ... all variables
  ];
  
  return (
    <Page title="Email Template Editor">
      <Layout>
        <Layout.Section>
          <Card>
            <TextField
              label="Subject Line"
              value={template.subject}
              onChange={(value) => setTemplate({ ...template, subject: value })}
              helpText="Use {{variable}} for dynamic content"
            />
            
            <RichTextEditor
              label="Email Body"
              value={template.html_body}
              onChange={(value) => setTemplate({ ...template, html_body: value })}
            />
            
            <TextArea
              label="Custom Winery Content"
              value={template.custom_content}
              helpText="Add your winery's unique message here"
            />
          </Card>
        </Layout.Section>
        
        <Layout.Section variant="oneThird">
          <Card title="Available Variables">
            {availableVariables.map(v => (
              <div key={v.key}>
                <code>{`{{${v.key}}}`}</code>
                <Text variant="bodySm">{v.description}</Text>
              </div>
            ))}
          </Card>
          
          <Card title="Preview">
            <TemplatePreview 
              template={template} 
              sampleData={sampleCustomerData}
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
```

## Future: AI-Driven Suggestions

### Suggested Wines Algorithm

```typescript
async function getSuggestedWines(customer, client) {
  // Factors to consider:
  // - Customer's purchase history
  // - What's needed to maintain/upgrade tier
  // - Seasonal recommendations
  // - Inventory levels
  // - Price point matching customer's usual spend
  
  // Phase 1: Rule-based
  const customerOrders = await getCustomerOrders(customer.id);
  const avgOrderValue = calculateAverage(customerOrders.map(o => o.total));
  const preferredWineTypes = getPreferredTypes(customerOrders);
  
  const suggestions = await db.products.findMany({
    where: {
      client_id: client.id,
      wine_type: { in: preferredWineTypes },
      price: {
        gte: avgOrderValue * 0.8,
        lte: avgOrderValue * 1.2
      }
    },
    orderBy: { created_at: 'desc' },
    take: 3
  });
  
  // Phase 2: ML-based (future)
  // - Collaborative filtering
  // - Customer clustering
  // - Seasonal patterns
  // - Inventory optimization
  
  return suggestions;
}
```

## Environment Variables

Add to `env.example`:

```bash
# Communication Platform Keys (per client, can also be stored in DB)
# These are defaults if client doesn't configure their own

# Mailchimp
MAILCHIMP_API_KEY=your_mailchimp_api_key

# Klaviyo
KLAVIYO_API_KEY=your_klaviyo_api_key

# SendGrid (LiberoVino managed defaults)
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@liberovino.com
SENDGRID_FROM_NAME=LiberoVino


# Twilio (alternative SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+15551234567
```

## Admin UI Features

### Communication Dashboard

```
Metrics to show:
├─ Monthly emails sent
├─ Email open rates
├─ SMS delivery rates
├─ Customer preferences breakdown
├─ Upcoming scheduled sends
└─ Recent communication log
```

### Template Management

```
Features:
├─ Create/edit templates per type
├─ Preview with sample data
├─ Test send to yourself
├─ Variable insertion helper
├─ Custom content section
└─ A/B testing (future)
```

### Communication Settings

```
Configure per winery:
├─ Choose email provider (Mailchimp/Klaviyo/SendGrid)
├─ Choose SMS provider (Mailchimp/Klaviyo/Twilio)
├─ Set API keys
├─ Configure from addresses/numbers
├─ Enable/disable monthly sends
├─ Set warning days (7, 14, 30)
└─ Default opt-in settings
```

## Benefits

✅ **Multi-provider support** - Wineries use what they already have  
✅ **Customizable content** - Each winery's unique voice  
✅ **Automated reminders** - Reduces churn from forgotten expirations  
✅ **Status transparency** - Customers know exactly where they stand  
✅ **Upgrade incentives** - Built-in cross-sell opportunities  
✅ **Preference management** - Respect customer communication preferences  
✅ **Full audit trail** - Track all communications  
✅ **Rate limit friendly** - Batch processing with delays  

## Implementation Phases

### Phase 1: Foundation
- [ ] Create database tables
- [ ] Build provider abstraction
- [x] Implement Mailchimp provider (tag-based triggers with merge fields for recurring events)
- [ ] Basic template system
- [ ] Monthly cron job

### Phase 2: Multi-Provider
- [ ] Klaviyo provider
- [ ] RedChirp provider
- [ ] SendGrid backup
- [ ] Provider selection UI

### Phase 3: Advanced Features
- [ ] A/B testing templates
- [ ] Advanced segmentation
- [ ] AI wine recommendations
- [ ] Analytics dashboard
- [ ] Triggered campaigns (beyond monthly/expiration)

Ready to add the communication tables to the migration?

