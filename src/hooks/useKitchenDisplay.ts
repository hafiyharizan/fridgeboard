"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  burnInOffset,
  isNewVersion,
  isNightTime,
  KITCHEN_IDLE_MS,
  IDLE_DIM_KEY,
  KITCHEN_MODE_KEY,
  parseFlag,
  SLIDESHOW_KEY,
  VERSION_CHECK_MS,
} from "@/lib/kitchen";

const CHANGE_EVENT = "fridgeboard:kitchen-mode";
const CURRENT_VERSION = process.env.APP_VERSION ?? "dev";

function readEnabled() {
  try {
    return localStorage.getItem(KITCHEN_MODE_KEY) === "on";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function writeEnabled(on: boolean) {
  try {
    if (on) localStorage.setItem(KITCHEN_MODE_KEY, "on");
    else localStorage.removeItem(KITCHEN_MODE_KEY);
  } catch {
    // Storage blocked: the setting lasts until the page reloads.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function readFlag(key: string, fallback: boolean) {
  try {
    return parseFlag(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // Storage blocked: the setting lasts until the page reloads.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const readIdleDim = () => readFlag(IDLE_DIM_KEY, true);
const readSlideshow = () => readFlag(SLIDESHOW_KEY, false);

/** Whether this device is in kitchen display mode (read-only view of the switch). */
export function useKitchenEnabled() {
  return useSyncExternalStore(subscribe, readEnabled, () => false);
}

/** Keeps the screen on while the page is visible; re-asks after the tablet wakes. */
function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.hidden || (lock && !lock.released)) return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // Refused (battery saver, not visible): try again on the next wake.
      }
    };
    const onVisibility = () => void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release();
    };
  }, [enabled]);
}

/**
 * Everything an always-on kitchen tablet needs, switched on per device:
 * screen kept awake, idle reset, night dimming, burn-in shift and
 * self-updating when a new deploy is live.
 */
export function useKitchenDisplay(onIdle: () => void) {
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => false);
  const idleDim = useSyncExternalStore(subscribe, readIdleDim, () => true);
  const slideshow = useSyncExternalStore(subscribe, readSlideshow, () => false);
  const [idle, setIdle] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const updateReady = useRef(false);
  const idleRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useWakeLock(enabled);

  // Minute-level clock for night mode and the burn-in shift.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  // Idle detection: any touch, click or key press counts as activity.
  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const goIdle = () => {
      idleRef.current = true;
      setIdle(true);
      setNow(new Date());
      if (updateReady.current) {
        window.location.reload();
        return;
      }
      onIdleRef.current();
    };
    const onActivity = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(goIdle, KITCHEN_IDLE_MS);
      if (idleRef.current) {
        idleRef.current = false;
        setIdle(false);
      }
    };
    const events = ["pointerdown", "keydown", "wheel"] as const;
    events.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    onActivity();
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, onActivity));
    };
  }, [enabled]);

  // New deploy check. Reloads straight away if nobody is using the screen,
  // otherwise at the next idle reset.
  useEffect(() => {
    if (!enabled) return;
    const check = async () => {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        const { version } = (await response.json()) as { version?: unknown };
        if (!isNewVersion(CURRENT_VERSION, version)) return;
        updateReady.current = true;
        if (idleRef.current) window.location.reload();
      } catch {
        // Offline: try again next round.
      }
    };
    const timer = window.setInterval(check, VERSION_CHECK_MS);
    const onVisibility = () => {
      if (!document.hidden) void check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  const setEnabled = useCallback((on: boolean) => writeEnabled(on), []);
  const setIdleDim = useCallback((on: boolean) => writeFlag(IDLE_DIM_KEY, on), []);
  const setSlideshow = useCallback((on: boolean) => writeFlag(SLIDESHOW_KEY, on), []);
  const active = enabled && idle;

  return {
    enabled,
    setEnabled,
    /** Dark overlay on the idle view (default on). */
    idleDim,
    setIdleDim,
    /** Photo slideshow on the idle view (default off). */
    slideshow,
    setSlideshow,
    /** Kitchen mode and nobody has touched the screen for a while. */
    idle: active,
    /** 22:00–06:00: the idle view switches to its dark, low-glare look. */
    night: isNightTime(now),
    offset: enabled ? burnInOffset(now) : { x: 0, y: 0 },
  };
}
