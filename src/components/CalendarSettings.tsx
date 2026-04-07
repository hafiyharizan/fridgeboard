"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarPlus2,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Settings2,
  Unlink2,
  X,
} from "lucide-react";
import {
  getCalendarImportLabel,
  getCalendarImportOptions,
  isCalendarImportSupported,
} from "@/lib/calendar-sources";
import type { CalendarImportSource } from "@/lib/types";

type CalendarSettingsProps = {
  busy: boolean;
  year: number;
  onImport: (source: CalendarImportSource) => Promise<{
    imported: number;
    skipped: number;
    total: number;
  } | null>;
  onCreateSyncLink: () => Promise<{
    feedUrl: string;
    appleUrl: string;
    googleUrl: string;
  } | null>;
};

type GoogleStatus = {
  connected: boolean;
  calendarId: string | null;
  watchExpiration: string | null;
  caldavUrl: string | null;
};

export function CalendarSettings({ busy, year, onImport, onCreateSyncLink }: CalendarSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [toolMessage, setToolMessage] = useState("");
  const [syncLinks, setSyncLinks] = useState<{
    feedUrl: string;
    appleUrl: string;
    googleUrl: string;
  } | null>(null);

  // Google Calendar state
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [copied, setCopied] = useState<"feed" | "caldav" | null>(null);

  const importOptions = useMemo(() => getCalendarImportOptions(), []);

  // ── Load Google status when panel opens ──────────────────────────────────
  const loadGoogleStatus = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/google-calendar/status");
      if (res.ok) {
        setGoogleStatus(await res.json());
      }
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadGoogleStatus();

    // Pick up ?gc= param set by the OAuth callback redirect
    const params = new URLSearchParams(window.location.search);
    const gc = params.get("gc");
    if (gc === "connected") {
      setToolMessage("Google Calendar connected successfully.");
      window.history.replaceState({}, "", window.location.pathname);
      void loadGoogleStatus();
    } else if (gc === "denied") {
      setToolMessage("Google Calendar access was denied.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (gc === "error") {
      setToolMessage("Something went wrong connecting Google Calendar. Try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [isOpen, loadGoogleStatus]);

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = async (source: CalendarImportSource) => {
    const result = await onImport(source);
    if (!result) return;
    setToolMessage(
      result.imported > 0
        ? `${getCalendarImportLabel(source)} added for ${year}. Imported ${result.imported} of ${result.total} dates.`
        : `${getCalendarImportLabel(source)} were already on this calendar for ${year}.`,
    );
  };

  // ── iCal feed link ────────────────────────────────────────────────────────
  const handleCreateSyncLink = async () => {
    const nextLinks = await onCreateSyncLink();
    if (!nextLinks) return;
    setSyncLinks(nextLinks);
    setToolMessage("Private calendar feed ready.");
  };

  const copyToClipboard = async (text: string, type: "feed" | "caldav") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setToolMessage("Copy failed — select and copy the URL manually.");
    }
  };

  // ── Google Calendar OAuth ─────────────────────────────────────────────────
  const handleConnectGoogle = async () => {
    // We need the PIN — it's in sessionStorage (set by PinEntry)
    const pin = sessionStorage.getItem("pin");
    if (!pin) {
      setToolMessage("Sign-in required to connect Google Calendar.");
      return;
    }
    const res = await fetch(`/api/google-calendar/authorize?pin=${encodeURIComponent(pin)}`);
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setToolMessage(json.error ?? "Could not start Google Calendar authorization.");
      return;
    }
    const { authUrl } = (await res.json()) as { authUrl: string };
    window.location.href = authUrl;
  };

  const handleDisconnectGoogle = async () => {
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      if (res.ok) {
        setGoogleStatus((s) => (s ? { ...s, connected: false, watchExpiration: null } : s));
        setToolMessage("Google Calendar disconnected.");
      } else {
        setToolMessage("Could not disconnect. Try again.");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/google-calendar/sync", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        pushed?: number;
        pulled?: number;
        deleted?: number;
        errors?: string[];
      };
      if (res.ok) {
        setToolMessage(
          `Sync complete — pushed ${json.pushed ?? 0}, pulled ${json.pulled ?? 0}, deleted ${json.deleted ?? 0}.`,
        );
        if ((json.errors?.length ?? 0) > 0) {
          console.error("[CalendarSync] Errors:", json.errors);
        }
      } else {
        setToolMessage("Sync failed. Check the console for details.");
      }
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <>
      <button
        className="rounded-full border border-border p-2 text-muted transition hover:border-amber/40 hover:text-foreground"
        onClick={() => setIsOpen(true)}
        title="Calendar settings"
        type="button"
      >
        <Settings2 className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 px-0 backdrop-blur-sm sm:items-center sm:px-4"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-lg overflow-hidden rounded-t-[1.5rem] border border-white/60 bg-white/95 shadow-[0_24px_64px_rgba(60,40,20,0.15)] backdrop-blur-xl sm:rounded-[1.5rem]"
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(event) => event.stopPropagation()}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-muted" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Calendar settings</p>
                    <p className="mt-0.5 text-xs text-muted">Imports and external calendar sync for {year}</p>
                  </div>
                </div>
                <button
                  className="rounded-full p-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[75vh] space-y-5 overflow-y-auto px-5 py-4">
                {/* ── Import curated dates ─────────────────────────────── */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarPlus2 className="h-4 w-4 text-muted" />
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted">
                      Import curated dates
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {importOptions.map((option) => {
                      const supported = isCalendarImportSupported(option.source, year);
                      return (
                        <button
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                            supported
                              ? "border-border bg-white text-foreground hover:border-amber/40 hover:bg-amber/10"
                              : "cursor-not-allowed border-border/60 bg-white/60 text-muted/70"
                          }`}
                          disabled={!supported || busy}
                          key={option.source}
                          onClick={() => handleImport(option.source)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-sm leading-6 text-muted">
                    Add Islamic dates, Western Australia holidays, or Malaysia public holidays without cluttering the
                    month view.
                  </p>
                </section>

                {/* ── Google Calendar (two-way OAuth2 sync) ────────────── */}
                <section className="space-y-3 rounded-[1.1rem] border border-border/60 bg-foreground/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted">
                      Google Calendar — two-way sync
                    </p>
                    {googleLoading && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted" />}
                  </div>

                  {googleStatus?.connected ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/8 px-3 py-2.5">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#4a6e3f]">Connected</p>
                          {googleStatus.watchExpiration && (
                            <p className="text-[0.65rem] text-muted">
                              Push notifications active until{" "}
                              {new Date(googleStatus.watchExpiration).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-foreground transition hover:border-amber/40 hover:bg-amber/5 disabled:opacity-60"
                          disabled={syncLoading || busy}
                          onClick={handleManualSync}
                          type="button"
                        >
                          {syncLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Sync now
                        </button>
                        <button
                          className="flex items-center gap-1.5 rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 text-xs font-bold text-danger transition hover:bg-danger/10 disabled:opacity-60"
                          disabled={googleLoading || busy}
                          onClick={handleDisconnectGoogle}
                          type="button"
                        >
                          <Unlink2 className="h-3.5 w-3.5" />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-sm font-bold text-foreground transition hover:border-amber/40 hover:bg-foreground/[0.03] disabled:opacity-60"
                        disabled={busy || googleLoading}
                        onClick={handleConnectGoogle}
                        type="button"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Connect Google Calendar
                      </button>
                      <p className="text-xs leading-5 text-muted">
                        Creates a live two-way sync. Events added, edited, or deleted in either place
                        will appear in both. Requires a Google account.
                      </p>
                    </div>
                  )}
                </section>

                {/* ── Apple Calendar (CalDAV) ───────────────────────────── */}
                <section className="space-y-3 rounded-[1.1rem] border border-border/60 bg-foreground/[0.03] p-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-muted" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted">
                      Apple Calendar — two-way sync via CalDAV
                    </p>
                  </div>

                  {syncLinks?.feedUrl ? (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border bg-white p-3 text-xs">
                        <p className="mb-2 font-bold text-foreground">CalDAV account setup</p>
                        <ol className="space-y-1 text-muted">
                          <li>1. Open <span className="font-bold">Calendar → Settings → Accounts</span> (macOS)</li>
                          <li>2. Click <span className="font-bold">+</span> → <span className="font-bold">Other CalDAV account</span></li>
                          <li>3. Set account type to <span className="font-bold">Manual</span></li>
                          <li>4. Paste the CalDAV URL below as the server address</li>
                          <li>5. Username: any (e.g. your name), Password: leave blank</li>
                        </ol>
                      </div>

                      {googleStatus?.caldavUrl ? (
                        <div className="space-y-1.5">
                          <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted">CalDAV URL</p>
                          <div className="flex items-center gap-2">
                            <input
                              className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground outline-none"
                              readOnly
                              value={googleStatus.caldavUrl}
                            />
                            <button
                              className="shrink-0 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-foreground transition hover:border-amber/40 hover:bg-amber/10"
                              onClick={() => copyToClipboard(googleStatus.caldavUrl!, "caldav")}
                              type="button"
                            >
                              {copied === "caldav" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-1.5">
                        <p className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted">iCal subscription URL</p>
                        <div className="flex items-center gap-2">
                          <input
                            className="min-w-0 flex-1 rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground outline-none"
                            readOnly
                            value={syncLinks.feedUrl}
                          />
                          <button
                            className="shrink-0 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-foreground transition hover:border-amber/40 hover:bg-amber/10"
                            onClick={() => copyToClipboard(syncLinks.feedUrl, "feed")}
                            type="button"
                          >
                            {copied === "feed" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                        <p className="text-[0.65rem] text-muted">
                          For read-only subscription in older apps or on iOS, use this URL instead.
                        </p>
                      </div>

                      <a
                        className="flex items-center gap-1.5 text-xs font-bold text-muted transition hover:text-foreground"
                        href={syncLinks.appleUrl}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open subscription in Apple Calendar
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        className="w-full rounded-xl bg-foreground px-3 py-2.5 text-sm font-bold text-white transition hover:bg-[#2f241b] disabled:opacity-60"
                        disabled={busy}
                        onClick={handleCreateSyncLink}
                        type="button"
                      >
                        Generate CalDAV &amp; feed URLs
                      </button>
                      <p className="text-xs leading-5 text-muted">
                        Get a private CalDAV URL for full two-way sync, plus a read-only iCal feed
                        for subscription-only setups.
                      </p>
                    </div>
                  )}
                </section>

                {/* ── Read-only iCal feed (Google Calendar subscribe) ──── */}
                {syncLinks?.feedUrl ? (
                  <section className="space-y-3 rounded-[1.1rem] border border-border/60 bg-foreground/[0.03] p-4">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted" />
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted">
                        Google Calendar — subscribe (read-only)
                      </p>
                    </div>
                    <p className="text-xs leading-5 text-muted">
                      Alternative to the two-way sync above. Paste the iCal URL into{" "}
                      <span className="font-bold">Google Calendar → Other calendars → From URL</span>.
                    </p>
                    <a
                      className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2.5 text-xs font-bold text-foreground transition hover:border-amber/40 hover:bg-amber/5"
                      href={syncLinks.googleUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Google Calendar setup
                    </a>
                  </section>
                ) : null}

                {/* ── Status message ────────────────────────────────────── */}
                {toolMessage ? (
                  <div className="rounded-[1rem] border border-success/20 bg-success/10 px-4 py-3 text-sm text-[#4a6e3f]">
                    {toolMessage}
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
