-- Lock down tables that were still "open" (using (true)) to anyone with the
-- public anon key.
--
-- push_subscriptions  — device endpoints + keys per household. Anyone could read
--                       them all, or insert a subscription for another household
--                       and receive its grocery and calendar push messages.
-- notification_log    — anyone could insert rows to suppress notifications.
-- suggestion_feedback — anyone could read or write every household's entries.
--
-- None of these are used from the browser: push_subscriptions and
-- notification_log are only touched by API routes with the service role key,
-- and suggestion_feedback has no client code. RLS stays on with no policies,
-- so only the service role (which bypasses RLS) can reach them.

drop policy if exists "Allow all for push_subscriptions" on public.push_subscriptions;
drop policy if exists "notification_log is open" on public.notification_log;
drop policy if exists "suggestion_feedback is open" on public.suggestion_feedback;

alter table public.push_subscriptions enable row level security;
alter table public.notification_log enable row level security;
alter table public.suggestion_feedback enable row level security;

revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.notification_log from anon, authenticated;
revoke all on public.suggestion_feedback from anon, authenticated;
