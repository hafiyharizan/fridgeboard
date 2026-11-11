"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import {
  BriefcaseBusiness,
  CalendarDays,
  House,
  ListChecks,
  ShoppingBasket,
  Plus,
  Settings,
  LogOut,
  ArrowRight,
  Mic,
  Sparkles,
} from "lucide-react";
import { AssistantPanel, useAssistantEnabled } from "@/components/AssistantPanel";
import { VoiceAdd } from "@/components/VoiceAdd";
import { useSpeechSupported } from "@/hooks/useSpeech";
import { CalendarTab } from "@/components/CalendarTab";
import { InstallPrompt } from "@/components/InstallPrompt";
import {
  HoldToOpenButton,
  KitchenIdleSettings,
  KitchenModeSetting,
  KitchenNightSettings,
  SyncBadge,
} from "@/components/KitchenDisplay";
import { useKitchenDisplay } from "@/hooks/useKitchenDisplay";
import { DISMISS_OVERLAYS_EVENT } from "@/lib/kitchen";
import { ListTab } from "@/components/ListTab";
import { WorkTab } from "@/components/WorkTab";
import { AmbientLayer, HomeDashboard } from "@/components/HomeDashboard";
import { AthanBanner, PlaceSettings } from "@/components/Ambient";
import { OfflineSnapshotWriter, useHousehold } from "@/components/WorkspaceData";
import { useAthan, useNow, usePrayerDay, useWeather } from "@/hooks/useAmbient";
import { InvitePanel } from "@/components/InvitePanel";
import { HouseholdPeople } from "@/components/HouseholdPeople";
import { Dialog } from "@/components/Dialog";
import { CalendarDialogs } from "@/components/CalendarDialogs";
import { dateKey, greeting } from "@/lib/dashboard";
import { shortName } from "@/lib/new-item-push";
import { isDarkTime } from "@/lib/weather";
import type { ExpandedCalendarEvent, FridgeList } from "@/lib/types";

const THEME_COLORS = { light: "#f7f5f0", dark: "#121513" } as const;

/**
 * Light by day, dark from sunset to sunrise at home, for the whole signed-in
 * app (dialogs included, so it lives on <html>). Applied before paint so a
 * tablet woken at night doesn't flash white. Removed again on sign-out.
 */
function useAutoTheme(dark: boolean) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const theme = dark ? "dark" : "light";
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
    return () => {
      delete root.dataset.theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS.light);
    };
  }, [dark]);
}

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

/** "Good evening, Alex" — refreshed each minute so it rolls over on its own. */
function Greeting({ name }: { name: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span className="brand-title" suppressHydrationWarning>
      {greeting(now)}, {shortName(name)}
    </span>
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
  const [menu, setMenu] = useState<"household" | "quick" | "voice" | "assistant" | null>(null);
  const canSpeak = useSpeechSupported();
  const canAsk = useAssistantEnabled();
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [day, setDay] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExpandedCalendarEvent | null>(null);
  const tabs = [
    { id: "home", label: "Home", Icon: House },
    { id: "calendar", label: "Calendar", Icon: CalendarDays },
    { id: "work", label: "Work", Icon: BriefcaseBusiness },
    ...lists.map((list) => ({
      id: list.id,
      label: list.name === "Grocery" ? "Groceries" : list.name,
      Icon: list.name === "Grocery" ? ShoppingBasket : ListChecks,
    })),
  ];
  // Kitchen idle reset: close everything and show Home. Drafts in the list
  // panels survive because those panels stay mounted.
  const { settings, saveSettings, setAdderId } = useHousehold();
  const resetToHome = useCallback(() => {
    setActive("home");
    setAdderId(null);
    setMenu(null);
    setDay(null);
    setAdding(null);
    setSelected(null);
    window.dispatchEvent(new Event(DISMISS_OVERLAYS_EVENT));
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo({ top: 0 });
  }, [setAdderId]);
  const kitchen = useKitchenDisplay(resetToHome);
  const now = useNow(20_000);
  const weather = useWeather(settings);
  const prayer = usePrayerDay(settings, now);
  useAutoTheme(isDarkTime(now, weather.forecast?.today ?? null, weather.forecast?.current.isDay));
  const { athan, dismiss: dismissAthan } = useAthan(
    prayer,
    kitchen.enabled && Boolean(settings?.athan_enabled),
    now,
  );
  const shift = { translate: `${kitchen.offset.x}px ${kitchen.offset.y}px` };
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
      <main
        className={`household-workspace${kitchen.enabled ? " is-kitchen" : ""}${
          active === "home" ? " is-home" : ""
        }${kitchen.idle ? " is-idle" : ""}`}
      >
        <a className="skip-link" href="#workspace-content">
          Skip to content
        </a>
        <header className="dashboard-header" style={shift}>
          <button
            className="wordmark"
            onClick={() => setActive("home")}
            aria-label="Fridgeboard home"
          >
            <span className="brand-mark">
              <House size={22} />
            </span>
            <span className="brand-text">
              <span className="eyebrow">Fridgeboard</span>
              <Greeting name={name} />
            </span>
          </button>
          <nav className="workspace-nav" aria-label="Household tools">
            {tabs.map(({ id, label, Icon }) => (
              <button
                key={id}
                aria-current={active === id ? "page" : undefined}
                onClick={() => setActive(id)}
              >
                <Icon size={19} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="header-status">
            <Clock onDay={setToday} />
            <SyncBadge />
          </div>
          {active !== "home" && (
            <button
              className="icon-button header-add"
              onClick={() => setMenu("quick")}
              aria-label="Quick Add"
              title="Quick Add"
            >
              <Plus size={22} />
            </button>
          )}
          {canSpeak && (
            <button
              className="icon-button header-voice"
              onClick={() => setMenu("voice")}
              aria-label="Say it: add by voice"
              title="Add by voice"
            >
              <Mic size={21} />
            </button>
          )}
          {canAsk && (
            <button
              className="icon-button header-voice"
              onClick={() => setMenu("assistant")}
              aria-label="Ask the household assistant"
              title="Ask the household assistant"
            >
              <Sparkles size={21} />
            </button>
          )}
          <HoldToOpenButton
            locked={kitchen.enabled}
            label="Household and account"
            onOpen={() => setMenu("household")}
          >
            <Settings size={21} />
          </HoldToOpenButton>
        </header>
        <div
          id="workspace-content"
          className="workspace-content"
          tabIndex={-1}
          style={shift}
        >
          <h1 className="sr-only">Household dashboard</h1>
          {active === "home" && (
            <HomeDashboard
              today={today}
              lists={lists}
              onNavigate={setActive}
              onDay={setDay}
              onEvent={setSelected}
              onAddEvent={setAdding}
              onAddToList={addToList}
              settings={settings}
              forecast={weather.forecast}
              weatherFailed={weather.failed}
              prayer={prayer}
              onSetup={() => setMenu("household")}
              onOpenWork={() => setActive("work")}
            />
          )}
          {active === "work" && <WorkTab today={today} />}
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
        {menu === "quick" && (
          <Dialog title="Add something" onClose={closeMenu}>
            <p className="dialog-copy">A small note for your household.</p>
            <div className="quick-options">
              {canSpeak && (
                <button onClick={() => setMenu("voice")}>
                  <Mic />
                  <span>Say it</span>
                  <ArrowRight size={18} />
                </button>
              )}
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
        {menu === "voice" && <VoiceAdd lists={lists} onClose={closeMenu} />}
        {menu === "assistant" && <AssistantPanel onClose={closeMenu} />}
        {menu === "household" && (
          <Dialog title="Your household" onClose={closeMenu}>
            <p className="dialog-copy">
              Signed in as <strong>{name}</strong>
            </p>
            <HouseholdPeople />
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
            <PlaceSettings settings={settings} onSave={saveSettings} />
            <KitchenModeSetting
              enabled={kitchen.enabled}
              onChange={kitchen.setEnabled}
            />
            {kitchen.enabled && (
              <KitchenIdleSettings
                idleDim={kitchen.idleDim}
                slideshow={kitchen.slideshow}
                onIdleDim={kitchen.setIdleDim}
                onSlideshow={kitchen.setSlideshow}
              />
            )}
            {kitchen.enabled && (
              <KitchenNightSettings
                nightHours={kitchen.nightHours}
                onNightHours={kitchen.setNightHours}
                sleepEnabled={kitchen.sleepEnabled}
                onSleepEnabled={kitchen.setSleepEnabled}
                sleepHours={kitchen.sleepHours}
                onSleepHours={kitchen.setSleepHours}
              />
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
        <AmbientLayer
          visible={kitchen.idle}
          night={kitchen.night}
          offset={kitchen.offset}
          dim={kitchen.idleDim}
          asleep={kitchen.asleep}
          slideshow={kitchen.slideshow}
          lists={lists}
          today={today}
          forecast={weather.forecast}
          prayer={prayer}
        />
        <AthanBanner slot={athan} onDismiss={dismissAthan} />
        <OfflineSnapshotWriter lists={lists} today={today} />
      </main>
    </MotionConfig>
  );
}
