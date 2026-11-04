"use client";

import { useHousehold } from "@/components/WorkspaceData";
import { shortName } from "@/lib/new-item-push";
import type { HouseholdMember } from "@/lib/types";

/** Avatar tints, one per member in join order. Readable on light and dark. */
export const MEMBER_TINTS = ["#dfe8e1", "#fbe3cc", "#e3e9f4", "#f6e0dc", "#ebe4f3"];

export function initials(name: string) {
  return name
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export type MemberLook = { name: string; short: string; initials: string; tint: string };

export function memberLook(member: HouseholdMember, index: number): MemberLook {
  const name = member.display_name || "Member";
  return {
    name,
    short: shortName(name),
    initials: initials(name) || "?",
    tint: MEMBER_TINTS[index % MEMBER_TINTS.length],
  };
}

/** Looks up a member's name and colour by user id (undefined if unknown). */
export function useMemberLookup() {
  const { members } = useHousehold();
  return (userId: string | null | undefined): MemberLook | undefined => {
    if (!userId) return undefined;
    const index = members.findIndex((member) => member.user_id === userId);
    return index < 0 ? undefined : memberLook(members[index], index);
  };
}

export function MemberAvatar({ look, size = "md" }: { look: MemberLook; size?: "sm" | "md" }) {
  return (
    <span
      className={`member-avatar${size === "sm" ? " is-small" : ""}`}
      aria-hidden
      style={{ background: look.tint }}
    >
      {look.initials}
    </span>
  );
}

/**
 * Small owner tag ("HH Hafiy"). Hidden in a one-person household, where
 * everything is theirs anyway, and for unknown or missing owners.
 */
export function MemberTag({
  userId,
  label,
  className = "",
}: {
  userId: string | null | undefined;
  /** Screen-reader prefix, e.g. "Added by" or "For". */
  label: string;
  className?: string;
}) {
  const { members } = useHousehold();
  const look = useMemberLookup()(userId);
  if (!look || members.length < 2) return null;
  return (
    <span className={`member-tag ${className}`} title={`${label} ${look.name}`}>
      <MemberAvatar look={look} size="sm" />
      <span className="sr-only">{label} </span>
      {look.short}
    </span>
  );
}
