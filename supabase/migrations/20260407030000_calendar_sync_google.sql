-- ---------------------------------------------------------------------------
-- Google Calendar two-way sync + CalDAV write support
-- ---------------------------------------------------------------------------

-- 1. Track which Fridgeboard events have been synced to Google Calendar
alter table public.calendar_events
  add column if not exists google_event_id text null;

-- 2. Row-level update timestamp for conflict detection
alter table public.calendar_events
  add column if not exists updated_at timestamptz not null default now();

-- Backfill existing rows
update public.calendar_events
  set updated_at = created_at
  where updated_at = now()
    and created_at < now();

-- Keep updated_at current via trigger
create or replace function public.set_calendar_event_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_calendar_events_updated_at on public.calendar_events;
create trigger trg_calendar_events_updated_at
  before update on public.calendar_events
  for each row execute function public.set_calendar_event_updated_at();

-- 3. Expand source_type to include external calendar sources
alter table public.calendar_events
  drop constraint if exists calendar_events_source_type_check;

alter table public.calendar_events
  add constraint calendar_events_source_type_check
  check (source_type in (
    'manual',
    'islamic',
    'wa_public_holiday',
    'malaysia_public_holiday',
    'google_calendar',
    'caldav'
  ));

-- 4. Google Calendar OAuth2 tokens (one row per household)
create table if not exists public.google_calendar_tokens (
  pin_code            text        primary key
                                  references public.households(pin_code)
                                  on delete cascade,
  access_token        text        not null,
  refresh_token       text        not null,
  expires_at          timestamptz not null,
  google_calendar_id  text        not null default 'primary',
  -- Incremental sync token returned by Google after a full sync
  sync_token          text        null,
  -- Push-notification watch channel (registered with Google)
  watch_channel_id    text        null,
  watch_resource_id   text        null,
  watch_expiration    timestamptz null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;

-- Household members can manage their own token row
drop policy if exists "Household members can manage google tokens" on public.google_calendar_tokens;
create policy "Household members can manage google tokens"
  on public.google_calendar_tokens
  for all
  to authenticated
  using  (pin_code = public.current_user_pin())
  with check (pin_code = public.current_user_pin());

-- Service-role can do anything (used by webhook + cron handlers)
-- (No explicit policy needed; service role bypasses RLS.)

-- 5. Update get_calendar_feed to include the new columns
create or replace function public.get_calendar_feed(feed_token text)
returns table (
  id              uuid,
  pin_code        text,
  event_date      date,
  event_time      text,
  title           text,
  note            text,
  event_type      text,
  color           text,
  is_done         boolean,
  recurrence      text,
  recurrence_end  date,
  notify_before   integer,
  notify_channels text[],
  created_at      timestamptz,
  updated_at      timestamptz,
  source_type     text,
  source_label    text,
  source_event_id text,
  google_event_id text
)
language sql
security definer
set search_path = public
as $$
  select
    e.id,
    e.pin_code,
    e.event_date::date,
    e.event_time,
    e.title,
    e.note,
    e.event_type,
    e.color,
    e.is_done,
    e.recurrence,
    e.recurrence_end::date,
    e.notify_before,
    e.notify_channels,
    e.created_at,
    e.updated_at,
    e.source_type,
    e.source_label,
    e.source_event_id,
    e.google_event_id
  from public.calendar_sync_tokens t
  join public.calendar_events e on e.pin_code = t.pin_code
  where t.token::text = feed_token
  order by e.event_date asc, e.title asc
$$;

-- 6. Helper: resolve pin_code from a calendar sync token (for CalDAV writes)
create or replace function public.pin_for_sync_token(feed_token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pin_code
  from public.calendar_sync_tokens
  where token::text = feed_token
  limit 1
$$;
