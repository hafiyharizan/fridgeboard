/**
 * CalDAV server middleware — intercepts all /api/caldav/* requests so that
 * Apple Calendar (and any RFC 4791-compliant client) can perform real two-way
 * sync using HTTP methods that Next.js route handlers do not support natively
 * (PROPFIND, REPORT, MKCALENDAR, PROPPATCH).
 *
 * URL layout:
 *   /api/caldav/{token}/                        — principal + calendar-home
 *   /api/caldav/{token}/calendar/               — calendar collection
 *   /api/caldav/{token}/calendar/{uuid}.ics     — individual VEVENT resource
 *
 * Authentication: the sync token (UUID from calendar_sync_tokens) is embedded
 * in the URL. Optionally, HTTP Basic auth password may also be the token — the
 * username field is ignored.  Both are checked; URL token takes precedence.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { buildVEVENT, buildCalendarFeed, parseVEVENT } from "@/lib/calendar-feed";
import type { CalendarEvent } from "@/lib/types";

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// XML namespace constants
// ---------------------------------------------------------------------------

const NS_DAV = "DAV:";
const NS_CALDAV = "urn:ietf:params:xml:ns:caldav";
const NS_CS = "http://calendarserver.org/ns/";

// ---------------------------------------------------------------------------
// Minimal XML builders
// ---------------------------------------------------------------------------

function xmlDoc(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\r\n${body}`;
}

function el(tag: string, content: string, attrs = ""): string {
  return `<${tag}${attrs ? ` ${attrs}` : ""}>${content}</${tag}>`;
}

function multistatus(responses: string[]): string {
  return xmlDoc(
    el(
      "D:multistatus",
      responses.join(""),
      `xmlns:D="${NS_DAV}" xmlns:C="${NS_CALDAV}" xmlns:CS="${NS_CS}"`,
    ),
  );
}

function davResponse(href: string, propstats: string[]): string {
  return el("D:response", el("D:href", href) + propstats.join(""));
}

function propstatOk(propXml: string): string {
  return el("D:propstat", el("D:prop", propXml) + el("D:status", "HTTP/1.1 200 OK"));
}

function xmlResponse(body: string, status = 207): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      DAV: "1, 2, calendar-access",
      Allow: "OPTIONS, GET, HEAD, DELETE, PROPFIND, PROPPATCH, PUT, REPORT, MKCALENDAR",
    },
  });
}

// ---------------------------------------------------------------------------
// XML helpers for parsing REPORT request bodies
// ---------------------------------------------------------------------------

/** Extract all <href> values from a calendar-multiget REPORT body. */
function extractHrefs(xml: string): string[] {
  const re = /<[Dd]:[Hh][Rr][Ee][Ff]>([^<]+)<\/[Dd]:[Hh][Rr][Ee][Ff]>/g;
  const results: string[] = [];
  for (const m of xml.matchAll(re)) results.push(m[1]!.trim());
  return results;
}

/** Extract time-range start/end from a REPORT calendar-query. */
function extractTimeRange(xml: string): { start: string | null; end: string | null } {
  const re = /<(?:[^:>]+:)?time-range\b[^>]*>/i.exec(xml);
  if (!re) return { start: null, end: null };
  const tag = re[0];
  const startMatch = /start="([^"]+)"/i.exec(tag);
  const endMatch = /end="([^"]+)"/i.exec(tag);
  return {
    start: startMatch ? startMatch[1]! : null,
    end: endMatch ? endMatch[1]! : null,
  };
}

/** True if the REPORT body is a calendar-multiget. */
function isMultiget(xml: string): boolean {
  return /calendar-multiget/i.test(xml);
}

// ---------------------------------------------------------------------------
// iCal wrapper for a single event
// ---------------------------------------------------------------------------

function wrapInVCalendar(veventLines: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fridgeboard//CalDAV//EN",
    "CALSCALE:GREGORIAN",
    ...veventLines,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** Compute a weak ETag from the event's updated_at timestamp + id. */
function etag(event: CalendarEvent): string {
  const ts = (event as CalendarEvent & { updated_at?: string }).updated_at ?? event.created_at;
  return `"${event.id}-${new Date(ts).getTime()}"`;
}

// ---------------------------------------------------------------------------
// CalDAV request dispatcher
// ---------------------------------------------------------------------------

async function handleCalDAV(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname; // e.g. /api/caldav/{token}/calendar/abc.ics
  const method = request.method.toUpperCase();

  // ── Parse token from path ────────────────────────────────────────────────
  // Pattern: /api/caldav/{token}[/...]
  const tokenMatch = /^\/api\/caldav\/([^/]+)(\/?.*)$/.exec(path);
  if (!tokenMatch) {
    return new Response("Bad Request", { status: 400 });
  }
  const token = tokenMatch[1]!;
  const subPath = tokenMatch[2] ?? "/";

  // ── OPTIONS — always respond without auth ────────────────────────────────
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        DAV: "1, 2, calendar-access",
        Allow: "OPTIONS, GET, HEAD, DELETE, PROPFIND, PROPPATCH, PUT, REPORT, MKCALENDAR",
        "Content-Length": "0",
      },
    });
  }

  // ── Validate token ───────────────────────────────────────────────────────
  const supabase = getServiceClient();
  const { data: pinCode } = await supabase.rpc("pin_for_sync_token", { feed_token: token });
  if (!pinCode) {
    return new Response(
      xmlDoc(
        `<D:error xmlns:D="${NS_DAV}"><D:need-privileges/></D:error>`,
      ),
      {
        status: 401,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "WWW-Authenticate": 'Basic realm="Fridgeboard CalDAV"',
        },
      },
    );
  }

  // ── Route by sub-path ────────────────────────────────────────────────────
  const isRoot = subPath === "/" || subPath === "";
  const isCollection = subPath === "/calendar" || subPath === "/calendar/";
  const eventMatch = /^\/calendar\/([^/]+\.ics)$/.exec(subPath);
  const isEvent = Boolean(eventMatch);
  const eventSlug = eventMatch?.[1]; // e.g. "abc-123.ics"
  const eventId = eventSlug?.replace(/\.ics$/, ""); // the UUID

  const basePath = `/api/caldav/${token}`;
  const collectionHref = `${basePath}/calendar/`;

  // Fetch all events for this household (needed by multiple handlers)
  async function fetchEvents(dateStart?: string, dateEnd?: string): Promise<CalendarEvent[]> {
    let query = supabase
      .from("calendar_events")
      .select("*")
      .eq("pin_code", pinCode!)
      .order("event_date", { ascending: true });

    if (dateStart) query = query.gte("event_date", dateStart);
    if (dateEnd) query = query.lte("event_date", dateEnd);

    const { data } = await query;
    return (data ?? []) as CalendarEvent[];
  }

  async function fetchEvent(id: string): Promise<CalendarEvent | null> {
    const { data } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("pin_code", pinCode!)
      .eq("id", id)
      .single();
    return (data ?? null) as CalendarEvent | null;
  }

  // ── PROPFIND ─────────────────────────────────────────────────────────────
  if (method === "PROPFIND") {
    const depth = request.headers.get("depth") ?? "0";

    if (isRoot || isCollection) {
      const events = await fetchEvents();
      const ctag = String(
        events.reduce((acc, e) => {
          const ts = (e as CalendarEvent & { updated_at?: string }).updated_at ?? e.created_at;
          return acc + new Date(ts).getTime();
        }, events.length),
      );

      // Collection properties
      const collectionProps = propstatOk([
        el("D:resourcetype", el("D:collection", "") + el("C:calendar", "")),
        el("D:displayname", "Fridgeboard"),
        el("D:principal-URL", el("D:href", basePath + "/")),
        el("D:current-user-principal", el("D:href", basePath + "/")),
        el("C:calendar-home-set", el("D:href", basePath + "/")),
        el(
          "C:supported-calendar-component-set",
          el("C:comp", "", 'name="VEVENT"') + el("C:comp", "", 'name="VTODO"'),
        ),
        el("CS:getctag", ctag),
        el("D:getetag", `"ctag-${ctag}"`),
      ].join(""));

      const principalProps = propstatOk([
        el("D:resourcetype", el("D:principal", "") + el("D:collection", "")),
        el("D:displayname", "Fridgeboard"),
        el("D:principal-URL", el("D:href", basePath + "/")),
        el("D:current-user-principal", el("D:href", basePath + "/")),
        el("C:calendar-home-set", el("D:href", collectionHref)),
      ].join(""));

      const responses: string[] = [];

      if (isRoot) {
        responses.push(davResponse(basePath + "/", [principalProps]));
        if (depth === "1") {
          responses.push(davResponse(collectionHref, [collectionProps]));
        }
      } else {
        // isCollection
        responses.push(davResponse(collectionHref, [collectionProps]));
        if (depth === "1") {
          // Return event stubs (etag + resource type only — clients use REPORT for calendar-data)
          for (const event of events) {
            const href = `${collectionHref}${event.id}.ics`;
            responses.push(
              davResponse(href, [
                propstatOk([
                  el("D:resourcetype", ""),
                  el("D:getetag", etag(event)),
                ].join("")),
              ]),
            );
          }
        }
      }

      return xmlResponse(multistatus(responses));
    }

    if (isEvent && eventId) {
      const event = await fetchEvent(eventId);
      if (!event) return new Response("Not Found", { status: 404 });

      const href = `${collectionHref}${eventId}.ics`;
      const response = davResponse(href, [
        propstatOk([
          el("D:resourcetype", ""),
          el("D:getetag", etag(event)),
          el("D:getcontenttype", "text/calendar; charset=utf-8"),
        ].join("")),
      ]);
      return xmlResponse(multistatus([response]));
    }

    return new Response("Not Found", { status: 404 });
  }

  // ── REPORT ───────────────────────────────────────────────────────────────
  if (method === "REPORT") {
    if (!isCollection && !isRoot) {
      return new Response("Not Found", { status: 404 });
    }

    const body = await request.text();

    if (isMultiget(body)) {
      // calendar-multiget: fetch specific events by href
      const hrefs = extractHrefs(body);
      const ids = hrefs
        .map((h) => {
          const m = /\/([^/]+)\.ics$/.exec(h);
          return m ? m[1]! : null;
        })
        .filter((id): id is string => id !== null);

      const responses: string[] = [];
      for (const id of ids) {
        const event = await fetchEvent(id);
        if (!event) continue;
        const href = `${collectionHref}${event.id}.ics`;
        const calendarData = wrapInVCalendar(buildVEVENT(event));
        responses.push(
          davResponse(href, [
            propstatOk([
              el("D:getetag", etag(event)),
              el("C:calendar-data", calendarData),
            ].join("")),
          ]),
        );
      }
      return xmlResponse(multistatus(responses));
    }

    // calendar-query (possibly with time-range filter)
    const { start, end } = extractTimeRange(body);
    let dateStart: string | undefined;
    let dateEnd: string | undefined;

    if (start) {
      // start is like "20260401T000000Z" → "2026-04-01"
      const m = /^(\d{4})(\d{2})(\d{2})/.exec(start);
      if (m) dateStart = `${m[1]}-${m[2]}-${m[3]}`;
    }
    if (end) {
      const m = /^(\d{4})(\d{2})(\d{2})/.exec(end);
      if (m) dateEnd = `${m[1]}-${m[2]}-${m[3]}`;
    }

    const events = await fetchEvents(dateStart, dateEnd);
    const responses: string[] = [];

    for (const event of events) {
      const href = `${collectionHref}${event.id}.ics`;
      const calendarData = wrapInVCalendar(buildVEVENT(event));
      responses.push(
        davResponse(href, [
          propstatOk([
            el("D:getetag", etag(event)),
            el("C:calendar-data", calendarData),
          ].join("")),
        ]),
      );
    }

    return xmlResponse(multistatus(responses));
  }

  // ── GET / HEAD ───────────────────────────────────────────────────────────
  if (method === "GET" || method === "HEAD") {
    if (isCollection || isRoot) {
      // Return the full calendar feed for the household
      const events = await fetchEvents();
      const ics = buildCalendarFeed(events, { calendarName: "Fridgeboard" });
      return new Response(method === "HEAD" ? null : ics, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Cache-Control": "private, no-cache",
        },
      });
    }

    if (isEvent && eventId) {
      const event = await fetchEvent(eventId);
      if (!event) return new Response("Not Found", { status: 404 });

      const ics = wrapInVCalendar(buildVEVENT(event));
      return new Response(method === "HEAD" ? null : ics, {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          ETag: etag(event),
          "Cache-Control": "private, no-cache",
        },
      });
    }

    return new Response("Not Found", { status: 404 });
  }

  // ── PUT — create or update a VEVENT ─────────────────────────────────────
  if (method === "PUT") {
    if (!isEvent || !eventId) {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const icsBody = await request.text();
    const parsed = parseVEVENT(icsBody);
    if (!parsed) {
      return new Response("Bad Request: could not parse VEVENT", { status: 400 });
    }

    // Check If-None-Match: * (client wants to create, not overwrite)
    const ifNoneMatch = request.headers.get("if-none-match");
    const ifMatch = request.headers.get("if-match");

    // Check whether the event already exists
    const existing = await fetchEvent(eventId);

    if (existing) {
      // ETag precondition check — reject if client's ETag is stale
      if (ifMatch && ifMatch !== "*" && ifMatch !== etag(existing)) {
        return new Response("Precondition Failed", { status: 412 });
      }
      if (ifNoneMatch === "*") {
        return new Response("Precondition Failed", { status: 412 });
      }

      // Update existing event
      const { error } = await supabase
        .from("calendar_events")
        .update({
          title: parsed.title,
          note: parsed.note,
          event_date: parsed.event_date,
          event_time: parsed.event_time,
          event_type: parsed.event_type,
          recurrence: parsed.recurrence,
          recurrence_end: parsed.recurrence_end,
          notify_before: parsed.notify_before,
          is_done: parsed.is_done,
          source_type: "caldav",
        })
        .eq("id", eventId)
        .eq("pin_code", pinCode!);

      if (error) return new Response(error.message, { status: 500 });

      const updated = await fetchEvent(eventId);
      return new Response(null, {
        status: 204,
        headers: {
          ETag: updated ? etag(updated) : `"${eventId}"`,
        },
      });
    } else {
      // Create new event with the provided UUID
      const { error } = await supabase.from("calendar_events").insert({
        id: eventId,
        pin_code: pinCode!,
        title: parsed.title,
        note: parsed.note,
        event_date: parsed.event_date,
        event_time: parsed.event_time,
        event_type: parsed.event_type,
        color: parsed.color,
        recurrence: parsed.recurrence,
        recurrence_end: parsed.recurrence_end,
        notify_before: parsed.notify_before,
        notify_channels: [],
        is_done: parsed.is_done,
        source_type: "caldav",
      });

      if (error) return new Response(error.message, { status: 500 });

      const created = await fetchEvent(eventId);
      return new Response(null, {
        status: 201,
        headers: {
          ETag: created ? etag(created) : `"${eventId}"`,
          Location: `${collectionHref}${eventId}.ics`,
        },
      });
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (method === "DELETE") {
    if (!isEvent || !eventId) {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const existing = await fetchEvent(eventId);
    if (!existing) return new Response("Not Found", { status: 404 });

    const ifMatch = request.headers.get("if-match");
    if (ifMatch && ifMatch !== "*" && ifMatch !== etag(existing)) {
      return new Response("Precondition Failed", { status: 412 });
    }

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", eventId)
      .eq("pin_code", pinCode!);

    if (error) return new Response(error.message, { status: 500 });
    return new Response(null, { status: 204 });
  }

  // ── MKCALENDAR / PROPPATCH — accept gracefully ───────────────────────────
  if (method === "MKCALENDAR") {
    return new Response(null, { status: 201 });
  }

  if (method === "PROPPATCH") {
    return xmlResponse(multistatus([]));
  }

  return new Response("Method Not Allowed", { status: 405 });
}

// ---------------------------------------------------------------------------
// Middleware entry point
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest): Promise<NextResponse | Response> {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/caldav/")) {
    return handleCalDAV(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/caldav/:path*"],
};
