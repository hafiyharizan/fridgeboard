"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Share, X } from "lucide-react";

// Not yet part of the standard TypeScript lib
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type InstallState = "hidden" | "android" | "ios";

const DISMISSED_KEY = "install_prompt_dismissed";

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** Shows a bottom banner prompting the user to install the PWA.
 *  - Android/Chrome/Edge: uses the native `beforeinstallprompt` event.
 *  - iOS Safari: shows manual "Share → Add to Home Screen" instructions.
 *  Dismissed state is persisted to localStorage so it only appears once. */
export function InstallPrompt() {
  const [state, setState] = useState<InstallState>("hidden");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (isInStandaloneMode()) return;

    // iOS Safari doesn't fire beforeinstallprompt — show manual instructions.
    // Defer via a resolved Promise so setState runs in a callback, not synchronously.
    if (isIOS()) {
      void Promise.resolve().then(() => setState("ios"));
      return;
    }

    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setState("android");
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setState("hidden");
      localStorage.setItem(DISMISSED_KEY, "1");
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setState("hidden");
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  return (
    <AnimatePresence>
      {state !== "hidden" && (
        <motion.div
          key="install-prompt"
          role="banner"
          aria-label="Install application prompt"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-white/95 p-4 shadow-xl backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">Add to Home Screen</p>
              {state === "ios" ? (
                <p className="mt-1 text-xs leading-5 text-muted">
                  Tap <Share className="mx-0.5 inline h-3.5 w-3.5" /> then{" "}
                  <strong>Add to Home Screen</strong> for instant access.
                </p>
              ) : (
                <p className="mt-1 text-xs leading-5 text-muted">
                  Install Fridgeboard for quick access, even offline.
                </p>
              )}
            </div>
            <button
              aria-label="Dismiss install prompt"
              className="shrink-0 rounded-full p-1 text-muted hover:bg-border/30 hover:text-foreground"
              onClick={handleDismiss}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {state === "android" && (
            <motion.button
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-foreground py-2.5 text-sm font-bold text-white"
              onClick={handleInstall}
              type="button"
              whileTap={{ scale: 0.97 }}
            >
              <Plus className="h-4 w-4" />
              Install App
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
