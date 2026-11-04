-- Shared kitchen tablet + ambient extras.
--
-- 1. household_members(): who belongs to the caller's household, for the
--    kitchen display's "who's adding?" row. Profiles stay readable only by
--    their owner; this exposes just name and avatar of fellow members.
-- 2. items.added_by: the member an item is credited to when it was typed on a
--    shared device signed in as someone else. A trigger clears it unless that
--    member belongs to the list's household, so it can't name outsiders.
-- 3. household_settings: one shared location (weather + prayer times) and
--    prayer preferences per household.
-- 4. prayer_push_log: makes each athan push single-use. Service role only.

create or replace function public.household_members()
returns table (user_id uuid, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, p.avatar_url
  from public.user_profiles p
  where p.pin_code is not null
    and p.pin_code = public.current_user_pin()
  order by p.created_at
$$;

revoke all on function public.household_members() from public, anon;
grant execute on function public.household_members() to authenticated;

alter table public.items
  add column if not exists added_by uuid references auth.users (id) on delete set null;

create or replace function public.check_item_added_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.added_by is not null and not exists (
    select 1
    from public.user_profiles p
    join public.lists l on l.pin_code = p.pin_code
    where p.user_id = new.added_by
      and l.id = new.list_id
  ) then
    new.added_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists items_check_added_by on public.items;
create trigger items_check_added_by
  before insert or update of added_by, list_id on public.items
  for each row execute function public.check_item_added_by();

create table if not exists public.household_settings (
  pin_code        text primary key,
  location_name   text check (char_length(location_name) <= 120),
  latitude        double precision check (latitude between -90 and 90),
  longitude       double precision check (longitude between -180 and 180),
  timezone        text check (char_length(timezone) <= 64),
  prayer_enabled  boolean not null default false,
  prayer_method   text not null default 'MuslimWorldLeague'
    check (prayer_method in (
      'MuslimWorldLeague', 'Egyptian', 'Karachi', 'UmmAlQura', 'Dubai',
      'MoonsightingCommittee', 'NorthAmerica', 'Kuwait', 'Qatar',
      'Singapore', 'Tehran', 'Turkey'
    )),
  prayer_madhab   text not null default 'shafi'
    check (prayer_madhab in ('shafi', 'hanafi')),
  athan_enabled   boolean not null default false,
  updated_at      timestamptz not null default now()
);

alter table public.household_settings enable row level security;

drop policy if exists "Members read household settings" on public.household_settings;
drop policy if exists "Members insert household settings" on public.household_settings;
drop policy if exists "Members update household settings" on public.household_settings;
create policy "Members read household settings"
  on public.household_settings for select to authenticated
  using (pin_code = public.current_user_pin());
create policy "Members insert household settings"
  on public.household_settings for insert to authenticated
  with check (pin_code = public.current_user_pin());
create policy "Members update household settings"
  on public.household_settings for update to authenticated
  using (pin_code = public.current_user_pin())
  with check (pin_code = public.current_user_pin());

create table if not exists public.prayer_push_log (
  pin_code    text not null,
  prayer      text not null,
  prayer_date date not null,
  sent_at     timestamptz not null default now(),
  primary key (pin_code, prayer, prayer_date)
);

alter table public.prayer_push_log enable row level security;
revoke all on public.prayer_push_log from anon, authenticated;
