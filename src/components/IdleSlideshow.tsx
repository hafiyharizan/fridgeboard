"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { listPhotos } from "@/lib/photo-store";
import { nextSlide, SLIDE_SECONDS } from "@/lib/kitchen";

/**
 * Idle photo slideshow, drawn over the today view. Photos come from this
 * device's IndexedDB. With no photos (or none that load) it renders nothing,
 * so the normal clock view underneath is what you see.
 */
export function IdleSlideshow({
  night,
  now,
  offset = { x: 0, y: 0 },
}: {
  night: boolean;
  now: Date;
  offset?: { x: number; y: number };
}) {
  const reduce = useReducedMotion();
  const [urls, setUrls] = useState<string[] | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let made: string[] = [];
    void listPhotos().then((blobs) => {
      if (cancelled) return;
      made = blobs.map((blob) => URL.createObjectURL(blob));
      setUrls(made);
    });
    return () => {
      cancelled = true;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const usable = (urls ?? []).filter((url) => !failed.has(url));
  const count = usable.length;

  useEffect(() => {
    if (count < 2) return;
    const timer = window.setInterval(
      () => setIndex((current) => nextSlide(current, count)),
      SLIDE_SECONDS * 1000,
    );
    return () => window.clearInterval(timer);
  }, [count]);

  if (count === 0) return null;
  const url = usable[Math.min(index, count - 1)];
  const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(now);

  return (
    <div className={`slideshow${night ? " is-night" : ""}`}>
      <AnimatePresence>
        <motion.div
          key={url}
          className="slideshow-slide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 1.5 }}
        >
          {/* Object URL from this device: next/image can't optimise it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            onError={() => setFailed((current) => new Set(current).add(url))}
          />
        </motion.div>
      </AnimatePresence>
      <p className="slideshow-clock" style={{ translate: `${offset.x}px ${offset.y}px` }}>
        {time}
      </p>
    </div>
  );
}
