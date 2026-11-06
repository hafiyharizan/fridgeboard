"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock3,
  House,
  ListChecks,
  Newspaper,
  Plus,
  Repeat,
  ShoppingBasket,
  Sunrise,
  TrendingUp,
} from "lucide-react";
import { AmbientScreen, OutsideCard } from "@/components/Ambient";
import { Dialog } from "@/components/Dialog";
import { SwipeDeck } from "@/components/SwipeDeck";
import { useNews, useNow, useStocks, type PrayerDay } from "@/hooks/useAmbient";
import { formatChange, formatPrice, priceCurrency, type StockQuote } from "@/lib/stocks";
import { useWholeRows } from "@/hooks/useWholeRows";
import { newsAge, type NewsItem } from "@/lib/news";
import type { Forecast } from "@/lib/weather";
import { useCalendarData, useHousehold, useListData, useWorkData } from "@/components/WorkspaceData";
import { useKitchenEnabled } from "@/hooks/useKitchenDisplay";
import { daysSince, lastDoneLabel, needsDoing, sortRoutines } from "@/lib/routine";
import { MemberAvatar, MemberTag, useMemberLookup } from "@/components/MemberTag";
import { atWorkNow, formatShift, homeSummary, homeSummaryText } from "@/lib/work";
import {
  defaultScheduleDay,
  eventPhase,
  nextDateKey,
  nextUpEvent,
  pendingItems,
  upcomingEvents,
  weekDates,
} from "@/lib/dashboard";
import { formatEventTime } from "@/lib/calendar";
import type {
  CalendarEventType,
  ExpandedCalendarEvent,
  FridgeList,
  HouseholdSettings,
} from "@/lib/types";

export function DataStatus({
  loading,
  error,
  connected,
  retry,
}: {
  loading: boolean;
  error: string;
  connected: boolean;
  retry?: () => void;
}) {
  if (error)
    return (
      <p className="data-status error" role="alert">
        {error}{" "}
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </p>
    );
  if (loading)
    return (
      <p className="data-status" role="status">
        Loading your household…
      </p>
    );
  if (!connected)
    return (
      <p className="data-status" role="status">
        Reconnecting · displayed information may be out of date.
      </p>
    );
  return null;
}

const TYPE_LABEL: Record<CalendarEventType, string> = {
  event: "Event",
  reminder: "Reminder",
  todo: "To-do",
};
const TYPE_ICON: Record<CalendarEventType, typeof CalendarDays> = {
  event: CalendarDays,
  reminder: Bell,
  todo: ListChecks,
};

/** "16:00" → { time: "4:00", period: "PM" }; no time → all day. */
function timeParts(hhmm: string | null) {
  if (!hhmm) return { time: "All", period: "day" };
  const [time, period = ""] = formatEventTime(hhmm).split(" ");
  return { time, period };
}

function dayLabel(day: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, options);
}

/* ---------- Left column ---------- */

/** "Next up" line on the combined clock + weather card. */
function NextUp({
  nextUp,
  today,
  onEvent,
}: {
  nextUp: ExpandedCalendarEvent | null;
  today: string;
  onEvent: (event: ExpandedCalendarEvent) => void;
}) {
  if (!nextUp) {
    return (
      <p className="hero-next">
        <Clock3 size={18} aria-hidden />
        <span>Nothing else planned this week.</span>
      </p>
    );
  }
  const when = `${nextUp.occurrence_date === today ? "" : `${dayLabel(nextUp.occurrence_date, { weekday: "short" })} `}${
    nextUp.event_time ? formatEventTime(nextUp.event_time) : "all day"
  }`;
  return (
    <button className="hero-next" onClick={() => onEvent(nextUp)}>
      <Clock3 size={18} aria-hidden />
      <span>
        Next up: <strong>{nextUp.title}</strong> · {when}
      </span>
    </button>
  );
}

function NewsRow({ item, now }: { item: NewsItem; now: Date }) {
  return (
    <a className="news-item" href={item.link} draggable={false} target="_blank" rel="noopener noreferrer">
      <span className="news-title">{item.title}</span>
      <span className="news-meta">
        {item.source}
        {item.publishedAt && <> · {newsAge(item.publishedAt, now)}</>}
      </span>
    </a>
  );
}

/** Day-move direction for colouring a tile. */
function trendOf(change: string) {
  return !change || change === "0.0%" ? "flat" : change.startsWith("+") ? "up" : "down";
}

/** Market tiles from /api/stocks: share, index and currency pairs, one swipe away from the news. */
function MarketsCard({ quotes, loaded }: { quotes: StockQuote[]; loaded: boolean }) {
  return (
    <section className="card news-card markets-card" aria-label="Markets">
      <div className="news-head">
        <p className="eyebrow">
          <TrendingUp size={16} aria-hidden /> Markets
        </p>
      </div>
      {quotes.length ? (
        <ul className="market-grid">
          {quotes.map((quote) => {
            const change = formatChange(quote);
            const currency = priceCurrency(quote);
            return (
              <li key={quote.symbol} className={`market-tile is-${trendOf(change)}`}>
                <span className="market-label">{quote.label}</span>
                <span className="market-price">
                  <strong>{formatPrice(quote)}</strong>
                  {currency && <span className="market-currency">{currency}</span>}
                </span>
                {change && <span className="market-change">{change}</span>}
              </li>
            );
          })}
        </ul>
      ) : loaded ? (
        <p className="empty-copy">Market numbers aren&apos;t available right now.</p>
      ) : (
        <ul className="market-grid" aria-label="Loading markets">
          {[0, 1, 2, 3].map((key) => (
            <li key={key} className="market-tile is-skeleton" />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Two Perth headlines from /api/news (ABC News WA + national by default); the rest open in a dialog.
 * Lowest priority on Home, so it stays small.
 */
function NewsCard() {
  const news = useNews();
  const now = useNow(60_000);
  const [open, setOpen] = useState(false);
  const shown = news.items.slice(0, 2);
  const [rowsRef, visibleRows] = useWholeRows<HTMLUListElement>(shown.map((item) => item.id).join());
  return (
    <section className="card news-card" aria-label="News">
      <div className="news-head">
        <p className="eyebrow">
          <Newspaper size={16} aria-hidden /> Perth news
        </p>
        {news.items.length > 0 && (
          <button className="text-button" onClick={() => setOpen(true)}>
            More news
          </button>
        )}
      </div>
      {news.loading && !news.items.length ? (
        <ul className="news-list" aria-label="Loading headlines">
          {[0, 1].map((key) => (
            <li key={key}>
              <span className="news-skeleton" />
            </li>
          ))}
        </ul>
      ) : shown.length ? (
        <ul className="news-list" ref={rowsRef}>
          {shown.map((item, index) => (
            <li key={item.id} data-clipped={index >= visibleRows || undefined}>
              <NewsRow item={item} now={now} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-copy">Headlines aren&apos;t available right now.</p>
      )}
      {open && (
        <Dialog title="Perth news" onClose={() => setOpen(false)}>
          <ul className="news-list is-dialog">
            {news.items.map((item) => (
              <li key={item.id}>
                <NewsRow item={item} now={now} />
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </section>
  );
}

/** News and Markets share one cell; Markets drops out when no numbers come back. */
function NewsMarketsDeck() {
  const { quotes, loaded } = useStocks();
  const cards = [{ id: "news", label: "News", node: <NewsCard /> }];
  if (!loaded || quotes.length) {
    cards.push({ id: "markets", label: "Markets", node: <MarketsCard quotes={quotes} loaded={loaded} /> });
  }
  return <SwipeDeck cards={cards} label="News and markets" />;
}

/* ---------- Middle column ---------- */

type ScheduleView = "today" | "tomorrow" | "week";

function AgendaRow({
  event,
  onEvent,
  phase,
  clipped,
}: {
  event: ExpandedCalendarEvent;
  onEvent: (event: ExpandedCalendarEvent) => void;
  phase: "earlier" | "now" | "later";
  clipped?: boolean;
}) {
  const { time, period } = timeParts(event.event_time);
  const Icon = TYPE_ICON[event.event_type];
  const meta =
    event.note?.trim() ||
    (event.recurrence !== "none" ? `Repeats ${event.recurrence}` : "");
  return (
    <li data-clipped={clipped || undefined}>
      <motion.button
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.99 }}
        className={`agenda-row event-${event.color}${event.is_done ? " is-done" : ""}${
          phase === "earlier" ? " is-past" : ""
        }`}
        onClick={() => onEvent(event)}
      >
        <span className="agenda-time">
          {time}
          <small>{period}</small>
        </span>
        <span className="agenda-bar" aria-hidden />
        <span className="agenda-main">
          <span className="agenda-title">
            {phase === "now" && event.event_time && <span className="pill pill-now">Now</span>}
            {event.event_type !== "event" && (
              <span className="pill">{TYPE_LABEL[event.event_type]}</span>
            )}
            <strong>{event.title}</strong>
            <MemberTag userId={event.owner_id} personId={event.owner_person_id} label="For" />
          </span>
          {meta && <span className="agenda-meta">{meta}</span>}
        </span>
        <Icon className="agenda-icon" size={20} aria-hidden />
      </motion.button>
    </li>
  );
}

/**
 * One line under the schedule tabs: who works on the shown day and when the
 * whole household is home. Hidden when nobody has hours that day.
 */
function WorkStrip({
  day,
  today,
  now,
  onOpen,
}: {
  day: string;
  today: string;
  now: Date;
  onOpen: () => void;
}) {
  const { shifts } = useWorkData();
  const lookup = useMemberLookup();
  const dayShifts = shifts.filter((shift) => shift.shift_date === day);
  if (!dayShifts.length) return null;
  const away = day === today ? atWorkNow(shifts, now) : new Map<string, string>();
  return (
    <button className="work-strip" onClick={onOpen} aria-label="Open the work schedule">
      <BriefcaseBusiness size={18} aria-hidden className="work-strip-icon" />
      <span className="work-strip-people">
        {dayShifts.map((shift) => {
          const look = lookup(shift.user_id);
          if (!look) return null;
          return (
            <span key={shift.id}>
              <MemberAvatar look={look} size="sm" />
              <strong>{look.short}</strong> {formatShift(shift)}
              {away.has(shift.user_id) && <em className="work-strip-now">at work now</em>}
            </span>
          );
        })}
      </span>
      <span className="work-strip-home">
        <House size={16} aria-hidden /> {homeSummaryText(homeSummary(shifts, day))}
      </span>
    </button>
  );
}

function FamilySchedule({
  today,
  now,
  events,
  loading,
  onDay,
  onEvent,
  onAddEvent,
  onOpenWork,
  calendarStatus,
}: {
  onOpenWork: () => void;
  today: string;
  now: Date;
  events: ExpandedCalendarEvent[];
  loading: boolean;
  onDay: (date: string) => void;
  onEvent: (event: ExpandedCalendarEvent) => void;
  onAddEvent: (date: string) => void;
  calendarStatus: ReactNode;
}) {
  // Opens on tomorrow once today is over; a tap on a tab wins for the rest
  // of the day.
  const [picked, setPicked] = useState<{ day: string; view: ScheduleView } | null>(null);
  const view: ScheduleView =
    picked?.day === today ? picked.view : defaultScheduleDay(events, now);
  const setView = (next: ScheduleView) => setPicked({ day: today, view: next });
  const [showEarlier, setShowEarlier] = useState(false);
  const tomorrow = nextDateKey(today);
  const days = weekDates(today);
  const shownDay = view === "tomorrow" ? tomorrow : today;
  const dayEvents = events.filter((event) => event.occurrence_date === shownDay);
  const phased = dayEvents.map((event) => ({ event, phase: eventPhase(event, now) }));
  const ahead = phased.filter((row) => row.phase !== "earlier");
  const earlier = phased.filter((row) => row.phase === "earlier");
  const shownRows = showEarlier ? [...ahead, ...earlier] : ahead;
  const [rowsRef, visibleRows] = useWholeRows<HTMLUListElement>(
    `${view}|${showEarlier}|${shownRows.map((row) => `${row.event.id}${row.phase}`).join()}`,
  );
  const hiddenRows = Math.max(0, shownRows.length - visibleRows);
  const tomorrowEvents = events.filter(
    (event) => event.occurrence_date === tomorrow,
  );
  const tabs: { id: ScheduleView; label: string; sub: string }[] = [
    { id: "today", label: "Today", sub: dayLabel(today, { weekday: "short", day: "numeric" }) },
    { id: "tomorrow", label: "Tomorrow", sub: dayLabel(tomorrow, { weekday: "short", day: "numeric" }) },
    { id: "week", label: "Week", sub: "7 days" },
  ];

  return (
    <section className="card schedule-card" aria-label="Family schedule">
      <div className="schedule-head">
        <div className="card-heading">
          <span className="icon-tile">
            <CalendarDays size={22} />
          </span>
          <div className="heading-text">
            <h2>Family Schedule</h2>
            <p>Shared with everyone at home</p>
          </div>
          <button
            className="icon-button card-add schedule-add"
            onClick={() => onAddEvent(view === "tomorrow" ? tomorrow : today)}
            aria-label="Add an event"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Schedule range">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              aria-pressed={view === tab.id}
              onClick={() => setView(tab.id)}
            >
              {tab.label}
              <small>{tab.sub}</small>
            </button>
          ))}
        </div>
      </div>
      {calendarStatus}
      {view !== "week" && <WorkStrip day={shownDay} today={today} now={now} onOpen={onOpenWork} />}

      {view === "week" ? (
        <ul className="agenda">
          {days.map((day, index) => {
            const daily = events.filter((event) => event.occurrence_date === day);
            return (
              <li key={day}>
                <button
                  className={`week-row${index === 0 ? " is-today" : ""}`}
                  onClick={() => onDay(day)}
                  aria-label={`Open ${dayLabel(day, { weekday: "long", month: "long", day: "numeric" })}, ${daily.length} plans`}
                >
                  <span className="week-row-day">
                    {index === 0 ? "Today" : dayLabel(day, { weekday: "short" })}
                    <strong>{new Date(`${day}T12:00:00`).getDate()}</strong>
                  </span>
                  <span className="week-row-events">
                    {daily.length ? (
                      daily.slice(0, 2).map((event) => (
                        <span key={`${event.id}-${day}`}>
                          {event.event_time
                            ? formatEventTime(event.event_time)
                            : "All day"}{" "}
                          · {event.title}
                        </span>
                      ))
                    ) : (
                      <span className="quiet">No plans yet</span>
                    )}
                  </span>
                  {daily.length > 2 ? (
                    <span className="pill pill-quiet">+{daily.length - 2}</span>
                  ) : (
                    <ArrowUpRight size={18} className="agenda-icon" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : dayEvents.length ? (
        <>
          <ul className="agenda" ref={rowsRef}>
            {!ahead.length && !showEarlier && (
              <li className="agenda-note">That&apos;s everything for today.</li>
            )}
            {shownRows.map(({ event, phase }, index) => (
              <AgendaRow
                key={`${event.id}-${event.occurrence_date}`}
                event={event}
                phase={phase}
                onEvent={onEvent}
                clipped={index >= visibleRows}
              />
            ))}
          </ul>
          {(earlier.length > 0 || hiddenRows > 0) && (
            <div className="agenda-extra">
              {earlier.length > 0 && (
                <button
                  className="text-button agenda-earlier"
                  aria-expanded={showEarlier}
                  onClick={() => setShowEarlier((value) => !value)}
                >
                  {showEarlier ? "Hide earlier" : `Earlier today · ${earlier.length}`}
                  <ChevronDown size={16} aria-hidden className={showEarlier ? "is-flipped" : undefined} />
                </button>
              )}
              {hiddenRows > 0 && (
                <button className="text-button" onClick={() => onDay(shownDay)}>
                  View all · {dayEvents.length} plans <ArrowUpRight size={16} />
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="agenda-empty">
          <span className="icon-tile">
            <CalendarPlus size={26} />
          </span>
          <h3>{loading ? "Loading plans…" : "Nothing planned"}</h3>
          {!loading && (
            <>
              <p>
                {view === "today"
                  ? "A calm day at home."
                  : "Tomorrow is wide open."}
              </p>
              <button
                className="secondary-button"
                onClick={() => onAddEvent(shownDay)}
              >
                <CalendarPlus size={18} /> Add a plan
              </button>
            </>
          )}
        </div>
      )}

      {view === "today" && (
        <div className="agenda-footer">
          <span className="icon-tile">
            <Sunrise size={20} />
          </span>
          <div>
            <p className="eyebrow">
              Tomorrow · {dayLabel(tomorrow, { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <p>
              {tomorrowEvents.length
                ? `${tomorrowEvents[0].event_time ? `${formatEventTime(tomorrowEvents[0].event_time)} ` : ""}${tomorrowEvents[0].title}${
                    tomorrowEvents.length > 1
                      ? ` · +${tomorrowEvents.length - 1} more`
                      : ""
                  }`
                : "Nothing planned yet"}
            </p>
          </div>
          <button className="footer-button" onClick={() => onDay(tomorrow)}>
            View day
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- Right column ---------- */

function ListCard({
  list,
  kind,
  onOpen,
  onAdd,
}: {
  list: FridgeList;
  kind: "grocery" | "todo";
  onOpen: () => void;
  onAdd: () => void;
}) {
  const data = useListData(list.id);
  const items = pendingItems(data.items);
  const grocery = kind === "grocery";
  const Icon = grocery ? ShoppingBasket : ListChecks;
  const title = grocery ? "Groceries" : "To-Do";
  const now = useNow(60_000);
  const kitchen = useKitchenEnabled();
  const { adderId } = useHousehold();
  // Routines show up here only once they're due ("Change bed sheets · 9 days ago").
  const dueRoutines = grocery
    ? []
    : sortRoutines(data.items.filter((item) => item.is_routine && needsDoing(item, now)), now);
  const rendered = [...items, ...dueRoutines].slice(0, 8);
  const total = items.length + dueRoutines.length;
  const [rowsRef, visibleRows] = useWholeRows<HTMLUListElement>(rendered.map((item) => item.id).join());
  const shown = Math.min(rendered.length, visibleRows);
  return (
    <section className="card list-card" aria-label={`${title} summary`}>
      <div className="card-heading">
        <span className="icon-tile">
          <Icon size={22} />
        </span>
        <h2>{title}</h2>
        {!data.loading && (
          <span className={`pill${grocery && items.length ? " pill-amber" : ""}`}>
            {items.length} {grocery ? "needed" : "remaining"}
          </span>
        )}
        <button
          className="icon-button card-add"
          onClick={onAdd}
          aria-label={grocery ? "Add a grocery item" : "Add a task"}
        >
          <Plus size={20} />
        </button>
        <button
          className="icon-button card-open"
          onClick={onOpen}
          aria-label={`Open ${grocery ? "groceries" : "to-do"}`}
        >
          <ArrowUpRight size={20} />
        </button>
      </div>
      <DataStatus {...data} />
      {!data.loading && !data.error && !total && (
        <p className="empty-copy">
          {grocery
            ? "Everything on the list is picked up."
            : "A little breathing room. Nothing left to do."}
        </p>
      )}
      <ul className="list-rows" ref={rowsRef}>
        {rendered.map((item, index) => {
          const routine = item.is_routine === true;
          return (
            <motion.li
              layout
              key={item.id}
              className={`list-row${grocery ? " is-tinted" : ""}`}
              data-clipped={index >= shown || undefined}
            >
              <button
                className="check-control"
                disabled={data.isWorking}
                aria-label={routine ? `Done ${item.text} today` : `Check ${item.text}`}
                onClick={() =>
                  void (routine
                    ? data.markDone(item, kitchen ? adderId : null)
                    : data.toggleItem(item))
                }
              >
                <span className="check-ring">
                  <Check size={15} strokeWidth={3} />
                </span>
              </button>
              <span className="item-label">{item.text}</span>
              {routine ? (
                <span className="pill pill-rose" title="Last done">
                  <Repeat size={13} aria-hidden />
                  <span className="sr-only">Last done </span>
                  {lastDoneLabel(daysSince(item.last_done_at, now))}
                </span>
              ) : (
                <MemberTag userId={item.added_by ?? item.created_by} label="Added by" />
              )}
            </motion.li>
          );
        })}
      </ul>
      {total > shown && (
        <div className="list-footer">
          <button className="text-button" onClick={onOpen}>
            View all · {total} {total === 1 ? "item" : "items"} <ArrowUpRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}

/* ---------- Page ---------- */

export function HomeDashboard({
  today,
  lists,
  onNavigate,
  onDay,
  onEvent,
  onAddEvent,
  onAddToList,
  settings,
  forecast,
  weatherFailed,
  prayer,
  onSetup,
  onOpenWork,
}: {
  onOpenWork: () => void;
  today: string;
  lists: FridgeList[];
  onNavigate: (id: string) => void;
  onDay: (date: string) => void;
  onEvent: (event: ExpandedCalendarEvent) => void;
  onAddEvent: (date: string) => void;
  onAddToList: (id: string) => void;
  settings: HouseholdSettings | null;
  forecast: Forecast | null;
  weatherFailed?: boolean;
  prayer: PrayerDay | null;
  onSetup: () => void;
}) {
  const calendar = useCalendarData();
  const days = weekDates(today);
  const events = upcomingEvents(calendar.rawEvents, today, days[6]);
  const grocery = lists.find((list) => list.name === "Grocery");
  const todo = lists.find((list) => list.name === "To-Do");
  const now = useNow(15_000);
  const nextUp = nextUpEvent(events, now);

  return (
    <div className="home-grid">
      <div className="home-side">
        <OutsideCard
          settings={settings}
          forecast={forecast}
          weatherFailed={weatherFailed}
          prayer={prayer}
          now={now}
          onSetup={onSetup}
        >
          <NextUp nextUp={nextUp} today={today} onEvent={onEvent} />
        </OutsideCard>
        <NewsMarketsDeck />
      </div>

      <FamilySchedule
        today={today}
        now={now}
        events={events}
        loading={calendar.loading}
        onDay={onDay}
        onEvent={onEvent}
        onAddEvent={onAddEvent}
        onOpenWork={onOpenWork}
        calendarStatus={<DataStatus {...calendar} loading={false} />}
      />

      <div className="home-lists">
        {todo ? (
          <ListCard list={todo} kind="todo" onOpen={() => onNavigate(todo.id)} onAdd={() => onAddToList(todo.id)} />
        ) : (
          <section className="card list-card">
            <h2>To-Do</h2>
            <p className="empty-copy">No task list in this household.</p>
          </section>
        )}
        {grocery ? (
          <ListCard
            list={grocery}
            kind="grocery"
            onOpen={() => onNavigate(grocery.id)}
            onAdd={() => onAddToList(grocery.id)}
          />
        ) : (
          <section className="card list-card">
            <h2>Groceries</h2>
            <p className="empty-copy">No grocery list in this household.</p>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Kitchen display idle view: big time, next event, list counts, weather and
 * next prayer. Lives here because it reads the same household data as Home.
 */
export function AmbientLayer({
  visible,
  night,
  offset,
  dim,
  slideshow,
  lists,
  today,
  forecast,
  prayer,
}: {
  visible: boolean;
  night: boolean;
  offset: { x: number; y: number };
  dim: boolean;
  slideshow: boolean;
  lists: FridgeList[];
  today: string;
  forecast: Forecast | null;
  prayer: PrayerDay | null;
}) {
  const calendar = useCalendarData();
  const grocery = lists.find((list) => list.name === "Grocery");
  const todo = lists.find((list) => list.name === "To-Do");
  const groceryData = useListData(grocery?.id ?? lists[0].id);
  const todoData = useListData(todo?.id ?? lists[0].id);
  const now = useNow(15_000);
  const events = upcomingEvents(calendar.rawEvents, today, weekDates(today)[6]);
  return (
    <AmbientScreen
      visible={visible}
      night={night}
      now={now}
      offset={offset}
      dim={dim}
      slideshow={slideshow}
      forecast={forecast}
      prayer={prayer}
      nextUp={nextUpEvent(events, now)}
      groceries={grocery ? pendingItems(groceryData.items).length : 0}
      tasks={todo ? pendingItems(todoData.items).length : 0}
    />
  );
}
