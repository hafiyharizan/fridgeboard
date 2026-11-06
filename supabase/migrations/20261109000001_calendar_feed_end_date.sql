-- The iCal feed now carries end_date so multi-day events export with the right DTEND.
-- The return table changes, so the function is dropped and recreated (same
-- security definer / search_path as the original; no explicit grants existed).
drop function if exists public.get_calendar_feed(text);

create function public.get_calendar_feed(feed_token text)
returns table (
  id uuid,
  pin_code text,
  event_date date,
  title text,
  note text,
  event_type text,
  color text,
  is_done boolean,
  recurrence text,
  recurrence_end date,
  end_date text,
  notify_before integer,
  notify_channels text[],
  created_at timestamptz,
  source_type text,
  source_label text,
  source_event_id text
)
language sql
security definer
set search_path = public
as $$
  select
    calendar_events.id,
    calendar_events.pin_code,
    calendar_events.event_date,
    calendar_events.title,
    calendar_events.note,
    calendar_events.event_type,
    calendar_events.color,
    calendar_events.is_done,
    calendar_events.recurrence,
    calendar_events.recurrence_end,
    calendar_events.end_date,
    calendar_events.notify_before,
    calendar_events.notify_channels,
    calendar_events.created_at,
    calendar_events.source_type,
    calendar_events.source_label,
    calendar_events.source_event_id
  from public.calendar_sync_tokens
  join public.calendar_events
    on calendar_events.pin_code = calendar_sync_tokens.pin_code
  where calendar_sync_tokens.token::text = feed_token
  order by calendar_events.event_date asc, calendar_events.title asc
$$;
