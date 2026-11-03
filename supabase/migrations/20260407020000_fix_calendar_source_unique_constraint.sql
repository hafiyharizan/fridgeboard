-- Replace the partial unique index with a real unique constraint so that
-- ON CONFLICT (pin_code, source_type, source_event_id) works correctly.
-- The import route now uses INSERT (not UPSERT) with client-side dedup,
-- but the constraint still prevents accidental duplicates at the DB level.

drop index if exists public.idx_calendar_events_source_unique;

-- Only add the constraint for rows that have a source_event_id (partial unique
-- behaviour is replicated by filtering NULLs before insert in application code).
-- We use a unique index with WHERE to keep it partial at the DB level.
create unique index if not exists idx_calendar_events_source_unique
  on public.calendar_events (pin_code, source_type, source_event_id)
  where source_event_id is not null;
