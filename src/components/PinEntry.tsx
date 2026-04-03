"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { getSessionPin, setSessionPin } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function PinEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [pin, setPin] = useState("");
  const authError = searchParams.get("error") === "auth";
  const [error, setError] = useState(authError ? "Sign-in failed. Please try again." : "");
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (getSessionPin()) {
      router.replace("/list");
      return;
    }

    const checkSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("pin_code")
          .eq("user_id", user.id)
          .single();

        if (profile?.pin_code) {
          setSessionPin(profile.pin_code);
          router.replace("/list");
        } else {
          router.replace("/setup-pin");
        }
      }
    };

    void checkSession();
  }, [router, supabase]);

  const digits = useMemo(() => pin.split(""), [pin]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{4}$/.test(pin)) {
      setError("Use the same 4-digit PIN on both phones.");
      return;
    }

    setSessionPin(pin);
    router.push("/list");
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
              Fridgeboard
            </p>
            <div className="space-y-2">
              <h1 className="text-4xl text-balance text-foreground sm:text-5xl">
                Shared lists that feel like home.
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-6 text-muted sm:text-base">
                Grocery and to-do notes, synced in real time, with one simple PIN you both already know.
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
                or enter household PIN
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block space-y-3">
              <span className="text-sm font-semibold text-foreground">Enter your shared PIN</span>
              <input
                autoComplete="one-time-code"
                className="w-full rounded-[1.4rem] border border-border bg-white/90 px-5 py-4 text-center text-3xl tracking-[0.45em] text-foreground outline-none transition placeholder:text-muted/50 focus:border-amber-deep focus:ring-4 focus:ring-amber/25"
                inputMode="numeric"
                maxLength={4}
                onChange={(event) => {
                  const nextValue = event.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(nextValue);
                  setError("");
                }}
                placeholder="0000"
                value={pin}
              />
            </label>

            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`pin-dot ${digits[index] ? "scale-110 bg-foreground" : "bg-foreground/18"}`}
                />
              ))}
            </div>

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
              className="w-full rounded-[1.4rem] bg-foreground px-5 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#2f241b] focus:outline-none focus:ring-4 focus:ring-amber/25"
              type="submit"
            >
              Open the fridge
            </motion.button>
          </form>

          <p className="text-center text-xs uppercase tracking-[0.24em] text-muted/80">
            Warm, simple, always in sync
          </p>
        </div>
      </motion.section>
    </main>
  );
}
