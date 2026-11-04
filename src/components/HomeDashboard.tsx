"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  Clock3,
  ListChecks,
  ListPlus,
  ShoppingBasket,
  Sun,
  Sunrise,
} from "lucide-react";
import { SyncBadge } from "@/components/KitchenDisplay";
import { AmbientScreen, OutsideCard } from "@/components/Ambient";
import { useNow, type PrayerDay } from "@/hooks/useAmbient";
import type { Forecast } from "@/lib/weather";
import { useCalendarData, useListData } from "@/components/WorkspaceData";
import {
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

function HeroClock({
  nextUp,
  today,
  onEvent,
}: {
  nextUp: ExpandedCalendarEvent | null;
  today: string;
  onEvent: (event: ExpandedCalendarEvent) => void;
}) {
  const now = useNow(15_000);
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(now);
  const time = parts
    .filter((part) => part.type !== "dayPeriod")
    .map((part) => part.value)
    .join("")
    .trim();
  const period = parts.find((part) => part.type === "dayPeriod")?.value;
  const when = nextUp
    ? `${nextUp.occurrence_date === today ? "" : `${dayLabel(nextUp.occurrence_date, { weekday: "short" })} `}${
        nextUp.event_time ? formatEventTime(nextUp.event_time) : "all day"
      }`
    : "";
  return (
    <section className="card hero-card" aria-label="Time and next up">
      <div className="hero-top">
        <p className="eyebrow">
          <Sun size={16} aria-hidden /> Today at home
        </p>
        <SyncBadge />
      </div>
      <p className="hero-time">
        <time dateTime={now.toISOString()} suppressHydrationWarning>
          {time}
        </time>
        {period && <small>{period}</small>}
      </p>
      <p className="hero-date" suppressHydrationWarning>
        {now.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
      {nextUp ? (
        <button className="hero-next" onClick={() => onEvent(nextUp)}>
          <Clock3 size={18} aria-hidden />
          <span>
            Next up: <strong>{nextUp.title}</strong> · {when}
          </span>
        </button>
      ) : (
        <p className="hero-next">
          <Clock3 size={18} aria-hidden />
          <span>Nothing else planned this week.</span>
        </p>
      )}
    </section>
  );
}

function QuickTile({
  className,
  icon,
  label,
  onClick,
}: {
  className: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`quick-tile ${className}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </motion.button>
  );
}

/* ---------- Middle column ---------- */

type ScheduleView = "today" | "tomorrow" | "week";

function AgendaRow({
  event,
  onEvent,
}: {
  event: ExpandedCalendarEvent;
  onEvent: (event: ExpandedCalendarEvent) => void;
}) {
  const { time, period } = timeParts(event.event_time);
  const Icon = TYPE_ICON[event.event_type];
  const meta =
    event.note?.trim() ||
    (event.recurrence !== "none" ? `Repeats ${event.recurrence}` : "");
  return (
    <li>
      <motion.button
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.99 }}
        className={`agenda-row event-${event.color}${event.is_done ? " is-done" : ""}`}
        onClick={() => onEvent(event)}
      >
        <span className="agenda-time">
          {time}
          <small>{period}</small>
        </span>
        <span className="agenda-bar" aria-hidden />
        <span className="agenda-main">
          <span className="agenda-title">
            {event.event_type !== "event" && (
              <span className="pill">{TYPE_LABEL[event.event_type]}</span>
            )}
            <strong>{event.title}</strong>
          </span>
          {meta && <span className="agenda-meta">{meta}</span>}
        </span>
        <Icon className="agenda-icon" size={20} aria-hidden />
      </motion.button>
    </li>
  );
}

function FamilySchedule({
  today,
  events,
  loading,
  onDay,
  onEvent,
  onAddEvent,
  calendarStatus,
}: {
  today: string;
  events: ExpandedCalendarEvent[];
  loading: boolean;
  onDay: (date: string) => void;
  onEvent: (event: ExpandedCalendarEvent) => void;
  onAddEvent: (date: string) => void;
  calendarStatus: ReactNode;
}) {
  const [view, setView] = useState<ScheduleView>("today");
  const tomorrow = nextDateKey(today);
  const days = weekDates(today);
  const shownDay = view === "tomorrow" ? tomorrow : today;
  const dayEvents = events.filter((event) => event.occurrence_date === shownDay);
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
        <ul className="agenda">
          {dayEvents.map((event) => (
            <AgendaRow
              key={`${event.id}-${event.occurrence_date}`}
              event={event}
              onEvent={onEvent}
            />
          ))}
        </ul>
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
}: {
  list: FridgeList;
  kind: "grocery" | "todo";
  onOpen: () => void;
}) {
  const data = useListData(list.id);
  const items = pendingItems(data.items);
  const grocery = kind === "grocery";
  const Icon = grocery ? ShoppingBasket : ListChecks;
  const title = grocery ? "Groceries" : "To-Do";
  const visible = items.slice(0, 8);
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
          className="icon-button card-open"
          onClick={onOpen}
          aria-label={`Open ${grocery ? "groceries" : "to-do"}`}
        >
          <ArrowUpRight size={20} />
        </button>
      </div>
      <DataStatus {...data} />
      {!data.loading && !data.error && !items.length && (
        <p className="empty-copy">
          {grocery
            ? "Everything on the list is picked up."
            : "A little breathing room. Nothing left to do."}
        </p>
      )}
      <ul className="list-rows">
        {visible.map((item) => (
          <motion.li
            layout
            key={item.id}
            className={`list-row${grocery ? " is-tinted" : ""}`}
          >
            <button
              className="check-control"
              disabled={data.isWorking}
              aria-label={`Check ${item.text}`}
              onClick={() => void data.toggleItem(item)}
            >
              <span className="check-ring">
                <Check size={15} strokeWidth={3} />
              </span>
            </button>
            <span className="item-label">{item.text}</span>
          </motion.li>
        ))}
      </ul>
      {items.length > visible.length && (
        <div className="list-footer">
          <button className="text-button" onClick={onOpen}>
            +{items.length - visible.length} more <ArrowUpRight size={16} />
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
  prayer,
  onSetup,
}: {
  today: string;
  lists: FridgeList[];
  onNavigate: (id: string) => void;
  onDay: (date: string) => void;
  onEvent: (event: ExpandedCalendarEvent) => void;
  onAddEvent: (date: string) => void;
  onAddToList: (id: string) => void;
  settings: HouseholdSettings | null;
  forecast: Forecast | null;
  prayer: PrayerDay | null;
  onSetup: () => void;
}) {
  const calendar = useCalendarData();
  const days = weekDates(today);
  const events = upcomingEvents(calendar.rawEvents, today, days[6]);
  const grocery = lists.find((list) => list.name === "Grocery");
  const todo = lists.find((list) => list.name === "To-Do");
  const now = useNow(30_000);
  const nextUp = nextUpEvent(events, now);

  return (
    <div className="home-grid">
      <div className="home-side">
        <HeroClock nextUp={nextUp} today={today} onEvent={onEvent} />
        <OutsideCard
          settings={settings}
          forecast={forecast}
          prayer={prayer}
          now={now}
          onSetup={onSetup}
        />
        <section className="card quick-card" aria-label="Quick add">
          <p className="eyebrow">Quick add</p>
          <div className="quick-tiles">
            <QuickTile
              className="is-sage"
              icon={<CalendarPlus size={22} />}
              label="Event"
              onClick={() => onAddEvent(today)}
            />
            {todo && (
              <QuickTile
                className="is-oat"
                icon={<ListPlus size={22} />}
                label="Task"
                onClick={() => onAddToList(todo.id)}
              />
            )}
            {grocery && (
              <QuickTile
                className="is-amber"
                icon={<ShoppingBasket size={22} />}
                label="Grocery"
                onClick={() => onAddToList(grocery.id)}
              />
            )}
          </div>
        </section>
      </div>

      <FamilySchedule
        today={today}
        events={events}
        loading={calendar.loading}
        onDay={onDay}
        onEvent={onEvent}
        onAddEvent={onAddEvent}
        calendarStatus={<DataStatus {...calendar} loading={false} />}
      />

      <div className="home-lists">
        {todo ? (
          <ListCard list={todo} kind="todo" onOpen={() => onNavigate(todo.id)} />
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
  lists,
  today,
  forecast,
  prayer,
}: {
  visible: boolean;
  night: boolean;
  offset: { x: number; y: number };
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
      forecast={forecast}
      prayer={prayer}
      nextUp={nextUpEvent(events, now)}
      groceries={grocery ? pendingItems(groceryData.items).length : 0}
      tasks={todo ? pendingItems(todoData.items).length : 0}
    />
  );
}
