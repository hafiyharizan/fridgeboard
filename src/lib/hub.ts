// Pure helpers for the Home hub: time-of-day labels, the next-event line,
// item metadata and grocery icons.
import type { ExpandedCalendarEvent } from "@/lib/types";

/** Southern-hemisphere meteorological seasons. */
export function season(date: Date) {
  const month = date.getMonth();
  if (month === 11 || month <= 1) return "Summer";
  if (month <= 4) return "Autumn";
  if (month <= 7) return "Winter";
  return "Spring";
}

export function dayPart(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function formatClockTime(hhmm: string) {
  const total = minutesOf(hhmm);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDuration(minutes: number) {
  if (minutes < 1) return "now";
  if (minutes < 60) return `in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `in ${hours} h${rest ? ` ${rest} min` : ""}`;
}

export type NextEventLine = {
  text: string;
  event: ExpandedCalendarEvent | null;
};

/**
 * "Swimming lesson in 42 minutes (Nayla)" for the next timed event today,
 * otherwise a pointer to tomorrow's first event.
 */
export function nextEventLine(
  events: ExpandedCalendarEvent[],
  today: string,
  tomorrow: string,
  nowMinutes: number,
  namesFor: (event: ExpandedCalendarEvent) => string[] = () => [],
): NextEventLine {
  const open = events.filter((event) => !event.is_done);
  const withNames = (event: ExpandedCalendarEvent, text: string) => {
    const names = namesFor(event);
    return names.length ? `${text} (${names.join(" & ")})` : text;
  };
  const upcoming = open
    .filter((event) => event.occurrence_date === today && event.event_time)
    .map((event) => ({ event, at: minutesOf(event.event_time as string) }))
    .filter(({ at }) => at >= nowMinutes)
    .sort((a, b) => a.at - b.at)[0];
  if (upcoming) {
    const wait = upcoming.at - nowMinutes;
    return {
      event: upcoming.event,
      text: withNames(
        upcoming.event,
        wait < 1 ? `${upcoming.event.title} is starting now` : `${upcoming.event.title} ${formatDuration(wait)}`,
      ),
    };
  }
  const next = open
    .filter((event) => event.occurrence_date === tomorrow)
    .sort((a, b) => (a.event_time ?? "99").localeCompare(b.event_time ?? "99"))[0];
  if (next) {
    const when = next.event_time ? ` at ${formatClockTime(next.event_time)}` : "";
    return { event: next, text: withNames(next, `Nothing else today. Tomorrow: ${next.title}${when}`) };
  }
  return { event: null, text: "Nothing else planned today." };
}

const DAY_MS = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

function daysAgo(iso: string, now: Date) {
  return Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY_MS);
}

export function addedLabel(createdAt: string, now: Date) {
  const minutes = Math.floor((now.getTime() - new Date(createdAt).getTime()) / 60_000);
  if (minutes < 2) return "Added just now";
  if (minutes < 60) return `Added ${minutes} min ago`;
  const days = daysAgo(createdAt, now);
  if (days <= 0) return "Added today";
  if (days === 1) return "Added yesterday";
  if (days < 7) return `Added ${days} days ago`;
  return `Added ${new Date(createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

export function doneLabel(checkedAt: string | null, now: Date) {
  if (!checkedAt) return "Done";
  const days = daysAgo(checkedAt, now);
  if (days <= 0)
    return `Done at ${new Date(checkedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  if (days === 1) return "Done yesterday";
  return `Done ${days} days ago`;
}

export type GroceryIcon =
  | "milk"
  | "egg"
  | "bread"
  | "fruit"
  | "banana"
  | "veg"
  | "salad"
  | "fish"
  | "meat"
  | "chicken"
  | "cheese"
  | "coffee"
  | "drink"
  | "snack"
  | "grain"
  | "baby"
  | "cleaning"
  | "basket";

const GROCERY_RULES: [GroceryIcon, RegExp][] = [
  ["baby", /\b(nappies|nappy|diapers?|wipes|formula|baby)\b/],
  ["cleaning", /\b(detergent|soap|bleach|dishwash|sponge|toilet paper|tissues|cleaner|spray|bin bags?|laundry)\b/],
  ["milk", /\b(milk|cream|yog(h)?urt|kefir|butter)\b/],
  ["cheese", /\b(cheese|cheddar|feta|mozzarella|parmesan|halloumi)\b/],
  ["egg", /\beggs?\b/],
  ["bread", /\b(bread|sourdough|loaf|bagels?|rolls?|wraps?|tortillas?|croissants?|buns?|pita|roti)\b/],
  ["banana", /\bbananas?\b/],
  ["fruit", /\b(apples?|oranges?|limes?|lemons?|berries|strawberr(y|ies)|grapes?|mangoes|mangos?|pears?|avocados?|kiwis?|melons?|watermelon|dates|fruit)\b/],
  ["salad", /\b(lettuce|spinach|rocket|kale|salad|herbs?|basil|coriander|cilantro|parsley|mint)\b/],
  ["veg", /\b(carrots?|onions?|garlic|potato(es)?|tomato(es)?|capsicum|peppers?|broccoli|zucchini|cucumbers?|mushrooms?|ginger|chillies|chilli|corn|beans|peas|pumpkin|veg(gies|etables)?|scallions?|spring onions?)\b/],
  ["fish", /\b(fish|salmon|tuna|prawns?|shrimp|barramundi|seafood)\b/],
  ["chicken", /\b(chicken|turkey|drumsticks?|wings?)\b/],
  ["meat", /\b(beef|lamb|mince|steak|sausages?|meat|bacon|ham)\b/],
  ["coffee", /\b(coffee|tea|matcha|cocoa)\b/],
  ["drink", /\b(juice|water|soda|cordial|drinks?|kombucha)\b/],
  ["snack", /\b(chips|biscuits?|cookies?|crackers?|chocolate|snacks?|nuts|popcorn|ice cream)\b/],
  ["grain", /\b(rice|pasta|noodles|flour|oats|cereal|quinoa|couscous|lentils|sugar)\b/],
];

export function groceryIcon(text: string): GroceryIcon {
  const value = text.toLowerCase();
  return GROCERY_RULES.find(([, pattern]) => pattern.test(value))?.[0] ?? "basket";
}
