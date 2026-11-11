"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, RotateCcw, Send } from "lucide-react";
import { Dialog } from "@/components/Dialog";
import { useHousehold } from "@/components/WorkspaceData";
import { WhoIsAdding } from "@/components/WhoIsAdding";
import { useKitchenEnabled } from "@/hooks/useKitchenDisplay";
import { useSpeech, useSpeechSupported } from "@/hooks/useSpeech";
import { MAX_HISTORY_TURNS, MAX_QUESTION_LENGTH, type Turn } from "@/lib/assistant/limits";

const SUGGESTIONS = ["What's on today?", "Anything to remind me?", "Who's working today?", "What do we need to buy?"];

/** A little longer than the server's own limit, so its message arrives first. */
const CLIENT_TIMEOUT_MS = 65_000;
/** After this long, say why it is slow. */
const SLOW_AFTER_MS = 4000;

const OFFLINE = "You're offline. Reconnect and try again.";
const NO_REPLY = "Couldn't reach the assistant. Check the connection and try again.";
const TOO_SLOW = "That took too long. Try again in a moment.";

/** Whether a model is configured on the server; the header button hides until it is. */
export function useAssistantEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch("/api/assistant", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { enabled?: unknown } | null) => {
        if (alive) setEnabled(body?.enabled === true);
      })
      .catch(() => {
        // Offline or blocked: the button stays hidden.
      });
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}

/**
 * Ask a question about the household's calendar, roster and lists; the answer
 * comes back as short plain text. The conversation lives only while the panel
 * is open.
 */
export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { adderId } = useHousehold();
  const kitchen = useKitchenEnabled();
  const canSpeak = useSpeechSupported();
  const asker = kitchen ? adderId : null;

  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  /** The question being answered, or the one that failed. */
  const [pending, setPending] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // Closing the panel (or the kitchen idle reset) drops any question in flight.
  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns, waiting, error]);

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  const ask = useCallback(
    async (text: string) => {
      const question = text.trim().slice(0, MAX_QUESTION_LENGTH);
      if (!question || request.current) return;
      setDraft("");
      setPending(question);
      setError("");
      if (!navigator.onLine) {
        setError(OFFLINE);
        return;
      }
      const controller = new AbortController();
      request.current = controller;
      let timedOut = false;
      const timer = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, CLIENT_TIMEOUT_MS);
      setSlow(false);
      setWaiting(true);
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, history: turns.slice(-MAX_HISTORY_TURNS), asker }),
          signal: controller.signal,
        });
        const body = (await response.json().catch(() => null)) as { answer?: unknown; error?: unknown } | null;
        if (controller.signal.aborted) return;
        if (response.ok && typeof body?.answer === "string" && body.answer) {
          const answer = body.answer;
          setTurns((current) => [...current, { role: "user", text: question }, { role: "assistant", text: answer }]);
          setPending(null);
        } else {
          setError(typeof body?.error === "string" && body.error ? body.error : NO_REPLY);
        }
      } catch {
        // Aborted by closing the panel: nothing to show. Otherwise say what happened.
        if (timedOut) setError(TOO_SLOW);
        else if (!controller.signal.aborted) setError(NO_REPLY);
      } finally {
        window.clearTimeout(timer);
        if (request.current === controller) request.current = null;
        setWaiting(false);
      }
    },
    [asker, turns],
  );

  const speech = useSpeech((text) => void ask(text));
  const idle = !waiting && !speech.listening;

  return (
    <Dialog title="Ask" onClose={onClose}>
      <div className="assistant">
        <p className="dialog-copy">Ask about the calendar, the work roster, groceries or to-dos.</p>
        {kitchen && <WhoIsAdding label="Who's asking?" />}

        <div className="assistant-log" role="log" aria-live="polite" aria-label="Conversation">
          {turns.map((turn, index) => (
            <motion.p
              key={index}
              className={`assistant-bubble is-${turn.role}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="sr-only">{turn.role === "user" ? "You asked: " : "Answer: "}</span>
              {turn.text}
            </motion.p>
          ))}
          {pending && (
            <p className="assistant-bubble is-user">
              <span className="sr-only">You asked: </span>
              {pending}
            </p>
          )}
          {waiting && (
            <motion.p
              className="assistant-bubble is-assistant is-thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.span
                aria-hidden
                className="assistant-dot"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
              Thinking…{slow && <small>The first question can take a little longer.</small>}
            </motion.p>
          )}
          {error && !waiting && (
            <div className="assistant-error" role="alert">
              <p className="data-status error">{error}</p>
              {pending && (
                <button type="button" className="secondary-button" onClick={() => void ask(pending)}>
                  <RotateCcw size={18} /> Try again
                </button>
              )}
            </div>
          )}
          <div ref={end} />
        </div>

        {idle && !pending && (
          <div className="assistant-chips" role="group" aria-label="Suggested questions">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="assistant-chip" onClick={() => void ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {speech.error && (
          <p className="data-status error" role="alert">
            {speech.error}
          </p>
        )}

        <form
          className="assistant-form"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
        >
          <input
            value={speech.listening ? speech.transcript : draft}
            onChange={(event) => setDraft(event.target.value)}
            readOnly={speech.listening}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder={speech.listening ? "Listening…" : "Ask a question"}
            aria-label="Your question"
            enterKeyHint="send"
            autoComplete="off"
          />
          {canSpeak && (
            <button
              type="button"
              className={`icon-button assistant-mic${speech.listening ? " is-listening" : ""}`}
              aria-label={speech.listening ? "Stop listening" : "Ask by voice"}
              aria-pressed={speech.listening}
              disabled={waiting}
              onClick={speech.listening ? speech.stop : speech.start}
            >
              <Mic size={22} />
            </button>
          )}
          <button
            type="submit"
            className="primary-button assistant-send"
            disabled={!idle || !draft.trim()}
            aria-label="Send question"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </Dialog>
  );
}
