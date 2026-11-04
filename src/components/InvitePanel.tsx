"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [loading, setLoading] = useState(true);
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
    let mounted = true;
    void createHouseholdInvite(supabase).then((next) => {
      if (mounted) setInvite(next);
    }).catch((cause) => {
      if (mounted) setError(cause instanceof Error ? cause.message : "Could not create an invite.");
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [supabase]);

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
    <div className="invite">
      <div className="invite-code" aria-live="polite">
        {loading && !invite ? (
          <span className="skeleton invite-skeleton" aria-label="Creating invite code" />
        ) : (
          <p className="invite-code-value tabular">{displayCode || "—"}</p>
        )}
        {invite ? (
          <p className="invite-code-meta">Expires {formatExpiry(invite.expiresAt)}</p>
        ) : null}
      </div>

      <div className="invite-actions">
        {canShare ? (
          <button
            className="btn btn-primary flex-1"
            disabled={!invite || loading}
            onClick={handleShare}
            type="button"
          >
            <Share2 size={15} /> Share invite
          </button>
        ) : null}
        <button
          className={`btn ${canShare ? "btn-secondary" : "btn-primary flex-1"}`}
          disabled={!invite || loading}
          onClick={handleCopy}
          type="button"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy code"}
        </button>
        <button
          className="btn btn-ghost"
          disabled={loading}
          onClick={() => void generate()}
          aria-label="Make a new code"
          title="Make a new code"
          type="button"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : undefined} />
          <span className="hide-on-phone">New code</span>
        </button>
      </div>

      {error ? (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
