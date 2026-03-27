create extension if not exists pgcrypto;

create table if not exists public.lists (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  pin_code text not null,
  created_at timestamptz default now()
);

create table if not exists public.items (
  id uuid default gen_random_uuid() primary key,
  list_id uuid references public.lists(id) on delete cascade not null,
  text text not null,
  is_checked boolean default false,
  created_at timestamptz default now(),
  checked_at timestamptz
);

create index if not exists idx_items_list_id on public.items(list_id);

alter table public.lists enable row level security;
alter table public.items enable row level security;

drop policy if exists "lists are open" on public.lists;
create policy "lists are open"
on public.lists
for all
using (true)
with check (true);

drop policy if exists "items are open" on public.items;
create policy "items are open"
on public.items
for all
using (true)
with check (true);

insert into public.lists (name, pin_code)
select seed.name, seed.pin_code
from (
  values ('Grocery', '1234'), ('To-Do', '1234')
) as seed(name, pin_code)
where not exists (
  select 1 from public.lists existing where existing.name = seed.name and existing.pin_code = seed.pin_code
);

alter publication supabase_realtime add table public.items;
