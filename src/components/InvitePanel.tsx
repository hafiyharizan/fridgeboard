"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy, RefreshCw, Share2 } from "lucide-react";
import { createHouseholdInvite, type HouseholdInvite } from "@/lib/household";
import { formatInviteCode } from "@/lib/invite-code";
import { createSupabaseBrowserClient } from "@/lib/supabase";

function formatExpiry(expiresAt: string) {
  return new Date(expiresAt).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Generates a single-use invite code and lets the member copy or share it. */
export function InvitePanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [invite, setInvite] = useState<HouseholdInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    setCopied(false);

    try {
      setInvite(await createHouseholdInvite(supabase));
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "Could not create an invite.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void generate();
  }, [generate]);

  const displayCode = invite ? formatInviteCode(invite.code) : "";
  const shareText = invite
    ? `Join our Fridgeboard household. Sign in at ${window.location.origin} and enter invite code ${displayCode}`
    : "";

  const handleCopy = async () => {
    if (!invite) return;

    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Long-press the code to copy it instead.");
    }
  };

  const handleShare = async () => {
    if (!invite) return;

    try {
      await navigator.share({ title: "Fridgeboard invite", text: shareText });
    } catch {
      // Share sheet dismissed or unsupported; copying still works.
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="space-y-4 text-center">
      <div className="rounded-[1.4rem] border border-border bg-white/90 px-5 py-5 shadow-sm">
        <p className="select-all font-mono text-3xl font-bold tracking-[0.2em] text-foreground sm:text-4xl">
          {loading && !invite ? "····-····" : displayCode || "—"}
        </p>
        {invite ? (
          <p className="mt-2 text-xs text-muted">Works once · expires {formatExpiry(invite.expiresAt)}</p>
        ) : null}
      </div>

      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.98 }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] bg-foreground px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          disabled={!invite || loading}
          onClick={canShare ? handleShare : handleCopy}
          type="button"
        >
          {canShare ? <Share2 className="h-4 w-4" /> : copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {canShare ? "Share" : copied ? "Copied" : "Copy code"}
        </motion.button>

        {canShare ? (
          <motion.button
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center gap-2 rounded-[1.2rem] border border-border bg-white/90 px-4 py-3 text-sm font-bold text-foreground disabled:opacity-50"
            disabled={!invite || loading}
            onClick={handleCopy}
            title="Copy code"
            type="button"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </motion.button>
        ) : null}

        <motion.button
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center justify-center rounded-[1.2rem] border border-border bg-white/90 px-4 py-3 text-muted disabled:opacity-50"
          disabled={loading}
          onClick={() => void generate()}
          title="New code"
          type="button"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </motion.button>
      </div>

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
    </div>
  );
}
