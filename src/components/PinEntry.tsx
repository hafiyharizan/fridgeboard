"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import { AuthLoading, AuthLogo } from "@/components/AuthScreen";
import { clearSessionPin, setSessionPin } from "@/lib/auth";
import { buildAppUrl } from "@/lib/site-url";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ensureUserProfile } from "@/lib/user-profile";

/* ------------------------------------------------------------------ */
/*  Shared UI pieces                                                   */
/* ------------------------------------------------------------------ */

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
    "Checking your account…",
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
          setStatusMessage("Opening your household…");
          setSessionPin(profile.pin_code);
          router.replace("/list");
          return;
        }

        setStatusMessage("Taking you to household setup…");
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
    return <AuthLoading message={statusMessage} />;
  }

  /* ---- Sign-in screen ---- */
  return (
    <main className="auth-wrap">
      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth-head">
          <AuthLogo size={96} />
          <h1 className="auth-title">Sign in to Fridgeboard</h1>
          <p className="auth-desc">
            Groceries, to-dos and the family calendar, kept in sync for everyone at home.
          </p>
        </div>

        <button
          className="btn btn-secondary btn-lg btn-block google-button"
          disabled={googleLoading}
          onClick={handleGoogleSignIn}
          type="button"
        >
          {googleLoading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <GoogleIcon />}
          {googleLoading ? "Opening Google\u2026" : "Continue with Google"}
        </button>

        <AnimatePresence>
          {error ? (
            <motion.p
              key="auth-error"
              className="alert alert-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <p className="auth-foot auth-foot-center">
          <ShieldCheck size={14} aria-hidden />
          Only people in your household can see what you add.
        </p>
      </motion.section>
    </main>
  );
}
