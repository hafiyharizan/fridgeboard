"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export function AuthLogo({ size = 56 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Fridgeboard"
      width={size}
      height={size}
      className="auth-logo"
      preload
      draggable={false}
    />
  );
}

/** Centred status screen used while sessions and households load. */
export function AuthLoading({ message }: { message: string }) {
  return (
    <main className="auth-wrap">
      <motion.div
        className="auth-loading"
        role="status"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <AuthLogo size={48} />
        <p>
          <Loader2 size={15} className="animate-spin" aria-hidden />
          {message}
        </p>
      </motion.div>
    </main>
  );
}
