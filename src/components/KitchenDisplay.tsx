"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSyncStatus } from "@/components/WorkspaceData";
import { describeSync, SETTINGS_HOLD_MS } from "@/lib/kitchen";
import { addPhotos, clearPhotos, listPhotos, MAX_PHOTOS, roomForPhotos } from "@/lib/photo-store";

/**
 * Settings button. Normally a plain button; in kitchen mode a touch must be
 * held so passing kids and guests can't sign out or make invites. Keyboard
 * activation still works directly.
 */
export function HoldToOpenButton({
  locked,
  label,
  onOpen,
  children,
}: {
  locked: boolean;
  label: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  const [holding, setHolding] = useState(false);
  const [hint, setHint] = useState(false);
  const timer = useRef(0);
  const opened = useRef(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!hint) return;
    const hide = window.setTimeout(() => setHint(false), 2500);
    return () => window.clearTimeout(hide);
  }, [hint]);

  const cancel = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };

  return (
    <div className="hold-wrap">
      <button
        className="icon-button settings-trigger"
        aria-label={locked ? `${label} (press and hold)` : label}
        onPointerDown={(event) => {
          if (!locked || event.button !== 0) return;
          opened.current = false;
          setHolding(true);
          timer.current = window.setTimeout(() => {
            opened.current = true;
            setHolding(false);
            onOpen();
          }, SETTINGS_HOLD_MS);
        }}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(event) => locked && event.preventDefault()}
        onClick={(event) => {
          if (!locked || event.detail === 0) return onOpen();
          if (!opened.current) setHint(true);
        }}
      >
        <AnimatePresence>
          {holding && (
            <motion.span
              className="hold-progress"
              aria-hidden
              initial={{ scale: 0, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: SETTINGS_HOLD_MS / 1000, ease: "linear" }}
            />
          )}
        </AnimatePresence>
        {children}
      </button>
      <AnimatePresence>
        {hint && (
          <motion.p
            className="hold-hint"
            role="status"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Press and hold to open
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** "Live" or "Synced 4 min ago", so a stale screen is obvious from across the room. */
export function SyncBadge() {
  const { connected, syncedAt } = useSyncStatus();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const label = describeSync(connected, syncedAt, now);
  const live = label === "Live";
  return (
    <span className={`sync-badge${live ? " is-live" : ""}`} role="status">
      <span className="sync-dot" aria-hidden />
      {label}
    </span>
  );
}

/** Per-device switch in the household menu. */
export function KitchenModeSetting({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <section className="kitchen-setting">
      <div>
        <h3 id="kitchen-mode-label">Kitchen display</h3>
        <p>
          For a tablet that stays on the wall: keeps the screen on, shows a
          big today view after 2 minutes (dark at night), asks who&apos;s
          adding, updates itself, and needs a press-and-hold to open
          settings. Only affects this device.
        </p>
      </div>
      <button
        className="switch"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="kitchen-mode-label"
        onClick={() => onChange(!enabled)}
        type="button"
      >
        <motion.span
          className="switch-thumb"
          layout
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
        />
      </button>
    </section>
  );
}

/** Pick, count and remove the slideshow photos stored on this device. */
function PhotoPicker() {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listPhotos().then((photos) => {
      if (!cancelled) setCount(photos.length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = async (files: File[]) => {
    if (files.length === 0) return;
    const before = count ?? 0;
    setBusy(true);
    setMessage("");
    const { accepted, skipped } = roomForPhotos(before, files.length);
    if (accepted > 0) await addPhotos(files.slice(0, accepted));
    const after = (await listPhotos()).length;
    setCount(after);
    setBusy(false);
    if (skipped > 0) {
      setMessage(
        `Only ${MAX_PHOTOS} photos fit. ${skipped} ${skipped === 1 ? "was" : "were"} left out. Remove all to start again.`,
      );
    } else if (after < before + accepted) {
      setMessage("Some photos could not be read and were skipped.");
    }
  };

  const removeAll = async () => {
    setBusy(true);
    setMessage("");
    await clearPhotos();
    setCount(0);
    setBusy(false);
  };

  return (
    <section className="kitchen-setting photo-picker">
      <div>
        <h3>Slideshow photos</h3>
        <p>
          {count === null
            ? "Checking this device…"
            : count === 0
              ? "No photos yet. They stay on this device only."
              : `${count} ${count === 1 ? "photo" : "photos"} on this device.`}
        </p>
        {message && (
          <p className="photo-picker-note" role="status">
            {message}
          </p>
        )}
        <div className="photo-picker-actions">
          <label className={`secondary-button photo-picker-choose${busy ? " is-busy" : ""}`}>
            {busy ? "Working…" : "Choose photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={busy}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void choose(files);
              }}
            />
          </label>
          {!!count && (
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void removeAll()}>
              Remove all
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/** Idle-view options; shown only while kitchen mode is on. */
export function KitchenIdleSettings({
  idleDim,
  slideshow,
  onIdleDim,
  onSlideshow,
}: {
  idleDim: boolean;
  slideshow: boolean;
  onIdleDim: (on: boolean) => void;
  onSlideshow: (on: boolean) => void;
}) {
  const rows = [
    {
      id: "idle-dim-label",
      title: "Dim the screen when idle",
      text: "Darkens the today view after 2 minutes, more at night. Only affects this device.",
      on: idleDim,
      set: onIdleDim,
    },
    {
      id: "idle-slideshow-label",
      title: "Photo slideshow when idle",
      text: "Shows household photos instead of the today view while idle. Only affects this device.",
      on: slideshow,
      set: onSlideshow,
    },
  ];
  return (
    <>
      {rows.map((row) => (
        <section className="kitchen-setting" key={row.id}>
          <div>
            <h3 id={row.id}>{row.title}</h3>
            <p>{row.text}</p>
          </div>
          <button
            className="switch"
            role="switch"
            aria-checked={row.on}
            aria-labelledby={row.id}
            onClick={() => row.set(!row.on)}
            type="button"
          >
            <motion.span
              className="switch-thumb"
              layout
              transition={{ type: "spring", stiffness: 500, damping: 34 }}
            />
          </button>
        </section>
      ))}
      <PhotoPicker />
    </>
  );
}
