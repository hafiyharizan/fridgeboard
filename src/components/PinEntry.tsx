"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const SESSION_PIN_KEY = "fridgeboard-pin";

export function PinEntry() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const savedPin = sessionStorage.getItem(SESSION_PIN_KEY);
    if (savedPin && /^\d{4}$/.test(savedPin)) {
      router.replace("/list");
    }
  }, [router]);

  const digits = useMemo(() => pin.split(""), [pin]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{4}$/.test(pin)) {
      setError("Use the same 4-digit PIN on both phones.");
      return;
    }

    sessionStorage.setItem(SESSION_PIN_KEY, pin);
    router.push("/list");
  };

  return (
    <main className="fridge-wrap flex items-center justify-center">
      <motion.section 
        className="fridge-card relative w-full max-w-md overflow-hidden px-6 py-7 sm:px-8"
        initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div 
          animate={{ y: [0, 20, 0], x: [0, -15, 0], scale: [1, 1.1, 1] }}
          className="absolute -left-10 top-8 h-32 w-32 rounded-full bg-amber/30 blur-3xl" 
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          animate={{ y: [0, -20, 0], x: [0, 20, 0], scale: [1, 1.2, 1] }}
          className="absolute -right-4 top-0 h-36 w-36 rounded-full bg-blue/25 blur-3xl" 
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        <div className="relative flex flex-col gap-8">
          <div className="space-y-3 text-center">
            <p className="inline-flex rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-muted">
              Fridgeboard
            </p>
            <div className="space-y-2">
              <h1 className="text-4xl text-balance text-foreground sm:text-5xl">
                Shared lists that feel like home.
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-6 text-muted sm:text-base">
                Grocery and to-do notes, synced in real time, with one simple PIN you both already know.
              </p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block space-y-3">
              <span className="text-sm font-semibold text-foreground">Enter your shared PIN</span>
              <input
                autoComplete="one-time-code"
                className="w-full rounded-[1.4rem] border border-border bg-white/90 px-5 py-4 text-center text-3xl tracking-[0.45em] text-foreground outline-none transition placeholder:text-muted/50 focus:border-amber-deep focus:ring-4 focus:ring-amber/25"
                inputMode="numeric"
                maxLength={4}
                onChange={(event) => {
                  const nextValue = event.target.value.replace(/\D/g, "").slice(0, 4);
                  setPin(nextValue);
                  setError("");
                }}
                placeholder="0000"
                value={pin}
              />
            </label>

            <div className="flex items-center justify-center gap-2">
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`pin-dot ${digits[index] ? "scale-110 bg-foreground" : "bg-foreground/18"}`}
                />
              ))}
            </div>

            {error ? (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-sm font-medium text-danger"
              >
                {error}
              </motion.p>
            ) : null}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-[1.4rem] bg-foreground px-5 py-4 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#2f241b] focus:outline-none focus:ring-4 focus:ring-amber/25"
              type="submit"
            >
              Open the fridge
            </motion.button>
          </form>

          <p className="text-center text-xs uppercase tracking-[0.24em] text-muted/80">
            Warm, simple, always in sync
          </p>
        </div>
      </motion.section>
    </main>
  );
}
