"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { SkyPhase, SkyScene, SkyWeather } from "@/lib/weather";

// Animated sky behind the Outside card, in the spirit of the iPhone Weather
// app: the gradient follows the time of day, the layers follow the weather.
//
// The looping layers (stars, clouds, rain, snow, lightning) are CSS keyframes
// on transform/opacity only. They run on the compositor with no JavaScript
// per frame, which matters on an always-on kitchen tablet; Framer Motion
// only cross-fades between scenes. Reduced motion stops the loops.

type Palette = [top: string, bottom: string];

const PALETTES: Record<SkyPhase, Record<SkyWeather, Palette>> = {
  night: {
    clear: ["#0B1026", "#2B3166"],
    partly: ["#0F1530", "#30375F"],
    cloudy: ["#1A2030", "#3B4458"],
    fog: ["#1C2230", "#40495A"],
    rain: ["#121826", "#2E3748"],
    storm: ["#0C0F19", "#272C3F"],
    snow: ["#1D2638", "#46526A"],
  },
  day: {
    clear: ["#1F64B5", "#5A9BDC"],
    partly: ["#2A6AB3", "#6EA0D4"],
    cloudy: ["#566779", "#8191A3"],
    fog: ["#66737F", "#939EA9"],
    rain: ["#465464", "#73808D"],
    storm: ["#2A3140", "#525C6D"],
    snow: ["#5F7590", "#93A6BB"],
  },
  dawn: {
    clear: ["#34488A", "#E39A78"],
    partly: ["#3A4C88", "#D99A80"],
    cloudy: ["#4D5878", "#B08A80"],
    fog: ["#56607A", "#B4948A"],
    rain: ["#3F4864", "#8C7A7A"],
    storm: ["#2D3348", "#6F5E66"],
    snow: ["#56627E", "#B9A3A0"],
  },
  dusk: {
    clear: ["#272B66", "#D6745E"],
    partly: ["#2E3268", "#C97A66"],
    cloudy: ["#3B3F5E", "#9E706A"],
    fog: ["#44485F", "#A27C75"],
    rain: ["#2F3450", "#7A5E62"],
    storm: ["#22253A", "#5E4A55"],
    snow: ["#454C68", "#A88D8C"],
  },
};

/** Stable pseudo-random numbers, so layouts match between server and client. */
function rand(index: number, salt: number): number {
  const x = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const secs = (value: number) => `${value.toFixed(2)}s`;

function Stars({ count, dim }: { count: number; dim?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const size = 1 + rand(i, 1) * (dim ? 1 : 1.8);
        const style: CSSProperties = {
          left: pct(rand(i, 2)),
          top: pct(rand(i, 3) * (dim ? 0.45 : 0.85)),
          width: size,
          height: size,
          animationDuration: secs(2.4 + rand(i, 4) * 3),
          animationDelay: secs(-rand(i, 5) * 5),
        };
        return <span key={i} className={`sky-star${dim ? " is-dim" : ""}`} style={style} />;
      })}
    </>
  );
}

function Clouds({ count, tone }: { count: number; tone: "light" | "grey" | "dark" }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const width = 150 + rand(i, 6) * 120;
        const duration = 70 + rand(i, 7) * 50;
        const style: CSSProperties = {
          top: pct(0.02 + rand(i, 8) * 0.5),
          width,
          height: width * 0.36,
          animationDuration: secs(duration),
          animationDelay: secs(-rand(i, 9) * duration),
        };
        return <span key={i} className={`sky-cloud is-${tone}`} style={style} />;
      })}
    </>
  );
}

function Rain({ count, heavy }: { count: number; heavy?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const duration = (heavy ? 0.55 : 0.8) + rand(i, 10) * 0.45;
        const style: CSSProperties = {
          left: pct(rand(i, 11) * 1.08),
          height: 12 + rand(i, 12) * 10,
          animationDuration: secs(duration),
          animationDelay: secs(-rand(i, 13) * duration),
        };
        return <span key={i} className="sky-drop" style={style} />;
      })}
    </>
  );
}

function Snow({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const size = 3 + rand(i, 14) * 3;
        const duration = 7 + rand(i, 15) * 5;
        const style: CSSProperties = {
          left: pct(rand(i, 16)),
          width: size,
          height: size,
          animationDuration: secs(duration),
          animationDelay: secs(-rand(i, 17) * duration),
        };
        return <span key={i} className="sky-flake" style={style} />;
      })}
    </>
  );
}

function Layers({ phase, weather }: SkyScene) {
  const dark = phase === "night";
  const clearish = weather === "clear" || weather === "partly";
  return (
    <>
      {clearish && phase === "day" && <span className="sky-sun" />}
      {clearish && dark && <span className="sky-moon" />}
      {clearish && dark && <Stars count={weather === "clear" ? 32 : 18} />}
      {clearish && (phase === "dusk" || phase === "dawn") && <Stars count={8} dim />}
      {weather === "partly" && <Clouds count={2} tone="light" />}
      {(weather === "cloudy" || weather === "snow") && <Clouds count={4} tone={dark ? "dark" : "light"} />}
      {weather === "rain" && <Clouds count={4} tone={dark ? "dark" : "grey"} />}
      {weather === "storm" && <Clouds count={5} tone="dark" />}
      {weather === "fog" && (
        <>
          <span className="sky-fog" />
          <span className="sky-fog is-low" />
        </>
      )}
      {weather === "rain" && <Rain count={22} />}
      {weather === "storm" && <Rain count={30} heavy />}
      {weather === "storm" && <span className="sky-flash" />}
      {weather === "snow" && <Snow count={18} />}
    </>
  );
}

export function SkyBackdrop({ scene }: { scene: SkyScene }) {
  const [top, bottom] = PALETTES[scene.phase][scene.weather];
  return (
    <div className="sky-backdrop" aria-hidden>
      <AnimatePresence initial={false}>
        <motion.div
          key={`${scene.phase}-${scene.weather}`}
          className="sky-scene"
          style={{ backgroundImage: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
        >
          <Layers {...scene} />
        </motion.div>
      </AnimatePresence>
      <span className="sky-scrim" />
    </div>
  );
}
