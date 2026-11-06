"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { stepIndex, swipeStep, TAP_SLOP } from "@/lib/swipe";

export type DeckCard = { id: string; label: string; node: ReactNode };

/**
 * One card at a time, swiped sideways (or with the dots / arrow keys). It fills
 * whatever height its parent gives it, so it never grows the page. A single card
 * renders as is, with no dots.
 */
export function SwipeDeck({ cards, label }: { cards: DeckCard[]; label: string }) {
  const [rawIndex, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const reduceMotion = useReducedMotion();
  const dragged = useRef(false);
  const count = cards.length;
  // Cards can come and go (Markets drops out when there are no quotes).
  const index = stepIndex(rawIndex, 0, count);
  const card = cards[index];

  const go = (target: number) => {
    const next = stepIndex(target, 0, count);
    if (next === index) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  };

  if (!card) return null;
  if (count === 1) return <div className="swipe-deck">{card.node}</div>;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") go(index + 1);
    else if (event.key === "ArrowLeft") go(index - 1);
    else return;
    event.preventDefault();
  };

  // A drag that ends over a link must not also open it.
  const swallowClick = (event: MouseEvent) => {
    if (!dragged.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const shift = reduceMotion ? 0 : 36;

  return (
    <div
      className="swipe-deck"
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={card.id}
          className="swipe-slide"
          role="group"
          aria-roledescription="slide"
          aria-label={`${card.label}, ${index + 1} of ${count}`}
          custom={direction}
          variants={{
            enter: (dir: number) => ({ opacity: 0, x: dir * shift }),
            center: { opacity: 1, x: 0 },
            exit: (dir: number) => ({ opacity: 0, x: dir * -shift }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragStart={() => {
            dragged.current = false;
          }}
          onDrag={(_, info) => {
            if (Math.abs(info.offset.x) > TAP_SLOP) dragged.current = true;
          }}
          onDragEnd={(_, info) => {
            const step = swipeStep(info.offset.x, info.velocity.x);
            if (step) go(index + step);
            // The click that follows pointer-up still sees the flag; clear it after.
            window.setTimeout(() => {
              dragged.current = false;
            }, 0);
          }}
          onClickCapture={swallowClick}
        >
          {card.node}
        </motion.div>
      </AnimatePresence>
      <div className="swipe-dots">
        {cards.map((item, i) => (
          <button
            key={item.id}
            type="button"
            className="swipe-dot"
            aria-label={`Show ${item.label}`}
            aria-current={i === index || undefined}
            onClick={() => go(i)}
          >
            <span aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
