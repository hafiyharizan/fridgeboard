-- Multi-day events: last day of the event (YYYY-MM-DD); null = single day.
alter table public.calendar_events add column end_date text;

alter table public.calendar_events
  add constraint calendar_events_end_date_after_start
  check (end_date is null or end_date > event_date);
