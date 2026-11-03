"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share, X } from "lucide-react";
import {
  INSTALL_PROMPT_KEY,
  isAppleMobile,
  isInstallPromptHidden,
} from "@/lib/install-prompt";

// Chromium-only event, not yet in TypeScript's DOM types.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Mode = "hidden" | "native" | "apple";

/** Wait before showing the iPhone hint so it doesn't greet people on arrival. */
const APPLE_HINT_DELAY_MS = 4000;

function readStored(): string | null {
  try {
    return localStorage.getItem(INSTALL_PROMPT_KEY);
  } catch {
    return null;
  }
}

function store(value: string) {
  try {
    localStorage.setItem(INSTALL_PROMPT_KEY, value);
  } catch {
    // Private mode or blocked storage: the banner just comes back next visit.
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own flag, not in the DOM types.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Bottom banner suggesting the home-screen app. Chrome, Edge and Android get a
 * one-tap install button; iPhone and iPad get Share → Add to Home Screen steps,
 * since that is also the only way push notifications work there.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>("hidden");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || isInstallPromptHidden(readStored())) return;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode("native");
    };
    const onInstalled = () => {
      store("installed");
      setMode("hidden");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const appleTimer = isAppleMobile(navigator.userAgent, navigator.maxTouchPoints)
      ? window.setTimeout(() => setMode("apple"), APPLE_HINT_DELAY_MS)
      : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.clearTimeout(appleTimer);
    };
  }, []);

  const dismiss = () => {
    store(String(Date.now()));
    setMode("hidden");
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The browser's event can only be used once.
    setDeferred(null);
    if (outcome === "accepted") store("installed");
    else store(String(Date.now()));
    setMode("hidden");
  };

  return (
    <AnimatePresence>
      {mode !== "hidden" && (
        <motion.aside
          key="install-prompt"
          className="install-banner"
          aria-label="Install Fridgeboard"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
        >
          <Image className="install-icon" src="/logo.png" alt="" width={44} height={44} />
          <div className="install-copy">
            <strong>Keep Fridgeboard on your home screen</strong>
            {mode === "apple" ? (
              <p>
                Tap <Share size={15} aria-label="Share" className="inline-icon" /> then{" "}
                <b>Add to Home Screen</b>. On iPhone, that&apos;s also how you get
                alerts when someone adds to a list.
              </p>
            ) : (
              <p>Opens like an app, and lets your household&apos;s updates reach you.</p>
            )}
          </div>
          <div className="install-actions">
            {mode === "native" && (
              <button className="primary-button" onClick={install} type="button">
                <Download size={17} /> Install
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Not now"
              onClick={dismiss}
              type="button"
            >
              <X size={19} />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
