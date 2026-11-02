"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { clearSessionPin, setSessionPin } from "@/lib/auth";
import { InvitePanel } from "@/components/InvitePanel";
import { createHousehold, joinHouseholdWithInvite } from "@/lib/household";
import { formatInviteCode, isValidInviteCode } from "@/lib/invite-code";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { ensureUserProfile, getUserDisplayName } from "@/lib/user-profile";

type SetupMode = "choice" | "create" | "created" | "join";

export function HouseholdSetup() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<SetupMode>("choice");
  const [inviteCode, setInviteCode] = useState("");
  const [createdPin, setCreatedPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        clearSessionPin();
        router.replace("/");
        return;
      }

      setUser(authUser);

      try {
        const profile = await ensureUserProfile(supabase, authUser);

        if (profile.pin_code) {
          setSessionPin(profile.pin_code);
          router.replace("/list");
          return;
        }
      } catch (profileError) {
        setError(profileError instanceof Error ? profileError.message : "Could not load your account.");
      } finally {
        setChecking(false);
      }
    };

    void checkAuth();
  }, [router, supabase]);

  const welcomeName = user ? getUserDisplayName(user) : "there";

  const handleCreateHousehold = async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const nextPin = await createHousehold(supabase, user);
      setCreatedPin(nextPin);
      setMode("created");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create a household.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinHousehold = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) return;

    if (!isValidInviteCode(inviteCode)) {
      setError("Enter the 8-character invite code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const joinedPin = await joinHouseholdWithInvite(supabase, user, inviteCode);
      setSessionPin(joinedPin);
      router.push("/list");
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join that household.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    clearSessionPin();
    await supabase.auth.signOut();
    router.replace("/");
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
              Step 2 · Household access
            </p>
            <div className="space-y-2">
              <h1 className="text-4xl text-balance text-foreground sm:text-5xl">
                Set up your household
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-6 text-muted sm:text-base">
                You&apos;re signed in, {welcomeName}. Now create a household, or join one with an invite code from a family member.
              </p>
            </div>
          </div>

          {mode === "choice" ? (
            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-[1.4rem] bg-foreground px-5 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#2f241b] focus:outline-none focus:ring-4 focus:ring-amber/25 disabled:opacity-50"
                disabled={loading}
                onClick={() => {
                  setError("");
                  setMode("create");
                }}
                type="button"
              >
                Create a new household
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-[1.4rem] border border-border bg-white/90 px-5 py-4 text-base font-bold text-foreground shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber/25"
                onClick={() => {
                  setError("");
                  setMode("join");
                }}
                type="button"
              >
                Join an existing household
              </motion.button>
            </div>
          ) : null}

          {mode === "create" ? (
            <div className="space-y-5 text-center">
              <div className="space-y-2">
                <h2 className="text-2xl text-foreground">Create a new household</h2>
                <p className="text-sm leading-6 text-muted">
                  We&apos;ll set up Grocery and To-Do for you. Then you can invite the rest of the family.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-[1.4rem] bg-foreground px-5 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#2f241b] focus:outline-none focus:ring-4 focus:ring-amber/25 disabled:opacity-50"
                disabled={loading}
                onClick={handleCreateHousehold}
                type="button"
              >
                {loading ? "Creating household..." : "Create my household"}
              </motion.button>

              <button
                className="w-full rounded-[1.4rem] border border-border bg-white/90 px-5 py-4 text-sm font-bold text-muted transition-colors hover:bg-white"
                onClick={() => setMode("choice")}
                type="button"
              >
                Back
              </button>
            </div>
          ) : null}

          {mode === "created" ? (
            <div className="space-y-5 text-center">
              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">Household ready</p>
                <p className="text-sm leading-6 text-muted">
                  Share this invite code with a family member. They sign in with Google and enter it to join. Each code works once, so make a new one for each person.
                </p>
              </div>

              <InvitePanel />

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-[1.4rem] bg-foreground px-5 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#2f241b] focus:outline-none focus:ring-4 focus:ring-amber/25"
                onClick={() => {
                  setSessionPin(createdPin);
                  router.push("/list");
                }}
                type="button"
              >
                Open the fridge
              </motion.button>
            </div>
          ) : null}

          {mode === "join" ? (
            <form className="space-y-5" onSubmit={handleJoinHousehold}>
              <label className="block space-y-3">
                <span className="text-sm font-semibold text-foreground">Invite code</span>
                <input
                  autoCapitalize="characters"
                  autoComplete="off"
                  autoCorrect="off"
                  className="w-full rounded-[1.4rem] border border-border bg-white/90 px-5 py-4 text-center font-mono text-2xl tracking-[0.2em] text-foreground outline-none transition placeholder:text-muted/50 focus:border-amber-deep focus:ring-4 focus:ring-amber/25"
                  maxLength={9}
                  onChange={(event) => {
                    setInviteCode(formatInviteCode(event.target.value));
                    setError("");
                  }}
                  placeholder="ABCD-EFGH"
                  spellCheck={false}
                  value={inviteCode}
                />
                <span className="block text-xs text-muted">Ask someone already in the household to tap Invite.</span>
              </label>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full rounded-[1.4rem] bg-foreground px-5 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#2f241b] focus:outline-none focus:ring-4 focus:ring-amber/25 disabled:opacity-50"
                disabled={loading}
                type="submit"
              >
                {loading ? "Joining household..." : "Join household"}
              </motion.button>

              <button
                className="w-full rounded-[1.4rem] border border-border bg-white/90 px-5 py-4 text-sm font-bold text-muted transition-colors hover:bg-white"
                onClick={() => {
                  setInviteCode("");
                  setError("");
                  setMode("choice");
                }}
                type="button"
              >
                Back
              </button>
            </form>
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

          <div className="space-y-3 text-center">
            <button
              className="text-sm font-semibold text-muted transition hover:text-foreground"
              onClick={handleSignOut}
              type="button"
            >
              Sign out
            </button>
            <p className="text-xs uppercase tracking-[0.24em] text-muted/80">
              Invite codes work once and expire after 7 days
            </p>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
