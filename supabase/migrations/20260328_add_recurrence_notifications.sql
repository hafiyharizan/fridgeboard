-- ---------------------------------------------------------------------------
-- Recurrence columns on calendar_events
-- ---------------------------------------------------------------------------
alter table public.calendar_events
  add column if not exists recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  add column if not exists recurrence_end date,
  add column if not exists notify_before integer not null default -1,
  add column if not exists notify_channels text[] not null default '{}';

-- notify_before: minutes before event to send notification (-1 = no notification)
-- notify_channels: array of channel keys like {'email', 'telegram', 'webhook'}

-- ---------------------------------------------------------------------------
-- Notification channels — stores delivery endpoints per household PIN
-- ---------------------------------------------------------------------------
create table if not exists public.notification_channels (
  id uuid default gen_random_uuid() primary key,
  pin_code text not null,
  channel_type text not null check (channel_type in ('email', 'telegram', 'webhook')),
  channel_value text not null,
  label text,
  is_enabled boolean default true,
  created_at timestamptz default now(),
  unique (pin_code, channel_type, channel_value)
);

create index if not exists idx_notification_channels_pin on public.notification_channels(pin_code);

alter table public.notification_channels enable row level security;

drop policy if exists "notification_channels are open" on public.notification_channels;
create policy "notification_channels are open"
on public.notification_channels
for all
using (true)
with check (true);

-- ---------------------------------------------------------------------------
-- Notification log — tracks what was sent to avoid duplicates
-- ---------------------------------------------------------------------------
create table if not exists public.notification_log (
  id uuid default gen_random_uuid() primary key,
  event_id uuid references public.calendar_events(id) on delete cascade not null,
  channel_type text not null,
  sent_at timestamptz default now(),
  status text not null default 'sent' check (status in ('sent', 'failed')),
  unique (event_id, channel_type, sent_at)
);

alter table public.notification_log enable row level security;

drop policy if exists "notification_log is open" on public.notification_log;
create policy "notification_log is open"
on public.notification_log
for all
using (true)
with check (true);
