"use client";
import { useEffect, useRef } from "react";

/** Keyboard containment for the existing animated calendar dialogs. */
export function useModalSurface(onClose: () => void, enabled = true) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!enabled) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const workspace = document.querySelector<HTMLElement>(
      ".household-workspace",
    );
    if (workspace) workspace.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ),
      ).filter((node) => node.getClientRects().length);
    (focusable()[0] ?? root).focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;
      const nodes = focusable();
      const first = nodes[0],
        last = nodes.at(-1);
      if (!first) {
        event.preventDefault();
        root.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    root.addEventListener("keydown", handleKey);
    return () => {
      root.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (workspace) workspace.inert = false;
      previous?.focus();
    };
  }, [enabled]);
  return ref;
}
