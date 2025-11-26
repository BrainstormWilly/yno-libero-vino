# Pre-Release TODO Backlog

A running list of follow-up items to complete before launch, spanning communication, enrollment, CRM, and documentation workstreams.

## Communication & Automations

- [ ] Surface Klaviyo flow activation status in the Email Communication Setup screen (Sync/Live badges).
- [ ] Add “after setup” checklist reminding wineries to activate Klaviyo flows and review content before going live.
- [ ] Implement SendGrid/Mailchimp post-enrollment hooks so each provider can run its own automations.
- [ ] Extend “Send Test” to report success/failure across all providers and log activity for support.
- [ ] Document troubleshooting steps for “Send Test” and Klaviyo errors.

## Member Enrollment

- [ ] Add indicators in the enrollment review step showing whether automations ran (e.g., Klaviyo event success, unsubscribed).
- [ ] Log automation failures centrally (Supabase or monitoring) with actionable messages for support.
- [ ] Provide a post-enrollment summary email or Slack notification for winery staff (optional enhancement).

## CRM & Loyalty Integration

- [ ] Confirm bonus-point preload behavior for Commerce7 and design Shopify equivalent.
- [ ] Build abstractions so new CRM providers (e.g., Shopify) can hook into the same enrollment pipeline without duplication.
- [ ] Review loyalty edge cases (multiple enrollments, early renewals) and document reconciliation steps.

## Documentation & Support

- [ ] Update COMMUNICATION_STRATEGY.md and MEMBER_ENROLLMENT docs with the latest flows and screenshots.
- [ ] Produce step-by-step guides or short screencasts for onboarding (seeding, activating flows, testing).
- [ ] Track open questions or dependencies (e.g., Mailchimp API readiness, SMS provider selection).

## Architecture & Code Quality

- [ ] Review all nested routes to ensure they follow the parent/child pattern with proper structure:
  - Parent routes should have loaders and render `<Outlet />` with shared Page/Layout
  - Child routes (including `_index.tsx`) should have their own loaders
  - Actions should use `redirect()` from React Router instead of client-side navigation workarounds and `redirectWithSessionUrl()`
  - Verify redirects work correctly with nested route structure

_Keep this backlog updated as additional APIs land or new pre-release polish items surface._
