"use client";

import { FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
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
  const listboxId = useId();

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
        <span className="menu-match">
          {text.slice(idx, idx + q.length)}
        </span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div className="composer" ref={wrapperRef}>
      <form className="composer-form" onSubmit={handleSubmit}>
        <div className="composer-field">
          <Plus size={17} className="composer-icon" aria-hidden />
          <input
            id={inputId}
            aria-label={buttonLabel}
            aria-autocomplete="list"
            aria-expanded={showDropdown}
            aria-controls={showDropdown ? listboxId : undefined}
            aria-activedescendant={
              showDropdown && selectedIndex >= 0 ? `${listboxId}-${selectedIndex}` : undefined
            }
            role="combobox"
            autoComplete="off"
            disabled={busy}
            className="input composer-input"
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
        </div>
        <button className="btn btn-primary composer-submit" disabled={busy || !value.trim()} type="submit">
          {buttonLabel}
        </button>
      </form>

      <AnimatePresence>
        {showDropdown ? (
          <motion.ul
            id={listboxId}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="menu composer-menu"
          >
            {matches.map((match, i) => (
              <li
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={i === selectedIndex}
                className="menu-item"
                key={match}
                onMouseDown={(e) => {
                  e.preventDefault();
                  void submit(match);
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <Plus size={14} className="menu-item-icon" aria-hidden />
                <span className="truncate">{highlightMatch(match)}</span>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
