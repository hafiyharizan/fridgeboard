"use client";

import { createPortal } from "react-dom";
import { useModalSurface } from "@/hooks/useModalSurface";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarPlus2, Link2, Settings2, X } from "lucide-react";
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

export function CalendarSettings({
  busy,
  year,
  onImport,
  onCreateSyncLink,
}: CalendarSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useModalSurface(() => setIsOpen(false), isOpen);
  const [toolMessage, setToolMessage] = useState("");
  const [syncLinks, setSyncLinks] = useState<{
    feedUrl: string;
    appleUrl: string;
    googleUrl: string;
  } | null>(null);

  const importOptions = useMemo(() => getCalendarImportOptions(), []);

  const handleImport = async (source: CalendarImportSource) => {
    const result = await onImport(source);

    if (!result) {
      return;
    }

    setToolMessage(
      result.imported > 0
        ? `${getCalendarImportLabel(source)} added for ${year}. Imported ${result.imported} of ${result.total} dates.`
        : `${getCalendarImportLabel(source)} were already on this calendar for ${year}.`,
    );
  };

  const handleCreateSyncLink = async () => {
    const nextLinks = await onCreateSyncLink();

    if (!nextLinks) {
      return;
    }

    setSyncLinks(nextLinks);
    setToolMessage(
      "Private calendar feed ready. Apple can open it directly, and Google can subscribe from URL.",
    );
  };

  const handleCopyFeedUrl = async () => {
    if (!syncLinks) {
      return;
    }

    try {
      await navigator.clipboard.writeText(syncLinks.feedUrl);
      setToolMessage(
        "Calendar feed link copied. Paste it into Google Calendar's 'From URL' flow.",
      );
    } catch {
      setToolMessage(
        "Copy did not work automatically. You can still select the feed link below.",
      );
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

      {isOpen
        ? createPortal(
            <motion.div
              animate={{ opacity: 1 }}
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label="Calendar settings"
              tabIndex={-1}
              className="calendar-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 px-4 backdrop-blur-sm"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            >
              <motion.div
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/95 shadow-[0_24px_64px_rgba(60,40,20,0.15)] backdrop-blur-xl"
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(event) => event.stopPropagation()}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
                        Calendar settings
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        Imports and external calendar sync for {year}
                      </p>
                    </div>
                  </div>
                  <button
                    className="rounded-full p-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
                    onClick={() => setIsOpen(false)}
                    type="button"
                  >
                    <span className="sr-only">Close calendar settings</span>
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="max-h-[75vh] space-y-5 overflow-y-auto px-5 py-4">
                  <section className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarPlus2 className="h-4 w-4 text-muted" />
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted">
                        Import curated dates
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {importOptions.map((option) => {
                        const supported = isCalendarImportSupported(
                          option.source,
                          year,
                        );

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
                      Add Islamic dates, Western Australia holidays, or Malaysia
                      public holidays without cluttering the month view.
                    </p>
                  </section>

                  <section className="space-y-3 rounded-[1.1rem] border border-border/60 bg-foreground/[0.03] p-4">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-muted" />
                      <p className="text-[0.68rem] font-bold uppercase tracking-[0.2em] text-muted">
                        Sync to Google or Apple
                      </p>
                    </div>
                    <button
                      className="w-full rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-60"
                      disabled={busy}
                      onClick={handleCreateSyncLink}
                      type="button"
                    >
                      Create private sync link
                    </button>

                    {syncLinks ? (
                      <div className="space-y-2">
                        <input
                          className="w-full rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground outline-none"
                          readOnly
                          value={syncLinks.feedUrl}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-full border border-border px-3 py-1 text-[0.68rem] font-bold text-foreground transition hover:border-amber/40 hover:bg-amber/10"
                            onClick={handleCopyFeedUrl}
                            type="button"
                          >
                            Copy feed URL
                          </button>
                          <a
                            className="rounded-full border border-border px-3 py-1 text-[0.68rem] font-bold text-foreground transition hover:border-blue/40 hover:bg-blue/10"
                            href={syncLinks.appleUrl}
                          >
                            Open in Apple
                          </a>
                          <a
                            className="rounded-full border border-border px-3 py-1 text-[0.68rem] font-bold text-foreground transition hover:border-blue/40 hover:bg-blue/10"
                            href={syncLinks.googleUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open Google setup
                          </a>
                        </div>
                        <p className="text-xs leading-5 text-muted">
                          Apple Calendar can subscribe directly. For Google
                          Calendar, open the setup page and paste the copied URL
                          into the “From URL” field.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-muted">
                        Generate a private iCal feed so this household calendar
                        stays in sync across Apple Calendar and Google Calendar.
                      </p>
                    )}
                  </section>

                  {toolMessage ? (
                    <div className="rounded-[1rem] border border-success/20 bg-success/10 px-4 py-3 text-sm text-[#4a6e3f]">
                      {toolMessage}
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </motion.div>,
            document.body,
          )
        : null}
    </>
  );
}
