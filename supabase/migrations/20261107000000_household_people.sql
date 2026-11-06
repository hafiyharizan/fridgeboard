-- Household members, admins, and people without an account.
--
-- 1. household_admins — who may manage the household (several allowed).
--    A household with no rows here falls back to whoever created it
--    (households.created_by), or for older households the member who
--    joined first, so existing and new households always have an admin.
--    Service role only; read through household_members().
--    set_household_admin() adds or removes an admin (admins only; at least
--    one admin always remains). remove_household_member() lets an admin take
--    someone out of the household (their link, admin role, colour, roster
--    and unused invite codes go).
-- 2. household_members() also returns joined_at and is_admin.
-- 3. household_people — one row per person. A row with user_id set holds an
--    account member's colour (their name still comes from their profile);
--    a row without user_id is someone who can't sign up (a baby, a child).
--    Only admins add or remove people; members may recolour themselves,
--    admins anyone.
-- 4. calendar_events.owner_person_id — "Whose is it?" for someone without an
--    account. owner_id still names account members. A trigger clears it
--    unless that person belongs to the event's household.

create table if not exists public.household_admins (
  pin_code   text not null references public.households (pin_code) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pin_code, user_id)
);

alter table public.household_admins enable row level security;

-- Admin when nobody has been made admin explicitly yet.
create or replace function public.household_default_admin(target_pin text)
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

create or replace function public.household_user_is_admin(target_user uuid, target_pin text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_user is not null and target_pin is not null and (
    exists (
      select 1
      from public.household_admins a
      join public.user_profiles p on p.user_id = a.user_id and p.pin_code = a.pin_code
      where a.pin_code = target_pin and a.user_id = target_user
    )
    or (
      not exists (
        select 1
        from public.household_admins a
        join public.user_profiles p on p.user_id = a.user_id and p.pin_code = a.pin_code
        where a.pin_code = target_pin
      )
      and public.household_default_admin(target_pin) = target_user
    )
  )
$$;

revoke all on function public.household_default_admin(text) from public, anon, authenticated;
revoke all on function public.household_user_is_admin(uuid, text) from public, anon, authenticated;

create or replace function public.is_household_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.household_user_is_admin(auth.uid(), public.current_user_pin())
$$;

revoke all on function public.is_household_admin() from public, anon;
grant execute on function public.is_household_admin() to authenticated;

-- Writes the implicit admin down before the admin list changes, so adding
-- a second admin doesn't silently drop the first.
create or replace function public.household_pin_admins(target_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.household_admins a
  where a.pin_code = target_pin
    and not exists (
      select 1 from public.user_profiles p
      where p.user_id = a.user_id and p.pin_code = a.pin_code
    );
  if not exists (select 1 from public.household_admins where pin_code = target_pin)
     and public.household_default_admin(target_pin) is not null then
    insert into public.household_admins (pin_code, user_id)
    values (target_pin, public.household_default_admin(target_pin));
  end if;
end;
$$;

revoke all on function public.household_pin_admins(text) from public, anon, authenticated;

-- Makes a member an admin (make_admin true) or a regular member (false).
-- Admins only; the last admin can't be removed.
create or replace function public.set_household_admin(member uuid, make_admin boolean)
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
    raise exception 'Only a household admin can do that.';
  end if;
  if not exists (
    select 1 from public.user_profiles p
    where p.user_id = member and p.pin_code = member_pin
  ) then
    raise exception 'That person is not in this household.';
  end if;

  perform pg_advisory_xact_lock(hashtext('household_admins:' || member_pin));
  perform public.household_pin_admins(member_pin);

  if make_admin then
    insert into public.household_admins (pin_code, user_id)
    values (member_pin, member)
    on conflict do nothing;
  else
    if (select count(*) from public.household_admins where pin_code = member_pin and user_id <> member) = 0 then
      raise exception 'A household needs at least one admin. Make someone else admin first.';
    end if;
    delete from public.household_admins where pin_code = member_pin and user_id = member;
  end if;
end;
$$;

revoke all on function public.set_household_admin(uuid, boolean) from public, anon;
grant execute on function public.set_household_admin(uuid, boolean) to authenticated;

-- Takes a member out of the caller's household. Admins only, and not
-- themselves. The person can rejoin only with a new invite code.
create or replace function public.remove_household_member(member uuid)
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
    raise exception 'Only a household admin can do that.';
  end if;
  if member = auth.uid() then
    raise exception 'You can''t remove yourself.';
  end if;
  if not exists (
    select 1 from public.user_profiles p
    where p.user_id = member and p.pin_code = member_pin
  ) then
    raise exception 'That person is not in this household.';
  end if;

  perform pg_advisory_xact_lock(hashtext('household_admins:' || member_pin));
  -- Keep the caller recorded as admin before the member list changes.
  perform public.household_pin_admins(member_pin);

  delete from public.household_admins where pin_code = member_pin and user_id = member;
  delete from public.household_people where pin_code = member_pin and user_id = member;
  delete from public.work_shifts where pin_code = member_pin and user_id = member;
  delete from public.household_invites
    where pin_code = member_pin and created_by = member and used_at is null;
  update public.user_profiles set pin_code = null where user_id = member and pin_code = member_pin;
end;
$$;

revoke all on function public.remove_household_member(uuid) from public, anon;
grant execute on function public.remove_household_member(uuid) to authenticated;

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
         public.household_user_is_admin(p.user_id, p.pin_code)
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

-- Trigger functions aren't meant to be called through the API. (EXECUTE is
-- only checked when a trigger is created, so the triggers still fire.)
revoke all on function public.check_household_person() from public, anon, authenticated;
revoke all on function public.check_event_owner_person() from public, anon, authenticated;
