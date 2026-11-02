"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UserPlus, X } from "lucide-react";
import { InvitePanel } from "@/components/InvitePanel";

export function InviteMemberButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <motion.button
        whileHover={{ y: -1, boxShadow: "0 8px 20px rgba(95, 65, 36, 0.08)" }}
        whileTap={{ scale: 0.98 }}
        className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border bg-white/70 p-2.5 text-muted transition-all duration-200 hover:bg-white hover:text-foreground sm:w-fit sm:justify-start sm:px-3 sm:py-2"
        onClick={() => setIsOpen(true)}
        title="Invite someone"
        type="button"
      >
        <UserPlus className="h-3.5 w-3.5" />
        <span className="hidden whitespace-nowrap text-xs font-bold uppercase tracking-[0.18em] sm:inline">
          Invite
        </span>
      </motion.button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 px-0 backdrop-blur-sm sm:items-center sm:px-4"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-md overflow-hidden rounded-t-[1.5rem] border border-white/60 bg-white/95 shadow-[0_24px_64px_rgba(60,40,20,0.15)] backdrop-blur-xl sm:rounded-[1.5rem]"
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(event) => event.stopPropagation()}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-muted" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Invite to household</p>
                    <p className="mt-0.5 text-xs text-muted">They sign in with Google, then enter this code</p>
                  </div>
                </div>
                <button
                  className="rounded-full p-2 text-muted transition hover:bg-foreground/5 hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-5">
                <InvitePanel />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
