"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Droplets,
  Lightbulb,
  ListChecks,
  MapPin,
  Moon,
  MoonStar,
  Navigation,
  Search,
  ShoppingBasket,
  Snowflake,
  Sun,
  Wind,
  X,
} from "lucide-react";
import { formatEventTime } from "@/lib/calendar";
import { countdown, isPrayerMethod, PRAYER_METHODS, type PrayerSlot } from "@/lib/prayer";
import { describeWeather, geocodeUrl, parsePlaces, skyScene, uvLevel, weatherTip, type Forecast, type Place, type WeatherKind } from "@/lib/weather";
import { SkyBackdrop } from "@/components/Sky";
import { IdleSlideshow } from "@/components/IdleSlideshow";
import { idleDimOpacity } from "@/lib/kitchen";
import type { PrayerDay } from "@/hooks/useAmbient";
import type { SettingsPatch } from "@/hooks/useHouseholdInfo";
import type { ExpandedCalendarEvent, HouseholdSettings } from "@/lib/types";

const ICONS: Record<WeatherKind, typeof Sun> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  storm: CloudLightning,
};

export function WeatherIcon({ code, night, size }: { code: number; night?: boolean; size: number }) {
  const { kind } = describeWeather(code);
  const Icon = night && kind === "clear" ? Moon : ICONS[kind];
  return <Icon size={size} aria-hidden />;
}

const clock = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/* ---------- Home: weather + prayer card ---------- */

/** "Southern River, Western Australia, Australia" → "Southern River". */
const placeName = (name: string | null | undefined) => name?.split(",")[0]?.trim() || "Home";

function HomeLabel({ place }: { place?: string }) {
  return (
    <span className="sky-home">
      <Navigation size={12} fill="currentColor" aria-hidden /> Home
      {place && <span className="sky-home-place"> · {place}</span>}
    </span>
  );
}

/** "4:55" + "PM" in the household's locale. */
function clockParts(now: Date) {
  const parts = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).formatToParts(now);
  return {
    time: parts
      .filter((part) => part.type !== "dayPeriod")
      .map((part) => part.value)
      .join("")
      .trim(),
    period: parts.find((part) => part.type === "dayPeriod")?.value,
  };
}

/**
 * Home's first card: the time and date with the weather beside them on an
 * animated sky, then "next up" (passed in as children), weather details and
 * prayer times.
 */
export function OutsideCard({
  settings,
  forecast,
  weatherFailed,
  prayer,
  now,
  onSetup,
  children,
}: {
  settings: HouseholdSettings | null;
  forecast: Forecast | null;
  weatherFailed?: boolean;
  prayer: PrayerDay | null;
  now: Date;
  onSetup: () => void;
  /** Shown under the clock (Home's "Next up" line). */
  children?: ReactNode;
}) {
  const scene = skyScene(forecast, now);
  const located = Boolean(settings?.latitude && settings.longitude);
  const today = forecast ? describeWeather(forecast.current.code) : null;
  const { time, period } = clockParts(now);
  return (
    <section
      className={`card outside-card sky is-${scene.phase} is-${scene.weather}`}
      aria-label="Time, weather and prayer times"
    >
      <SkyBackdrop scene={scene} />
      <div className="sky-content">
        <div className="sky-head">
          <div className="sky-where">
            <HomeLabel place={located ? placeName(settings?.location_name) : undefined} />
            <p className="sky-clock">
              <time dateTime={now.toISOString()} suppressHydrationWarning>
                {time}
              </time>
              {period && <small>{period}</small>}
            </p>
            <p className="sky-date" suppressHydrationWarning>
              {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
            </p>
          </div>
          {located && forecast && today && (
            <div className="sky-summary">
              <p className="sky-now">
                <WeatherIcon code={forecast.current.code} night={scene.phase === "night"} size={28} />
                <span className="sky-temp">{Math.round(forecast.current.temperature)}°</span>
              </p>
              <strong>{today.label}</strong>
              <span>
                H:{Math.round(forecast.today.max)}° L:{Math.round(forecast.today.min)}°
              </span>
              {forecast.today.rainChance !== null && forecast.today.rainChance >= 20 && (
                <span>
                  <Droplets size={13} aria-hidden /> {forecast.today.rainChance}% rain
                </span>
              )}
            </div>
          )}
        </div>
        {children}
        {!located ? (
          <button className="sky-setup" onClick={onSetup}>
            <MapPin size={20} aria-hidden />
            <span>
              <strong>Add your home location</strong>
              <span>For weather and, if you like, prayer times.</span>
            </span>
          </button>
        ) : forecast && today ? (
          <>
            <dl className="weather-stats">
              <div>
                <dt>
                  <Sun size={15} aria-hidden /> UV
                </dt>
                <dd>
                  {(() => {
                    const uv = forecast.current.uv ?? forecast.today.uvMax;
                    return uv === null ? "—" : `${Math.round(uv)} ${uvLevel(uv)}`;
                  })()}
                </dd>
              </div>
              <div>
                <dt>
                  <Droplets size={15} aria-hidden />
                  <span className="sr-only">Humidity</span>
                </dt>
                <dd>{forecast.current.humidity === null ? "—" : `${Math.round(forecast.current.humidity)}%`}</dd>
              </div>
              <div>
                <dt>
                  <Wind size={15} aria-hidden />
                  <span className="sr-only">Wind</span>
                </dt>
                <dd>{forecast.current.wind === null ? "—" : `${Math.round(forecast.current.wind)} km/h`}</dd>
              </div>
            </dl>
            <p className="weather-tip">
              <Lightbulb size={16} aria-hidden />
              <span>{weatherTip(forecast, scene.phase === "night")}</span>
            </p>
            {forecast.tomorrow && (
              <p className="weather-tomorrow">
                <WeatherIcon code={forecast.tomorrow.code} size={16} />
                <span>
                  Tomorrow {Math.round(forecast.tomorrow.max)}° / {Math.round(forecast.tomorrow.min)}° ·{" "}
                  {describeWeather(forecast.tomorrow.code).label}
                  {forecast.tomorrow.rainChance !== null && forecast.tomorrow.rainChance >= 20
                    ? ` · ${forecast.tomorrow.rainChance}% rain`
                    : ""}
                </span>
              </p>
            )}
          </>
        ) : (
          <p className="sky-waiting">
            {weatherFailed ? "Weather isn\u2019t available right now." : "Checking the weather…"}
          </p>
        )}
        {prayer?.next && (
          <div className="prayer-strip">
            <p className="prayer-next">
              <MoonStar size={16} aria-hidden />
              <span className="prayer-day">{prayer.nextIsTomorrow ? "Tomorrow" : "Today"}</span>
              <span className="prayer-countdown">
                <strong>{prayer.next.label}</strong> {countdown(prayer.next.time, now)}
              </span>
            </p>
            <ol className="prayer-times" aria-label={`Prayer times ${prayer.nextIsTomorrow ? "tomorrow" : "today"}`}>
              {prayer.shown.map((slot) => {
                const next = slot.name === prayer.next?.name;
                return (
                  <li key={slot.name} className={next ? "is-next" : ""} aria-current={next ? "time" : undefined}>
                    <span>{slot.label}</span>
                    <strong>{clock(slot.time).replace(/\s?[AP]M$/i, "")}</strong>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Athan banner (kitchen display) ---------- */

export function AthanBanner({ slot, onDismiss }: { slot: PrayerSlot | null; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      {slot && (
        <motion.div
          className="athan-banner"
          role="alert"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
        >
          <span className="athan-icon">
            <MoonStar size={26} />
          </span>
          <span>
            <span className="eyebrow">Athan</span>
            <strong>Time for {slot.label}</strong>
            <span>{clock(slot.time)}</span>
          </span>
          <button className="icon-button" aria-label="Dismiss athan" onClick={onDismiss}>
            <X size={22} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Idle "today" view (kitchen display) ---------- */

export function AmbientScreen({
  visible,
  night,
  now,
  offset,
  dim,
  slideshow,
  forecast,
  prayer,
  nextUp,
  groceries,
  tasks,
}: {
  visible: boolean;
  night: boolean;
  now: Date;
  offset: { x: number; y: number };
  /** Dark overlay (a browser can't change real brightness). */
  dim: boolean;
  /** Cover the today view with this device's photos, when it has any. */
  slideshow: boolean;
  forecast: Forecast | null;
  prayer: PrayerDay | null;
  nextUp: ExpandedCalendarEvent | null;
  groceries: number;
  tasks: number;
}) {
  const parts = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).formatToParts(now);
  const time = parts.filter((part) => part.type !== "dayPeriod").map((part) => part.value).join("").trim();
  const period = parts.find((part) => part.type === "dayPeriod")?.value;
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`ambient${night ? " is-night" : ""}`}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          transition={{ duration: 1.2 }}
        >
          <div className="ambient-inner" style={{ translate: `${offset.x}px ${offset.y}px` }}>
            <p className="ambient-time">
              {time}
              {period && <small>{period}</small>}
            </p>
            <p className="ambient-date">
              {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
              {forecast && (
                <span className="ambient-weather">
                  <WeatherIcon code={forecast.current.code} night={!forecast.current.isDay} size={34} />
                  {Math.round(forecast.current.temperature)}°{" "}
                  <small>{describeWeather(forecast.current.code).label}</small>
                </span>
              )}
            </p>
            <div className="ambient-tiles">
              <div className="ambient-tile is-wide">
                <span className="eyebrow">Next up</span>
                {nextUp ? (
                  <strong>
                    {nextUp.title}
                    <small>
                      {nextUp.occurrence_date === todayKey
                        ? "Today"
                        : new Date(`${nextUp.occurrence_date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })}
                      {nextUp.event_time ? ` · ${formatEventTime(nextUp.event_time)}` : " · All day"}
                    </small>
                  </strong>
                ) : (
                  <strong>
                    A calm week
                    <small>Nothing planned</small>
                  </strong>
                )}
              </div>
              <div className="ambient-tile">
                <span className="eyebrow">
                  <ShoppingBasket size={16} aria-hidden /> Groceries
                </span>
                <strong>
                  {groceries}
                  <small>{groceries === 1 ? "item to buy" : "items to buy"}</small>
                </strong>
              </div>
              <div className="ambient-tile">
                <span className="eyebrow">
                  <ListChecks size={16} aria-hidden /> To-do
                </span>
                <strong>
                  {tasks}
                  <small>{tasks === 1 ? "task open" : "tasks open"}</small>
                </strong>
              </div>
              {prayer?.next && (
                <div className="ambient-tile">
                  <span className="eyebrow">
                    <MoonStar size={16} aria-hidden /> Next prayer
                  </span>
                  <strong>
                    {prayer.next.label}
                    <small>
                      {clock(prayer.next.time)} · {countdown(prayer.next.time, now)}
                    </small>
                  </strong>
                </div>
              )}
            </div>
            <p className="ambient-hint">Tap anywhere to open Fridgeboard</p>
          </div>
          {slideshow && <IdleSlideshow night={night} now={now} offset={offset} />}
          {dim && (
            <div
              className="ambient-dim"
              aria-hidden
              style={{ opacity: idleDimOpacity(night) }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Settings: location + prayer ---------- */

export function PlaceSettings({
  settings,
  onSave,
}: {
  settings: HouseholdSettings | null;
  onSave: (patch: SettingsPatch) => Promise<string | null>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (patch: SettingsPatch, done = "Saved") => {
    setBusy(true);
    const error = await onSave(patch);
    setBusy(false);
    setStatus(error ? `Could not save: ${error}` : done);
  };

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(geocodeUrl(query));
      const places = parsePlaces(await response.json());
      setResults(places);
      if (!places.length) setStatus("No places found. Try a suburb or city name.");
    } catch {
      setStatus("Couldn't search right now. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const prayerOn = Boolean(settings?.prayer_enabled);
  return (
    <section className="place-settings">
      <h3>Weather &amp; prayer times</h3>
      <p>Shared by everyone in the household.</p>
      <p className="place-current">
        <MapPin size={16} aria-hidden />
        {settings?.location_name ?? "No location set"}
      </p>
      <form className="place-search" onSubmit={search}>
        <input
          aria-label="Search for your suburb or city"
          placeholder="Suburb or city"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="secondary-button" disabled={busy} type="submit">
          <Search size={18} /> Find
        </button>
      </form>
      {results && results.length > 0 && (
        <ul className="place-results">
          {results.map((place) => (
            <li key={`${place.latitude},${place.longitude}`}>
              <button
                disabled={busy}
                onClick={async () => {
                  await save(
                    {
                      location_name: place.name,
                      latitude: place.latitude,
                      longitude: place.longitude,
                      timezone: place.timezone,
                    },
                    `Location set to ${place.name.split(",")[0]}`,
                  );
                  setResults(null);
                  setQuery("");
                }}
              >
                <MapPin size={16} aria-hidden /> {place.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="setting-row">
        <span>
          <strong>Show prayer times</strong>
          <span>On Home and the idle screen.</span>
        </span>
        <input
          type="checkbox"
          className="toggle"
          checked={prayerOn}
          disabled={busy}
          onChange={(event) => void save({ prayer_enabled: event.target.checked })}
        />
      </label>
      {prayerOn && (
        <>
          <label className="setting-row is-stacked">
            <strong>Calculation method</strong>
            <select
              value={settings?.prayer_method ?? "MuslimWorldLeague"}
              disabled={busy}
              onChange={(event) => {
                const method = event.target.value;
                if (isPrayerMethod(method)) void save({ prayer_method: method });
              }}
            >
              {PRAYER_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </label>
          <div className="setting-row">
            <span>
              <strong>Asr time</strong>
            </span>
            <div className="segmented" role="group" aria-label="Asr calculation">
              {(["shafi", "hanafi"] as const).map((madhab) => (
                <button
                  key={madhab}
                  type="button"
                  aria-pressed={(settings?.prayer_madhab ?? "shafi") === madhab}
                  disabled={busy}
                  onClick={() => void save({ prayer_madhab: madhab })}
                >
                  {madhab === "shafi" ? "Standard" : "Hanafi"}
                </button>
              ))}
            </div>
          </div>
          <label className="setting-row">
            <span>
              <strong>Athan alerts</strong>
              <span>
                Sound on the kitchen display, and a notification on phones with
                Fridgeboard notifications on.
              </span>
            </span>
            <input
              type="checkbox"
              className="toggle"
              checked={Boolean(settings?.athan_enabled)}
              disabled={busy}
              onChange={(event) => void save({ athan_enabled: event.target.checked })}
            />
          </label>
        </>
      )}
      {status && (
        <p className="data-status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
