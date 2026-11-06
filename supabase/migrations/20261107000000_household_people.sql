-- Household members and people without an account.
--
-- 1. is_household_admin(): the household's admin is whoever created it
--    (households.created_by); for older households with no creator saved,
--    the member who joined first.
--    transfer_household_admin() lets the admin hand this to another member.
-- 2. household_members() also returns joined_at and is_admin, so the
--    household dialog can list who signed up and who the admin is.
-- 3. household_people — one row per person. A row with user_id set holds an
--    account member's colour (their name still comes from their profile);
--    a row without user_id is someone who can't sign up (a baby, a child).
--    Only the admin adds or removes people; members may recolour themselves,
--    the admin anyone.
-- 4. calendar_events.owner_person_id — "Whose is it?" for someone without an
--    account. owner_id still names account members. A trigger clears it
--    unless that person belongs to the event's household.

create or replace function public.household_admin_id(target_pin text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select h.created_by
       from public.households h
       join public.user_profiles p on p.user_id = h.created_by and p.pin_code = h.pin_code
      where h.pin_code = target_pin),
    (select p.user_id
       from public.user_profiles p
      where p.pin_code = target_pin
      order by p.created_at, p.user_id
      limit 1)
  )
$$;

revoke all on function public.household_admin_id(text) from public, anon, authenticated;

create or replace function public.is_household_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and public.current_user_pin() is not null
    and public.household_admin_id(public.current_user_pin()) = auth.uid()
$$;

revoke all on function public.is_household_admin() from public, anon;
grant execute on function public.is_household_admin() to authenticated;

-- Hands admin to another member of the caller's household. Only the
-- current admin can do this; they become a regular member.
create or replace function public.transfer_household_admin(new_admin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member_pin text := public.current_user_pin();
begin
  if auth.uid() is null or member_pin is null then
    raise exception 'Join a household first.';
  end if;
  if not public.is_household_admin() then
    raise exception 'Only the household admin can do that.';
  end if;
  if not exists (
    select 1 from public.user_profiles p
    where p.user_id = new_admin and p.pin_code = member_pin
  ) then
    raise exception 'That person is not in this household.';
  end if;
  insert into public.households (pin_code, created_by)
  values (member_pin, new_admin)
  on conflict (pin_code) do update set created_by = excluded.created_by;
end;
$$;

revoke all on function public.transfer_household_admin(uuid) from public, anon;
grant execute on function public.transfer_household_admin(uuid) to authenticated;

-- The return type changes, so the function has to be dropped first.
drop function if exists public.household_members();
create function public.household_members()
returns table (user_id uuid, display_name text, avatar_url text, joined_at timestamptz, is_admin boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, p.avatar_url, p.created_at,
         p.user_id = public.household_admin_id(p.pin_code)
  from public.user_profiles p
  where p.pin_code is not null
    and p.pin_code = public.current_user_pin()
  order by p.created_at
$$;

revoke all on function public.household_members() from public, anon;
grant execute on function public.household_members() to authenticated;

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
drop policy if exists "Admin deletes people" on public.household_people;
create policy "Members read people"
  on public.household_people for select to authenticated
  using (pin_code = public.current_user_pin());
-- Admin: anyone in the household. Others: only their own colour row.
create policy "Members insert people"
  on public.household_people for insert to authenticated
  with check (
    pin_code = public.current_user_pin()
    and (public.is_household_admin() or user_id = auth.uid())
  );
create policy "Members update people"
  on public.household_people for update to authenticated
  using (
    pin_code = public.current_user_pin()
    and (public.is_household_admin() or user_id = auth.uid())
  )
  with check (
    pin_code = public.current_user_pin()
    and (public.is_household_admin() or user_id = auth.uid())
  );
create policy "Admin deletes people"
  on public.household_people for delete to authenticated
  using (pin_code = public.current_user_pin() and public.is_household_admin());

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
