-- Routines: to-dos that come back (change bed sheets, wash the car).
--
-- A routine item is never checked off. Ticking it records when it was last
-- done (and by whom), so the list can show "8 days ago". `repeat_days` is an
-- optional "every N days" that makes it show as due / overdue.
--
-- last_done_by is cleared by a trigger unless that member belongs to the
-- list's household, like items.added_by.

alter table public.items
  add column if not exists is_routine boolean not null default false,
  add column if not exists repeat_days integer
    check (repeat_days is null or repeat_days between 1 and 365),
  add column if not exists last_done_at timestamptz,
  add column if not exists last_done_by uuid references auth.users (id) on delete set null;

create or replace function public.check_item_last_done_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_done_by is not null and not exists (
    select 1
    from public.user_profiles p
    join public.lists l on l.pin_code = p.pin_code
    where p.user_id = new.last_done_by
      and l.id = new.list_id
  ) then
    new.last_done_by := null;
  end if;
  return new;
end;
$$;

-- Trigger functions aren't API: keep them off PostgREST.
revoke all on function public.check_item_last_done_by() from public, anon, authenticated;

drop trigger if exists items_check_last_done_by on public.items;
create trigger items_check_last_done_by
  before insert or update of last_done_by, list_id on public.items
  for each row execute function public.check_item_last_done_by();
