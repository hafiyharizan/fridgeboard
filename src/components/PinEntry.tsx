"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
      <section className="fridge-card relative w-full max-w-md overflow-hidden px-6 py-7 sm:px-8">
        <div className="absolute -left-10 top-8 h-24 w-24 rounded-full bg-amber/30 blur-2xl" />
        <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-blue/20 blur-2xl" />

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

            {error ? <p className="text-center text-sm text-danger">{error}</p> : null}

            <button
              className="w-full rounded-[1.4rem] bg-foreground px-5 py-4 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#2f241b] focus:outline-none focus:ring-4 focus:ring-amber/25"
              type="submit"
            >
              Open the fridge
            </button>
          </form>

          <p className="text-center text-xs uppercase tracking-[0.24em] text-muted/80">
            Warm, simple, always in sync
          </p>
        </div>
      </section>
    </main>
  );
}
