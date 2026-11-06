"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { useHousehold } from "@/components/WorkspaceData";
import { COLOR_ORDER, MemberAvatar, PERSON_COLORS, useEveryone, type MemberLook } from "@/components/MemberTag";
import type { PersonColor } from "@/lib/types";

function PersonChip({ look }: { look: MemberLook }) {
  return (
    <span className="person-chip" style={{ background: look.tint, color: look.ink, borderColor: look.ink }}>
      <span className="person-dot" aria-hidden style={{ background: look.ink }} />
      <span className="person-chip-name">{look.name}</span>
    </span>
  );
}

function ColorPicker({
  value,
  label,
  onChange,
}: {
  value: PersonColor;
  label: string;
  onChange: (color: PersonColor) => void;
}) {
  return (
    <div className="color-picker" role="radiogroup" aria-label={label}>
      {COLOR_ORDER.map((color) => {
        const selected = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={PERSON_COLORS[color].label}
            className="color-swatch"
            onClick={() => onChange(color)}
          >
            <span
              aria-hidden
              style={{
                background: selected ? PERSON_COLORS[color].ink : PERSON_COLORS[color].swatch,
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

function joinedLabel(joinedAt: string | null | undefined) {
  if (!joinedAt) return null;
  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Joined ${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
}

/**
 * Household dialog: "Members" lists everyone who signed up and joined;
 * "Without an account" lists babies and kids the admin added so events can
 * be tagged for them. Only the admin (who created the household) adds or
 * removes people; members can change their own colour, the admin anyone's.
 */
export function HouseholdPeople() {
  const { members, userId, addPerson, setPersonColor, removePerson } = useHousehold();
  const everyone = useEveryone();
  const isAdmin = members.some((member) => member.user_id === userId && member.is_admin);
  const admin = members.find((member) => member.is_admin);
  const accounts = everyone.filter((entry) => entry.userId);
  const others = everyone.filter((entry) => entry.personId);
  const used = new Set(everyone.map((entry) => entry.look.color));
  const [name, setName] = useState("");
  const [color, setColor] = useState<PersonColor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const newColor = color ?? COLOR_ORDER.find((c) => !used.has(c)) ?? "sage";

  const report = (message: string | null) => setError(message ? "Couldn't save that. Please try again." : "");

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const message = await addPerson(trimmed, newColor);
    setBusy(false);
    report(message);
    if (!message) {
      setName("");
      setColor(null);
    }
  };

  return (
    <section className="household-sharing people-settings">
      <h3>Members</h3>
      <p>Everyone who has signed in and joined this household.</p>
      <ul className="people-list">
        {accounts.map((entry) => {
          const member = members.find((m) => m.user_id === entry.userId);
          const you = entry.userId === userId;
          const joined = joinedLabel(member?.joined_at);
          return (
            <li key={entry.key} className="people-row is-member">
              <MemberAvatar look={entry.look} />
              <span className="people-member">
                <strong className="people-name">{entry.look.name}</strong>
                <span className="people-meta">
                  {member?.is_admin && <span className="people-badge is-admin">Admin</span>}
                  {you && <span className="people-badge">You</span>}
                  {joined && <span>{joined}</span>}
                </span>
              </span>
              {(you || isAdmin) && (
                <ColorPicker
                  value={entry.look.color}
                  label={`Colour for ${entry.look.name}`}
                  onChange={async (next) =>
                    report(await setPersonColor({ userId: entry.userId ?? "", name: entry.look.name }, next))
                  }
                />
              )}
            </li>
          );
        })}
      </ul>

      <h4 className="people-subhead">Without an account</h4>
      <p>
        Babies and kids who can&apos;t sign up. Tag events with who they&apos;re for.
        {!isAdmin && admin && <> Ask {admin.display_name || "the admin"} to add someone.</>}
      </p>
      {others.length > 0 ? (
        <ul className="people-list">
          {others.map((entry) => (
            <li key={entry.key} className="people-row">
              <PersonChip look={entry.look} />
              {isAdmin && (
                <>
                  <ColorPicker
                    value={entry.look.color}
                    label={`Colour for ${entry.look.name}`}
                    onChange={async (next) => report(await setPersonColor({ personId: entry.personId ?? "" }, next))}
                  />
                  <button
                    type="button"
                    className="icon-button people-remove"
                    aria-label={`Remove ${entry.look.name}`}
                    onClick={async () => report(await removePerson(entry.personId ?? ""))}
                  >
                    <X size={18} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !isAdmin && <p className="people-empty">No one added yet.</p>
      )}
      {isAdmin && (
        <form className="people-add" onSubmit={add}>
          <div className="people-add-row">
            <input
              aria-label="Name"
              placeholder="Name, e.g. Nayla"
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <ColorPicker value={newColor} label="Colour for the new person" onChange={setColor} />
          </div>
          <button className="text-button people-add-button" type="submit" disabled={!name.trim() || busy}>
            <Plus size={18} aria-hidden /> {busy ? "Adding…" : "Add"}
          </button>
        </form>
      )}
      {error && (
        <p className="data-status error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
