# Admin lead workflow checks

Run `npm run test:leads` from `backend/`. Tests start an isolated MongoDB process,
use a temporary database directory, and remove it afterward. They never load
the application's `.env`, contact its database, or send real emails.

MongoDB `mongod` must be installed. On Windows the default binary is
`C:/Program Files/MongoDB/Server/7.0/bin/mongod.exe`; elsewhere it is `mongod`.
Set `MONGOD_BINARY` to use a different installed binary.

The same isolated integration suite also covers Platform Settings: validated
Super Admin-only persistence, maintenance API enforcement, signup blocking,
existing invitation access, configured trial durations and trial expiry.

## Platform settings

- Save changes persists support email, trial duration (1–365 days), maintenance
  and signup switches. Stedi remains the only configured verification provider.
- Support email is exposed in the client Support page and maintenance screen.
- Maintenance returns HTTP 503 for client-panel APIs, including sign-in and
  onboarding. Public platform status, logout, Admin APIs and the separately
  mounted Stripe webhook remain available. The client screen checks for recovery
  every minute while visible; normal operation has no extra status polling.
- There is currently no public self-registration flow. Disabling signups blocks
  new client creation/invitations in Admin; existing invitations still work when
  maintenance is off. It does not revoke existing users or their logins.
- Trial length applies to new trial records and new transitions to trial. Existing
  dated trials are preserved. Legacy undated trial records receive the configured
  duration from their first access after rollout. Expired trials retain login,
  account/security, billing and support access; operational APIs return
  `TRIAL_EXPIRED`. Existing paid Stripe checkout is not turned into a free trial.

## Automatic reminders

- The running backend checks incomplete tasks/follow-ups every minute. Items
  need a due date; reminders go to the lead owner, not the lead/contact.
- The owner must be active and retain `leads:view` and `tasks:view`, with the
  appropriate tenant access. Completion resolves the in-app reminder.
- Notification links and email links open `/leads?leadId=...`.
- SMTP and `ADMIN_APP_URL` configure delivery. Missing/failed SMTP retries
  after five minutes; in-app notifications still work. Production email links
  require an explicit Admin URL. `LEAD_REMINDERS_ENABLED=false` disables the
  scheduler. Backend downtime delays delivery until it runs again.
- Delivery timestamps and a five-minute database lease survive restarts and
  prevent normal concurrent/periodic duplicates. SMTP delivery is at least once:
  a crash after SMTP accepts a message but before the database records success
  can cause a duplicate email on retry. A stable Message-ID is supplied.
- The UI displays reminder delivery timestamps when lead details are refreshed.
