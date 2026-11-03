"use client";

import {
  ArrowUpRight,
  Check,
  CalendarDays,
  ShoppingBasket,
  ListChecks,
} from "lucide-react";
import { useCalendarData, useListData } from "@/components/WorkspaceData";
import { pendingItems, upcomingEvents, weekDates } from "@/lib/dashboard";
import { formatEventTime } from "@/lib/calendar";
import type { ExpandedCalendarEvent, FridgeList } from "@/lib/types";

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

function ListSummary({
  list,
  onOpen,
}: {
  list: FridgeList;
  onOpen: () => void;
}) {
  const data = useListData(list.id);
  const items = pendingItems(data.items);
  const grocery = list.name === "Grocery";
  const Icon = grocery ? ShoppingBasket : ListChecks;
  return (
    <section
      className="dashboard-panel list-summary"
      aria-label={grocery ? "Groceries summary" : "To-Do summary"}
    >
      <div className="panel-heading">
        <div className="panel-title">
          <Icon size={20} />
          <h2>{grocery ? "Groceries" : "To-Do"}</h2>
          {!data.loading && (
            <span
              className="count-badge"
              aria-label={`${items.length} pending`}
            >
              {items.length}
            </span>
          )}
        </div>
        <button className="text-button" onClick={onOpen}>
          View all <ArrowUpRight size={16} />
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
      <ul className="summary-items">
        {items.slice(0, 5).map((item, index) => (
          <li key={item.id} className={index >= 3 ? "extra-summary-row" : ""}>
            <button
              className="check-control"
              disabled={data.isWorking}
              aria-label={`Check ${item.text}`}
              onClick={() => void data.toggleItem(item)}
            >
              <span>
                <Check size={14} />
              </span>
            </button>
            <span className="item-label">{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HomeDashboard({
  today,
  lists,
  onNavigate,
  onDay,
  onEvent,
}: {
  today: string;
  lists: FridgeList[];
  onNavigate: (id: string) => void;
  onDay: (date: string) => void;
  onEvent: (event: ExpandedCalendarEvent) => void;
}) {
  const calendar = useCalendarData();
  const days = weekDates(today);
  const events = upcomingEvents(calendar.rawEvents, today, days[6]);
  const grocery = lists.find((list) => list.name === "Grocery");
  const todo = lists.find((list) => list.name === "To-Do");
  return (
    <div className="home-dashboard">
      <section className="dashboard-panel week-panel" aria-label="This week">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">A little more in sync</p>
            <h2 className="week-title">Your week at home.</h2>
          </div>
          <button
            className="text-button"
            onClick={() => onNavigate("calendar")}
          >
            Calendar <ArrowUpRight size={16} />
          </button>
        </div>
        <DataStatus {...calendar} />
        <div className="week-days">
          {days.map((day, index) => {
            const date = new Date(`${day}T12:00:00`);
            const daily = events.filter(
              (event) => event.occurrence_date === day,
            );
            return (
              <div
                key={day}
                className={`week-day ${index === 0 ? "is-today" : ""}`}
              >
                <button
                  className="day-label"
                  onClick={() => onDay(day)}
                  aria-label={`Open ${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
                >
                  <span>
                    {index === 0
                      ? "Today"
                      : date.toLocaleDateString(undefined, {
                          weekday: "short",
                        })}
                  </span>
                  <strong>{date.getDate()}</strong>
                </button>
                <div className="day-events">
                  {daily.slice(0, 2).map((event) => (
                    <button
                      className={`week-event event-${event.color}`}
                      key={`${event.id}-${day}`}
                      onClick={() => onEvent(event)}
                    >
                      <span>
                        {event.event_time
                          ? formatEventTime(event.event_time)
                          : "All day"}
                      </span>
                      <strong>{event.title}</strong>
                    </button>
                  ))}
                  {!daily.length && !calendar.loading && !calendar.error && (
                    <span className="quiet-day">No plans yet</span>
                  )}
                  {daily.length > 2 && (
                    <button className="more-events" onClick={() => onDay(day)}>
                      +{daily.length - 2} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="week-footer">
          <span>
            {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </span>
          <span>One home. Everyone together.</span>
        </div>
      </section>
      <div className="dashboard-summaries">
        <section className="dashboard-panel upcoming-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <CalendarDays size={20} />
              <h2>Today & coming up</h2>
            </div>
          </div>
          <DataStatus {...calendar} />
          {!calendar.loading && !calendar.error && !events.length && (
            <p className="empty-copy">
              A clear week ahead. Tap a day to make a plan.
            </p>
          )}
          <ul className="upcoming-list">
            {events.slice(0, 3).map((event) => (
              <li key={`${event.id}-${event.occurrence_date}`}>
                <button onClick={() => onEvent(event)}>
                  <span className="upcoming-time">
                    {event.occurrence_date === today
                      ? "Today"
                      : new Date(
                          `${event.occurrence_date}T12:00:00`,
                        ).toLocaleDateString(undefined, { weekday: "short" })}
                    <small>
                      {event.event_time
                        ? formatEventTime(event.event_time)
                        : "All day"}
                    </small>
                  </span>
                  <span className="upcoming-title">{event.title}</span>
                  <ArrowUpRight size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
        {grocery ? (
          <ListSummary list={grocery} onOpen={() => onNavigate(grocery.id)} />
        ) : (
          <section className="dashboard-panel">
            <h2>Groceries</h2>
            <p className="empty-copy">No grocery list in this household.</p>
          </section>
        )}
        {todo ? (
          <ListSummary list={todo} onOpen={() => onNavigate(todo.id)} />
        ) : (
          <section className="dashboard-panel">
            <h2>To-Do</h2>
            <p className="empty-copy">No task list in this household.</p>
          </section>
        )}
      </div>
    </div>
  );
}
