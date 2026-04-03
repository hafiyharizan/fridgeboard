"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { setSessionPin } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export function PinSetup() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        // Not signed in — redirect to login
        router.replace("/");
        return;
      }

      // Check if profile already exists
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("pin_code")
        .eq("user_id", authUser.id)
        .single();

      if (profile?.pin_code) {
        // Already has a PIN — redirect to app
        setSessionPin(profile.pin_code);
        router.replace("/list");
        return;
      }

      setUser(authUser);
      setChecking(false);
    };

    void checkAuth();
  }, [router, supabase]);

  const digits = useMemo(() => pin.split(""), [pin]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{4}$/.test(pin)) {
      setError("Enter a 4-digit PIN to link your household.");
      return;
    }

    if (!user) return;

    setLoading(true);
    setError("");

    const { error: insertError } = await supabase.from("user_profiles").insert({
      user_id: user.id,
      pin_code: pin,
      display_name: user.user_metadata?.full_name ?? user.email ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    setSessionPin(pin);
    router.push("/list");
  };

  if (checking) {
    return (
      <main className="fridge-wrap flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-muted"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            Setting things up...
          </motion.div>
        </motion.div>
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
              Fridgeboard
            </p>
            <div className="space-y-2">
              <h1 className="text-4xl text-balance text-foreground sm:text-5xl">
                Link your household
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-6 text-muted sm:text-base">
                Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}! Enter the 4-digit PIN your household uses to sync lists and calendar.
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block space-y-3">
              <span className="text-sm font-semibold text-foreground">Household PIN</span>
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
              className="w-full rounded-[1.4rem] bg-foreground px-5 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#2f241b] focus:outline-none focus:ring-4 focus:ring-amber/25 disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {loading ? "Linking..." : "Link & open the fridge"}
            </motion.button>
          </form>

          <p className="text-center text-xs uppercase tracking-[0.24em] text-muted/80">
            Your Google account will remember this PIN
          </p>
        </div>
      </motion.section>
    </main>
  );
}
