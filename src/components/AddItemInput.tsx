"use client";

import { FormEvent, useState } from "react";

type AddItemInputProps = {
  busy: boolean;
  buttonLabel: string;
  onAdd: (text: string) => Promise<void>;
  placeholder: string;
};

export function AddItemInput({
  busy,
  buttonLabel,
  onAdd,
  placeholder,
}: AddItemInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValue = value.trim();

    if (!nextValue) {
      return;
    }

    await onAdd(nextValue);
    setValue("");
  };

  return (
    <form className="flex gap-3" onSubmit={handleSubmit}>
      <input
        className="min-w-0 flex-1 rounded-[1.2rem] border border-border bg-white px-4 py-3 text-base text-foreground outline-none transition placeholder:text-muted/55 focus:border-amber-deep focus:ring-4 focus:ring-amber/20"
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <button
        className="shrink-0 rounded-[1.2rem] bg-foreground px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#2f241b] disabled:translate-y-0 disabled:opacity-60"
        disabled={busy}
        type="submit"
      >
        {buttonLabel}
      </button>
    </form>
  );
}
