-- Owner tags and a weekly work roster.
--
-- 1. calendar_events.created_by — who added the event (defaults to the
--    signed-in user, so the client never sends it).
--    calendar_events.owner_id   — whose event it is ("Whose is it?"). Null
--    means the whole household. A trigger clears it unless that member
--    belongs to the event's household, so it can't name outsiders.
-- 2. work_shifts — one shift per member per day (start/end as HH:MM; an end
--    at or before the start runs past midnight). Any member can edit the
--    household roster, since it's often filled in on a shared tablet. A
--    trigger keeps user_id inside the shift's household.

alter table public.calendar_events
  add column if not exists created_by uuid default auth.uid()
    references auth.users (id) on delete set null,
  add column if not exists owner_id uuid
    references auth.users (id) on delete set null;

create or replace function public.check_event_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.user_profiles p
    where p.user_id = new.owner_id and p.pin_code = new.pin_code
  ) then
    new.owner_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_events_check_owner on public.calendar_events;
create trigger calendar_events_check_owner
  before insert or update of owner_id, pin_code on public.calendar_events
  for each row execute function public.check_event_owner();

create table if not exists public.work_shifts (
  id          uuid primary key default gen_random_uuid(),
  pin_code    text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  shift_date  date not null,
  start_time  text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time    text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  note        text check (char_length(note) <= 60),
  created_at  timestamptz not null default now(),
  unique (user_id, shift_date)
);

create index if not exists work_shifts_pin_date_idx
  on public.work_shifts (pin_code, shift_date);

create or replace function public.check_work_shift_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_profiles p
    where p.user_id = new.user_id and p.pin_code = new.pin_code
  ) then
    raise exception 'That person is not in this household.';
  end if;
  return new;
end;
$$;

drop trigger if exists work_shifts_check_member on public.work_shifts;
create trigger work_shifts_check_member
  before insert or update of user_id, pin_code on public.work_shifts
  for each row execute function public.check_work_shift_member();

alter table public.work_shifts enable row level security;

drop policy if exists "Members read work shifts" on public.work_shifts;
drop policy if exists "Members insert work shifts" on public.work_shifts;
drop policy if exists "Members update work shifts" on public.work_shifts;
drop policy if exists "Members delete work shifts" on public.work_shifts;
create policy "Members read work shifts"
  on public.work_shifts for select to authenticated
  using (pin_code = public.current_user_pin());
create policy "Members insert work shifts"
  on public.work_shifts for insert to authenticated
  with check (pin_code = public.current_user_pin());
create policy "Members update work shifts"
  on public.work_shifts for update to authenticated
  using (pin_code = public.current_user_pin())
  with check (pin_code = public.current_user_pin());
create policy "Members delete work shifts"
  on public.work_shifts for delete to authenticated
  using (pin_code = public.current_user_pin());

-- Deletes over realtime carry only the primary key unless the full row is
-- logged; the client matches deletes by id, so the default is enough.
alter publication supabase_realtime add table public.work_shifts;
