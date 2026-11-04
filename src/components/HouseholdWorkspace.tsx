"use client";

import { useCallback, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import {
  CalendarDays,
  ChevronRight,
  House,
  ListChecks,
  LogOut,
  Plus,
  Settings,
  ShoppingBasket,
} from "lucide-react";
import { CalendarTab } from "@/components/CalendarTab";
import { InstallPrompt } from "@/components/InstallPrompt";
import {
  HoldToOpenButton,
  KitchenModeSetting,
  NightDimmer,
  SyncBadge,
} from "@/components/KitchenDisplay";
import { useKitchenDisplay } from "@/hooks/useKitchenDisplay";
import { DISMISS_OVERLAYS_EVENT } from "@/lib/kitchen";
import { ListTab } from "@/components/ListTab";
import { HomeDashboard } from "@/components/HomeDashboard";
import { InvitePanel } from "@/components/InvitePanel";
import { Dialog } from "@/components/Dialog";
import { CalendarDialogs } from "@/components/CalendarDialogs";
import { useAllListData, useCalendarData } from "@/components/WorkspaceData";
import { dateKey, pendingItems, upcomingEvents } from "@/lib/dashboard";
import type { ExpandedCalendarEvent, FridgeList } from "@/lib/types";

const listLabel = (list: FridgeList) => (list.name === "Grocery" ? "Groceries" : list.name);
const ListIcon = (list: FridgeList) => (list.name === "Grocery" ? ShoppingBasket : ListChecks);

function Clock({ onDay }: { onDay: (date: string) => void }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => {
      const date = new Date();
      setNow(date);
      onDay(dateKey(date));
    };
    tick();
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [onDay]);
  return (
    <div className="app-clock">
      <time dateTime={now?.toISOString()}>
        {now
          ? now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
          : "—:—"}
      </time>
      <span>
        {now
          ? now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
          : " "}
      </span>
    </div>
  );
}

function greeting(hour: number) {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

function joinParts(parts: string[]) {
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** Title and one-line summary for the active view. */
function PageHeading({
  active,
  lists,
  today,
  firstName,
}: {
  active: string;
  lists: FridgeList[];
  today: string;
  firstName: string | null;
}) {
  const calendar = useCalendarData();
  const listData = useAllListData();
  const list = lists.find((entry) => entry.id === active);

  let title = "Calendar";
  let description = "Plans and reminders for everyone at home.";
  if (active === "home") {
    const hour = new Date().getHours();
    title = firstName ? `${greeting(hour)}, ${firstName}` : greeting(hour);
    const loading = calendar.loading || Object.values(listData).some((data) => data.loading);
    if (loading) {
      description = "Catching up on your household…";
    } else {
      const todayCount = upcomingEvents(calendar.rawEvents, today, today).filter(
        (event) => !event.is_done,
      ).length;
      const parts = [todayCount ? plural(todayCount, "event today", "events today") : "Nothing on today"];
      for (const entry of lists) {
        const count = pendingItems(listData[entry.id]?.items ?? []).length;
        if (!count) continue;
        parts.push(
          entry.name === "Grocery"
            ? plural(count, "grocery to get", "groceries to get")
            : entry.name === "To-Do"
              ? plural(count, "task open", "tasks open")
              : `${count} on ${entry.name}`,
        );
      }
      description = `${joinParts(parts)}.`;
    }
  } else if (list) {
    title = listLabel(list);
    const data = listData[list.id];
    const open = pendingItems(data?.items ?? []).length;
    const done = (data?.items.length ?? 0) - open;
    description = data?.loading
      ? "Loading…"
      : list.name === "Grocery"
        ? `${open ? `${plural(open, "item", "items")} to get` : "Nothing to get"}${done ? `, ${done} in the basket` : ""}.`
        : `${open ? `${plural(open, "task", "tasks")} open` : "No open tasks"}${done ? `, ${done} done` : ""}.`;
  }

  return (
    <div className="min-w-0">
      <h1 className="page-title">{title}</h1>
      <p className="page-desc">{description}</p>
    </div>
  );
}

export function HouseholdWorkspace({
  lists,
  name,
  onSignOut,
}: {
  lists: FridgeList[];
  name: string;
  onSignOut: () => Promise<void>;
}) {
  const [active, setActive] = useState("home");
  const [today, setToday] = useState(() => dateKey(new Date()));
  const [menu, setMenu] = useState<"household" | "quick" | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExpandedCalendarEvent | null>(null);
  const tabs = [
    { id: "home", label: "Home", Icon: House },
    { id: "calendar", label: "Calendar", Icon: CalendarDays },
    ...lists.map((list) => ({ id: list.id, label: listLabel(list), Icon: ListIcon(list) })),
  ];
  // Kitchen idle reset: close everything and show Home. Drafts in the list
  // panels survive because those panels stay mounted.
  const resetToHome = useCallback(() => {
    setActive("home");
    setMenu(null);
    setDay(null);
    setAdding(null);
    setSelected(null);
    window.dispatchEvent(new Event(DISMISS_OVERLAYS_EVENT));
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0 });
  }, []);
  const kitchen = useKitchenDisplay(resetToHome);
  const shift = { translate: `${kitchen.offset.x}px ${kitchen.offset.y}px` };
  const closeMenu = () => setMenu(null);
  const navigate = (id: string) => {
    setActive(id);
    window.scrollTo({ top: 0 });
  };
  const addToList = (id: string) => {
    closeMenu();
    setActive(id);
    // Wait for the hidden panel and modal focus restoration to settle.
    window.setTimeout(() => document.getElementById(`list-input-${id}`)?.focus(), 50);
  };
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const firstName = kitchen.enabled ? null : name.split(/\s+/)[0] || null;

  const nav = (
    <>
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={active === id ? "page" : undefined}
          onClick={() => navigate(id)}
        >
          <Icon size={18} strokeWidth={active === id ? 2.2 : 1.9} />
          <span>{label}</span>
        </button>
      ))}
    </>
  );

  return (
    <MotionConfig reducedMotion="user">
      <main className={`household-workspace${kitchen.enabled ? " is-kitchen" : ""}`}>
        <a className="skip-link" href="#workspace-content">
          Skip to content
        </a>
        <header className="app-header" style={shift}>
          <button className="brand" onClick={() => navigate("home")} aria-label="Fridgeboard home" type="button">
            <span className="brand-mark" aria-hidden>
              <House size={16} strokeWidth={2.2} />
            </span>
            <span className="brand-name">Fridgeboard</span>
          </button>
          <nav className="app-nav" aria-label="Household tools">
            {nav}
          </nav>
          <div className="app-header-end">
            <div className="clock-stack">
              <Clock onDay={setToday} />
              {kitchen.enabled && <SyncBadge />}
            </div>
            <HoldToOpenButton
              locked={kitchen.enabled}
              label="Household and account"
              onOpen={() => setMenu("household")}
            >
              <Settings size={19} />
            </HoldToOpenButton>
          </div>
        </header>

        <div id="workspace-content" className="workspace-content" tabIndex={-1} style={shift}>
          <div className="page-header">
            <PageHeading active={active} lists={lists} today={today} firstName={firstName} />
            <button className="btn btn-primary" onClick={() => setMenu("quick")} aria-label="Quick add" type="button">
              <Plus size={17} strokeWidth={2.2} />
              <span className="quick-add-label">Quick add</span>
            </button>
          </div>
          {active === "home" && (
            <HomeDashboard
              today={today}
              lists={lists}
              onNavigate={navigate}
              onDay={setDay}
              onEvent={setSelected}
            />
          )}
          <div hidden={active !== "calendar"}>
            <CalendarTab onDay={setDay} onEvent={setSelected} />
          </div>
          {lists.map((list) => (
            <div key={list.id} hidden={active !== list.id}>
              <ListTab list={list} />
            </div>
          ))}
        </div>

        <nav className="tab-bar" aria-label="Household tools">
          {nav}
        </nav>

        <InstallPrompt />
        <CalendarDialogs
          day={day}
          setDay={setDay}
          adding={adding}
          setAdding={setAdding}
          selected={selected}
          setSelected={setSelected}
        />
        {menu === "quick" && (
          <Dialog
            title="Quick add"
            description="Add to a list, or put something on the calendar."
            onClose={closeMenu}
          >
            <div className="modal-body">
              <div className="option-list">
                {lists.map((list) => {
                  const Icon = ListIcon(list);
                  return (
                    <button key={list.id} onClick={() => addToList(list.id)} type="button">
                      <span className="option-icon">
                        <Icon size={18} />
                      </span>
                      <span className="option-text">
                        <strong>
                          {list.name === "Grocery"
                            ? "Grocery item"
                            : list.name === "To-Do"
                              ? "Task"
                              : list.name}
                        </strong>
                        <span>Add to {listLabel(list)}</span>
                      </span>
                      <ChevronRight size={18} className="option-chevron" />
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    closeMenu();
                    setAdding(today);
                  }}
                  type="button"
                >
                  <span className="option-icon">
                    <CalendarDays size={18} />
                  </span>
                  <span className="option-text">
                    <strong>Event or reminder</strong>
                    <span>Add to today on the calendar</span>
                  </span>
                  <ChevronRight size={18} className="option-chevron" />
                </button>
              </div>
            </div>
          </Dialog>
        )}
        {menu === "household" && (
          <Dialog title="Household settings" onClose={closeMenu}>
            <div className="modal-body">
              <section className="modal-section">
                <div className="account-row">
                  <span className="avatar" aria-hidden>
                    {initials || "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="account-name">{name}</p>
                    <p className="account-meta">Signed in with Google</p>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={signingOut}
                    onClick={async () => {
                      setSigningOut(true);
                      try {
                        await onSignOut();
                      } catch {
                        setAccountError("Couldn't sign out. Check your connection and try again.");
                        setSigningOut(false);
                      }
                    }}
                    type="button"
                  >
                    <LogOut size={15} />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
                {accountError && (
                  <p className="alert alert-error mt-3" role="alert">
                    {accountError}
                  </p>
                )}
              </section>
              <section className="modal-section">
                <h3 className="modal-section-title">Invite someone</h3>
                <p className="section-copy">
                  They sign in with Google, then enter this code. Each code works once and expires
                  after seven days.
                </p>
                <div className="mt-3">
                  <InvitePanel />
                </div>
              </section>
              <section className="modal-section">
                <KitchenModeSetting enabled={kitchen.enabled} onChange={kitchen.setEnabled} />
              </section>
            </div>
          </Dialog>
        )}
        <NightDimmer visible={kitchen.dimmed} />
      </main>
    </MotionConfig>
  );
}
