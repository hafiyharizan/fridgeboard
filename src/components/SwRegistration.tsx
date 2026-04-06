"use client";

import { useEffect } from "react";

/** Registers the service worker once on mount. Renders nothing. */
export function SwRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[SW] Registration failed:", err);
      });
    }
  }, []);

  return null;
}
