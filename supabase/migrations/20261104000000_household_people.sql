-- Household people ("crew") and person tags on calendar events.
--
-- household_people         — everyone the household plans around, including
--                            people without an account (kids, grandparents).
--                            Readable and editable by household members only.
-- calendar_events.person_ids
--                          — who an event is for. Empty means the whole family.
--                            Deleting a person removes them from every event.

create table if not exists public.household_people (
  id uuid primary key default gen_random_uuid(),
  pin_code text not null references public.households (pin_code) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default 'sage'
    check (color in ('sage', 'peach', 'sky', 'lilac', 'sand', 'rose')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists household_people_pin_code_idx
  on public.household_people (pin_code, sort_order, created_at);

alter table public.household_people enable row level security;

drop policy if exists "Household members can read people" on public.household_people;
create policy "Household members can read people"
  on public.household_people for select to authenticated
  using (pin_code = public.current_user_pin());

drop policy if exists "Household members can add people" on public.household_people;
create policy "Household members can add people"
  on public.household_people for insert to authenticated
  with check (pin_code = public.current_user_pin());

drop policy if exists "Household members can update people" on public.household_people;
create policy "Household members can update people"
  on public.household_people for update to authenticated
  using (pin_code = public.current_user_pin())
  with check (pin_code = public.current_user_pin());

drop policy if exists "Household members can remove people" on public.household_people;
create policy "Household members can remove people"
  on public.household_people for delete to authenticated
  using (pin_code = public.current_user_pin());

revoke all on public.household_people from anon;
grant select, insert, update, delete on public.household_people to authenticated;

-- Keep households to a sensible size so the crew row stays usable.
create or replace function public.limit_household_people()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.household_people where pin_code = new.pin_code) >= 12 then
    raise exception 'A household can have up to 12 people.';
  end if;
  return new;
end;
$$;

drop trigger if exists household_people_limit on public.household_people;
create trigger household_people_limit
  before insert on public.household_people
  for each row execute function public.limit_household_people();

alter table public.calendar_events
  add column if not exists person_ids uuid[] not null default '{}';

-- Removing a person untags them everywhere in their household.
create or replace function public.untag_removed_person()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.calendar_events
  set person_ids = array_remove(person_ids, old.id)
  where pin_code = old.pin_code
    and old.id = any (person_ids);
  return old;
end;
$$;

drop trigger if exists household_people_untag on public.household_people;
create trigger household_people_untag
  after delete on public.household_people
  for each row execute function public.untag_removed_person();

revoke all on function public.untag_removed_person() from public, anon, authenticated;
revoke all on function public.limit_household_people() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'household_people'
  ) then
    alter publication supabase_realtime add table public.household_people;
  end if;
end;
$$;
