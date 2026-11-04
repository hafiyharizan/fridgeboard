"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** The one-screen Home layout (see workspace.css): cards have fixed heights. */
export const FIT_LAYOUT_QUERY = "(min-width: 1180px) and (min-height: 680px)";

/**
 * On the one-screen layout, counts how many of a list's rows are fully
 * visible so the rest can be hidden (`data-clipped`) instead of showing a
 * row cut in half. Rows may differ in height. Elsewhere the page scrolls,
 * so every row counts as visible.
 *
 * `version` should change whenever the rendered rows change. Returns the
 * ref for the list element and how many of its rows are fully visible.
 */
export function useWholeRows<T extends HTMLElement>(version: string) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(Number.POSITIVE_INFINITY);

  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const media = window.matchMedia(FIT_LAYOUT_QUERY);
    const measure = () => {
      if (!media.matches) {
        setVisible(Number.POSITIVE_INFINITY);
        return;
      }
      // offsetTop/offsetHeight ignore transforms, so rows mid-animation
      // measure where they will land. The list is position: relative.
      const limit = list.clientHeight - parseFloat(getComputedStyle(list).paddingBottom || "0");
      let count = 0;
      for (const row of Array.from(list.children) as HTMLElement[]) {
        if (row.offsetTop + row.offsetHeight > limit + 0.5) break;
        count += 1;
      }
      setVisible(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    // A row can grow on its own (text wrapping, fonts loading).
    for (const row of Array.from(list.children)) observer.observe(row);
    media.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", measure);
    };
  }, [version]);

  return [ref, visible] as const;
}
