"use client";

import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { CalendarPlus2, CheckCircle2, Copy, ExternalLink, Link2, Plus, Settings2 } from "lucide-react";
import { ModalFrame } from "@/components/ModalFrame";
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
      "Private link ready. Copy it, or open it in your calendar app.",
    );
  };

  const handleCopyFeedUrl = async () => {
    if (!syncLinks) {
      return;
    }

    try {
      await navigator.clipboard.writeText(syncLinks.feedUrl);
      setToolMessage(
        "Link copied. Paste it into Google Calendar under “From URL”.",
      );
    } catch {
      setToolMessage(
        "Couldn't copy automatically. Select the link and copy it instead.",
      );
    }
  };

  return (
    <>
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => setIsOpen(true)}
        aria-label="Calendar settings"
        type="button"
      >
        <Settings2 size={15} />
        <span className="hide-on-phone">Import and sync</span>
      </button>

      {isOpen
        ? createPortal(
            <ModalFrame
              label="Calendar settings"
              title="Import and sync"
              description={`Calendar tools for ${year}`}
              onClose={() => setIsOpen(false)}
              size="lg"
            >
              <div className="modal-body">
                <section className="modal-section">
                  <h3 className="modal-section-title">
                    <CalendarPlus2 size={16} />
                    Add holidays and observances
                  </h3>
                  <p className="section-copy">
                    Adds the dates for {year} to the household calendar. Dates already there are skipped.
                  </p>
                  <ul className="import-list">
                    {importOptions.map((option) => {
                      const supported = isCalendarImportSupported(option.source, year);
                      return (
                        <li key={option.source}>
                          <div className="min-w-0 flex-1">
                            <p className="import-name">{option.label}</p>
                            <p className="import-desc">
                              {supported ? option.description : `Not available for ${year} yet.`}
                            </p>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={!supported || busy}
                            onClick={() => handleImport(option.source)}
                            type="button"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>

                <section className="modal-section">
                  <h3 className="modal-section-title">
                    <Link2 size={16} />
                    Show on Google or Apple Calendar
                  </h3>
                  <p className="section-copy">
                    A private feed link keeps this calendar in sync with the calendar app on your phone.
                  </p>
                  {syncLinks ? (
                    <div className="mt-3 grid gap-3">
                      <div className="flex gap-2">
                        <input
                          aria-label="Private calendar feed link"
                          className="input text-[13px]"
                          readOnly
                          onFocus={(event) => event.currentTarget.select()}
                          value={syncLinks.feedUrl}
                        />
                        <button className="btn btn-secondary shrink-0" onClick={handleCopyFeedUrl} type="button">
                          <Copy size={15} /> Copy
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a className="btn btn-secondary btn-sm" href={syncLinks.appleUrl}>
                          Open in Apple Calendar
                        </a>
                        <a
                          className="btn btn-secondary btn-sm"
                          href={syncLinks.googleUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Google Calendar setup <ExternalLink size={13} />
                        </a>
                      </div>
                      <p className="field-hint">
                        Apple Calendar subscribes directly. For Google, open the setup page and paste the
                        link into “From URL”.
                      </p>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary mt-3"
                      disabled={busy}
                      onClick={handleCreateSyncLink}
                      type="button"
                    >
                      <Link2 size={15} /> Create private link
                    </button>
                  )}
                </section>

                {toolMessage ? (
                  <p className="alert alert-success mt-5" role="status">
                    <CheckCircle2 size={16} />
                    {toolMessage}
                  </p>
                ) : null}
              </div>
            </ModalFrame>,
            document.body,
          )
        : null}
    </>
  );
}
