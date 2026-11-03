import { isSameOriginRequest } from "@/lib/request-security";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCalendarSourceEvents, isCalendarImportSupported, normalizeCalendarTitle } from "@/lib/calendar-sources";
import { createSupabaseRouteClient } from "@/lib/supabase";
import type { CalendarEvent, CalendarImportSource, Database } from "@/lib/types";

const VALID_SOURCES = new Set<CalendarImportSource>([
  "islamic",
  "malaysia_public_holiday",
  "wa_public_holiday",
]);

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let payload: { source?: unknown; year?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body with source and year." }, { status: 400 });
  }

  if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Invalid import request." }, { status: 400 });
  const source = payload.source;
  const year = Number(payload.year);

  if (typeof source !== "string" || !VALID_SOURCES.has(source as CalendarImportSource)) {
    return NextResponse.json({ error: "Pick a valid calendar source." }, { status: 400 });
  }

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Pick a valid calendar year." }, { status: 400 });
  }

  if (!isCalendarImportSupported(source as CalendarImportSource, year)) {
    return NextResponse.json({ error: `${source} is not available for ${year} yet.` }, { status: 400 });
  }

  const sourceKey = source as CalendarImportSource;

  const cookieStore = await cookies();
  const supabase = createSupabaseRouteClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to import a calendar." }, { status: 401 });
  }

  const { data: pinCode, error: pinError } = await supabase.rpc("current_user_pin");

  if (pinError || !pinCode) {
    return NextResponse.json({ error: pinError?.message || "Join a household before importing a calendar." }, { status: 400 });
  }

  const rangeStart = `${year}-01-01`;
  const rangeEnd = `${year}-12-31`;
  const { data: existingEvents, error: existingError } = await supabase
    .from("calendar_events")
    .select("event_date, title, source_type, source_event_id")
    .eq("pin_code", pinCode)
    .gte("event_date", rangeStart)
    .lte("event_date", rangeEnd);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const currentEvents = (existingEvents ?? []) as Pick<
    CalendarEvent,
    "event_date" | "title" | "source_type" | "source_event_id"
  >[];

  const existingSourceIds = new Set(
    currentEvents
      .filter((event) => event.source_type === sourceKey && event.source_event_id)
      .map((event) => event.source_event_id as string),
  );

  const existingTitleDates = new Set(
    currentEvents.map((event) => `${event.event_date}|${normalizeCalendarTitle(event.title)}`),
  );

  const sourceEvents = getCalendarSourceEvents(sourceKey, year);
  const rows: Database["public"]["Tables"]["calendar_events"]["Insert"][] = sourceEvents
    .filter((event) => {
      const dedupeKey = `${event.event_date}|${normalizeCalendarTitle(event.title)}`;
      return existingSourceIds.has(event.source_event_id) || !existingTitleDates.has(dedupeKey);
    })
    .map((event) => ({
      pin_code: pinCode,
      event_date: event.event_date,
      title: event.title,
      note: event.note ?? null,
      event_type: event.event_type,
      color: event.color,
      recurrence: "none" as const,
      recurrence_end: null,
      notify_before: -1,
      notify_channels: [],
      source_type: sourceKey,
      source_label: event.source_label,
      source_event_id: event.source_event_id,
    }));

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from("calendar_events").upsert(rows, {
      onConflict: "pin_code,source_type,source_event_id",
    });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    imported: rows.length,
    skipped: sourceEvents.length - rows.length,
    total: sourceEvents.length,
  });
}
