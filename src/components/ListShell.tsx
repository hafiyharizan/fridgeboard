"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { AuthLoading } from "@/components/AuthScreen";
import { WorkspaceData } from "@/components/WorkspaceData";
import { HouseholdWorkspace } from "@/components/HouseholdWorkspace";
import { clearSessionPin, setSessionPin } from "@/lib/auth";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { FridgeList } from "@/lib/types";
import { ensureUserProfile, getUserDisplayName } from "@/lib/user-profile";

export function ListShell() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [lists, setLists] = useState<FridgeList[]>([]);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authUser, setAuthUser] = useState<{
    name: string;
    avatar: string | null;
  } | null>(null);

  useEffect(() => {
    const loadLists = async (pinCode: string) => {
      const { data, error: fetchError } = await supabase
        .from("lists")
        .select("*")
        .eq("pin_code", pinCode)
        .order("created_at", { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      const typedLists = (data ?? []) as FridgeList[];

      if (!typedLists.length) {
        setError(
          "Your household lists could not be found. Please sign in again.",
        );
        setLoading(false);
        return;
      }

      setLists(typedLists);
      setLoading(false);
    };

    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          clearSessionPin();
          router.replace("/");
          return;
        }

        const profile = await ensureUserProfile(supabase, user);
        setAuthUser({
          name: getUserDisplayName(user, profile),
          avatar: profile.avatar_url,
        });

        if (!profile.pin_code) {
          clearSessionPin();
          router.replace("/setup-household");
          return;
        }

        setPin(profile.pin_code);
        setSessionPin(profile.pin_code);
        await loadLists(profile.pin_code);
      } catch (initError) {
        setError(
          initError instanceof Error
            ? initError.message
            : "Could not load your account.",
        );
        setLoading(false);
      }
    };

    void init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setLists([]);
        setPin("");
        clearSessionPin();
        router.replace("/");
      }
    });
    return () => subscription.unsubscribe();
  }, [router, supabase]);

  const handleResetPin = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) throw signOutError;
    clearSessionPin();
    router.replace("/");
  };

  if (loading) {
    return <AuthLoading message="Loading your household…" />;
  }

  if (error || !lists.length) {
    return (
      <main className="auth-wrap">
        <section className="auth-card" role="alert">
          <div className="auth-head">
            <span className="empty-state-icon auth-error-icon">
              <AlertTriangle size={18} />
            </span>
            <h1 className="auth-title">Couldn&apos;t open your household</h1>
            <p className="auth-desc">{error || "Your shared lists didn't load."}</p>
          </div>
          <div className="grid gap-2">
            <button className="btn btn-primary btn-lg btn-block" onClick={() => window.location.reload()} type="button">
              <RefreshCw size={16} /> Try again
            </button>
            <button className="btn btn-ghost btn-block" onClick={handleResetPin} type="button">
              Back to sign in
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <WorkspaceData key={pin} pin={pin} lists={lists}>
      <HouseholdWorkspace
        lists={lists}
        name={authUser?.name ?? "Household member"}
        onSignOut={handleResetPin}
      />
    </WorkspaceData>
  );
}
