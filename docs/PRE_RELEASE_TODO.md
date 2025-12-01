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
