"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Mic, MicOff } from "lucide-react";
import { Dialog } from "@/components/Dialog";
import { useCalendarData, useHousehold, useListData } from "@/components/WorkspaceData";
import { useEveryone } from "@/components/MemberTag";
import { WhoIsAdding } from "@/components/WhoIsAdding";
import { useKitchenEnabled } from "@/hooks/useKitchenDisplay";
import { useSpeech } from "@/hooks/useSpeech";
import { describeDate, parseVoiceCommand, splitItems, type VoiceCommand, type VoiceKind } from "@/lib/voice";
import type { FridgeList } from "@/lib/types";

const KINDS: { value: VoiceKind; label: string }[] = [
  { value: "grocery", label: "Grocery" },
  { value: "todo", label: "To-do" },
  { value: "event", label: "Event" },
  { value: "reminder", label: "Reminder" },
];

const EXAMPLES = [
  "“Add milk and eggs to the shopping list”",
  "“Remind me to call Mum tomorrow at 5pm”",
  "“Dentist on Friday at 3”",
  "“I need to fix the gate”",
];

/** What the confirm card is editing: the parse, with grocery items as one line. */
type Draft = Omit<VoiceCommand, "items"> & { itemsText: string };

function toDraft(command: VoiceCommand): Draft {
  const { items, ...rest } = command;
  return { ...rest, itemsText: items.join(", ") };
}

/**
 * "Say it": listen, show what was understood, add it on "Add".
 * Speech is recognised by the browser; the sentence is read on the device.
 */
export function VoiceAdd({ lists, onClose }: { lists: FridgeList[]; onClose: () => void }) {
  const grocery = lists.find((list) => list.name === "Grocery");
  const todo = lists.find((list) => list.name === "To-Do");
  const groceryData = useListData(grocery?.id ?? lists[0].id);
  const todoData = useListData(todo?.id ?? lists[0].id);
  const calendar = useCalendarData();
  const { userId, adderId } = useHousehold();
  const everyone = useEveryone();
  const kitchen = useKitchenEnabled();
  const credit = kitchen ? adderId : null;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [heard, setHeard] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [saveError, setSaveError] = useState("");

  const speech = useSpeech((text) => {
    setHeard(text);
    setDraft(toDraft(parseVoiceCommand(text)));
  });
  const { start } = speech;

  // Start listening as soon as the dialog opens.
  useEffect(() => {
    start();
  }, [start]);

  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  // Show the confirmation for a moment, then get out of the way.
  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => close.current(), 1400);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const available = useMemo(
    () =>
      KINDS.filter(
        (kind) => (kind.value !== "grocery" || grocery) && (kind.value !== "todo" || todo),
      ),
    [grocery, todo],
  );

  const listenAgain = () => {
    setDraft(null);
    setHeard("");
    setSaveError("");
    start();
  };

  const update = (patch: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...patch } : current));

  const add = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      if (draft.kind === "grocery" && grocery) {
        const items = splitItems(draft.itemsText);
        if (!items.length) return;
        for (const item of items) {
          if (!(await groceryData.addItem(item, credit))) {
            setSaveError(groceryData.error || "Couldn't add that. Try again.");
            return;
          }
        }
        setSaved(items.length === 1 ? `${items[0]} added to Groceries` : `${items.length} items added to Groceries`);
        return;
      }
      const title = draft.title.trim();
      if (!title) return;
      if (draft.kind === "todo" && todo) {
        if (!(await todoData.addItem(title, credit))) {
          setSaveError(todoData.error || "Couldn't add that. Try again.");
          return;
        }
        setSaved(`${title} added to To-Do`);
        return;
      }
      const reminder = draft.kind === "reminder";
      const owner = everyone.length > 1 ? (credit ?? userId) : null;
      const ok = await calendar.addEvent({
        event_date: draft.date,
        event_time: draft.time,
        title,
        event_type: reminder ? "reminder" : "event",
        color: reminder ? "rose" : "amber",
        recurrence: draft.recurrence,
        // A reminder with a time alerts at that time; events stay quiet, as in the form.
        notify_before: reminder && draft.time ? 0 : -1,
        notify_channels: [],
        owner_id: owner,
        owner_person_id: null,
      });
      if (!ok) {
        setSaveError(calendar.error || "Couldn't add that. Try again.");
        return;
      }
      setSaved(`${title} added to the calendar · ${describeDate(draft.date)}`);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || groceryData.isWorking || todoData.isWorking || calendar.isWorking;
  const canAdd = draft
    ? draft.kind === "grocery"
      ? splitItems(draft.itemsText).length > 0
      : draft.title.trim().length > 0 && (draft.kind === "todo" || Boolean(draft.date))
    : false;

  return (
    <Dialog title="Say it" onClose={onClose}>
      {kitchen && <WhoIsAdding />}

      <AnimatePresence mode="wait" initial={false}>
        {saved ? (
          <motion.div
            key="saved"
            className="voice-saved"
            role="status"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <span className="voice-saved-mark">
              <Check size={28} strokeWidth={3} />
            </span>
            <p>{saved}</p>
          </motion.div>
        ) : !draft ? (
          <motion.div
            key="listen"
            className="voice-listen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className={`voice-mic${speech.listening ? " is-listening" : ""}`}
              aria-label={speech.listening ? "Stop listening" : "Start listening"}
              aria-pressed={speech.listening}
              onClick={speech.listening ? speech.stop : listenAgain}
            >
              {speech.listening && (
                <motion.span
                  className="voice-pulse"
                  aria-hidden
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              {speech.error && !speech.listening ? <MicOff size={34} /> : <Mic size={34} />}
            </button>
            <p className="voice-transcript" aria-live="polite">
              {speech.transcript ||
                (speech.listening ? "Listening…" : speech.error ? "" : "Tap the microphone and speak.")}
            </p>
            {speech.error && (
              <p className="data-status error" role="alert">
                {speech.error}
              </p>
            )}
            {!speech.transcript && (
              <ul className="voice-examples" aria-label="Things you can say">
                {EXAMPLES.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="confirm"
            className="voice-confirm"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <p className="voice-heard">
              <span className="eyebrow">You said</span>
              <span>“{heard}”</span>
            </p>

            <div className="segmented voice-kinds" role="group" aria-label="Add as">
              {available.map((kind) => (
                <button
                  key={kind.value}
                  type="button"
                  aria-pressed={draft.kind === kind.value}
                  onClick={() => {
                    // Moving between groceries and the rest carries the words across.
                    if (kind.value === "grocery" && draft.kind !== "grocery") {
                      update({ kind: kind.value, itemsText: splitItems(draft.title).join(", ") });
                    } else if (kind.value !== "grocery" && draft.kind === "grocery") {
                      update({ kind: kind.value, title: draft.title || draft.itemsText });
                    } else {
                      update({ kind: kind.value });
                    }
                  }}
                >
                  {kind.label}
                </button>
              ))}
            </div>

            {draft.kind === "grocery" ? (
              <label className="voice-field">
                <span>Items</span>
                <input
                  value={draft.itemsText}
                  onChange={(event) => update({ itemsText: event.target.value })}
                  placeholder="Milk, eggs, bread"
                />
                <small>Separate items with commas.</small>
              </label>
            ) : (
              <label className="voice-field">
                <span>{draft.kind === "todo" ? "Task" : "Title"}</span>
                <input
                  value={draft.title}
                  onChange={(event) => update({ title: event.target.value })}
                />
              </label>
            )}

            {(draft.kind === "event" || draft.kind === "reminder") && (
              <div className="voice-when">
                <label className="voice-field">
                  <span>Date</span>
                  <input
                    type="date"
                    required
                    value={draft.date}
                    onChange={(event) => update({ date: event.target.value })}
                  />
                </label>
                <label className="voice-field">
                  <span>Time</span>
                  <input
                    type="time"
                    value={draft.time ?? ""}
                    onChange={(event) => update({ time: event.target.value || null })}
                  />
                </label>
                {draft.recurrence !== "none" && (
                  <p className="voice-repeat">
                    Repeats {draft.recurrence === "biweekly" ? "every two weeks" : draft.recurrence}
                    <button type="button" className="text-button" onClick={() => update({ recurrence: "none" })}>
                      Just once
                    </button>
                  </p>
                )}
              </div>
            )}

            {saveError && (
              <p className="data-status error" role="alert">
                {saveError}
              </p>
            )}

            <div className="voice-actions">
              <button type="button" className="secondary-button" onClick={listenAgain} disabled={busy}>
                <Mic size={18} /> Say it again
              </button>
              <button type="submit" className="primary-button" disabled={busy || !canAdd}>
                <Check size={18} /> {saving ? "Adding…" : "Add"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
