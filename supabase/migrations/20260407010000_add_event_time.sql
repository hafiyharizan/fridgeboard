-- Add event_time column to calendar_events
-- Stores time in HH:MM (24-hour) format. Nullable — existing events are untimed.
-- Required to set a reminder (notify_before >= 0) going forward.
alter table public.calendar_events
  add column if not exists event_time text null;
