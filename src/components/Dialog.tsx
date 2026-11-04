"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Native <dialog> with the shared modal look. Children supply `.modal-body`
 * and an optional `.modal-footer`.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className="workspace-dialog modal"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <div className="min-w-0">
          <h2 className="modal-title">{title}</h2>
          {description ? <p className="modal-desc">{description}</p> : null}
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close dialog" type="button">
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
