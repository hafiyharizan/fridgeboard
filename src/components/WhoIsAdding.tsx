"use client";

import { motion } from "framer-motion";
import { useHousehold } from "@/components/WorkspaceData";
import { MemberAvatar, useAccountLooks } from "@/components/MemberTag";

/**
 * Kitchen display only: pick who is typing, so items (and the alerts other
 * members get) are credited to the right person rather than to whoever the
 * tablet is signed in as. Resets to the account on the idle reset.
 */
export function WhoIsAdding() {
  const { members, userId, adderId, setAdderId } = useHousehold();
  const looks = useAccountLooks();
  if (members.length < 2) return null;
  const current = adderId ?? userId;
  return (
    <div className="who-adding" role="radiogroup" aria-label="Who's adding?">
      <span className="eyebrow">Who&apos;s adding?</span>
      <div className="who-adding-row">
        {members.map((member, index) => {
          const look = looks[index];
          const selected = member.user_id === current;
          return (
            <motion.button
              key={member.user_id}
              type="button"
              role="radio"
              aria-checked={selected}
              whileTap={{ scale: 0.96 }}
              className="member-chip"
              onClick={() => setAdderId(member.user_id === userId ? null : member.user_id)}
            >
              <MemberAvatar look={look} />
              {look.short}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
