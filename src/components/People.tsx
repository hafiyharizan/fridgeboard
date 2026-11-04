"use client";

import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { usePeople } from "@/components/WorkspaceData";
import type { CalendarEvent, HouseholdPerson, PersonColor } from "@/lib/types";

export const PERSON_COLORS: { value: PersonColor; label: string }[] = [
  { value: "sage", label: "Sage" },
  { value: "peach", label: "Peach" },
  { value: "sky", label: "Sky" },
  { value: "lilac", label: "Lilac" },
  { value: "sand", label: "Sand" },
  { value: "rose", label: "Rose" },
];

/** People an event is tagged with, in crew order (unknown ids are skipped). */
export function eventPeople(
  event: Pick<CalendarEvent, "person_ids">,
  byId: Map<string, HouseholdPerson>,
) {
  return (event.person_ids ?? [])
    .map((id) => byId.get(id))
    .filter((person): person is HouseholdPerson => Boolean(person))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Coloured name pill. Untagged household events read as "Family". */
export function EventTags({ event, max = 2 }: { event: CalendarEvent; max?: number }) {
  const { byId, available } = usePeople();
  if (event.source_type && event.source_type !== "manual") return <span className="person-tag person-sand">Holiday</span>;
  if (!available) return null;
  const people = eventPeople(event, byId);
  if (!people.length) return <span className="person-tag person-sage">Family</span>;
  return (
    <>
      {people.slice(0, max).map((person) => (
        <span key={person.id} className={`person-tag person-${person.color}`}>
          {person.name}
        </span>
      ))}
      {people.length > max && <span className="person-tag person-sage">+{people.length - max}</span>}
    </>
  );
}

/** Toggle chips for choosing who an event is for. */
export function PersonPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { people, available } = usePeople();
  if (!available || !people.length) return null;
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]);
  return (
    <div className="space-y-2">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-muted">
        Who&apos;s it for <span className="normal-case tracking-normal font-normal">(none = whole family)</span>
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Who it's for">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            aria-pressed={value.includes(person.id)}
            className={`crew-chip person-${person.color}`}
            onClick={() => toggle(person.id)}
          >
            <span className="crew-dot" aria-hidden />
            {person.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Household settings section: add, recolour and remove crew members. */
export function PeopleSettings() {
  const { people, available, loading, error, busy, addPerson, removePerson, recolorPerson } = usePeople();
  const [name, setName] = useState("");
  const [color, setColor] = useState<PersonColor>("peach");

  if (!available) {
    return (
      <section className="people-settings">
        <h3>People</h3>
        <p>
          Tag events with who they&apos;re for. To turn this on, run the latest database migration
          (household_people) in Supabase.
        </p>
      </section>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await addPerson(name, color)) {
      setName("");
      const used = new Set([...people.map((person) => person.color), color]);
      setColor(PERSON_COLORS.find((option) => !used.has(option.value))?.value ?? "sage");
    }
  };

  return (
    <section className="people-settings">
      <h3>People</h3>
      <p>Everyone you plan around, including kids. Tag events with who they&apos;re for.</p>
      {loading ? null : people.length ? (
        <ul className="people-list">
          {people.map((person) => (
            <li key={person.id}>
              <span className={`crew-chip person-${person.color}`} aria-pressed="true">
                <span className="crew-dot" aria-hidden />
                {person.name}
              </span>
              <div className="people-swatches" role="group" aria-label={`Colour for ${person.name}`}>
                {PERSON_COLORS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-label={option.label}
                    aria-pressed={person.color === option.value}
                    className={`people-swatch person-${option.value}`}
                    disabled={busy}
                    onClick={() => void recolorPerson(person.id, option.value)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="icon-button people-remove"
                aria-label={`Remove ${person.name}`}
                disabled={busy}
                onClick={() => void removePerson(person.id)}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="people-empty">No one added yet.</p>
      )}
      {people.length < 12 && (
        <form className="people-add" onSubmit={submit}>
          <input
            aria-label="Name"
            maxLength={40}
            placeholder="Name, e.g. Nayla"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="people-swatches" role="group" aria-label="Colour">
            {PERSON_COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={color === option.value}
                className={`people-swatch person-${option.value}`}
                onClick={() => setColor(option.value)}
              />
            ))}
          </div>
          <button className="primary-button" disabled={busy || !name.trim()} type="submit">
            <Plus size={16} /> Add
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
