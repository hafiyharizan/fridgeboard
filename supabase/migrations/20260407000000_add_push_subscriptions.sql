-- Push notification subscriptions (Web Push / VAPID)
-- Each row is one browser/device subscription endpoint per household PIN.
create table if not exists public.push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  pin_code    text        not null,
  endpoint    text        not null,
  p256dh      text        not null,
  auth        text        not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);

create index if not exists push_subscriptions_pin_code_idx
  on public.push_subscriptions (pin_code);

-- RLS: open (access controlled at app level via pin_code)
alter table public.push_subscriptions enable row level security;

create policy "Allow all for push_subscriptions"
  on public.push_subscriptions
  for all
  using (true)
  with check (true);
