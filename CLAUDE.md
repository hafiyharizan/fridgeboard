@AGENTS.md

# Fridgeboard — Codebase Guide for AI Assistants

## What This App Is

Fridgeboard is a shared household management app: grocery lists, to-do lists, and a family calendar. Members sign in with Google and belong to a household. Multiple devices share data in real time via Supabase.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.4 (App Router) |
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
    page.tsx                    # Sign-in (renders PinEntry: Google sign-in)
    setup-household/, setup-pin/, auth/   # Onboarding and OAuth callback
    list/page.tsx               # Signed-in app — renders ListShell (client)
    layout.tsx                  # Root layout (Plus Jakarta Sans, manifest, viewport)
    globals.css                 # Tailwind + global tokens
    workspace.css               # Signed-in workspace design system (Warm & Homely)
    api/
      notifications/            # Cron: calendar reminders (email/Telegram/webhook)
      push/subscribe/           # Register a device for Web Push
      push/new-item/            # Alert the household about a new list item
      push/remind/              # Cron: grocery reminder / morning summary
      push/prayer/              # Cron: athan push at prayer times
      calendar/{feed,import,sync}/  # iCal feed, holiday imports, sync links
      version/                  # Live deploy id (kitchen display self-update)
      news/                     # Perth headlines for the Home news card (server-side RSS)
      stocks/                   # Market numbers for the news card (Yahoo Finance chart API)
  components/
    ListShell.tsx               # Auth check, loads household lists
    WorkspaceData.tsx           # Realtime controllers + household context (members, settings, adder)
    HouseholdWorkspace.tsx      # Header, tabs, dialogs, kitchen mode wiring
    HomeDashboard.tsx           # Home grid + AmbientLayer (idle "today" view data)
    WorkTab.tsx                 # Weekly work roster (Work tab) + shift editor
    MemberTag.tsx               # Owner tag, person colours, useEveryone / lookup helpers
    HouseholdPeople.tsx         # "People" in the household dialog (colours, kids without accounts)
    Ambient.tsx                 # Outside card (clock + weather + prayer), athan banner, idle view, place settings
    Sky.tsx                     # Animated sky behind the Outside card
    KitchenDisplay.tsx          # Settings hold button, sync badge, kitchen switch
    WhoIsAdding.tsx             # Kitchen display member picker
    ListTab.tsx, ItemRow.tsx, AddItemInput.tsx, SuggestionPanel.tsx
    CalendarTab.tsx, CalendarGrid.tsx, CalendarDialogs.tsx, AddEventModal.tsx,
    DayDetailSheet.tsx, EventDetail.tsx, CalendarSettings.tsx
    InstallPrompt.tsx, PushNotificationButton.tsx, InvitePanel.tsx, Dialog.tsx
  hooks/
    useRealtimeItems.ts, useRealtimeCalendar.ts   # Live data, refresh on wake
    useHouseholdInfo.ts         # Members + household_settings
    useWorkShifts.ts            # Live work roster (work_shifts)
    useKitchenDisplay.ts        # Wake lock, idle, night, self-update
    useAmbient.ts               # useNow, useWeather, usePrayerDay, useAthan, useNews
    useModalSurface.ts, watchWake.ts
    useWholeRows.ts             # One-screen Home: hide rows that would be cut off
  lib/
    types.ts                    # All types + Database schema type
    supabase.ts / supabase-admin.ts   # Browser/route clients / service client (server only)
    calendar.ts, dashboard.ts   # Recurrence expansion, Home helpers
    kitchen.ts                  # Kitchen display rules and timings
    weather.ts, prayer.ts       # Open-Meteo parsing, prayer times (adhan)
    news.ts                     # RSS/Atom parsing + Perth filter for the Home news card
    stocks.ts                   # STOCK_SYMBOLS, Yahoo chart parsing, price formatting
    work.ts                     # Work roster: weeks, overnight shifts, "everyone home" summary
    push.ts, new-item-push.ts   # Web Push sending and wording
    offline-snapshot.ts         # Last-known board for public/offline.html
supabase/migrations/            # SQL migrations (apply in filename order)
netlify/functions/              # Scheduled functions calling the cron routes
public/                         # sw.js, offline.html, manifest.json, icons
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

**`household_settings`** — one row per household (members read/write their own)
- `pin_code` PK, `location_name`, `latitude`, `longitude`, `timezone`
- `prayer_enabled`, `prayer_method` (adhan method name), `prayer_madhab` (`shafi`/`hanafi`), `athan_enabled`

**`items.added_by`** — member credited when an item is typed on a shared kitchen tablet ("who's adding?"); a trigger clears it unless that member is in the list's household. **`household_members()`** RPC returns name/avatar of the caller's household members.

**Owner tags** — list items show who added them (`added_by ?? created_by`). `calendar_events.owner_id` is whose plan it is (null = everyone), chosen with "Whose is it?" in the add form (defaults to the adder; on a kitchen display, the "Who's adding?" pick); a trigger clears it unless that member is in the event's household. `calendar_events.created_by` defaults to `auth.uid()`. `MemberTag` hides itself in one-person households.

**Household members & admins** — the household dialog's "Members" list is everyone who signed up and joined (`household_members()` returns `joined_at` and `is_admin`). A household can have several admins (`household_admins`, service role only). With none recorded, the admin is whoever created it (`households.created_by`), or for older households the first member to join. Admins can "Make admin" / "Remove admin" (`set_household_admin`; the last admin can't step down) and "Remove" a member from the household (`remove_household_member`: clears their `pin_code`, admin role, colour, work shifts and unused invites; not themselves). `is_household_admin()` is the RLS check.

**`household_people`** — colours, plus people who can't sign up (babies, kids). A row with `user_id` holds an account member's colour (name comes from their profile); a row without is someone with no account. Only admins add or remove people; members can change their own colour, admins anyone's (RLS). `calendar_events.owner_person_id` tags an event for someone without an account ("Whose is it?" lists everyone); `owner_id` still names account members. Triggers keep both inside the household. `MemberTag` / `useEveryone` merge accounts and people (`buildEveryone`); members without a chosen colour get one nobody has picked. UI in `components/HouseholdPeople.tsx`.

**`work_shifts`** — weekly work roster: one row per member per day (`unique (user_id, shift_date)`), `start_time`/`end_time` as `HH:MM` (end at or before start = overnight), optional `note`. Any household member can edit it; a trigger keeps `user_id` inside the household. Realtime enabled. Shown in the **Work** tab (Mon–Sun grid, "All home" column, copy last week) and as a line on Home's schedule (who works that day, when everyone is home).

**`prayer_push_log`**, **`item_push_log`** — single-use logs for athan and new-item pushes (service role only).

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
| `NEWS_FEEDS` | Optional | Home news card feeds: comma-separated `Label\|https://…` or `Label\|https://…\|local` RSS/Atom URLs, max 6. Only Perth/WA stories are kept unless a feed is `local` (default: ABC News WA + WAtoday in full, ABC Top Stories filtered) |
| `STOCK_SYMBOLS` | Optional | News card market line: comma-separated `Label\|SYMBOL` in Yahoo Finance form, max 4 (default `ASX 200\|^AXJO,AUD/USD\|AUDUSD=X`) |

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

### `POST /api/push/prayer`

Cron, every minute (same `event-reminders` scheduled function). For households with prayer times and athan alerts on, sends a push when a prayer time arrives (10-minute catch-up window), once per prayer per day via `prayer_push_log`. Times are calculated locally with `adhan` in the household's `timezone` (default `APP_TIMEZONE`).

### Weather and prayer times

Weather comes from Open-Meteo (no key) in the browser (`useWeather`), refreshed every 30 minutes and cached on the device. The Outside card is styled like the iPhone Weather app: "Home" + suburb, a large thin temperature, then a quiet line of UV, humidity and wind, a one-line tip (about tonight after dark) and tomorrow (`weatherTip`, `uvLevel` in `lib/weather.ts`). Behind it, `components/Sky.tsx` draws an animated sky chosen by `skyScene` (time of day from Open-Meteo sunrise/sunset: dawn, day, dusk, night × clear, partly, cloudy, fog, rain, storm, snow). The household location is set in the household dialog (Open-Meteo geocoding search). Prayer times are computed on the device (`usePrayerDay`). On a kitchen display with athan alerts on, `useAthan` shows a banner and plays `public/athan.mp3` if present, otherwise a soft chime.

### Offline fallback

`public/sw.js` serves `public/offline.html` when a page navigation fails. That page renders the last-known board that `OfflineSnapshotWriter` saves in localStorage (`fridgeboard.snapshot`, cleared on sign-out), read-only, and returns to `/list` when the connection is back.

### `GET /api/news`

Headlines for the Home news card. Fetches the fixed feed list from `NEWS_FEEDS` (never a URL from the client) on the server, since RSS has no CORS; 8s timeout; redirects followed by hand (max 3, https only); body capped at 2MB while downloading; 15-minute in-memory cache shared by concurrent requests; stale copy served if every feed fails. Parsing in `lib/news.ts` (no XML dependency, single forward scan so a malformed feed can't go quadratic): tags stripped, entities decoded, only http(s) links kept, merged newest first without duplicates. `useNews` in `hooks/useAmbient.ts` caches on the device (`fridgeboard.news`) and refreshes every 15 minutes and on wake.

### `GET /api/stocks`

Market numbers shown as one line above the news headlines. Fetches the fixed `STOCK_SYMBOLS` list (never a symbol from the client) from Yahoo Finance's public chart endpoint on the server; 8s timeout, no redirects, 200KB cap, 5-minute in-memory cache, last good numbers served if it fails. `useStocks` refreshes every 5 minutes and on wake; the line hides when there's nothing to show.

### `GET /api/version`

Returns `{ version }`, the build stamp `APP_VERSION` (Netlify `DEPLOY_ID`, else `COMMIT_REF`, else `"dev"`; set in `next.config.ts`). Kitchen displays poll it and reload while idle when it changes. `"dev"` never triggers a reload.

### Kitchen display mode

A per-device switch in the household menu (localStorage `fridgeboard.kitchen-mode`) for a wall tablet. Logic in `hooks/useKitchenDisplay.ts`, pure rules and timings in `lib/kitchen.ts`, UI in `components/KitchenDisplay.tsx`.

- Screen Wake Lock, re-acquired after the tablet wakes.
- After 2 minutes untouched: back to Home, dialogs closed. Overlays built on `useModalSurface` close via the `DISMISS_OVERLAYS_EVENT` window event.
- When idle: a full-screen "today" view (big time, next event, list counts, weather, next prayer) that swallows the first tap; dark and low-glare 22:00–06:00. An unsaved event form is parked and restored.
- "Who's adding?" member picker on list tabs; resets on idle.
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

**Note on `next/font/google`:** Fonts (Fraunces, Nunito) are downloaded from Google at build time and self-hosted. `npm run build` requires outbound HTTPS access to `fonts.googleapis.com`. Use `npm run build:local` in air-gapped CI. The font mock is in `test/font-mock.json`.

---

## Key Conventions

### Components
- All components are in `src/components/`. No co-located component files in `app/`.
- Client components use `"use client"` directive. Prefer server components for pages where possible; `list/page.tsx` is a client component because it uses hooks and sessionStorage.
- Do not add `"use client"` to files that don't need it.

### Styling
- Tailwind CSS v4 only. No CSS modules, no inline `style` props except for dynamic values.
- PostCSS config is in `postcss.config.mjs` using `@tailwindcss/postcss`.
- Global styles in `src/app/globals.css`.
- Design system "Warm & Homely" (kitchen ambient hub): warm cream canvas `#F7F5F0`, white cards, heritage sage `#6C8273` / deep laurel `#4C6153`, soft amber `#D99B65`, ink `#2B332E`. One font: Plus Jakarta Sans (`--font-body`; `--font-heading` points to it).
- Automatic light/dark: the signed-in app is light by day and dark from sunset to sunrise at home (`isDarkTime` in `lib/weather.ts`, using Open-Meteo sun times; fallback 6 AM–6 PM). `useAutoTheme` in `HouseholdWorkspace` sets `<html data-theme="dark">` before paint and updates `theme-color`; it's removed on sign-out, so sign-in and onboarding stay light. Dark tokens live under `:root[data-theme="dark"]` at the top of `workspace.css`. Deep greens stay mid-tone fills for white button text; text that used them reads `--sage-deep-text` / `--sage-ink-text`. New colours should come from tokens so both themes work.
- The signed-in workspace is styled in `src/app/workspace.css`, scoped to `.household-workspace` with tokens (`--sage`, `--amber-tint`, `--radius-card`, `--shadow-1`…) defined at the top. Shared pieces: `.card`, `.pill`, `.icon-tile`, `.check-control` + `.check-ring`, `.list-row`, `event-<color>` (sets `--event` / `--event-tint`).
- Home (`HomeDashboard`) is a three-column landscape layout (Outside card with clock, weather and "Next up" + Perth news with markets | Family Schedule | To-Do + Groceries) that fits 1280×800 without scrolling. On that one-screen layout, cards show whole rows only (`hooks/useWholeRows.ts` hides rows that would be cut off) with a "View all · N" link. Two columns below 1180px, one column below 760px (news moves last).
- The schedule is time-aware (`eventPhase`, `defaultScheduleDay` in `lib/dashboard.ts`): an event is "Now" from its start until an hour later, finished ones fold into "Earlier today", and Home opens on Tomorrow once today is over (or from 6 PM on an empty day). Prayer tiles switch to tomorrow's times after Isha (`prayerView` in `lib/prayer.ts`). News shows two headlines; "More news" opens the rest. Text meant to be read across the kitchen is at least 13–15px. Adding from Home uses the "+" buttons on the schedule, To-Do and Groceries cards. Touch targets are at least 48px.

### Animations
- Use Framer Motion (`framer-motion`) for all animations. Do not use CSS transitions for interactive UI elements — Framer Motion is already a dependency and is used throughout.
- Exception: the looping weather sky (`components/Sky.tsx`) uses CSS keyframes on transform/opacity, so an always-on tablet runs them on the compositor with no JavaScript per frame. Framer Motion only cross-fades between scenes. Loops stop under `prefers-reduced-motion`. Don't add `backdrop-filter` over the sky (it would re-blur every frame).

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
- `src/lib/work.test.ts` — week helpers, overnight shifts, "everyone home" summary
- `src/lib/news.test.ts` — feed parsing, merging, `NEWS_FEEDS`, Perth filter and story ages
- `src/lib/stocks.test.ts` — `STOCK_SYMBOLS`, Yahoo chart parsing, price/change formatting
- `src/app/api/news/route.test.ts` — redirect, size-cap and caching rules for `/api/news`

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
