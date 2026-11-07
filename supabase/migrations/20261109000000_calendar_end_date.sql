-- Multi-day events: last day of the event; null = single day.
-- Same type as event_date and recurrence_end (date). Safe to re-run: if an
-- earlier attempt created the column as text, it is converted to date.
alter table public.calendar_events add column if not exists end_date date;
alter table public.calendar_events alter column end_date type date using end_date::date;

alter table public.calendar_events
  drop constraint if exists calendar_events_end_date_after_start;
alter table public.calendar_events
  add constraint calendar_events_end_date_after_start
  check (end_date is null or end_date > event_date);
