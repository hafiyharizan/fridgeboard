"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Check,
} from "lucide-react";
import { AddItemInput } from "@/components/AddItemInput";
import { CalendarTab } from "@/components/CalendarTab";
import { InstallPrompt } from "@/components/InstallPrompt";
import {
  HoldToOpenButton,
  KitchenModeSetting,
  NightDimmer,
  SyncBadge,
} from "@/components/KitchenDisplay";
import { useKitchenDisplay } from "@/hooks/useKitchenDisplay";
import { useWeather } from "@/hooks/useWeather";
import { DISMISS_OVERLAYS_EVENT } from "@/lib/kitchen";
import { ListTab } from "@/components/ListTab";
import { HomeDashboard } from "@/components/HomeDashboard";
import { InvitePanel } from "@/components/InvitePanel";
import { PeopleSettings } from "@/components/People";
import { Dialog } from "@/components/Dialog";
import { CalendarDialogs } from "@/components/CalendarDialogs";
import { SuggestionPanel } from "@/components/SuggestionPanel";
import { useListData } from "@/components/WorkspaceData";
import { dateKey } from "@/lib/dashboard";
import type { ExpandedCalendarEvent, FridgeList } from "@/lib/types";

const listLabel = (list: FridgeList) => (list.name === "Grocery" ? "Groceries" : list.name);

function Clock({ onDay, compact }: { onDay: (date: string) => void; compact: boolean }) {
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
  // On Home the big clock card shows the time, so the header stays quiet.
  if (compact) return null;
  return (
    <div className="dashboard-clock">
      <time dateTime={now?.toISOString()}>
        {now ? now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—:—"}
      </time>
      <span>
        {now ? now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : " "}
      </span>
    </div>
  );
}

/** Add several items to one list without leaving Home. */
function QuickItemDialog({ list, onClose }: { list: FridgeList; onClose: () => void }) {
  const data = useListData(list.id);
  const [added, setAdded] = useState<string[]>([]);
  const grocery = list.name === "Grocery";
  const existing = useMemo(() => data.items.filter((item) => !item.is_checked).map((item) => item.text), [data.items]);
  const add = async (text: string) => {
    const ok = await data.addItem(text);
    if (ok) setAdded((current) => [text, ...current].slice(0, 6));
    return ok;
  };
  return (
    <Dialog title={grocery ? "Add groceries" : `Add to ${listLabel(list)}`} onClose={onClose}>
      <p className="dialog-copy">
        {grocery ? "Add as many as you like. Everyone sees them straight away." : "Add a task for the household."}
      </p>
      <div className="quick-item-form">
        <AddItemInput
          inputId={`quick-input-${list.id}`}
          autoFocusField
          busy={data.isWorking}
          buttonLabel={grocery ? "Add" : "Add task"}
          existingItems={existing}
          listName={list.name}
          onAdd={add}
          placeholder={grocery ? "Milk, eggs, sourdough…" : "Book car service…"}
        />
        <SuggestionPanel existingItems={existing} listName={list.name} onAddItem={add} />
      </div>
      {data.error && (
        <p className="data-status error" role="alert">
          {data.error}
        </p>
      )}
      {added.length > 0 && (
        <ul className="quick-added" aria-live="polite">
          {added.map((text, index) => (
            <li key={`${text}-${index}`}>
              <Check size={15} /> {text}
            </li>
          ))}
        </ul>
      )}
      <div className="dialog-actions">
        <button className="primary-button" onClick={onClose} type="button">
          Done
        </button>
      </div>
    </Dialog>
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
  const [quickList, setQuickList] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExpandedCalendarEvent | null>(null);
  const weather = useWeather();
  const tabs = [
    { id: "home", label: "Home", Icon: House },
    { id: "calendar", label: "Calendar", Icon: CalendarDays },
    ...lists.map((list) => ({
      id: list.id,
      label: listLabel(list),
      Icon: list.name === "Grocery" ? ShoppingBasket : ListChecks,
    })),
  ];
  // Kitchen idle reset: close everything and show Home. Drafts in the list
  // panels survive because those panels stay mounted.
  const resetToHome = useCallback(() => {
    setActive("home");
    setMenu(null);
    setQuickList(null);
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
  const addToList = (id: string) => {
    closeMenu();
    setQuickList(id);
  };
  const quick = lists.find((list) => list.id === quickList);
  const isHome = active === "home";

  return (
    <MotionConfig reducedMotion="user">
      <main className={`household-workspace${kitchen.enabled ? " is-kitchen" : ""}${isHome ? " is-home" : ""}`}>
        <a className="skip-link" href="#workspace-content">
          Skip to content
        </a>
        <header className="dashboard-header" style={shift}>
          <button className="wordmark" onClick={() => setActive("home")} aria-label="Fridgeboard home" type="button">
            <span className="brand-mark">
              <House size={22} />
            </span>
            <span className="wordmark-text">
              <span className="wordmark-eyebrow">
                Home hub<span className="eyebrow-dot" aria-hidden />
                <span className="wordmark-place">{weather.location.label}</span>
              </span>
              <span className="wordmark-name">Fridgeboard</span>
            </span>
          </button>
          <nav className="workspace-nav" aria-label="Household tools">
            {tabs.map(({ id, label, Icon }) => (
              <button key={id} aria-current={active === id ? "page" : undefined} onClick={() => setActive(id)} type="button">
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="header-end">
            <div className="clock-stack">
              <Clock onDay={setToday} compact={isHome} />
              {kitchen.enabled && !isHome && <SyncBadge />}
            </div>
            {!isHome && (
              <button className="primary-button header-quick-add" onClick={() => setMenu("quick")} aria-label="Quick add" type="button">
                <Plus size={19} /> <span>Quick add</span>
              </button>
            )}
            <HoldToOpenButton locked={kitchen.enabled} label="Household and account" onOpen={() => setMenu("household")}>
              <Settings size={21} />
            </HoldToOpenButton>
          </div>
        </header>
        <div id="workspace-content" className="workspace-content" tabIndex={-1} style={shift}>
          <h1 className="sr-only">{isHome ? "Household dashboard" : tabs.find((tab) => tab.id === active)?.label}</h1>
          {isHome && (
            <HomeDashboard
              today={today}
              lists={lists}
              weather={weather}
              onNavigate={setActive}
              onDay={setDay}
              onEvent={setSelected}
              onAddEvent={setAdding}
              onQuickItem={setQuickList}
              onManagePeople={() => setMenu("household")}
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
        <InstallPrompt />
        <CalendarDialogs
          day={day}
          setDay={setDay}
          adding={adding}
          setAdding={setAdding}
          selected={selected}
          setSelected={setSelected}
        />
        {quick && <QuickItemDialog list={quick} onClose={() => setQuickList(null)} />}
        {menu === "quick" && (
          <Dialog title="Add something" onClose={closeMenu}>
            <p className="dialog-copy">A small note for your household.</p>
            <div className="quick-options">
              {lists.map((list) => (
                <button key={list.id} onClick={() => addToList(list.id)} type="button">
                  {list.name === "Grocery" ? <ShoppingBasket /> : <ListChecks />}
                  <span>
                    {list.name === "Grocery" ? "Grocery item" : list.name === "To-Do" ? "Task" : list.name}
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
              <button
                onClick={() => {
                  closeMenu();
                  setAdding(today);
                }}
                type="button"
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
            <PeopleSettings />
            <section className="household-sharing">
              <h3>Invite your household</h3>
              <p>Each invite code works once and expires after seven days.</p>
              <InvitePanel />
            </section>
            {accountError && (
              <p className="data-status error" role="alert">
                {accountError}
              </p>
            )}
            <KitchenModeSetting enabled={kitchen.enabled} onChange={kitchen.setEnabled} />
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
              type="button"
            >
              <LogOut size={18} />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </Dialog>
        )}
        <NightDimmer visible={kitchen.dimmed} />
      </main>
    </MotionConfig>
  );
}
