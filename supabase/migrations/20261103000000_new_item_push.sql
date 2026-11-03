-- Push alerts when a household member adds a list item.
--
-- items.created_by      — who added the item. Defaults to the signed-in user, so
--                         the client never sends it. The notify route only lets
--                         the adder announce their own item.
-- push_subscriptions.user_id
--                       — which member owns the device, so the adder's own
--                         phones are skipped. Older rows stay null until the
--                         browser re-registers (it does so on every app load).
-- item_push_log         — one row per announced item. The primary key makes the
--                         announcement single-use. Service role only, like the
--                         other notification tables.

alter table public.items
  add column if not exists created_by uuid default auth.uid()
    references auth.users (id) on delete set null;

alter table public.push_subscriptions
  add column if not exists user_id uuid
    references auth.users (id) on delete cascade;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create table if not exists public.item_push_log (
  item_id uuid primary key references public.items (id) on delete cascade,
  sent_at timestamptz not null default now()
);

alter table public.item_push_log enable row level security;
revoke all on public.item_push_log from anon, authenticated;
