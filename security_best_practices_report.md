> Deployment integration update: merged existing upstream changes through b550830, preserving single-use invite codes, scheduled functions, timezone fixes and database hardening migrations already in the remote repository. The earlier findings below describe the pre-merge checkout: the remote now includes a service-only push policy migration and webhook literal-host checks. Deployed migration status is not verified; webhook DNS/redirect validation remains a follow-up. The household menu now uses invite codes instead of PIN sharing. Post-merge tests: 229 passed.

# Focused security review

3 November 2026. This review covers the redesign's data boundaries and adjacent authentication, notification and dependency paths. It is not a penetration test or verification of deployed Supabase policies.

## Implemented protections

1. Push registration verifies the user with Supabase Auth and derives the household through `current_user_pin` before privileged writes. A different client-supplied PIN is rejected. Request formats are preserved. Anonymous and cross-household regression tests pass.
2. Push subscription validation checks runtime input, bounded key/URL formats and known HTTPS browser push destinations. Sending also validates stored destinations, preventing bypass of the endpoint check through older rows.
3. Notification jobs fail closed without a configured `CRON_SECRET`; tests verify rejection before service-role access.
4. Calendar import/sync and push registration reject cross-origin browser mutations. Privileged client creation moved to `supabase-admin.ts` with a `server-only` boundary.
5. Security headers prevent framing, MIME sniffing, object embedding and external base URLs. The CSP is a baseline, not a full script-nonce policy.
6. Household PIN is revealed deliberately; account sign-out clears workspace state. New content uses React text rendering rather than raw HTML.
7. Next.js updated from 16.2.1 to 16.4.4 and compatible dependency fixes applied. Production audit reports zero vulnerabilities. Development lint tooling retains moderate minimatch-related advisories; forced remediation was rejected because it proposes a breaking downgrade.

## Remaining findings

### SEC-01 — Resolved: permissive push-subscription database policy

Was: `supabase/migrations/20260407000000_add_push_subscriptions.sql` created an all-operations policy with `USING (true)` and `WITH CHECK (true)`.

Fixed by `supabase/migrations/20261102010000_lock_down_server_tables.sql`, which drops that policy (and the equally open ones on `notification_log` and `suggestion_feedback`), keeps RLS on with no policies and revokes table access from `anon` and `authenticated`. Only the service role, used by API routes, can reach these tables. Later service-only tables (`item_push_log`, `prayer_push_log`) follow the same pattern. Confirm the migration has been applied to the deployed project.

### SEC-02 — Medium (partly mitigated): notification webhook destinations

Evidence: `src/app/api/notifications/route.ts:58-65` sends a server-side request to a stored URL; the webhook dispatch at line 153 obtains it from `config.channel_value`.

An account able to configure a webhook can potentially direct privileged server requests toward internal services. The cron secret blocks unauthorized job invocation, but does not validate stored destinations. Remediation requires a destination allowlist or public-destination checks with DNS/IP handling, redirect restrictions and deployment egress controls. Mitigation since this review: `src/lib/webhook-url.ts` now requires public HTTPS URLs and rejects literal private, loopback and link-local hosts. Redirects are not followed (`redirect: "manual"` in `src/app/api/notifications/route.ts`). Still open: a public hostname that resolves to a private address (DNS rebinding) is not checked; add resolved-IP checks before enabling untrusted household webhook configuration.

## Verification limits

Live Supabase policies/grants, deployed headers, provider-level rate limits, OAuth provider settings and genuine notification delivery were not changed or verified. Do not interpret passing local tests or a clean dependency audit as proof that the deployed system is fully secure.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [verified user lookup](https://supabase.com/docs/reference/javascript/auth-getuser). Service-role credentials bypass row-level security, so explicit tenant authorization is required before privileged operations.
