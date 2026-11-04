"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useModalSurface } from "@/hooks/useModalSurface";

/**
 * Shared overlay + panel + header for the app's animated dialogs.
 * Children supply `.modal-body` and an optional `.modal-footer`.
 * `sheet` turns it into a bottom sheet on phones.
 */
export function ModalFrame({
  label,
  title,
  description,
  leading,
  onClose,
  size = "md",
  sheet = false,
  children,
}: {
  label: string;
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  onClose: () => void;
  size?: "md" | "lg";
  sheet?: boolean;
  children: ReactNode;
}) {
  const modalRef = useModalSurface(onClose);
  return (
    <motion.div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      className={`overlay${sheet ? " overlay-sheet" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onClose}
    >
      <motion.div
        className={`modal${size === "lg" ? " modal-lg" : ""}`}
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.985 }}
        transition={{ type: "spring", stiffness: 520, damping: 38 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div className="flex min-w-0 items-start gap-3">
            {leading}
            <div className="min-w-0">
              <h2 className="modal-title">{title}</h2>
              {description ? <p className="modal-desc">{description}</p> : null}
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} type="button" aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}
