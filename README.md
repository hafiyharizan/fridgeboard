# Fridgeboard

Fridgeboard is a warm, shared household management app for families and flatmates. It combines grocery lists, to-dos, a household calendar, work-sharing, and a home dashboard into one real-time experience powered by Next.js and Supabase.

Members sign in with Google, belong to a household, and see updates instantly across devices.

## Features

- Shared grocery list with real-time sync
- Household to-do list and task tracking
- Family calendar with recurring events and reminders
- Work shift / roster management for household members
- Household onboarding and invite flow with PIN-based household linking
- Ambient "home" dashboard with weather, prayer times, news, and a shared kitchen display mode
- Push notifications and reminder flows for important tasks and events
- Multi-device support with Supabase Realtime

## Tech stack

- Next.js 16.4 (App Router)
- React 19.2.4
- TypeScript 5
- Tailwind CSS v4
- Framer Motion 12
- Supabase (PostgreSQL + Realtime + Auth)
- @supabase/ssr
- Lucide React
- Supabase pg_cron + pg_net for scheduled jobs (reminders, athan, daily pushes)
- Hosted on Vercel

## App overview

Fridgeboard is designed around a shared household model:

- Google sign-in via Supabase Auth
- Each user has a `user_profiles` record
- Household membership is linked by a 4-digit PIN code
- RLS policies scope data to the current household
- Realtime updates keep the list, calendar, work roster, and shared dashboard in sync

## Prerequisites

Before you start, make sure you have:

- Node.js 20+
- npm
- A Supabase project
- Access to a Google OAuth provider (for sign-in)
- Optional: Resend account for email notifications, Telegram bot token for Telegram reminders

## Environment setup

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Recommended variables:

```env
NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
CRON_SECRET=your-random-secret
RESEND_API_KEY=re_your_api_key_here
RESEND_FROM_EMAIL=Fridgeboard <noreply@yourdomain.com>
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

## Database setup

This project uses Supabase SQL migrations. Apply them in order from `supabase/migrations/`.

For example:

```bash
# With the Supabase CLI
supabase db push
```

Or apply the migration files manually in Supabase SQL editor in filename order.

The main bootstrapping migration is:

- `supabase/migrations/20260327_create_fridgeboard.sql`

Later migrations add calendar functions, auth flow updates, push subscriptions, work shifts, and ambient/shared-tablet features.

## Local development

```bash
npm install
npm run dev
```

Then open:

- http://localhost:3000

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run test
npm run test:watch
npm run test:coverage
```

## Project structure

```text
src/
  app/
    page.tsx
    setup-household/
    setup-pin/
    auth/
    list/page.tsx
    api/
  components/
  hooks/
  lib/
public/
supabase/
  migrations/
```

The app uses the App Router, a shared household workspace layout, and client-side realtime hooks to keep the UI synced with Supabase.

## Deployment notes

The app is hosted on Vercel (free Hobby plan). Scheduled jobs run in Supabase, not on the host: pg_cron checks every minute whether a reminder or athan is due and only then calls `/api/cron/tick`, and calls `/api/push/remind` for the 07:00 summary and 08:00 grocery reminder (see `supabase/migrations/20261109000000_supabase_scheduler.sql`).

For production, ensure:

- your Supabase project is configured correctly, with all migrations applied
- OAuth redirect URLs are added to your Google provider and Supabase auth settings
- your `NEXT_PUBLIC_SITE_URL` is set
- `CRON_SECRET` is set in Vercel, and the app URL and the same secret are stored in Supabase Vault:

```sql
select vault.create_secret('https://your-app.vercel.app', 'fridgeboard_app_url');
select vault.create_secret('your-cron-secret', 'fridgeboard_cron_secret');
```

## Security and auth notes

The app uses Supabase Auth for sign-in and enforces household-level data access via SQL policies.

Important security model notes from the project:

- `user_profiles.pin_code` is not directly writable by clients
- household membership and pin assignment are handled by security-definer functions
- RLS is used to restrict access to household-specific data and server-only tables

## Contributing

1. Create a branch from the default branch
2. Make your changes
3. Run the relevant checks (`npm run lint`, `npm run test`)
4. Open a pull request with a clear summary

## License

This project does not currently include a license file in the repository root. Check with the repository owner before using it in production or redistributing it.

