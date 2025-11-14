# SendGrid Setup & Testing Guide

Authoritative checklist for wiring SendGrid into LiberoVino during client onboarding. Use this when Klaviyo isn’t available or the winery prefers SendGrid for transactional messaging.

## 1. Prerequisites

- SendGrid account with **Mail Send** scope enabled on the API key (General Settings → API Keys → Create Restricted Key → toggle “Mail Send”).
- Domain authenticated (SPF + DKIM) and link branding verified. Single Sender verification alone is **not** enough for production.
- `support@ynosoftware.com`-style inbox monitored so SendGrid’s compliance emails receive a response during account review.

## 2. Environment Variables

Add the following to `.env.local` (or the environment that runs Remix):

```
LV_SENDGRID_API_KEY=SG.xxxxxx
LV_SENDGRID_FROM_EMAIL=support@ynosoftware.com
LV_SENDGRID_FROM_NAME=LiberoVino Support
```

`createCommunicationManager()` falls back to these defaults when Supabase does not yet have a stored provider config.

## 3. Supabase Communication Config

1. Go to **Setup → Email Communication** in the LiberoVino app.
2. Select **SendGrid** as the provider.
3. Paste the API key (it is encrypted at rest in `communication_configs`).
4. Enter the default **From Email/Name** that matches the authenticated domain.
5. Click **Save**. Switching providers automatically clears leftover Klaviyo keys to avoid accidental reuse.

## 4. Test Email Flow

1. In the same screen, click **Send Test Email**.
2. The server calls `sendClientTestEmail()` which routes directly through `SendGridProvider.sendEmail()`.
3. Expected response: HTTP 202 with empty body (SendGrid queues the message). Console log shows `SendGrid response ""`.
4. In SendGrid → Activity Feed, the event should progress `Received → Processed → Delivered`.

### If the email is not delivered

- **401 Unauthorized**: API key missing “Mail Send” permission or typo. Create a new key and update Supabase.
- **400 Invalid content order**: SendGrid requires `text/plain` before `text/html`. Code already enforces this; re-run after pulling latest.
- **Queued with no Delivered event**: usually account compliance review, suspended IP, or the recipient is on a suppression list. Open the event, note the Message ID, and contact SendGrid support.
- **404 Suppression**: Remove the address from Suppressions → Blocks/Bounces/Spam Reports and resend.

## 5. Enrollment Hooks

When SendGrid is the selected provider:

- `sendClientEmail()` drives enrollment confirmations and any direct transactional notices.
- `trackClientEvent()` returns `{ success: false }` because SendGrid doesn’t support Klaviyo-style metric triggers yet. This is expected until the provider parity project lands.

## 6. Current Limitations / Follow-Up Work

- SendGrid automation/marketing flows are **not** seeded. Clients must configure journeys in SendGrid manually or wait for the future parity layer.
- Flow status badges on the Email Communication screen still reflect Klaviyo-only data.
- No SendGrid equivalent of Klaviyo metrics/events (test flow, ClubSignup) yet. Reference `COMMUNICATION_PRE_RELEASE_TODOS.md` for the ongoing parity backlog.

Document last updated: 2025-11-14.

