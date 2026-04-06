"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { clearSessionPin, setSessionPin } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ensureUserProfile } from "@/lib/user-profile";

export function PinEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const authError = searchParams.get("error") === "auth";
  const [error, setError] = useState(authError ? "Sign-in failed. Please try again." : "");
  const [checkingSession, setCheckingSession] = useState(true);
  const [statusMessage, setStatusMessage] = useState("Checking your account...");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

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
        setError(profileError instanceof Error ? profileError.message : "Could not load your account.");
        setCheckingSession(false);
      }
    };

    void checkSession();
  }, [router, supabase]);

  const handleMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMagicLinkLoading(true);
    setMagicLinkSent(false);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setMagicLinkLoading(false);
      return;
    }

    setMagicLinkSent(true);
    setMagicLinkLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signInError) {
      setError(signInError.message);
      setGoogleLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="fridge-wrap flex items-center justify-center">
        <motion.section
          className="fridge-card relative w-full max-w-md overflow-hidden px-6 py-7 text-center sm:px-8"
          initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            animate={{ y: [0, 20, 0], x: [0, -15, 0], scale: [1, 1.1, 1] }}
            className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-amber/30 blur-3xl"
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            animate={{ y: [0, -20, 0], x: [0, 20, 0], scale: [1, 1.2, 1] }}
            className="absolute -right-4 top-0 h-36 w-36 rounded-full bg-blue/25 blur-3xl"
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />

          <div className="relative space-y-4">
            <p className="inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-muted">
              Fridgeboard
            </p>
            <motion.div
              animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
              className="text-sm font-medium text-muted"
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {statusMessage}
            </motion.div>
          </div>
        </motion.section>
      </main>
    );
  }

  return (
    <main className="fridge-wrap flex items-center justify-center">
      <motion.section
        className="fridge-card relative w-full max-w-md overflow-hidden px-6 py-7 sm:px-8"
        initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          animate={{ y: [0, 20, 0], x: [0, -15, 0], scale: [1, 1.1, 1] }}
          className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-amber/30 blur-3xl"
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          animate={{ y: [0, -20, 0], x: [0, 20, 0], scale: [1, 1.2, 1] }}
          className="absolute -right-4 top-0 h-36 w-36 rounded-full bg-blue/25 blur-3xl"
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        <div className="relative flex flex-col gap-8">
          <div className="space-y-3 text-center">
            <p className="inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-muted">
              Step 1 · Account sign-in
            </p>
            <div className="space-y-2">
              <h1 className="text-4xl text-balance text-foreground sm:text-5xl">
                Sign in with your account first.
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-6 text-muted sm:text-base">
                Use Google or a magic link email. Once you&apos;re in, you can create a household or join one with a shared household PIN.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-3 rounded-[1.4rem] border border-border bg-white/90 px-5 py-4 text-base font-bold text-foreground shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber/25 disabled:opacity-50"
              disabled={googleLoading}
              onClick={handleGoogleSignIn}
              type="button"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
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
              {googleLoading ? "Redirecting..." : "Sign in with Google"}
            </motion.button>

            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted/60">
                or sign in with email
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleMagicLink}>
            <label className="block space-y-3">
              <span className="text-sm font-semibold text-foreground">Email address</span>
              <input
                autoComplete="email"
                className="w-full rounded-[1.4rem] border border-border bg-white/90 px-5 py-4 text-base text-foreground outline-none transition placeholder:text-muted/50 focus:border-amber-deep focus:ring-4 focus:ring-amber/25"
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                  setMagicLinkSent(false);
                }}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </label>

            {magicLinkSent ? (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-sm font-medium text-[#4a6e3f]"
              >
                Check your email for a sign-in link.
              </motion.p>
            ) : null}

            {error ? (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-sm font-medium text-danger"
              >
                {error}
              </motion.p>
            ) : null}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-[1.4rem] bg-foreground px-5 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#2f241b] focus:outline-none focus:ring-4 focus:ring-amber/25 disabled:opacity-50"
              disabled={magicLinkLoading}
              type="submit"
            >
              {magicLinkLoading ? "Sending link..." : "Send magic link"}
            </motion.button>
          </form>

          <p className="text-center text-xs uppercase tracking-[0.24em] text-muted/80">
            Step 2 happens after sign-in
          </p>
        </div>
      </motion.section>
    </main>
  );
}
