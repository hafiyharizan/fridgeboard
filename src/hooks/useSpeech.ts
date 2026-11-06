"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/*
 * The Web Speech API's recogniser. TypeScript's DOM types don't include it
 * (it's still prefixed in Chrome and Safari), so this declares the part we use.
 */
type RecognitionEvent = { resultIndex: number; results: SpeechRecognitionResultList };
type RecognitionError = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

function recogniser(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  // The constructor lives under one of two names depending on the browser.
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

/** Whether this browser can listen (Chrome, Edge, Safari; not Firefox). */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => recogniser() !== null,
    () => false,
  );
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is off. Allow it for this site in your browser settings.",
  "service-not-allowed": "Voice input isn't available in this browser.",
  "audio-capture": "No microphone found.",
  network: "Voice input needs an internet connection.",
  "no-speech": "Didn't catch that. Try again.",
};

export type SpeechState = {
  listening: boolean;
  /** What's been heard so far, including words still being recognised. */
  transcript: string;
  error: string;
  start: () => void;
  stop: () => void;
};

/**
 * One utterance at a time: start() listens until the speaker pauses, then
 * `onFinal` gets the full sentence.
 */
export function useSpeech(onFinal: (text: string) => void): SpeechState {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const active = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const latest = useRef(onFinal);
  useEffect(() => {
    latest.current = onFinal;
  });

  const stop = useCallback(() => active.current?.stop(), []);

  const start = useCallback(() => {
    const Constructor = recogniser();
    if (!Constructor) {
      setError("Voice input isn't available in this browser.");
      return;
    }
    active.current?.abort();
    const recognition = new Constructor();
    recognition.lang = navigator.language || "en-AU";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    finalText.current = "";
    setTranscript("");
    setError("");

    recognition.onresult = (event) => {
      let interim = "";
      let done = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) done += result[0].transcript;
        else interim += result[0].transcript;
      }
      finalText.current = done.trim();
      setTranscript(`${done}${interim}`.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(ERRORS[event.error] ?? "Voice input stopped. Try again.");
    };
    recognition.onend = () => {
      if (active.current !== recognition) return;
      active.current = null;
      setListening(false);
      if (finalText.current) latest.current(finalText.current);
    };

    active.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      active.current = null;
      setError("Couldn't start the microphone. Try again.");
    }
  }, []);

  // Never leave the microphone on after the dialog closes.
  useEffect(
    () => () => {
      const recognition = active.current;
      active.current = null;
      recognition?.abort();
    },
    [],
  );

  return { listening, transcript, error, start, stop };
}
