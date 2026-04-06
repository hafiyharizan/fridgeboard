alter table public.user_profiles
  alter column pin_code drop not null;

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles for insert to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.households (
  pin_code text primary key check (pin_code ~ '^[0-9]{4}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;

insert into public.households (pin_code)
select distinct lists.pin_code
from public.lists
where lists.pin_code ~ '^[0-9]{4}$'
on conflict (pin_code) do nothing;

insert into public.households (pin_code, created_by)
select distinct user_profiles.pin_code, user_profiles.user_id
from public.user_profiles
where user_profiles.pin_code ~ '^[0-9]{4}$'
on conflict (pin_code) do update
set created_by = coalesce(public.households.created_by, excluded.created_by);

create or replace function public.current_user_pin()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select user_profiles.pin_code
  from public.user_profiles
  where user_profiles.user_id = auth.uid()
  limit 1
$$;

create or replace function public.create_household(
  profile_display_name text default null,
  profile_avatar_url text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_pin text;
  generated_pin text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to create a household.';
  end if;

  insert into public.user_profiles (user_id, pin_code, display_name, avatar_url)
  values (auth.uid(), null, profile_display_name, profile_avatar_url)
  on conflict (user_id) do update
  set display_name = coalesce(excluded.display_name, public.user_profiles.display_name),
      avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url);

  select user_profiles.pin_code
  into existing_pin
  from public.user_profiles
  where user_profiles.user_id = auth.uid();

  if existing_pin is not null then
    return existing_pin;
  end if;

  loop
    generated_pin := (floor(random() * 9000) + 1000)::int::text;

    begin
      insert into public.households (pin_code, created_by)
      values (generated_pin, auth.uid());
      exit;
    exception
      when unique_violation then
        generated_pin := null;
    end;
  end loop;

  insert into public.lists (name, pin_code)
  values ('Grocery', generated_pin), ('To-Do', generated_pin);

  update public.user_profiles
  set pin_code = generated_pin,
      display_name = coalesce(profile_display_name, display_name),
      avatar_url = coalesce(profile_avatar_url, avatar_url)
  where user_id = auth.uid();

  return generated_pin;
end;
$$;

create or replace function public.join_household(
  target_pin text,
  profile_display_name text default null,
  profile_avatar_url text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_pin text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to join a household.';
  end if;

  normalized_pin := regexp_replace(coalesce(target_pin, ''), '\D', '', 'g');

  if normalized_pin !~ '^[0-9]{4}$' then
    raise exception 'Enter a valid 4-digit household PIN.';
  end if;

  if not exists (
    select 1
    from public.households
    where households.pin_code = normalized_pin
  ) then
    raise exception 'No household found with that PIN.';
  end if;

  insert into public.user_profiles (user_id, pin_code, display_name, avatar_url)
  values (auth.uid(), normalized_pin, profile_display_name, profile_avatar_url)
  on conflict (user_id) do update
  set pin_code = excluded.pin_code,
      display_name = coalesce(excluded.display_name, public.user_profiles.display_name),
      avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url);

  return normalized_pin;
end;
$$;

drop policy if exists "Household members can read their household" on public.households;
create policy "Household members can read their household"
  on public.households for select to authenticated
  using (pin_code = public.current_user_pin());

drop policy if exists "lists are open" on public.lists;
drop policy if exists "Household members can read lists" on public.lists;
drop policy if exists "Household members can insert lists" on public.lists;
drop policy if exists "Household members can update lists" on public.lists;
drop policy if exists "Household members can delete lists" on public.lists;
create policy "Household members can read lists"
  on public.lists for select to authenticated
  using (pin_code = public.current_user_pin());
create policy "Household members can insert lists"
  on public.lists for insert to authenticated
  with check (pin_code = public.current_user_pin());
create policy "Household members can update lists"
  on public.lists for update to authenticated
  using (pin_code = public.current_user_pin())
  with check (pin_code = public.current_user_pin());
create policy "Household members can delete lists"
  on public.lists for delete to authenticated
  using (pin_code = public.current_user_pin());

drop policy if exists "items are open" on public.items;
drop policy if exists "Household members can read items" on public.items;
drop policy if exists "Household members can insert items" on public.items;
drop policy if exists "Household members can update items" on public.items;
drop policy if exists "Household members can delete items" on public.items;
create policy "Household members can read items"
  on public.items for select to authenticated
  using (
    exists (
      select 1
      from public.lists
      where lists.id = items.list_id
        and lists.pin_code = public.current_user_pin()
    )
  );
create policy "Household members can insert items"
  on public.items for insert to authenticated
  with check (
    exists (
      select 1
      from public.lists
      where lists.id = items.list_id
        and lists.pin_code = public.current_user_pin()
    )
  );
create policy "Household members can update items"
  on public.items for update to authenticated
  using (
    exists (
      select 1
      from public.lists
      where lists.id = items.list_id
        and lists.pin_code = public.current_user_pin()
    )
  )
  with check (
    exists (
      select 1
      from public.lists
      where lists.id = items.list_id
        and lists.pin_code = public.current_user_pin()
    )
  );
create policy "Household members can delete items"
  on public.items for delete to authenticated
  using (
    exists (
      select 1
      from public.lists
      where lists.id = items.list_id
        and lists.pin_code = public.current_user_pin()
    )
  );

drop policy if exists "calendar_events are open" on public.calendar_events;
drop policy if exists "Household members can read calendar events" on public.calendar_events;
drop policy if exists "Household members can insert calendar events" on public.calendar_events;
drop policy if exists "Household members can update calendar events" on public.calendar_events;
drop policy if exists "Household members can delete calendar events" on public.calendar_events;
create policy "Household members can read calendar events"
  on public.calendar_events for select to authenticated
  using (pin_code = public.current_user_pin());
create policy "Household members can insert calendar events"
  on public.calendar_events for insert to authenticated
  with check (pin_code = public.current_user_pin());
create policy "Household members can update calendar events"
  on public.calendar_events for update to authenticated
  using (pin_code = public.current_user_pin())
  with check (pin_code = public.current_user_pin());
create policy "Household members can delete calendar events"
  on public.calendar_events for delete to authenticated
  using (pin_code = public.current_user_pin());

drop policy if exists "notification_channels are open" on public.notification_channels;
drop policy if exists "Household members can read notification channels" on public.notification_channels;
drop policy if exists "Household members can insert notification channels" on public.notification_channels;
drop policy if exists "Household members can update notification channels" on public.notification_channels;
drop policy if exists "Household members can delete notification channels" on public.notification_channels;
create policy "Household members can read notification channels"
  on public.notification_channels for select to authenticated
  using (pin_code = public.current_user_pin());
create policy "Household members can insert notification channels"
  on public.notification_channels for insert to authenticated
  with check (pin_code = public.current_user_pin());
create policy "Household members can update notification channels"
  on public.notification_channels for update to authenticated
  using (pin_code = public.current_user_pin())
  with check (pin_code = public.current_user_pin());
create policy "Household members can delete notification channels"
  on public.notification_channels for delete to authenticated
  using (pin_code = public.current_user_pin());
