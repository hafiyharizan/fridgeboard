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

type Pending = { userId: string; action: "remove" | "step-down" };

/**
 * Household dialog: "Members" lists everyone who signed up and joined;
 * "Without an account" lists babies and kids so events can be tagged for
 * them. Admins (there can be several) add and remove people, make or remove
 * admins, and can take a member out of the household. Members can change
 * their own colour, admins anyone's. The database enforces all of this.
 */
export function HouseholdPeople() {
  const { members, userId, addPerson, setPersonColor, removePerson, setAdmin, removeMember } = useHousehold();
  const everyone = useEveryone();
  const isAdmin = members.some((member) => member.user_id === userId && member.is_admin);
  const admins = members.filter((member) => member.is_admin);
  const accounts = everyone.filter((entry) => entry.userId);
  const others = everyone.filter((entry) => entry.personId);
  const used = new Set(everyone.map((entry) => entry.look.color));
  const [name, setName] = useState("");
  const [color, setColor] = useState<PersonColor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Destructive member actions ask first.
  const [pending, setPending] = useState<Pending | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const newColor = color ?? COLOR_ORDER.find((c) => !used.has(c)) ?? "sage";

  const report = (message: string | null) => setError(message ? "Couldn't save that. Please try again." : "");
  // Admin actions raise readable messages ("A household needs at least one admin…").
  const reportAction = (message: string | null) =>
    setError(message ? (/^(A household|You can|Only a household|That person)/.test(message) ? message : "Couldn't save that. Please try again.") : "");

  const run = async (member: string, action: () => Promise<string | null>) => {
    if (working) return;
    setWorking(member);
    const message = await action();
    setWorking(null);
    setPending(null);
    reportAction(message);
  };

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
          const memberId = entry.userId ?? "";
          const you = memberId === userId;
          const memberIsAdmin = Boolean(member?.is_admin);
          const joined = joinedLabel(member?.joined_at);
          const confirming = pending?.userId === memberId ? pending : null;
          const busyHere = working === memberId;
          // The last admin can't step down; the database checks this too.
          const canStepDown = you && memberIsAdmin && admins.length > 1;
          return (
            <li key={entry.key} className={`people-row is-member${confirming ? " is-confirming" : ""}`}>
              <MemberAvatar look={entry.look} />
              <span className="people-member">
                <strong className="people-name">{entry.look.name}</strong>
                <span className="people-meta">
                  {memberIsAdmin && <span className="people-badge is-admin">Admin</span>}
                  {you && <span className="people-badge">You</span>}
                  {joined && <span>{joined}</span>}
                </span>
                {isAdmin && !confirming && (!you || canStepDown) && (
                  <span className="people-actions">
                    {!you && (
                      <button
                        type="button"
                        className="text-button"
                        disabled={busyHere}
                        onClick={() => void run(memberId, () => setAdmin(memberId, !memberIsAdmin))}
                      >
                        {memberIsAdmin ? "Remove admin" : "Make admin"}
                      </button>
                    )}
                    {canStepDown && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setPending({ userId: memberId, action: "step-down" })}
                      >
                        Stop being admin
                      </button>
                    )}
                    {!you && (
                      <button
                        type="button"
                        className="text-button is-danger"
                        onClick={() => setPending({ userId: memberId, action: "remove" })}
                      >
                        Remove
                      </button>
                    )}
                  </span>
                )}
              </span>
              {(you || isAdmin) && (
                <ColorPicker
                  value={entry.look.color}
                  label={`Colour for ${entry.look.name}`}
                  onChange={async (next) =>
                    report(await setPersonColor({ userId: memberId, name: entry.look.name }, next))
                  }
                />
              )}
              {confirming && (
                <div
                  className="people-confirm"
                  role="group"
                  aria-label={confirming.action === "remove" ? `Remove ${entry.look.name}` : "Stop being admin"}
                >
                  {confirming.action === "remove" ? (
                    <p>
                      Remove <strong>{entry.look.name}</strong> from the household? They&apos;ll lose access to your
                      lists and calendar, and their work roster is cleared. They can rejoin with a new invite code.
                    </p>
                  ) : (
                    <p>
                      Stop being an admin? You won&apos;t be able to manage members or people without an account
                      until another admin makes you admin again.
                    </p>
                  )}
                  <div className="people-confirm-actions">
                    <button type="button" className="secondary-button" onClick={() => setPending(null)}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`primary-button${confirming.action === "remove" ? " is-danger" : ""}`}
                      disabled={busyHere}
                      onClick={() =>
                        void run(memberId, () =>
                          confirming.action === "remove" ? removeMember(memberId) : setAdmin(memberId, false),
                        )
                      }
                    >
                      {busyHere ? "Saving…" : confirming.action === "remove" ? "Remove" : "Stop being admin"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h4 className="people-subhead">Without an account</h4>
      <p>
        Babies and kids who can&apos;t sign up. Tag events with who they&apos;re for.
        {!isAdmin && admins.length > 0 && (
          <>
            {" "}
            Ask {admins.length === 1 ? admins[0].display_name || "the admin" : "an admin"} to add someone.
          </>
        )}
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
