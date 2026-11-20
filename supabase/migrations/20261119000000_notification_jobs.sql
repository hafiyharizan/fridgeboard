-- Due-job queue for reminders, athan alerts and the daily pushes, driven by
-- Supabase Cron instead of Netlify scheduled functions.
--
-- Every minute pg_cron calls POST {site}/api/cron/tick through pg_net. The
-- route adds a row here for each alert that has come due (job_key makes that
-- idempotent), claims due rows with claim_notification_jobs() and sends them.
-- done_targets records each channel that already got the alert, so a retry
-- only resends what failed.
--
-- One-time setup after applying (values are NOT stored in this file):
--   select vault.create_secret('https://fridgeboard-three.vercel.app', 'fridgeboard_site_url');
--   select vault.create_secret('<same value as CRON_SECRET on Vercel>', 'fridgeboard_cron_secret');
-- Until both exist the cron job runs but posts nowhere.

create table if not exists public.notification_jobs (
  id            uuid primary key default gen_random_uuid(),
  job_key       text not null unique,
  kind          text not null check (kind in ('event', 'athan', 'summary', 'grocery')),
  pin_code      text not null,
  due_at        timestamptz not null,
  expires_at    timestamptz not null,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                check (status in ('pending', 'sending', 'sent', 'skipped', 'failed', 'expired')),
  attempts      integer not null default 0,
  next_try_at   timestamptz not null default now(),
  locked_until  timestamptz,
  done_targets  text[] not null default '{}',
  last_error    text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  check (expires_at > due_at)
);

create index if not exists notification_jobs_due_idx
  on public.notification_jobs (next_try_at)
  where status in ('pending', 'sending');

-- Service role only, like the other delivery logs.
alter table public.notification_jobs enable row level security;
revoke all on public.notification_jobs from anon, authenticated;

-- Claims up to `batch` due jobs for `lease_seconds`. A run that dies mid-send
-- leaves its jobs 'sending'; they become claimable again once the lease ends.
create or replace function public.claim_notification_jobs(batch integer default 50, lease_seconds integer default 120)
returns setof public.notification_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_jobs
     set status = 'expired', locked_until = null
   where status in ('pending', 'sending')
     and expires_at <= now()
     and (status = 'pending' or locked_until < now());

  return query
  update public.notification_jobs j
     set status = 'sending',
         attempts = j.attempts + 1,
         locked_until = now() + make_interval(secs => lease_seconds)
   where j.id in (
     select id from public.notification_jobs
      where expires_at > now()
        and next_try_at <= now()
        and (status = 'pending' or (status = 'sending' and locked_until < now()))
      order by due_at
      limit batch
      for update skip locked
   )
  returning j.*;
end;
$$;

revoke all on function public.claim_notification_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.claim_notification_jobs(integer, integer) to service_role;

-- The old single-use logs are superseded by job_key; keep the tables (and
-- their history) but nothing writes to them any more.
comment on table public.notification_log is 'Superseded by notification_jobs (2026-11-19). Kept for history.';
comment on table public.prayer_push_log is 'Superseded by notification_jobs (2026-11-19). Kept for history.';

-- ---------------------------------------------------------------------------
-- Supabase Cron
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- cron.schedule replaces a job with the same name, so re-running is safe.
select cron.schedule(
  'fridgeboard-notification-tick',
  '* * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'fridgeboard_site_url')
           || '/api/cron/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'fridgeboard_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'fridgeboard_site_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'fridgeboard_cron_secret');
  $cron$
);

-- Housekeeping: finished jobs after 30 days, cron run history after 7.
select cron.schedule(
  'fridgeboard-notification-cleanup',
  '17 3 * * *',
  $cron$
  delete from public.notification_jobs
   where status not in ('pending', 'sending') and created_at < now() - interval '30 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  $cron$
);
