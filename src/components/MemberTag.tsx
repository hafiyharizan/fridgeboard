"use client";

import { useMemo } from "react";
import { useHousehold } from "@/components/WorkspaceData";
import { shortName } from "@/lib/new-item-push";
import type { HouseholdMember, HouseholdPerson, PersonColor } from "@/lib/types";

/**
 * Person colours. `tint` fills chips and avatars, `ink` is their text and
 * dot, `swatch` is the unselected picker dot. Pastel fills with dark ink stay
 * readable in both themes.
 */
export const PERSON_COLORS: Record<PersonColor, { label: string; tint: string; ink: string; swatch: string }> = {
  sage: { label: "Sage", tint: "#dcebdf", ink: "#2f5a3a", swatch: "#b4c4b6" },
  clay: { label: "Clay", tint: "#fbe3cc", ink: "#9a4a1c", swatch: "#dcc3b0" },
  blue: { label: "Blue", tint: "#dde8f6", ink: "#2f5a8a", swatch: "#b8c8dc" },
  lilac: { label: "Lilac", tint: "#ebe4f3", ink: "#5c4a8a", swatch: "#cdc3e0" },
  sand: { label: "Sand", tint: "#efe9d6", ink: "#6d6235", swatch: "#d3cbb0" },
  rose: { label: "Rose", tint: "#f6e0e4", ink: "#94485a", swatch: "#e2bcc5" },
};
export const COLOR_ORDER: PersonColor[] = ["sage", "clay", "blue", "lilac", "sand", "rose"];

export function initials(name: string) {
  return name
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export type MemberLook = {
  name: string;
  short: string;
  initials: string;
  color: PersonColor;
  tint: string;
  ink: string;
};

export function lookFor(rawName: string | null | undefined, color: PersonColor): MemberLook {
  const name = rawName?.trim() || "Member";
  return {
    name,
    short: shortName(name),
    initials: initials(name) || "?",
    color,
    tint: PERSON_COLORS[color].tint,
    ink: PERSON_COLORS[color].ink,
  };
}

/**
 * One person the household plans around: an account member (userId set) or
 * someone without an account (personId set, e.g. a child). `key` is unique
 * across both: the user id, or "p:" + the person id.
 */
export type PersonEntry = {
  key: string;
  userId: string | null;
  personId: string | null;
  /** household_people row holding this person's colour, if any. */
  row: HouseholdPerson | null;
  look: MemberLook;
};

export function personKey(userId: string | null | undefined, personId: string | null | undefined) {
  return userId ? userId : personId ? `p:${personId}` : null;
}

/** Accounts first (join order), then people without an account. */
export function buildEveryone(members: HouseholdMember[], people: HouseholdPerson[]): PersonEntry[] {
  // Members who haven't picked a colour get the next one nobody has chosen.
  const chosen = new Set(people.map((person) => person.color));
  const spare = COLOR_ORDER.filter((color) => !chosen.has(color));
  let nextSpare = 0;
  const accounts = members.map((member, index): PersonEntry => {
    const row = people.find((person) => person.user_id === member.user_id) ?? null;
    const color =
      row?.color ?? (spare.length ? spare[nextSpare++ % spare.length] : COLOR_ORDER[index % COLOR_ORDER.length]);
    return { key: member.user_id, userId: member.user_id, personId: null, row, look: lookFor(member.display_name, color) };
  });
  const others = people
    .filter((person) => !person.user_id)
    .map((person): PersonEntry => ({
      key: `p:${person.id}`,
      userId: null,
      personId: person.id,
      row: person,
      look: lookFor(person.name, person.color),
    }));
  return [...accounts, ...others];
}

/** Everyone in the household, with names and colours. */
export function useEveryone() {
  const { members, people } = useHousehold();
  return useMemo(() => buildEveryone(members, people), [members, people]);
}

/** Account members only, aligned with `members` (work roster, "who's adding?"). */
export function useAccountLooks(): MemberLook[] {
  const everyone = useEveryone();
  return everyone.filter((entry) => entry.userId).map((entry) => entry.look);
}

/** Looks up a person's name and colour by user id or person id. */
export function useMemberLookup() {
  const everyone = useEveryone();
  return (userId: string | null | undefined, personId?: string | null): MemberLook | undefined => {
    const key = personKey(userId, personId);
    return key ? everyone.find((entry) => entry.key === key)?.look : undefined;
  };
}

export function MemberAvatar({ look, size = "md" }: { look: MemberLook; size?: "sm" | "md" }) {
  return (
    <span
      className={`member-avatar${size === "sm" ? " is-small" : ""}`}
      aria-hidden
      style={{ background: look.tint, color: look.ink }}
    >
      {look.initials}
    </span>
  );
}

/**
 * Small owner tag ("HH Hafiy"). Hidden when only one person is set up,
 * where everything is theirs anyway, and for unknown or missing owners.
 */
export function MemberTag({
  userId,
  personId,
  label,
  className = "",
}: {
  userId: string | null | undefined;
  personId?: string | null;
  /** Screen-reader prefix, e.g. "Added by" or "For". */
  label: string;
  className?: string;
}) {
  const everyone = useEveryone();
  const key = personKey(userId, personId);
  const look = key ? everyone.find((entry) => entry.key === key)?.look : undefined;
  if (!look || everyone.length < 2) return null;
  return (
    <span className={`member-tag ${className}`} title={`${label} ${look.name}`}>
      <MemberAvatar look={look} size="sm" />
      <span className="sr-only">{label} </span>
      {look.short}
    </span>
  );
}
