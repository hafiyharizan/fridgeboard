"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { useHousehold } from "@/components/WorkspaceData";
import { COLOR_ORDER, PERSON_COLORS, useEveryone, type MemberLook } from "@/components/MemberTag";
import type { PersonColor } from "@/lib/types";

function PersonChip({ look, you }: { look: MemberLook; you?: boolean }) {
  return (
    <span className="person-chip" style={{ background: look.tint, color: look.ink, borderColor: look.ink }}>
      <span className="person-dot" aria-hidden style={{ background: look.ink }} />
      <span className="person-chip-name">{look.name}</span>
      {you && <span className="person-you">you</span>}
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

/**
 * "People" in the household dialog: everyone the household plans around.
 * Account members are listed automatically (they can change colour, but
 * leave the household by other means); people without an account, such as
 * kids, can be added and removed here.
 */
export function HouseholdPeople() {
  const { userId, addPerson, setPersonColor, removePerson } = useHousehold();
  const everyone = useEveryone();
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
      <h3>People</h3>
      <p>Everyone you plan around, including kids. Tag events with who they&apos;re for.</p>
      <ul className="people-list">
        {everyone.map((entry) => (
          <li key={entry.key} className="people-row">
            <PersonChip look={entry.look} you={entry.userId === userId} />
            <ColorPicker
              value={entry.look.color}
              label={`Colour for ${entry.look.name}`}
              onChange={async (next) =>
                report(
                  await setPersonColor(
                    entry.personId
                      ? { personId: entry.personId }
                      : { userId: entry.userId ?? "", name: entry.look.name },
                    next,
                  ),
                )
              }
            />
            {entry.personId ? (
              <button
                type="button"
                className="icon-button people-remove"
                aria-label={`Remove ${entry.look.name}`}
                onClick={async () => report(await removePerson(entry.personId ?? ""))}
              >
                <X size={18} />
              </button>
            ) : (
              <span className="people-remove" aria-hidden />
            )}
          </li>
        ))}
      </ul>
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
      {error && (
        <p className="data-status error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
