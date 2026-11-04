"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { clearSessionPin, setSessionPin } from "@/lib/auth";
import { ArrowLeft, ChevronRight, Home, KeyRound } from "lucide-react";
import { AuthLoading, AuthLogo } from "@/components/AuthScreen";
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
    return <AuthLoading message="Setting things up…" />;
  }

  const firstName = welcomeName.split(/\s+/)[0];

  return (
    <main className="auth-wrap">
      <motion.section
        className="auth-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth-head">
          <AuthLogo size={80} />
          <p className="auth-step">Step 2 of 2</p>
          <h1 className="auth-title">
            {mode === "created" ? "Your household is ready" : "Set up your household"}
          </h1>
          <p className="auth-desc">
            {mode === "created"
              ? "Invite the rest of the family. Each person signs in with Google and enters a code."
              : `Welcome, ${firstName}. Start a new household, or join one with an invite code.`}
          </p>
        </div>

        {mode === "choice" ? (
          <div className="option-list">
            <button
              disabled={loading}
              onClick={() => {
                setError("");
                setMode("create");
              }}
              type="button"
            >
              <span className="option-icon">
                <Home size={18} />
              </span>
              <span className="option-text">
                <strong>Create a new household</strong>
                <span>Starts with Grocery and To-Do lists.</span>
              </span>
              <ChevronRight size={18} className="option-chevron" />
            </button>
            <button
              onClick={() => {
                setError("");
                setMode("join");
              }}
              type="button"
            >
              <span className="option-icon">
                <KeyRound size={18} />
              </span>
              <span className="option-text">
                <strong>Join with an invite code</strong>
                <span>Get one from someone already in the household.</span>
              </span>
              <ChevronRight size={18} className="option-chevron" />
            </button>
          </div>
        ) : null}

        {mode === "create" ? (
          <div className="grid gap-3">
            <p className="auth-note">
              You&apos;ll get shared Grocery and To-Do lists and a family calendar. You can invite
              people straight after.
            </p>
            <button
              className="btn btn-primary btn-lg btn-block"
              disabled={loading}
              onClick={handleCreateHousehold}
              type="button"
            >
              {loading ? "Creating household…" : "Create household"}
            </button>
            <button className="btn btn-ghost btn-block" onClick={() => setMode("choice")} type="button">
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        ) : null}

        {mode === "created" ? (
          <div className="grid gap-4">
            <InvitePanel />
            <button
              className="btn btn-primary btn-lg btn-block"
              onClick={() => {
                setSessionPin(createdPin);
                router.push("/list");
              }}
              type="button"
            >
              Open Fridgeboard
            </button>
          </div>
        ) : null}

        {mode === "join" ? (
          <form className="grid gap-3" onSubmit={handleJoinHousehold}>
            <div className="field">
              <label className="field-label" htmlFor="invite-code">
                Invite code
              </label>
              <input
                id="invite-code"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                autoFocus
                className="input invite-input tabular"
                maxLength={9}
                onChange={(event) => {
                  setInviteCode(formatInviteCode(event.target.value));
                  setError("");
                }}
                placeholder="ABCD-EFGH"
                spellCheck={false}
                value={inviteCode}
              />
              <span className="field-hint">Codes work once and expire after seven days.</span>
            </div>
            <button
              className="btn btn-primary btn-lg btn-block"
              disabled={loading || !isValidInviteCode(inviteCode)}
              type="submit"
            >
              {loading ? "Joining household…" : "Join household"}
            </button>
            <button
              className="btn btn-ghost btn-block"
              onClick={() => {
                setInviteCode("");
                setError("");
                setMode("choice");
              }}
              type="button"
            >
              <ArrowLeft size={16} /> Back
            </button>
          </form>
        ) : null}

        {error ? (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        ) : null}

        {mode !== "created" ? (
          <div className="auth-foot">
            <span>Signed in as {welcomeName}</span>
            <button className="btn-link btn" onClick={handleSignOut} type="button">
              Sign out
            </button>
          </div>
        ) : null}
      </motion.section>
    </main>
  );
}
