"use client";

import { createElement, useEffect, useState } from "react";
import {
  Apple,
  ArrowUpRight,
  Baby,
  Banana,
  Beef,
  BellRing,
  CalendarDays,
  CalendarPlus,
  Carrot,
  Check,
  CircleCheck,
  Clock3,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSun,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Droplets,
  Drumstick,
  Egg,
  Fish,
  Lightbulb,
  ListChecks,
  ListTodo,
  Milk,
  Moon,
  Plus,
  RefreshCw,
  Repeat,
  Salad,
  ShoppingBasket,
  Snowflake,
  SprayCan,
  Sun,
  Sunrise,
  UserPlus,
  Wheat,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { EventTags, eventPeople } from "@/components/People";
import { useCalendarData, useListData, usePeople, useSyncStatus } from "@/components/WorkspaceData";
import { dateKey, pendingItems, upcomingEvents, weekDates } from "@/lib/dashboard";
import { addedLabel, dayPart, doneLabel, groceryIcon, nextEventLine, season, type GroceryIcon } from "@/lib/hub";
import { uvLevel, weatherTip, type WeatherKind } from "@/lib/weather";
import type { WeatherState } from "@/hooks/useWeather";
import type { ExpandedCalendarEvent, FridgeList, Item } from "@/lib/types";

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
        Reconnecting. What you see may be a little out of date.
      </p>
    );
  return null;
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);
  return now;
}

const addDays = (key: string, days: number) => {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
};
const shortDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

/* ---------------- Clock ---------------- */

function ClockCard({
  today,
  locationLabel,
  onEvent,
}: {
  today: string;
  locationLabel: string;
  onEvent: (event: ExpandedCalendarEvent) => void;
}) {
  const now = useNow(15_000);
  const calendar = useCalendarData();
  const { byId } = usePeople();
  const { connected } = useSyncStatus();
  const tomorrow = addDays(today, 1);
  const events = upcomingEvents(calendar.rawEvents, today, tomorrow);
  const line = now
    ? nextEventLine(events, today, tomorrow, now.getHours() * 60 + now.getMinutes(), (event) =>
        eventPeople(event, byId).map((person) => person.name),
      )
    : null;
  const time = now?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) ?? "—:— —";
  const [clock, suffix] = time.split(" ");
  const part = now ? dayPart(now) : "";
  return (
    <section className="hub-card clock-card" aria-label="Time and date">
      <div className="hub-card-top">
        <p className="hub-eyebrow">
          <Sunrise size={15} aria-hidden />
          {locationLabel.split(",")[0]}
          {now && (
            <>
              <span className="eyebrow-dot" aria-hidden />
              {season(now)} {part}
            </>
          )}
        </p>
        <span className={`live-badge${connected ? "" : " is-stale"}`} role="status">
          {connected ? "Live" : "Syncing"}
        </span>
      </div>
      <p className="hub-clock">
        <time dateTime={now?.toISOString()}>{clock}</time>
        <span>{suffix}</span>
      </p>
      <p className="hub-date">
        {now
          ? now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : " "}
      </p>
      <div className="hub-divider" />
      {line?.event ? (
        <button className="next-line" onClick={() => onEvent(line.event as ExpandedCalendarEvent)} type="button">
          <Clock3 size={16} aria-hidden />
          <span>{line.text}</span>
        </button>
      ) : (
        <p className="next-line">
          <Clock3 size={16} aria-hidden />
          <span>{calendar.loading ? "Checking the calendar…" : (line?.text ?? " ")}</span>
        </p>
      )}
    </section>
  );
}

/* ---------------- Weather ---------------- */

const WEATHER_ICONS: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  storm: CloudLightning,
  snow: Snowflake,
};

function weatherIcon(kind: WeatherKind, isDay: boolean): LucideIcon {
  if (!isDay && kind === "clear") return Moon;
  if (!isDay && kind === "partly") return CloudMoon;
  return WEATHER_ICONS[kind];
}

/** Icon for a weather condition, with night variants for clear skies. */
export function WeatherGlyph({ kind, isDay, size, strokeWidth }: { kind: WeatherKind; isDay: boolean; size: number; strokeWidth?: number }) {
  return createElement(weatherIcon(kind, isDay), { size, strokeWidth, "aria-hidden": true });
}

function WeatherCard({ state }: { state: WeatherState }) {
  const { weather, loading, failed, location, refresh } = state;
  if (!weather) {
    return (
      <section className="hub-card weather-card" aria-label="Weather">
        {loading ? (
          <div className="weather-loading" role="status" aria-label="Loading weather">
            <span className="skeleton h-12 w-28" />
            <span className="skeleton h-4 w-44" />
            <div className="weather-stats">
              <span className="skeleton h-14" />
              <span className="skeleton h-14" />
              <span className="skeleton h-14" />
            </div>
          </div>
        ) : (
          <div className="weather-empty">
            <Cloud size={22} aria-hidden />
            <p>Weather isn&apos;t available right now.</p>
            {failed && (
              <button className="text-button" onClick={() => void refresh()} type="button">
                <RefreshCw size={14} /> Try again
              </button>
            )}
          </div>
        )}
      </section>
    );
  }
  const uv = weather.uv ?? weather.uvMax;
  return (
    <section className="hub-card weather-card" aria-label="Weather">
      <div className="weather-head">
        <div className="min-w-0">
          <p className="weather-temp">
            <span className="tabular">{Math.round(weather.temperature)}°</span>
            <span className="weather-label">{weather.label}</span>
          </p>
          <p className="weather-sub">
            {location.label.split(",")[0]}
            {weather.high !== null && <> · High {Math.round(weather.high)}°</>}
            {weather.low !== null && <> · Low {Math.round(weather.low)}°</>}
          </p>
        </div>
        <span className={`weather-icon weather-${weather.kind}${weather.isDay ? "" : " is-night"}`} aria-hidden>
          <WeatherGlyph kind={weather.kind} isDay={weather.isDay} size={30} strokeWidth={1.8} />
        </span>
      </div>
      <dl className="weather-stats">
        <div>
          <dt>
            <Sun size={16} aria-hidden /> UV
          </dt>
          <dd>{uv !== null ? `${Math.round(uv)} ${uvLevel(uv).replace("Moderate", "Mod")}` : "—"}</dd>
        </div>
        <div>
          <dt>
            <Droplets size={16} aria-hidden /> Humidity
          </dt>
          <dd>{weather.humidity !== null ? `${Math.round(weather.humidity)}%` : "—"}</dd>
        </div>
        <div>
          <dt>
            <Wind size={16} aria-hidden /> Wind
          </dt>
          <dd>{weather.windKmh !== null ? `${Math.round(weather.windKmh)} km/h` : "—"}</dd>
        </div>
      </dl>
      <p className="weather-tip">
        <Lightbulb size={17} aria-hidden />
        <span>{weatherTip(weather)}</span>
      </p>
      <a className="weather-credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">
        Weather by Open-Meteo
      </a>
    </section>
  );
}

/* ---------------- Quick add ---------------- */

function QuickAddCard({
  onEvent,
  todo,
  grocery,
  onItem,
}: {
  onEvent: () => void;
  todo?: FridgeList;
  grocery?: FridgeList;
  onItem: (listId: string) => void;
}) {
  return (
    <section className="hub-card quick-card" aria-label="Quick add">
      <p className="hub-eyebrow">Quick add</p>
      <div className="quick-grid">
        <button className="quick-button is-event" onClick={onEvent} type="button">
          <CalendarPlus size={24} aria-hidden />
          <span>Event</span>
        </button>
        {todo && (
          <button className="quick-button is-task" onClick={() => onItem(todo.id)} type="button">
            <ListTodo size={24} aria-hidden />
            <span>Task</span>
          </button>
        )}
        {grocery && (
          <button className="quick-button is-grocery" onClick={() => onItem(grocery.id)} type="button">
            <ShoppingBasket size={24} aria-hidden />
            <span>Grocery</span>
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------------- Schedule ---------------- */

type Range = "today" | "tomorrow" | "week";

const timeParts = (event: ExpandedCalendarEvent) => {
  if (!event.event_time) return ["All", "day"];
  const [h, m] = event.event_time.split(":").map(Number);
  return [`${h % 12 || 12}:${String(m).padStart(2, "0")}`, h >= 12 ? "PM" : "AM"];
};

const eventSubline = (event: ExpandedCalendarEvent) => {
  const parts: string[] = [];
  if (event.note) parts.push(event.note);
  if (event.recurrence !== "none") parts.push(event.recurrence === "weekly" ? "Every week" : "Repeats");
  if (event.event_type === "reminder" && !event.note) parts.push("Reminder");
  if (event.source_type && event.source_type !== "manual" && event.source_label) parts.push(event.source_label);
  return parts.join(" · ");
};

function ScheduleRow({
  event,
  past,
  onEvent,
}: {
  event: ExpandedCalendarEvent;
  past: boolean;
  onEvent: (event: ExpandedCalendarEvent) => void;
}) {
  const [time, suffix] = timeParts(event);
  const sub = eventSubline(event);
  const TypeIcon = event.is_done ? CircleCheck : event.event_type === "reminder" ? BellRing : event.recurrence !== "none" ? Repeat : CalendarDays;
  return (
    <li>
      <button
        className={`schedule-row event-${event.color}${past ? " is-past" : ""}${event.is_done ? " is-done" : ""}`}
        onClick={() => onEvent(event)}
        type="button"
      >
        <span className="schedule-time tabular">
          <strong>{time}</strong>
          <small>{suffix}</small>
        </span>
        <span className="schedule-bar" aria-hidden />
        <span className="schedule-main">
          <span className="schedule-title-row">
            <EventTags event={event} />
            <span className="schedule-title">{event.title}</span>
          </span>
          {sub && <span className="schedule-sub">{sub}</span>}
        </span>
        <TypeIcon size={20} className="schedule-icon" aria-hidden />
      </button>
    </li>
  );
}

function ScheduleCard({
  today,
  onEvent,
  onDay,
  onAdd,
  onOpenCalendar,
  onManagePeople,
}: {
  today: string;
  onEvent: (event: ExpandedCalendarEvent) => void;
  onDay: (date: string) => void;
  onAdd: (date: string) => void;
  onOpenCalendar: () => void;
  onManagePeople: () => void;
}) {
  const [range, setRange] = useState<Range>("today");
  const [person, setPerson] = useState<string | null>(null);
  const calendar = useCalendarData();
  const { people, available } = usePeople();
  const { connected } = useSyncStatus();
  const now = useNow();
  const tomorrow = addDays(today, 1);
  const days = weekDates(today);
  const weekEnd = days[6];
  const all = upcomingEvents(calendar.rawEvents, today, weekEnd);
  const activePerson = person && people.some((entry) => entry.id === person) ? person : null;
  // Family-wide events (no one tagged) stay visible under every person's filter.
  const visible = activePerson
    ? all.filter((event) => !event.person_ids?.length || event.person_ids.includes(activePerson))
    : all;
  const rangeDays = range === "today" ? [today] : range === "tomorrow" ? [tomorrow] : days;
  const byDay = rangeDays.map((day) => ({
    day,
    events: visible.filter((event) => event.occurrence_date === day),
  }));
  const shown = byDay.reduce((sum, group) => sum + group.events.length, 0);
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const isPast = (event: ExpandedCalendarEvent) => {
    if (event.occurrence_date !== today || !event.event_time) return false;
    const [h, m] = event.event_time.split(":").map(Number);
    return h * 60 + m + 30 < nowMinutes;
  };
  const tomorrowEvents = all.filter((event) => event.occurrence_date === tomorrow);
  const laterCount = all.filter((event) => event.occurrence_date > tomorrow).length;
  const focusDay = range === "tomorrow" ? tomorrow : today;

  return (
    <section className="hub-card schedule-card" aria-label="Family schedule">
      <div className="schedule-head">
        <span className="hub-tile" aria-hidden>
          <CalendarDays size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="hub-title">Family schedule</h2>
          <p className="hub-subtitle">{connected ? "Synced across family devices" : "Reconnecting…"}</p>
        </div>
        <div className="range-tabs" role="tablist" aria-label="Show">
          {(
            [
              ["today", "Today", shortDay(today)],
              ["tomorrow", "Tomorrow", shortDay(tomorrow)],
              ["week", "Week", "7 days"],
            ] as const
          ).map(([id, label, hint]) => (
            <button key={id} role="tab" aria-selected={range === id} onClick={() => setRange(id)} type="button">
              <span>{label}</span>
              <small>{hint}</small>
            </button>
          ))}
        </div>
      </div>

      {available && (
        <div className="crew-row">
          <span className="crew-label">Crew</span>
          <div className="crew-chips" role="group" aria-label="Show events for">
            <button
              className="crew-chip person-everyone"
              aria-pressed={!activePerson}
              onClick={() => setPerson(null)}
              type="button"
            >
              Everyone
            </button>
            {people.map((entry) => (
              <button
                key={entry.id}
                className={`crew-chip person-${entry.color}`}
                aria-pressed={activePerson === entry.id}
                onClick={() => setPerson(activePerson === entry.id ? null : entry.id)}
                type="button"
              >
                <span className="crew-dot" aria-hidden />
                {entry.name}
              </button>
            ))}
            <button className="crew-chip crew-add" onClick={onManagePeople} type="button">
              <UserPlus size={15} aria-hidden />
              {people.length ? "Edit" : "Add people"}
            </button>
          </div>
        </div>
      )}

      <div className="schedule-body">
        {calendar.error || (!calendar.connected && !calendar.loading) ? <DataStatus {...calendar} loading={false} /> : null}
        {calendar.loading ? (
          <ul className="schedule-list" aria-label="Loading">
            {[0, 1, 2].map((key) => (
              <li key={key}>
                <span className="skeleton schedule-skeleton" />
              </li>
            ))}
          </ul>
        ) : shown === 0 ? (
          <div className="hub-empty">
            <span className="hub-tile" aria-hidden>
              <CalendarPlus size={22} />
            </span>
            <p>
              {range === "week"
                ? "Nothing planned this week."
                : `Nothing planned ${range === "today" ? "today" : "tomorrow"}${activePerson ? " for them" : ""}.`}
            </p>
            <button className="secondary-button" onClick={() => onAdd(focusDay)} type="button">
              <Plus size={16} /> Add event
            </button>
          </div>
        ) : (
          byDay.map(({ day, events }) =>
            !events.length ? null : (
              <div key={day} className="schedule-group">
                {range === "week" && (
                  <button className="schedule-day" onClick={() => onDay(day)} type="button">
                    {day === today
                      ? "Today"
                      : day === tomorrow
                        ? "Tomorrow"
                        : new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                  </button>
                )}
                <ul className="schedule-list">
                  {events.map((event) => (
                    <ScheduleRow key={`${event.id}-${event.occurrence_date}`} event={event} past={isPast(event)} onEvent={onEvent} />
                  ))}
                </ul>
              </div>
            ),
          )
        )}
      </div>

      <div className="schedule-foot">
        <span className="hub-tile is-small" aria-hidden>
          {range === "today" ? <Sunrise size={18} /> : <CalendarDays size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="hub-eyebrow">
            {range === "today" ? `Tomorrow · ${shortDay(tomorrow)}` : range === "tomorrow" ? "Later this week" : "Whole month"}
          </p>
          <p className="schedule-foot-text">
            {range === "today"
              ? tomorrowEvents.length
                ? tomorrowEvents
                    .slice(0, 2)
                    .map((event) => `${event.event_time ? `${timeParts(event).join(" ")} ` : ""}${event.title}`)
                    .join(" · ")
                : "Nothing planned yet."
              : range === "tomorrow"
                ? laterCount
                  ? `${laterCount} more ${laterCount === 1 ? "event" : "events"} after tomorrow`
                  : "Nothing else this week."
                : "See every event in the calendar."}
          </p>
        </div>
        <button
          className="pill-button"
          onClick={() => (range === "today" ? setRange("tomorrow") : range === "tomorrow" ? setRange("week") : onOpenCalendar())}
          type="button"
        >
          {range === "week" ? "Open calendar" : range === "today" ? "View day" : "View week"}
          <ArrowUpRight size={15} />
        </button>
      </div>
    </section>
  );
}

/* ---------------- Lists ---------------- */

const GROCERY_ICONS: Record<GroceryIcon, LucideIcon> = {
  milk: Milk,
  egg: Egg,
  bread: Croissant,
  fruit: Apple,
  banana: Banana,
  veg: Carrot,
  salad: Salad,
  fish: Fish,
  meat: Beef,
  chicken: Drumstick,
  cheese: Milk,
  coffee: Coffee,
  drink: CupSoda,
  snack: Cookie,
  grain: Wheat,
  baby: Baby,
  cleaning: SprayCan,
  basket: ShoppingBasket,
};

/** Checked today, newest first, so the board shows what just got done. */
function doneToday(items: Item[], today: string) {
  return items
    .filter((item) => item.is_checked && item.checked_at && dateKey(new Date(item.checked_at)) === today)
    .sort((a, b) => (b.checked_at ?? "").localeCompare(a.checked_at ?? ""));
}

function ListCard({
  list,
  today,
  onOpen,
  onAdd,
}: {
  list: FridgeList;
  today: string;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const data = useListData(list.id);
  const now = useNow(60_000) ?? new Date();
  const grocery = list.name === "Grocery";
  const open = pendingItems(data.items);
  const done = doneToday(data.items, today).slice(0, 3);
  const title = grocery ? "Groceries" : list.name;
  const HeadIcon = grocery ? ShoppingBasket : ListChecks;
  return (
    <section className={`hub-card list-card${grocery ? " is-grocery" : ""}`} aria-label={title}>
      <div className="list-card-head">
        <span className="hub-tile" aria-hidden>
          <HeadIcon size={21} />
        </span>
        <h2 className="hub-title">{title}</h2>
        {!data.loading && (
          <span className="count-pill" aria-label={`${open.length} open`}>
            {open.length} {grocery ? "to get" : "open"}
          </span>
        )}
        <button className="icon-button list-card-add" onClick={onAdd} aria-label={`Add to ${title}`} type="button">
          <Plus size={19} />
        </button>
      </div>
      <div className="list-card-body">
        {data.error || (!data.connected && !data.loading) ? <DataStatus {...data} loading={false} /> : null}
        {data.loading ? (
          <ul className="hub-items">
            {[0, 1, 2].map((key) => (
              <li key={key}>
                <span className="skeleton hub-item-skeleton" />
              </li>
            ))}
          </ul>
        ) : !open.length && !done.length ? (
          <div className="hub-empty is-compact">
            <CircleCheck size={22} aria-hidden />
            <p>{grocery ? "Nothing left to buy." : "All tasks are done."}</p>
          </div>
        ) : (
          <ul className="hub-items">
            {open.map((item) => {
              const Icon = GROCERY_ICONS[groceryIcon(item.text)];
              return (
                <li key={item.id}>
                  <div className="hub-item">
                    {grocery ? (
                      <span className="hub-item-icon" aria-hidden>
                        <Icon size={19} />
                      </span>
                    ) : null}
                    <span className="hub-item-text">
                      <span className="hub-item-title">{item.text}</span>
                      {!grocery && <span className="hub-item-sub">{addedLabel(item.created_at, now)}</span>}
                    </span>
                    <button
                      className="round-check"
                      disabled={data.isWorking}
                      aria-label={`Check ${item.text}`}
                      onClick={() => void data.toggleItem(item)}
                      type="button"
                    >
                      <Check size={15} strokeWidth={3} />
                    </button>
                  </div>
                </li>
              );
            })}
            {done.map((item) => (
              <li key={item.id}>
                <div className="hub-item is-done">
                  {grocery ? (
                    <span className="hub-item-icon" aria-hidden>
                      <Check size={18} />
                    </span>
                  ) : null}
                  <span className="hub-item-text">
                    <span className="hub-item-title">{item.text}</span>
                    <span className="hub-item-sub">{doneLabel(item.checked_at, now)}</span>
                  </span>
                  <button
                    className="round-check is-checked"
                    disabled={data.isWorking}
                    aria-label={`Uncheck ${item.text}`}
                    onClick={() => void data.toggleItem(item)}
                    type="button"
                  >
                    <Check size={15} strokeWidth={3} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="list-card-foot" onClick={onOpen} type="button">
        Open {title} <ArrowUpRight size={15} />
      </button>
    </section>
  );
}

/* ---------------- Home ---------------- */

export function HomeDashboard({
  today,
  lists,
  weather,
  onNavigate,
  onDay,
  onEvent,
  onAddEvent,
  onQuickItem,
  onManagePeople,
}: {
  today: string;
  lists: FridgeList[];
  weather: WeatherState;
  onNavigate: (id: string) => void;
  onDay: (date: string) => void;
  onEvent: (event: ExpandedCalendarEvent) => void;
  onAddEvent: (date: string) => void;
  onQuickItem: (listId: string) => void;
  onManagePeople: () => void;
}) {
  const grocery = lists.find((list) => list.name === "Grocery");
  const todo = lists.find((list) => list.name === "To-Do");
  const extra = lists.filter((list) => list !== grocery && list !== todo);
  return (
    <div className="hub-grid">
      <div className="hub-col hub-left">
        <ClockCard today={today} locationLabel={weather.location.label} onEvent={onEvent} />
        <WeatherCard state={weather} />
        <QuickAddCard onEvent={() => onAddEvent(today)} todo={todo} grocery={grocery} onItem={onQuickItem} />
      </div>
      <div className="hub-col hub-middle">
        <ScheduleCard
          today={today}
          onEvent={onEvent}
          onDay={onDay}
          onAdd={onAddEvent}
          onOpenCalendar={() => onNavigate("calendar")}
          onManagePeople={onManagePeople}
        />
      </div>
      <div className="hub-col hub-right">
        {[todo, grocery, ...extra].filter(Boolean).map((list) => (
          <ListCard
            key={(list as FridgeList).id}
            list={list as FridgeList}
            today={today}
            onOpen={() => onNavigate((list as FridgeList).id)}
            onAdd={() => onQuickItem((list as FridgeList).id)}
          />
        ))}
      </div>
    </div>
  );
}
