-- Where a work shift happens: the office, working from home, or a named
-- location. Null = not said (shifts saved before this column existed).
alter table public.work_shifts
  add column if not exists work_place text
    check (work_place in ('office', 'home', 'other')),
  add column if not exists location text
    check (char_length(location) <= 60);
