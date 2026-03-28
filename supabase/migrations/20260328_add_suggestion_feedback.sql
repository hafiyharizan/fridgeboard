create table if not exists public.suggestion_feedback (
  id uuid default gen_random_uuid() primary key,
  list_id uuid references public.lists(id) on delete cascade not null,
  suggestion_text text not null,
  action text not null check (action in ('accepted', 'dismissed')),
  created_at timestamptz default now()
);

create index if not exists idx_suggestion_feedback_list_id on public.suggestion_feedback(list_id);

alter table public.suggestion_feedback enable row level security;

drop policy if exists "suggestion_feedback is open" on public.suggestion_feedback;
create policy "suggestion_feedback is open"
on public.suggestion_feedback
for all
using (true)
with check (true);
