create table if not exists public.calendar_events (
  id uuid default gen_random_uuid() primary key,
  pin_code text not null,
  event_date date not null,
  title text not null,
  note text,
  event_type text not null default 'event' check (event_type in ('event', 'reminder', 'todo')),
  color text not null default 'amber' check (color in ('amber', 'blue', 'rose', 'green', 'purple')),
  is_done boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_calendar_events_pin on public.calendar_events(pin_code);
create index if not exists idx_calendar_events_date on public.calendar_events(event_date);

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events are open" on public.calendar_events;
create policy "calendar_events are open"
on public.calendar_events
for all
using (true)
with check (true);

alter publication supabase_realtime add table public.calendar_events;
