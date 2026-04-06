alter table public.calendar_events
  add column if not exists source_type text not null default 'manual'
    check (source_type in ('manual', 'islamic', 'wa_public_holiday', 'malaysia_public_holiday')),
  add column if not exists source_label text,
  add column if not exists source_event_id text;

create unique index if not exists idx_calendar_events_source_unique
  on public.calendar_events (pin_code, source_type, source_event_id)
  where source_event_id is not null;

create table if not exists public.calendar_sync_tokens (
  pin_code text primary key references public.households(pin_code) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.calendar_sync_tokens enable row level security;

drop policy if exists "Household members can read calendar sync tokens" on public.calendar_sync_tokens;
create policy "Household members can read calendar sync tokens"
  on public.calendar_sync_tokens for select to authenticated
  using (pin_code = public.current_user_pin());

drop policy if exists "Household members can insert calendar sync tokens" on public.calendar_sync_tokens;
create policy "Household members can insert calendar sync tokens"
  on public.calendar_sync_tokens for insert to authenticated
  with check (pin_code = public.current_user_pin());

drop policy if exists "Household members can update calendar sync tokens" on public.calendar_sync_tokens;
create policy "Household members can update calendar sync tokens"
  on public.calendar_sync_tokens for update to authenticated
  using (pin_code = public.current_user_pin())
  with check (pin_code = public.current_user_pin());

drop policy if exists "Household members can delete calendar sync tokens" on public.calendar_sync_tokens;
create policy "Household members can delete calendar sync tokens"
  on public.calendar_sync_tokens for delete to authenticated
  using (pin_code = public.current_user_pin());

create or replace function public.ensure_calendar_sync_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pin text;
  existing_token text;
begin
  pin := public.current_user_pin();

  if pin is null then
    raise exception 'You must join a household before creating a calendar feed.';
  end if;

  select token::text
  into existing_token
  from public.calendar_sync_tokens
  where calendar_sync_tokens.pin_code = pin;

  if existing_token is not null then
    return existing_token;
  end if;

  insert into public.calendar_sync_tokens (pin_code)
  values (pin)
  returning token::text into existing_token;

  return existing_token;
end;
$$;

create or replace function public.validate_calendar_sync_token(feed_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.calendar_sync_tokens
    where token::text = feed_token
  )
$$;

create or replace function public.get_calendar_feed(feed_token text)
returns table (
  id uuid,
  pin_code text,
  event_date date,
  title text,
  note text,
  event_type text,
  color text,
  is_done boolean,
  recurrence text,
  recurrence_end date,
  notify_before integer,
  notify_channels text[],
  created_at timestamptz,
  source_type text,
  source_label text,
  source_event_id text
)
language sql
security definer
set search_path = public
as $$
  select
    calendar_events.id,
    calendar_events.pin_code,
    calendar_events.event_date,
    calendar_events.title,
    calendar_events.note,
    calendar_events.event_type,
    calendar_events.color,
    calendar_events.is_done,
    calendar_events.recurrence,
    calendar_events.recurrence_end,
    calendar_events.notify_before,
    calendar_events.notify_channels,
    calendar_events.created_at,
    calendar_events.source_type,
    calendar_events.source_label,
    calendar_events.source_event_id
  from public.calendar_sync_tokens
  join public.calendar_events
    on calendar_events.pin_code = calendar_sync_tokens.pin_code
  where calendar_sync_tokens.token::text = feed_token
  order by calendar_events.event_date asc, calendar_events.title asc
$$;
