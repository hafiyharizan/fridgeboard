"use client";

import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import {
  CalendarDays,
  House,
  ListChecks,
  ShoppingBasket,
  Plus,
  Settings,
  LogOut,
  ArrowRight,
} from "lucide-react";
import { CalendarTab } from "@/components/CalendarTab";
import { ListTab } from "@/components/ListTab";
import { HomeDashboard } from "@/components/HomeDashboard";
import { InvitePanel } from "@/components/InvitePanel";
import { Dialog } from "@/components/Dialog";
import { CalendarDialogs } from "@/components/CalendarDialogs";
import { dateKey } from "@/lib/dashboard";
import type { ExpandedCalendarEvent, FridgeList } from "@/lib/types";

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
    <div className="dashboard-clock">
      <time dateTime={now?.toISOString()}>
        {now
          ? now.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            })
          : "—:—"}
      </time>
      <span>
        {now
          ? now.toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
          : "Your household, together"}
      </span>
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
    ...lists.map((list) => ({
      id: list.id,
      label: list.name === "Grocery" ? "Groceries" : list.name,
      Icon: list.name === "Grocery" ? ShoppingBasket : ListChecks,
    })),
  ];
  const closeMenu = () => {
    setMenu(null);
  };
  const addToList = (id: string) => {
    closeMenu();
    setActive(id);
    // Wait for the hidden panel and modal focus restoration to settle.
    window.setTimeout(
      () => document.getElementById(`list-input-${id}`)?.focus(),
      50,
    );
  };
  return (
    <MotionConfig reducedMotion="user">
      <main className="household-workspace">
        <a className="skip-link" href="#workspace-content">
          Skip to content
        </a>
        <header className="dashboard-header">
          <button
            className="wordmark"
            onClick={() => setActive("home")}
            aria-label="Fridgeboard home"
          >
            <span className="brand-mark">
              <House size={21} />
            </span>
            Fridgeboard<span className="brand-dot">.</span>
          </button>
          <nav className="workspace-nav" aria-label="Household tools">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                aria-current={active === id ? "page" : undefined}
                onClick={() => setActive(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <Clock onDay={setToday} />
          <button
            className="icon-button settings-trigger"
            aria-label="Household and account"
            onClick={() => setMenu("household")}
          >
            <Settings size={21} />
          </button>
        </header>
        <div id="workspace-content" className="workspace-content" tabIndex={-1}>
          <h1 className="sr-only">Household dashboard</h1>
          <div className="workspace-toolbar">
            <p className="eyebrow">
              {active === "home"
                ? "The everyday, together"
                : tabs.find((tab) => tab.id === active)?.label}
            </p>
            <button className="primary-button" onClick={() => setMenu("quick")}>
              <Plus size={19} /> Quick Add
            </button>
          </div>
          {active === "home" && (
            <HomeDashboard
              today={today}
              lists={lists}
              onNavigate={setActive}
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
        <CalendarDialogs
          day={day}
          setDay={setDay}
          adding={adding}
          setAdding={setAdding}
          selected={selected}
          setSelected={setSelected}
        />
        {menu === "quick" && (
          <Dialog title="Add something" onClose={closeMenu}>
            <p className="dialog-copy">A small note for your household.</p>
            <div className="quick-options">
              {lists.map((list) => (
                <button key={list.id} onClick={() => addToList(list.id)}>
                  {list.name === "Grocery" ? (
                    <ShoppingBasket />
                  ) : (
                    <ListChecks />
                  )}
                  <span>
                    {list.name === "Grocery"
                      ? "Grocery item"
                      : list.name === "To-Do"
                        ? "Task"
                        : list.name}
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
              <button
                onClick={() => {
                  closeMenu();
                  setAdding(today);
                }}
              >
                <CalendarDays />
                <span>Event or reminder</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </Dialog>
        )}
        {menu === "household" && (
          <Dialog title="Your household" onClose={closeMenu}>
            <p className="dialog-copy">
              Signed in as <strong>{name}</strong>
            </p>
            <section className="household-sharing"><h3>Invite your household</h3><p>Each invite code works once and expires after seven days.</p><InvitePanel /></section>
          {accountError && (
              <p className="data-status error" role="alert">
                {accountError}
              </p>
            )}
            <button
              className="secondary-button sign-out-button"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try {
                  await onSignOut();
                } catch {
                  setAccountError("Could not sign out. Please try again.");
                  setSigningOut(false);
                }
              }}
            >
              <LogOut size={18} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </Dialog>
        )}
      </main>
    </MotionConfig>
  );
}
