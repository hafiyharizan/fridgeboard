-- People: everyone the household plans around, including kids and others
-- without an account, each with a colour.
--
-- 1. household_people — one row per person. A row with user_id set holds an
--    account member's colour (their name still comes from their profile);
--    a row without user_id is a person with no account (e.g. a child).
--    Any member can add, recolour or remove people in their own household.
-- 2. calendar_events.owner_person_id — "Whose is it?" for someone without an
--    account. owner_id still names account members. A trigger clears it
--    unless that person belongs to the event's household.

create table if not exists public.household_people (
  id          uuid primary key default gen_random_uuid(),
  pin_code    text not null,
  user_id     uuid references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  color       text not null default 'sage'
    check (color in ('sage', 'clay', 'blue', 'lilac', 'sand', 'rose')),
  created_at  timestamptz not null default now(),
  unique (pin_code, user_id)
);

create index if not exists household_people_pin_idx
  on public.household_people (pin_code, created_at);

-- A row linked to an account must be for a member of the same household.
create or replace function public.check_household_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and not exists (
    select 1 from public.user_profiles p
    where p.user_id = new.user_id and p.pin_code = new.pin_code
  ) then
    raise exception 'That person is not in this household.';
  end if;
  return new;
end;
$$;

drop trigger if exists household_people_check on public.household_people;
create trigger household_people_check
  before insert or update of user_id, pin_code on public.household_people
  for each row execute function public.check_household_person();

alter table public.household_people enable row level security;

drop policy if exists "Members read people" on public.household_people;
drop policy if exists "Members insert people" on public.household_people;
drop policy if exists "Members update people" on public.household_people;
drop policy if exists "Members delete people" on public.household_people;
create policy "Members read people"
  on public.household_people for select to authenticated
  using (pin_code = public.current_user_pin());
create policy "Members insert people"
  on public.household_people for insert to authenticated
  with check (pin_code = public.current_user_pin());
create policy "Members update people"
  on public.household_people for update to authenticated
  using (pin_code = public.current_user_pin())
  with check (pin_code = public.current_user_pin());
create policy "Members delete people"
  on public.household_people for delete to authenticated
  using (pin_code = public.current_user_pin());

alter table public.calendar_events
  add column if not exists owner_person_id uuid
    references public.household_people (id) on delete set null;

create or replace function public.check_event_owner_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_person_id is not null and not exists (
    select 1 from public.household_people hp
    where hp.id = new.owner_person_id and hp.pin_code = new.pin_code
  ) then
    new.owner_person_id := null;
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_events_check_owner_person on public.calendar_events;
create trigger calendar_events_check_owner_person
  before insert or update of owner_person_id, pin_code on public.calendar_events
  for each row execute function public.check_event_owner_person();
