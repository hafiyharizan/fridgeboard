@AGENTS.md

# Fridgeboard — Codebase Guide for AI Assistants

## What This App Is

Fridgeboard is a shared household management app: grocery lists, to-do lists, and a family calendar. Members sign in with Google and belong to a household. Multiple devices share data in real time via Supabase.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| UI | React 19.2.4 |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion 12 |
| Icons | Lucide React |
| Database + Realtime | Supabase (PostgreSQL) |
| Supabase client | `@supabase/ssr` ^0.9.0 |
| Language | TypeScript 5 (strict mode) |

**Before writing any Next.js or React code, read `node_modules/next/dist/docs/` — this is Next.js 16 with React 19 and has breaking changes from older versions.**

---

## Project Structure

```
src/
  app/
    page.tsx                    # Home — renders PinEntry
    layout.tsx                  # Root layout (IBM Plex Sans via next/font/local)
    globals.css                 # Design tokens + UI primitives (buttons, inputs, panels, modals)
    workspace.css               # App shell and per-view layouts
    fonts/                      # Bundled IBM Plex Sans woff2 files (SIL OFL)
    list/
      page.tsx                  # Main app — renders ListShell (client component)
    api/
      notifications/
        route.ts                # POST /api/notifications — cron-triggered notification sender
  components/
    PinEntry.tsx                # Google sign-in screen
    AuthScreen.tsx              # Shared logo + loading screen for auth/setup
    ModalFrame.tsx              # Shared overlay/panel/header for animated dialogs
    ListShell.tsx               # App shell — tab state, loads lists from Supabase
    ListTab.tsx                 # Grocery/to-do list view
    ItemRow.tsx                 # Single list item (check, delete)
    AddItemInput.tsx            # Input + suggestion dropdown for new items
    SuggestionPanel.tsx         # Smart suggestions panel
    CalendarTab.tsx             # Month calendar view
    CalendarGrid.tsx            # Calendar grid rendering
    AddEventModal.tsx           # Create/edit calendar events
    EventDetail.tsx             # View/edit a calendar event
    NotificationSettings.tsx    # Manage notification channels
  hooks/
    useRealtimeItems.ts         # Supabase Realtime subscription for list items
    useRealtimeCalendar.ts      # Supabase Realtime subscription for calendar events
  lib/
    types.ts                    # All TypeScript types + Database schema type
    supabase.ts                 # Browser Supabase client (singleton via createBrowserClient)
    calendar.ts                 # Recurrence expansion, date formatting, month logic
    suggestions.ts              # Static suggestion library (no API calls)
supabase/
  migrations/                   # SQL migration files (apply in filename order)
public/                         # Static assets (SVGs)
```

---

## Path Alias

Use `@/*` for all imports from `src/`. Example: `import { createSupabaseBrowserClient } from "@/lib/supabase"`.

---

## Authentication

Google sign-in via Supabase Auth. Each user has a `user_profiles` row whose `pin_code` links them to a household (the 4-digit PIN is the internal household ID, not a secret). RLS scopes household data with `public.current_user_pin()`.

- Clients may write only `display_name` / `avatar_url` on `user_profiles`; `pin_code` is set only by the security definer functions `create_household` and `join_household_with_invite`.
- `push_subscriptions`, `notification_log`, `item_push_log` and `suggestion_feedback` have RLS on with no policies: service role only, via API routes.
- Webhook notification URLs must be public HTTPS (`lib/webhook-url.ts`).
- New members join with a single-use invite code (8 chars, expires after 7 days) made by an existing member via `create_household_invite`. Joining by PIN was removed. Helpers live in `lib/invite-code.ts` and `lib/household.ts`.

---

## Database Schema

Managed via SQL migrations in `supabase/migrations/`. Apply in filename timestamp order.

### Tables

**`lists`** — household lists (e.g. "Groceries", "To-Do")
- `id` uuid PK, `name` text, `pin_code` text, `created_at` timestamptz

**`items`** — items belonging to a list
- `id` uuid PK, `list_id` uuid FK→lists, `text` text, `is_checked` bool, `checked_at` timestamptz|null, `created_at` timestamptz
- Realtime enabled

**`calendar_events`** — events with optional recurrence and notifications
- `id` uuid PK, `pin_code` text, `event_date` text (YYYY-MM-DD), `title` text, `note` text|null
- `event_type`: `"event" | "reminder" | "todo"`
- `color`: `"amber" | "blue" | "rose" | "green" | "purple"`
- `is_done` bool, `recurrence`: `"none" | "daily" | "weekly" | "biweekly" | "monthly" | "yearly"`
- `recurrence_end` text|null (YYYY-MM-DD), `notify_before` int (minutes), `notify_channels` text[]
- Realtime enabled

**`notification_channels`** — per-PIN notification endpoints
- `id` uuid PK, `pin_code` text, `channel_type`: `"email" | "telegram" | "webhook"`
- `channel_value` text, `label` text|null, `is_enabled` bool

**`notification_log`** — idempotency log for sent notifications
- `id` uuid PK, `event_id` uuid, `channel_type` text, `sent_at` timestamptz, `status` text

**`suggestion_feedback`** — tracks accepted/dismissed suggestions
- `id` uuid PK, `list_id` uuid, `suggestion_text` text, `action` text, `created_at` timestamptz

### Key Types (src/lib/types.ts)

```ts
FridgeList, Item, CalendarEvent, ExpandedCalendarEvent,
NotificationChannelConfig, Database,
CalendarEventType, StickyColor, Recurrence, NotifyChannel
```

Always import types from `@/lib/types`. Do not redefine them locally.

---

## Supabase Client

**Browser client** (use in components and hooks):
```ts
import { createSupabaseBrowserClient } from "@/lib/supabase";
const supabase = createSupabaseBrowserClient();
```

This is a singleton. Do not call `createBrowserClient` directly.

**Server/API client** (use in `route.ts` only):
```ts
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);
```

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (API routes) | Supabase service role key (server-side only) |
| `CRON_SECRET` | Yes (cron routes) | Bearer token for `/api/notifications` and `/api/push/remind`. If unset, those routes reject every request (fail closed). |
| `TELEGRAM_BOT_TOKEN` | Optional | For Telegram notification channel |
| `APP_TIMEZONE` | Optional | IANA zone for event dates/times in cron routes (default `Australia/Perth`; Netlify functions run in UTC) |

---

## API Routes

### `POST /api/notifications`

Cron-triggered notification dispatcher, called every minute by the `event-reminders` Netlify scheduled function.

- Auth: `Authorization: Bearer <CRON_SECRET>` header (required; checked by `lib/cron-auth.ts`)
- Finds `calendar_events` for today with `notify_before >= 0`
- Checks `notification_log` for idempotency
- Dispatches to enabled `notification_channels` matching `pin_code`
- Supports: email (Resend), Telegram (live), webhook (live)
- Returns `{ sent: number, checked: number }`

---

### `POST /api/push/new-item`

Called by `useRealtimeItems` right after a member adds a list item. Body: `{ itemId }` only.

- Auth: signed-in session + same origin. The server reads the item, list and adder's name itself; only the member who added the item (`items.created_by`) can announce it, within 10 minutes.
- `item_push_log` makes each announcement single-use.
- Skips the adder's own devices (`push_subscriptions.user_id`). Notifications are tagged per list, so a burst of additions replaces itself instead of stacking.

`InstallPrompt` (mounted in `HouseholdWorkspace`) suggests installing the app: a native install button on Chromium, Share → Add to Home Screen steps on iPhone/iPad (the only way iOS allows web push). "Not now" snoozes it for 30 days.

### `GET /api/version`

Returns `{ version }`, the build stamp `APP_VERSION` (Netlify `DEPLOY_ID`, else `COMMIT_REF`, else `"dev"`; set in `next.config.ts`). Kitchen displays poll it and reload while idle when it changes. `"dev"` never triggers a reload.

### Kitchen display mode

A per-device switch in the household menu (localStorage `fridgeboard.kitchen-mode`) for a wall tablet. Logic in `hooks/useKitchenDisplay.ts`, pure rules and timings in `lib/kitchen.ts`, UI in `components/KitchenDisplay.tsx`.

- Screen Wake Lock, re-acquired after the tablet wakes.
- After 2 minutes untouched: back to Home, dialogs closed. Overlays built on `useModalSurface` close via the `DISMISS_OVERLAYS_EVENT` window event.
- 22:00–06:00 while idle: dim overlay that swallows the first tap.
- Header and content shift ±3px every 10 minutes (burn-in).
- Settings button needs a press-and-hold (keyboard still opens it directly).
- "Live" / "Synced N min ago" badge from `useSyncStatus()` in `WorkspaceData`.

On every device, `useRealtimeItems` and `useRealtimeCalendar` refetch when the page becomes visible again, and resubscribe if it was hidden for over 5 minutes (`hooks/watchWake.ts`).

---

## Development Commands

```bash
npm run dev           # Start dev server (Next.js turbopack)
npm run build         # Production build (requires internet for Google Fonts)
npm run build:local   # Production build with mocked fonts — use in offline/restricted environments
npm run start         # Start production server
npm run lint          # ESLint (flat config, eslint.config.mjs)
npm test              # Run tests once (vitest run)
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

**Fonts:** IBM Plex Sans is bundled in `src/app/fonts/` and loaded with `next/font/local`, so `npm run build` needs no network access. `build:local` and `test/font-mock.json` are no longer required but still work.

---

## Key Conventions

### Components
- All components are in `src/components/`. No co-located component files in `app/`.
- Client components use `"use client"` directive. Prefer server components for pages where possible; `list/page.tsx` is a client component because it uses hooks and sessionStorage.
- Do not add `"use client"` to files that don't need it.

### Styling
- Tailwind CSS v4 only. No CSS modules, no inline `style` props except for dynamic values.
- PostCSS config is in `postcss.config.mjs` using `@tailwindcss/postcss`.
- **Design system** (`src/app/globals.css`): neutral canvas, white surfaces, hairline borders, one pine-green accent (`--accent`). Radii step up with elevation: controls 8px, panels 12px, overlays 16px; shadows only on things that float.
  - Tokens: `--canvas --surface --border --ink --ink-2 --muted --subtle --accent --danger …`, also exposed as Tailwind colours (`text-muted`, `bg-surface`, …).
  - Primitives (`@layer components`): `.btn` + `.btn-primary|secondary|ghost|danger|link`, `.btn-sm|lg|block`, `.icon-btn`, `.input .textarea .select`, `.field .field-label .field-hint`, `.segmented` (uses `aria-pressed`), `.panel .panel-header .panel-title .panel-body`, `.badge`, `.alert-error|warning|success`, `.empty-state`, `.skeleton`, `.overlay .modal .modal-header|body|footer`.
  - Event colours: put `tone-{amber|blue|rose|green|purple}` on an element and use `var(--tone)`, `var(--tone-soft)`, `var(--tone-ink)`.
  - Base element rules must stay inside `@layer base`; unlayered rules beat the component layer.
- Layouts for the shell and each view live in `src/app/workspace.css`. Phones (≤720px) get a bottom tab bar; the month grid shows coloured dots below 600px.
- Overlays: use `ModalFrame` (animated, focus-trapped via `useModalSurface`) or `Dialog` (native `<dialog>`). Mark the field to focus with `data-autofocus`.
- Copy: sentence case, no all-caps labels; buttons say what happens ("Add to calendar").

### Animations
- Use Framer Motion (`framer-motion`) for motion: overlays opening/closing, list rows entering/leaving, the kitchen switch. CSS transitions are only for short (120ms) colour/border changes on hover and focus. Keep motion tied to what the user just did; no decorative loops.

### State Management
- No global state library (no Redux, Zustand, etc.). State lives in React component state + Supabase Realtime hooks.
- Realtime hooks (`useRealtimeItems`, `useRealtimeCalendar`) return live data and handle subscription cleanup.

### Supabase Queries
- Always filter by `pin_code` for user-scoped data.
- Use the typed `Database` generic when creating clients to get type inference.
- Recurrence expansion is done client-side in `lib/calendar.ts` — recurring events are stored as a single row and expanded on read.

### Icons
- Use Lucide React only. Import individual icons: `import { Trash2 } from "lucide-react"`.

### TypeScript
- Strict mode is on. No `any`, no type assertions without comment explaining why.
- All database-related types must come from `@/lib/types`.

---

## Notification Integrations

All three channels are fully implemented in `src/app/api/notifications/route.ts`:

- **Email** — uses [Resend](https://resend.com). Requires `RESEND_API_KEY` and `RESEND_FROM_EMAIL` env vars. The `from` address must be a verified sender in your Resend account.
- **Telegram** — live. Requires `TELEGRAM_BOT_TOKEN`. The `channel_value` is the Telegram chat ID.
- **Webhook** — live. POSTs a JSON payload to the configured URL.

---

## Testing

Vitest is configured. Tests live alongside source files as `*.test.ts`.

- `src/lib/calendar.test.ts` — covers all pure calendar utilities and recurrence expansion
- `src/lib/suggestions.test.ts` — covers autocomplete and smartSuggest

The vitest config (`vitest.config.ts`) sets up the `@/*` path alias and uses the `node` environment (no DOM needed for pure utility tests).

---

## Deployment

Netlify is the target host. Configuration is in `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `.next`
- Plugin: `@netlify/plugin-nextjs` v5 (handles SSR + API routes as Netlify Functions)
- Node version: 20
- Set env vars in Netlify UI → Site configuration → Environment variables

Cron routes are called by Netlify Scheduled Functions in `netlify/functions/` (shared helper `netlify/lib/call-cron-route.ts`, which uses Netlify's `URL` and `CRON_SECRET` env vars): `event-reminders` every minute → `/api/notifications`, `morning-summary` 07:00 Perth (`0 23 * * *` UTC) and `grocery-reminder` 08:00 Perth (`0 0 * * *` UTC) → `/api/push/remind`. They only run on the published production deploy; use **Run now** in Netlify → Functions to test. Reminders stay due for 30 minutes after their trigger time (`lib/local-time.ts`); `notification_log` prevents duplicates.

---

## What Does NOT Exist

- No admin panel
- No server actions (all mutations go through Supabase client directly)
