# Warm & Homely implementation

Implemented 3 November 2026. The workspace remains at `/list`; existing sign-in, setup routes, database tables, migrations, RPCs and API request formats are retained.

## Changes

- Tablet shell, warm neutral/sage/peach surfaces, local live clock, Home navigation and household menu.
- Home combines a rolling seven-day schedule, upcoming occurrences, pending groceries and open tasks. Dense content links through to existing detailed tools.
- `WorkspaceData` owns one realtime controller per list and one calendar controller. Detailed list/calendar panels remain mounted to retain drafts and month navigation.
- Quick Add opens existing item entry or the existing event form. Failed writes retain drafts; failed event writes retain the dialog. Mutation results now explicitly indicate success.
- Larger touch controls, keyboard-accessible calendar buttons, focus containment, Escape dismissal, restored focus and reduced-motion support.
- Reconnect/error states and retry actions use existing Supabase subscriptions; no polling, offline write queue or new external service.
- Account menu reveals the household sharing PIN only on request. Existing calendar import, feed and notification controls remain in Calendar Settings.
- Next.js and compatible affected dependencies were updated for security. See `security_best_practices_report.md`.

## Validation

- Production build: passed on Next.js 16.4.4.
- Lint: passed.
- Vitest: 215 tests passed across 14 discovered files, including new summary/date and API authorization tests.
- Production dependency audit: zero reported vulnerabilities. Development tooling still reports moderate minimatch-related advisories; the audit's forced remediation proposes an incompatible ESLint downgrade and was not applied.
- Production browser checks used isolated HTTP/WebSocket fixtures, with no real household mutations: Home completion/count changes, detailed-list synchronization, add/delete, draft retention across navigation, Quick Add, event form, calendar month retention, Calendar Settings, Escape dismissal and deliberate PIN reveal passed.
- Failed item/event saves retain their drafts; event retry succeeds; checked state remains correct after reload with the fixture persistence layer.
- Home measured without horizontal overflow at 1280×800, 1024×768, 768×1024, 390×844 and 1440×900. Landscape/tablet and desktop samples fit without page scrolling; portrait/mobile scroll naturally. Screenshots were visually inspected.
- Local validation scripts and screenshots live under ignored `output/playwright/`.

## Before deployment

Verify Google OAuth, genuine cross-device Supabase delivery, calendar import/feed subscriptions and OS push permission/delivery against a test household. Those external integrations were preserved but were not exercised end-to-end with live accounts. Confirm the actual kitchen tablet's viewport and browser installation behaviour.

Configure `CRON_SECRET` for existing notification jobs; they now fail closed when it is absent. Review the remaining database policy and webhook risks in the security report before describing the application as fully secured.

No deployment, migration or database-policy change was performed. Optional weather, idle return, night mode and new PWA caching remain outside this implementation.
