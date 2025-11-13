# Communication Pre-Release TODOs

A running backlog of follow-up items to complete before launch once the core email automation work is done.

## Klaviyo Onboarding

- [ ] Surface flow activation status in the Email Communication Setup screen (show “Sync”/“Live” badges, highlight Draft flows).
- [ ] After the client saves their Klaviyo config, check for any flows still in draft and prompt them with next steps.
- [ ] Add a checklist reminder on the setup screen summarizing: seed successful, flows live, test flow triggered, transactional addresses verified.

## Provider Parity

- [ ] Implement SendGrid test send parity (either direct email or equivalent metric trigger) once SendGrid automations are wired.
- [ ] Add Mailchimp provider support and seed logic; mirror the “Send Test” UX when API coverage exists.
- [ ] Abstract post-enrollment automation (currently Klaviyo-only) so each provider can register its own hooks.

## Enrollment Flow Enhancements

- [ ] Provide a visual indicator in the enrollment review step when Klaviyo events were triggered successfully versus skipped (e.g., unsubscribed).
- [ ] Store the last automation timestamp in `provider_data` so support can confirm when flows last ran.
- [ ] Log warnings in-app if Klaviyo returns a 4xx/5xx during enrollment so the client can retry or contact support.

## Documentation & Support

- [ ] Extend COMMUNICATION_STRATEGY.md with an “After Setup” section covering flow activation and QA steps.
- [ ] Add troubleshooting notes for Send Test (flow still draft, API key missing, etc.).
- [ ] Prepare a short video or step-by-step guide walking wineries through activating the seeded flows.

(Keep this list updated as we integrate additional channels like SMS and Mailchimp.)
