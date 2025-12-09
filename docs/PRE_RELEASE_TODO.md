# Pre-Release TODO Backlog

A running list of follow-up items to complete before launch, spanning communication, enrollment, CRM, and documentation workstreams.

## Communication & Automations

- [ ] Surface Klaviyo flow activation status in the Email Communication Setup screen (Sync/Live badges, highlight Draft flows).
- [ ] After the client saves their Klaviyo config, check for any flows still in draft and prompt them with next steps.
- [ ] Add "after setup" checklist reminding wineries to activate Klaviyo flows and review content before going live (summarizing: seed successful, flows live, test flow triggered, transactional addresses verified).
- [ ] Implement SendGrid/Mailchimp post-enrollment hooks so each provider can run its own automations.
- [ ] Implement SendGrid test send parity (either direct email or equivalent metric trigger) once SendGrid automations are wired.
- [ ] Add Mailchimp provider support and seed logic; mirror the "Send Test" UX when API coverage exists.
- [ ] Extend "Send Test" to report success/failure across all providers and log activity for support.
- [ ] Document troubleshooting steps for "Send Test" and Klaviyo errors.
- [ ] Store the last automation timestamp in `provider_data` so support can confirm when flows last ran.
- [ ] Log warnings in-app if Klaviyo returns a 4xx/5xx during enrollment so the client can retry or contact support.
- [ ] Add email notification setup and templates for members when membership is cancelled via Commerce7 webhook (club-membership/update with status='Cancelled').

### Email Unsubscribe & Legal Compliance (CAN-SPAM, GDPR, CASL)

**Required by law before sending marketing emails:**

- [ ] Create unsubscribe route (`/unsubscribe/:token`) that:
  - Validates the token
  - Sets `unsubscribed_all = true` in `communication_preferences`
  - Records `unsubscribed_at` timestamp
  - Shows confirmation page (no login required)
  - Processes requests within 10 business days (ideally instant)
- [ ] Create preference management page (`/preferences/:token`) for granular control:
  - Allow toggling individual email types (monthly status, expiration warnings, promotions)
  - Allow toggling SMS preferences
  - Include "unsubscribe from all" option
  - No login/password required (token-based access)
- [ ] Add winery physical address to client configuration:
  - Add fields to `clients` table or `communication_configs` for physical address
  - Required by CAN-SPAM Act (must appear in every marketing email)
  - Fields needed: address line 1, address line 2 (optional), city, state/province, postal code, country
- [ ] Update all email templates to include compliant footer:
  - Physical mailing address of winery (or "c/o LiberoVino" address)
  - Clear unsubscribe link ("Unsubscribe from all")
  - Preference center link ("Manage email preferences")
  - Optional: Reason for receiving email ("You're receiving this as a LiberoVino member")
- [ ] Verify email provider configurations (Klaviyo, Mailchimp, SendGrid):
  - Confirm physical address is configured in provider settings
  - Verify List-Unsubscribe headers are enabled (RFC 8058 for one-click unsubscribe)
  - Set up complaint feedback loops for each provider
  - Test that provider's native unsubscribe mechanisms sync with our `communication_preferences` table
- [ ] Generate secure unsubscribe tokens:
  - Create token generation utility (signed JWT or similar)
  - Include customer_id, client_id, and expiration (suggest 90 days minimum)
  - Add token to all email template variables (`{{unsubscribe_url}}`, `{{preferences_url}}`)
- [ ] Test unsubscribe flow end-to-end:
  - User clicks unsubscribe link from email
  - Instant opt-out (no additional clicks or confirmations required for CAN-SPAM)
  - Confirmation page shows successful unsubscribe
  - Verify no more emails are sent to unsubscribed users
  - Test granular preferences (unsubscribe from promotions only, etc.)
- [ ] Document compliance requirements for winery clients:
  - Explain CAN-SPAM, GDPR, and CASL requirements
  - Requirement to include valid physical address
  - 10-day opt-out processing requirement
  - No fees or login barriers for unsubscribe
  - GDPR: Need explicit consent for EU recipients
  - Provide best practices guide

## Member Enrollment

- [ ] Add indicators in the enrollment review step showing whether automations ran (e.g., Klaviyo event success, unsubscribed).
- [ ] Log automation failures centrally (Supabase or monitoring) with actionable messages for support.
- [ ] Provide a post-enrollment summary email or Slack notification for winery staff (optional enhancement).

## CRM & Loyalty Integration

- [ ] Confirm bonus-point preload behavior for Commerce7 and design Shopify equivalent.
- [ ] Build abstractions so new CRM providers (e.g., Shopify) can hook into the same enrollment pipeline without duplication.
- [ ] Review loyalty edge cases (multiple enrollments, early renewals) and document reconciliation steps.
- [ ] Implement handling for Commerce7 webhook batch updates (bulk updates to members/customers).
- [ ] Add tier/club deletion member action configuration in tier setup:
  - [ ] UI option for clients to choose member action when tier is deleted (upgrade members, downgrade members, or cancel membership).
  - [ ] Store deletion action preference in database schema (club_stages or club_programs table).
  - [ ] Implement logic in `handleClubDelete()` to respect configured action (upgrade/downgrade/cancel).
  - [ ] Add email notification setup and templates for members when tier deletion occurs.

## Documentation & Support

- [ ] Update COMMUNICATION_STRATEGY.md and MEMBER_ENROLLMENT docs with the latest flows and screenshots.
- [ ] Extend COMMUNICATION_STRATEGY.md with an "After Setup" section covering flow activation and QA steps.
- [ ] Produce step-by-step guides or short screencasts for onboarding (seeding, activating flows, testing).
- [ ] Prepare a short video or step-by-step guide walking wineries through activating the seeded flows.
- [ ] Track open questions or dependencies (e.g., Mailchimp API readiness, SMS provider selection).

## Architecture & Code Quality

- [ ] Review all nested routes to ensure they follow the parent/child pattern with proper structure:
  - Parent routes should have loaders and render `<Outlet />` with shared Page/Layout
  - Child routes (including `_index.tsx`) should have their own loaders
  - Actions should use `redirect()` from React Router instead of client-side navigation workarounds and `redirectWithSessionUrl()`
  - Verify redirects work correctly with nested route structure

_Keep this backlog updated as additional APIs land or new pre-release polish items surface._
