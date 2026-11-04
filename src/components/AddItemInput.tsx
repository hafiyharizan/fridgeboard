"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { autocomplete } from "@/lib/suggestions";

type AddItemInputProps = {
  busy: boolean;
  inputId?: string;
  buttonLabel: string;
  existingItems: string[];
  listName: string;
  onAdd: (text: string) => Promise<boolean>;
  placeholder: string;
};

export function AddItemInput({
  busy,
  inputId,
  buttonLabel,
  existingItems,
  listName,
  onAdd,
  placeholder,
}: AddItemInputProps) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Derive matches — no effect needed
  const matches = useMemo(() => {
    const q = value.trim();
    if (q.length < 1) return [];
    return autocomplete(q, listName, existingItems);
  }, [value, listName, existingItems]);

  const showDropdown = open && matches.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  });

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setOpen(false);
    if (await onAdd(trimmed)) setValue("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedIndex >= 0 && matches[selectedIndex]) {
      await submit(matches[selectedIndex]);
    } else {
      await submit(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || matches.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < matches.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : matches.length - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setSelectedIndex(-1);
    }
  };

  // Highlight matching portion in dropdown
  const highlightMatch = (text: string) => {
    const q = value.trim().toLowerCase();
    const idx = text.toLowerCase().indexOf(q);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="font-bold text-foreground">
          {text.slice(idx, idx + q.length)}
        </span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <form className="flex gap-3" onSubmit={handleSubmit}>
        <input
          id={inputId}
          aria-label={buttonLabel}
          disabled={busy}
          className="min-w-0 flex-1 rounded-2xl border border-border bg-[#f7f5f0] px-4 py-3 text-base text-foreground outline-none placeholder:text-muted/70 focus:border-success focus:bg-white focus:ring-4 focus:ring-success/20"
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (matches.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          value={value}
        />
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="min-h-[52px] shrink-0 cursor-pointer rounded-2xl bg-[#4c6153] px-5 py-3 text-[15px] font-bold text-white hover:bg-[#374b3e] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          {buttonLabel}
        </motion.button>
      </form>

      <AnimatePresence>
        {showDropdown && matches.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 right-16 z-10 mt-2 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_10px_28px_-4px_rgba(43,51,46,0.12)]"
          >
            {matches.map((match, i) => (
              <button
                className={`flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${
                  i === selectedIndex
                    ? "bg-amber/15 text-foreground"
                    : "text-muted hover:bg-amber/8 hover:text-foreground"
                }`}
                key={match}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void submit(match);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                type="button"
              >
                <span className="text-xs text-amber-deep">+</span>
                {highlightMatch(match)}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
