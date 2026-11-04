"use client";

import {
  AlertCircle,
  Check,
  ChevronRight,
  ListChecks,
  RefreshCw,
  ShoppingBasket,
  WifiOff,
} from "lucide-react";
import { useCalendarData, useListData } from "@/components/WorkspaceData";
import { pendingItems, upcomingEvents, weekDates } from "@/lib/dashboard";
import { formatEventTime } from "@/lib/calendar";
import type { ExpandedCalendarEvent, FridgeList } from "@/lib/types";

/** Loading skeleton, error with retry, or a quiet reconnecting notice. */
export function DataStatus({
  loading,
  error,
  connected,
  retry,
  rows = 3,
}: {
  loading: boolean;
  error: string;
  connected: boolean;
  retry?: () => void;
  rows?: number;
}) {
  if (error)
    return (
      <div className="data-status alert alert-error" role="alert">
        <AlertCircle size={16} />
        <span className="flex-1">{error}</span>
        {retry && (
          <button className="btn btn-sm btn-secondary" onClick={retry} type="button">
            <RefreshCw size={14} /> Try again
          </button>
        )}
      </div>
    );
  if (loading)
    return (
      <div className="skeleton-rows" role="status" aria-label="Loading">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="skeleton-row">
            <span className="skeleton h-4 w-4" />
            <span className="skeleton h-3.5" style={{ width: `${[62, 44, 54, 38, 50][index % 5]}%` }} />
          </div>
        ))}
      </div>
    );
  if (!connected)
    return (
      <div className="data-status alert alert-warning" role="status">
        <WifiOff size={16} />
        <span>Reconnecting. What you see may be a little out of date.</span>
      </div>
    );
  return null;
}

const shortDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });

function ListSummary({ list, onOpen }: { list: FridgeList; onOpen: () => void }) {
  const data = useListData(list.id);
  const items = pendingItems(data.items);
  const grocery = list.name === "Grocery";
  const Icon = grocery ? ShoppingBasket : ListChecks;
  const title = grocery ? "Groceries" : list.name;
  const shown = items.slice(0, 4);
  return (
    <section className="panel summary-panel" aria-label={`${title} summary`}>
      <div className="panel-header">
        <h2 className="panel-title">
          <Icon size={17} />
          {title}
          {!data.loading && <span className="badge" aria-label={`${items.length} open`}>{items.length}</span>}
        </h2>
        <button className="btn btn-ghost btn-sm" onClick={onOpen} type="button">
          View all <ChevronRight size={15} />
        </button>
      </div>
      <div className="panel-body">
        <DataStatus {...data} />
        {!data.loading && !data.error && !items.length && (
          <p className="summary-empty">
            <Check size={15} />
            {grocery ? "Nothing left to buy." : "All tasks are done."}
          </p>
        )}
        <ul className="summary-items">
          {shown.map((item) => (
            <li key={item.id}>
              <button
                className="check"
                disabled={data.isWorking}
                aria-label={`Check ${item.text}`}
                onClick={() => void data.toggleItem(item)}
                type="button"
              >
                <span className="check-box">
                  <Check size={13} strokeWidth={3} />
                </span>
              </button>
              <span className="item-label">{item.text}</span>
            </li>
          ))}
        </ul>
        {items.length > shown.length && (
          <button className="summary-more" onClick={onOpen} type="button">
            {items.length - shown.length} more
          </button>
        )}
      </div>
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
  const extraLists = lists.filter((list) => list !== grocery && list !== todo);
  const start = new Date(`${today}T12:00:00`);
  const end = new Date(`${days[6]}T12:00:00`);
  const monthName = (date: Date) => date.toLocaleDateString(undefined, { month: "long" });
  const range =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${monthName(end)}`
      : `${start.getDate()} ${monthName(start)} – ${end.getDate()} ${monthName(end)}`;

  return (
    <div className="home-grid">
      <section className="panel week-panel" aria-label="This week">
        <div className="panel-header">
          <div className="min-w-0">
            <h2 className="panel-title">This week</h2>
            <p className="panel-desc">{range}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate("calendar")} type="button">
            Open calendar <ChevronRight size={15} />
          </button>
        </div>
        {!calendar.loading && (calendar.error || !calendar.connected) && (
          <div className="panel-body pb-0">
            <DataStatus {...calendar} />
          </div>
        )}
        <ol className="week-days">
          {days.map((day, index) => {
            const date = new Date(`${day}T12:00:00`);
            const daily = events.filter((event) => event.occurrence_date === day);
            const isToday = index === 0;
            const longDate = date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
            return (
              <li key={day} className={`week-day${isToday ? " is-today" : ""}`}>
                <button
                  className="day-label"
                  onClick={() => onDay(day)}
                  aria-label={`Open ${isToday ? "today, " : ""}${longDate}`}
                  type="button"
                >
                  <span className="day-name">{isToday ? "Today" : shortDay(day)}</span>
                  <span className="day-number tabular">{date.getDate()}</span>
                </button>
                <div className="day-events">
                  {calendar.loading ? (
                    <span className="skeleton h-3.5 w-40" />
                  ) : (
                    <>
                      {daily.slice(0, 3).map((event) => (
                        <button
                          className={`week-event tone-${event.color}`}
                          key={`${event.id}-${day}`}
                          onClick={() => onEvent(event)}
                          type="button"
                        >
                          <span className="week-event-time tabular">
                            {event.event_time ? formatEventTime(event.event_time) : "All day"}
                          </span>
                          <span className="week-event-title">{event.title}</span>
                        </button>
                      ))}
                      {daily.length > 3 && (
                        <button className="more-events" onClick={() => onDay(day)} type="button">
                          +{daily.length - 3} more
                        </button>
                      )}
                      {!daily.length && !calendar.error && (
                        <button className="quiet-day" onClick={() => onDay(day)} type="button">
                          {isToday ? "Nothing planned today" : "No plans"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="home-side">
        {grocery && <ListSummary list={grocery} onOpen={() => onNavigate(grocery.id)} />}
        {todo && <ListSummary list={todo} onOpen={() => onNavigate(todo.id)} />}
        {extraLists.map((list) => (
          <ListSummary key={list.id} list={list} onOpen={() => onNavigate(list.id)} />
        ))}
      </div>
    </div>
  );
}
