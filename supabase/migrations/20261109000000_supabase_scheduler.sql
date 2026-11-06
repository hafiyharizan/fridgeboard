-- Scheduled jobs run in Supabase instead of the web host.
--
-- Every minute pg_cron runs cron_tick(). It asks the database whether a
-- reminder or athan is due (cron_tick_due) and only then calls the app's
-- /api/cron/tick through pg_net. A quiet minute costs one small query and
-- never wakes the app. The 07:00 summary and 08:00 grocery pushes call
-- /api/push/remind directly.
--
-- Setup, once, in the SQL editor (values are stored encrypted in Vault):
--   select vault.create_secret('https://your-app.vercel.app', 'fridgeboard_app_url');
--   select vault.create_secret('<same value as CRON_SECRET>', 'fridgeboard_cron_secret');
-- Until both exist the jobs do nothing.
--
-- 1. prayer_times: today's and tomorrow's prayer times per athan household,
--    written by the app (adhan runs in JavaScript). Service role only.
--    Changing location or prayer settings clears them, and the next minute's
--    check asks the app to work them out again.
-- 2. notification_log: one "push" row per event, claimed before sending.
-- 3. The check, the caller and the schedules.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Saved prayer times ------------------------------------------------------

create table if not exists public.prayer_times (
  pin_code    text not null,
  prayer      text not null,
  prayer_date date not null,
  prayer_at   timestamptz not null,
  primary key (pin_code, prayer, prayer_date)
);

create index if not exists prayer_times_prayer_at_idx on public.prayer_times (prayer_at);

alter table public.prayer_times enable row level security;
revoke all on public.prayer_times from anon, authenticated;

create or replace function public.forget_prayer_times()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.pin_code, new.latitude, new.longitude, new.timezone, new.prayer_method,
      new.prayer_madhab, new.prayer_enabled, new.athan_enabled)
     is distinct from
     (old.pin_code, old.latitude, old.longitude, old.timezone, old.prayer_method,
      old.prayer_madhab, old.prayer_enabled, old.athan_enabled) then
    delete from public.prayer_times where pin_code in (old.pin_code, new.pin_code);
  end if;
  return new;
end;
$$;

revoke all on function public.forget_prayer_times() from public, anon, authenticated;

drop trigger if exists household_settings_forget_prayer_times on public.household_settings;
create trigger household_settings_forget_prayer_times
  after update on public.household_settings
  for each row execute function public.forget_prayer_times();

-- 2. One push per reminder -------------------------------------------------

create unique index if not exists notification_log_one_push_per_event
  on public.notification_log (event_id)
  where channel_type = 'push';

-- 3. The once-a-minute check -------------------------------------------------

-- Must match DEFAULT_APP_TIMEZONE in src/lib/local-time.ts.
create or replace function public.safe_time_zone(tz text)
returns text
language plpgsql
stable
set search_path = ''
as $$
begin
  if tz is null or tz = '' then
    return 'Australia/Perth';
  end if;
  perform now() at time zone tz;
  return tz;
exception when others then
  return 'Australia/Perth';
end;
$$;

-- When an event's reminder fires (local start minus notify_before), or null
-- for a malformed date or time. Mirrors reminderTriggerAt in local-time.ts.
create or replace function public.reminder_trigger_at(
  event_date date,
  event_time text,
  notify_before integer,
  tz text
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if event_time is null or notify_before is null or notify_before < 0 then
    return null;
  end if;
  return ((event_date + event_time::time) at time zone public.safe_time_zone(tz))
    - make_interval(mins => notify_before);
exception when others then
  return null;
end;
$$;

create or replace function public.cron_tick_due()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with reminders as (
    select
      e.id,
      e.pin_code,
      e.notify_channels,
      public.reminder_trigger_at(e.event_date, e.event_time, e.notify_before, hs.timezone) as trigger_at
    from public.calendar_events e
    left join public.household_settings hs on hs.pin_code = e.pin_code
    where e.notify_before >= 0
      and e.event_time is not null
      -- Every local "today" is within a day of the UTC date (same window as the app).
      and e.event_date between (now() at time zone 'UTC')::date - 1
                           and (now() at time zone 'UTC')::date + 2
  )
  select
    -- A reminder whose push hasn't gone out, or whose email / Telegram /
    -- webhook hasn't succeeded yet (30-minute catch-up, as REMINDER_CATCH_UP_MINUTES).
    exists (
      select 1
      from reminders r
      where r.trigger_at is not null
        and now() >= r.trigger_at
        and now() <= r.trigger_at + interval '30 minutes'
        and (
          not exists (
            select 1 from public.notification_log l
            where l.event_id = r.id and l.channel_type = 'push'
          )
          or exists (
            select 1
            from public.notification_channels c
            where c.pin_code = r.pin_code
              and c.is_enabled
              and c.channel_type = any (r.notify_channels)
              and not exists (
                select 1 from public.notification_log l
                where l.event_id = r.id and l.channel_type = c.channel_type and l.status = 'sent'
              )
          )
        )
    )
    -- A prayer that started in the last 10 minutes (ATHAN_WINDOW_MS) without an athan push.
    or exists (
      select 1
      from public.prayer_times pt
      join public.household_settings hs
        on hs.pin_code = pt.pin_code and hs.prayer_enabled and hs.athan_enabled
      where pt.prayer_at <= now()
        and pt.prayer_at > now() - interval '10 minutes'
        and not exists (
          select 1 from public.prayer_push_log pl
          where pl.pin_code = pt.pin_code and pl.prayer = pt.prayer and pl.prayer_date = pt.prayer_date
        )
    )
    -- An athan household without tomorrow's times saved (new day, or settings changed).
    or exists (
      select 1
      from public.household_settings hs
      where hs.prayer_enabled
        and hs.athan_enabled
        and hs.latitude is not null
        and hs.longitude is not null
        and not exists (
          select 1 from public.prayer_times pt
          where pt.pin_code = hs.pin_code
            and pt.prayer_date = (now() at time zone public.safe_time_zone(hs.timezone))::date + 1
        )
    )
$$;

-- POSTs to one of the app's cron routes with the CRON_SECRET from Vault.
create or replace function public.call_app_route(path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'fridgeboard_app_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'fridgeboard_cron_secret';
  if base_url is null or secret is null then
    raise notice 'Vault secrets fridgeboard_app_url / fridgeboard_cron_secret not set; skipped %', path;
    return;
  end if;

  perform net.http_post(
    url := rtrim(base_url, '/') || path,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

create or replace function public.cron_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.cron_tick_due() then
    perform public.call_app_route('/api/cron/tick');
  end if;
end;
$$;

-- Never callable from the browser (these are in the API-exposed schema).
revoke all on function public.safe_time_zone(text) from public, anon, authenticated;
revoke all on function public.reminder_trigger_at(date, text, integer, text) from public, anon, authenticated;
revoke all on function public.cron_tick_due() from public, anon, authenticated;
revoke all on function public.call_app_route(text) from public, anon, authenticated;
revoke all on function public.cron_tick() from public, anon, authenticated;

-- Schedules (UTC; Perth is UTC+8 with no daylight saving). Re-running
-- cron.schedule with the same name updates the job.
select cron.schedule('fridgeboard-tick', '* * * * *', 'select public.cron_tick()');
select cron.schedule(
  'fridgeboard-morning-summary',
  '0 23 * * *', -- 07:00 Perth
  $$select public.call_app_route('/api/push/remind?mode=summary')$$
);
select cron.schedule(
  'fridgeboard-grocery-reminder',
  '0 0 * * *', -- 08:00 Perth
  $$select public.call_app_route('/api/push/remind?mode=grocery')$$
);
-- pg_cron keeps a row per run (1,440 a day for the tick); keep a week.
select cron.schedule(
  'fridgeboard-cron-history-cleanup',
  '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
