"use client";

import { useState, type FormEvent } from "react";
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
  Search,
  ShoppingBasket,
  Snowflake,
  Sun,
  Wind,
  X,
} from "lucide-react";
import { formatEventTime } from "@/lib/calendar";
import { countdown, isPrayerMethod, PRAYER_METHODS, type PrayerSlot } from "@/lib/prayer";
import { describeWeather, geocodeUrl, parsePlaces, uvLevel, weatherTip, type Forecast, type Place, type WeatherKind } from "@/lib/weather";
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

export function OutsideCard({
  settings,
  forecast,
  prayer,
  now,
  onSetup,
}: {
  settings: HouseholdSettings | null;
  forecast: Forecast | null;
  prayer: PrayerDay | null;
  now: Date;
  onSetup: () => void;
}) {
  if (!settings?.latitude || !settings.longitude) {
    return (
      <section className="card outside-card" aria-label="Weather and prayer times">
        <p className="eyebrow">Outside</p>
        <button className="outside-setup" onClick={onSetup}>
          <span className="icon-tile">
            <MapPin size={22} />
          </span>
          <span>
            <strong>Add your location</strong>
            <span>For weather and, if you like, prayer times.</span>
          </span>
        </button>
      </section>
    );
  }
  const place = settings.location_name?.split(",")[0] ?? "Home";
  const today = forecast ? describeWeather(forecast.current.code) : null;
  return (
    <section className="card outside-card" aria-label="Weather and prayer times">
      <p className="eyebrow">
        Outside · {place}
      </p>
      {forecast && today ? (
        <>
          <div className="weather-now">
            <span className="weather-icon">
              <WeatherIcon code={forecast.current.code} night={!forecast.current.isDay} size={30} />
            </span>
            <strong className="weather-temp">{Math.round(forecast.current.temperature)}°</strong>
            <span className="weather-words">
              <b>{today.label}</b>
              <span>
                H {Math.round(forecast.today.max)}° · L {Math.round(forecast.today.min)}°
                {forecast.today.rainChance !== null && forecast.today.rainChance >= 20 && (
                  <>
                    {" "}
                    · <Droplets size={13} aria-hidden /> {forecast.today.rainChance}%
                  </>
                )}
              </span>
            </span>
          </div>
          <dl className="weather-stats">
            <div>
              <dt>
                <Sun size={14} aria-hidden /> UV
              </dt>
              <dd>
                {(() => {
                  const uv = forecast.current.uv ?? forecast.today.uvMax;
                  return uv === null ? "—" : `${Math.round(uv)} ${uvLevel(uv).replace("Moderate", "Mod").replace("Very high", "V. high")}`;
                })()}
              </dd>
            </div>
            <div>
              <dt>
                <Droplets size={14} aria-hidden /> Humidity
              </dt>
              <dd>{forecast.current.humidity === null ? "—" : `${Math.round(forecast.current.humidity)}%`}</dd>
            </div>
            <div>
              <dt>
                <Wind size={14} aria-hidden /> Wind
              </dt>
              <dd>{forecast.current.wind === null ? "—" : `${Math.round(forecast.current.wind)} km/h`}</dd>
            </div>
          </dl>
          <p className="weather-tip">
            <Lightbulb size={16} aria-hidden />
            <span>{weatherTip(forecast)}</span>
          </p>
          {forecast.tomorrow && (
            <p className="weather-tomorrow">
              <WeatherIcon code={forecast.tomorrow.code} size={16} />
              Tomorrow · {describeWeather(forecast.tomorrow.code).label} ·{" "}
              {Math.round(forecast.tomorrow.max)}° / {Math.round(forecast.tomorrow.min)}°
              {forecast.tomorrow.rainChance !== null && forecast.tomorrow.rainChance >= 20
                ? ` · ${forecast.tomorrow.rainChance}% rain`
                : ""}
            </p>
          )}
        </>
      ) : (
        <p className="empty-copy">Checking the weather…</p>
      )}
      {prayer?.next && (
        <div className="prayer-strip">
          <p className="prayer-next">
            <MoonStar size={16} aria-hidden />
            <span>
              Next: <strong>{prayer.next.label}</strong> {clock(prayer.next.time)}
              {prayer.nextIsTomorrow ? " tomorrow" : ""} · {countdown(prayer.next.time, now)}
            </span>
          </p>
          <ol className="prayer-times">
            {prayer.today.map((slot) => (
              <li
                key={slot.name}
                className={
                  !prayer.nextIsTomorrow && slot.name === prayer.next?.name ? "is-next" : ""
                }
              >
                <span>{slot.label}</span>
                <strong>{clock(slot.time).replace(/\s?[AP]M$/i, "")}</strong>
              </li>
            ))}
          </ol>
        </div>
      )}
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
              {now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
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
