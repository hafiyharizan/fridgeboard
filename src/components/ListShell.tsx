"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
    return (
      <main className="fridge-wrap">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fridge-card mx-auto flex min-h-[75vh] w-full max-w-2xl items-center justify-center px-6 py-10 text-muted"
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            Warming up your lists...
          </motion.div>
        </motion.div>
      </main>
    );
  }

  if (error || !lists.length) {
    return (
      <main className="fridge-wrap">
        <section className="fridge-card mx-auto flex min-h-[75vh] w-full max-w-2xl flex-col items-center justify-center gap-5 px-6 py-10 text-center">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
              Fridgeboard
            </p>
            <h1 className="text-4xl text-foreground">
              Something needs a quick fix.
            </h1>
            <p className="mx-auto max-w-md text-sm leading-6 text-muted sm:text-base">
              {error || "We could not load your shared lists right now."}
            </p>
          </div>
          <motion.button
            whileHover={{
              scale: 1.02,
              boxShadow: "0 8px 24px rgba(60, 40, 20, 0.16)",
            }}
            whileTap={{ scale: 0.98 }}
            className="cursor-pointer rounded-full bg-foreground px-5 py-3 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-[#2f241b]"
            onClick={handleResetPin}
            type="button"
          >
            Back to sign in
          </motion.button>
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
