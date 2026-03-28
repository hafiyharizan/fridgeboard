@AGENTS.md

# Fridgeboard — Codebase Guide for AI Assistants

## What This App Is

Fridgeboard is a shared household management app: grocery lists, to-do lists, and a family calendar. Access is PIN-based (no user accounts). Multiple devices share data in real time via Supabase.

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
    layout.tsx                  # Root layout (Fraunces + Nunito fonts)
    globals.css                 # Tailwind base styles
    list/
      page.tsx                  # Main app — renders ListShell (client component)
    api/
      notifications/
        route.ts                # POST /api/notifications — cron-triggered notification sender
  components/
    PinEntry.tsx                # PIN authentication screen
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

PIN-based only — no user accounts, no NextAuth, no cookies. The PIN is entered on the home page and stored in `sessionStorage`. All Supabase queries filter by `pin_code`. RLS is open at the database level; access control is entirely in application code.

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
| `CRON_SECRET` | Recommended | Bearer token to protect `/api/notifications` |
| `TELEGRAM_BOT_TOKEN` | Optional | For Telegram notification channel |

---

## API Routes

### `POST /api/notifications`

Cron-triggered notification dispatcher. Call every minute via Vercel Cron, GitHub Actions, etc.

- Auth: `Authorization: Bearer <CRON_SECRET>` header (skipped if `CRON_SECRET` is unset)
- Finds `calendar_events` for today with `notify_before >= 0`
- Checks `notification_log` for idempotency
- Dispatches to enabled `notification_channels` matching `pin_code`
- Supports: email (stubbed — integrate Resend/SendGrid/SES), Telegram (live), webhook (live)
- Returns `{ sent: number, checked: number }`

---

## Development Commands

```bash
npm run dev      # Start dev server (Next.js turbopack)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint (flat config, eslint.config.mjs)
```

No test framework is configured.

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

### Animations
- Use Framer Motion (`framer-motion`) for all animations. Do not use CSS transitions for interactive UI elements — Framer Motion is already a dependency and is used throughout.

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

## Notification Integrations (Incomplete)

`src/app/api/notifications/route.ts` has stubbed email sending. To add email:
1. Install provider SDK (e.g. `resend`)
2. Add API key to env vars
3. Implement the `sendEmail()` function body (marked with `// TODO`)

Telegram and webhook are fully implemented.

---

## What Does NOT Exist

- No testing framework
- No authentication middleware (PIN is app-level only)
- No admin panel
- No server actions (all mutations go through Supabase client directly)
- No `.env.example` file
