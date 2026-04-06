"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { clearSessionPin, setSessionPin } from "@/lib/auth";
import { buildAppUrl } from "@/lib/site-url";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ensureUserProfile } from "@/lib/user-profile";

/* ------------------------------------------------------------------ */
/*  Shared UI pieces                                                   */
/* ------------------------------------------------------------------ */

/** Ambient gradient blobs that float behind the card content */
function AmbientBlobs() {
  return (
    <>
      <motion.div
        animate={{ y: [0, 20, 0], x: [0, -15, 0], scale: [1, 1.1, 1] }}
        className="pointer-events-none absolute -left-12 top-6 h-40 w-40 rounded-full bg-amber/25 blur-3xl"
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 20, 0], scale: [1, 1.2, 1] }}
        className="pointer-events-none absolute -right-6 -top-2 h-44 w-44 rounded-full bg-blue/20 blur-3xl"
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
      <motion.div
        animate={{ y: [0, 15, 0], x: [0, 10, 0], scale: [1, 1.15, 1] }}
        className="pointer-events-none absolute -bottom-4 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-amber-deep/10 blur-3xl"
        transition={{
          duration: 11,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
    </>
  );
}

/** Google "G" icon */
function GoogleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** Stagger children with a subtle slide-up */
const stagger = {
  container: {
    animate: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
  },
  item: {
    initial: { opacity: 0, y: 18 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.55,
        ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
      },
    },
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function PinEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const authError = searchParams.get("error") === "auth";
  const [error, setError] = useState(
    authError ? "Sign-in failed. Please try again." : "",
  );
  const [checkingSession, setCheckingSession] = useState(true);
  const [statusMessage, setStatusMessage] = useState(
    "Checking your account...",
  );
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        clearSessionPin();
        setCheckingSession(false);
        return;
      }

      try {
        const profile = await ensureUserProfile(supabase, user);

        if (profile.pin_code) {
          setStatusMessage("Opening your household...");
          setSessionPin(profile.pin_code);
          router.replace("/list");
          return;
        }

        setStatusMessage("Taking you to household setup...");
        clearSessionPin();
        router.replace("/setup-household");
      } catch (profileError) {
        setError(
          profileError instanceof Error
            ? profileError.message
            : "Could not load your account.",
        );
        setCheckingSession(false);
      }
    };

    void checkSession();
  }, [router, supabase]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildAppUrl("/auth/callback", window.location.origin),
      },
    });

    if (signInError) {
      setError(signInError.message);
      setGoogleLoading(false);
    }
  };

  /* ---- Loading / session-check screen ---- */
  if (checkingSession) {
    return (
      <main className="fridge-wrap flex items-center justify-center">
        <motion.section
          className="fridge-card relative w-full max-w-sm overflow-hidden px-8 py-10 text-center"
          initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <AmbientBlobs />

          <div className="relative flex flex-col items-center gap-5">
            {/* Logo — smaller on loading screen */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/logo.png"
                alt="Fridgeboard"
                width={120}
                height={120}
                className="drop-shadow-md"
                preload
                draggable={false}
              />
            </motion.div>

            <motion.p
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="text-sm font-medium text-muted"
            >
              {statusMessage}
            </motion.p>
          </div>
        </motion.section>
      </main>
    );
  }

  /* ---- Sign-in screen ---- */
  return (
    <main className="fridge-wrap flex items-center justify-center">
      <motion.section
        className="fridge-card relative w-full max-w-sm overflow-hidden px-8 pb-10 pt-10 sm:px-10"
        initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <AmbientBlobs />

        <motion.div
          className="relative flex flex-col items-center"
          variants={stagger.container}
          initial="initial"
          animate="animate"
        >
          {/* ---- Logo ---- */}
          <motion.div variants={stagger.item} className="mb-0">
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="/logo.png"
                alt="Fridgeboard — warm shared grocery & to-do lists"
                width={200}
                height={200}
                className="drop-shadow-lg"
                preload
                draggable={false}
              />
            </motion.div>
          </motion.div>

          {/* ---- Welcome copy ---- */}
          <motion.div
            variants={stagger.item}
            className="mb-8 w-full max-w-md text-center"
          >
            <h1 className="text-4xl text-foreground sm:text-[2.8rem]">
              Fridgeboard
            </h1>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted sm:text-base">
              Welcome home.
            </p>
            <p className="mt-1 max-w-md text-sm leading-6 text-muted sm:text-base">
              Tap between grocery and to-do, and every change
              shows up on both phones.
            </p>
          </motion.div>

          {/* ---- Google sign-in button ---- */}
          <motion.div variants={stagger.item} className="w-full">
            <motion.button
              whileHover={{
                scale: 1.015,
                boxShadow: "0 8px 32px rgba(60, 40, 20, 0.12)",
              }}
              whileTap={{ scale: 0.975 }}
              className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-border bg-white/90 px-5 py-4 text-base font-bold text-foreground shadow-sm transition-all duration-200 hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber/30 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={googleLoading}
              onClick={handleGoogleSignIn}
              type="button"
            >
              {googleLoading ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="inline-block"
                >
                  <GoogleIcon />
                </motion.span>
              ) : (
                <GoogleIcon />
              )}
              {googleLoading
                ? "Redirecting to Google\u2026"
                : "Continue with Google"}
            </motion.button>
          </motion.div>

          {/* ---- Error message ---- */}
          <AnimatePresence>
            {error ? (
              <motion.p
                key="auth-error"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="mt-4 text-center text-sm font-medium text-danger"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {/* ---- Trust footer ---- */}
          <motion.p
            variants={stagger.item}
            className="mt-8 max-w-[16rem] text-center text-xs leading-relaxed text-muted/50"
          >
            Your data stays private&nbsp;&mdash; shared only within
            your&nbsp;household.
          </motion.p>
        </motion.div>
      </motion.section>
    </main>
  );
}
