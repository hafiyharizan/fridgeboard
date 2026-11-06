import { dateKey } from "@/lib/dashboard";
import { isKnownGrocery } from "@/lib/suggestions";
import type { Recurrence } from "@/lib/types";

/**
 * Turns a spoken sentence into something to add:
 *   "Add milk and eggs to the shopping list"  → grocery: Milk, Eggs
 *   "Remind me to call Mum tomorrow at 5pm"   → reminder: Call Mum, tomorrow 17:00
 *   "Dentist on Friday at 3"                  → event: Dentist, Friday 15:00
 *   "I need to fix the gate"                  → to-do: Fix the gate
 * Rule-based and on-device: nothing is sent anywhere. The result is always
 * shown for checking before it's saved.
 */

export type VoiceKind = "grocery" | "todo" | "event" | "reminder";

export type VoiceCommand = {
  kind: VoiceKind;
  /** Title for a to-do, event or reminder. */
  title: string;
  /** Grocery items, split on "and" / commas. */
  items: string[];
  /** YYYY-MM-DD; set for events and reminders. */
  date: string;
  /** HH:MM, or null for all day. */
  time: string | null;
  recurrence: Recurrence;
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_PATTERN =
  "(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thur?s?|fri|sat)";
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_PATTERN =
  "(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)";
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function weekdayIndex(word: string): number {
  const lower = word.toLowerCase();
  return WEEKDAYS.findIndex((day) => day.startsWith(lower.slice(0, 3)));
}

function monthIndex(word: string): number {
  const lower = word.toLowerCase();
  return MONTHS.findIndex((month) => month.startsWith(lower.slice(0, 3)));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Removes a match and tidies the gap it leaves. */
function cut(text: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  return `${text.slice(0, start)} ${text.slice(start + match[0].length)}`.replace(/\s+/g, " ").trim();
}

/** "p.m." → "pm", word numbers next to times → digits, filler punctuation out. */
function normalise(raw: string): string {
  return raw
    .replace(/\b([ap])\.\s?m\.?/gi, "$1m")
    .replace(/\bo'?clock\b/gi, "")
    .replace(
      /\b(at|half past|quarter past|quarter to)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
      (_, lead: string, word: string) => `${lead} ${NUMBER_WORDS[word.toLowerCase()]}`,
    )
    .replace(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(am|pm)\b/gi,
      (_, word: string, half: string) => `${NUMBER_WORDS[word.toLowerCase()]} ${half}`,
    )
    .replace(/[.!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bare "at 3" → afternoon for 1–6, morning for 7–11, 12 = noon. */
function guessHour(hour: number): number {
  if (hour >= 1 && hour <= 6) return hour + 12;
  return hour;
}

function to24(hour: number, half: string | undefined): number {
  const marker = half?.toLowerCase();
  if (marker === "pm" && hour < 12) return hour + 12;
  if (marker === "am" && hour === 12) return 0;
  return hour;
}

function takeTime(text: string): { text: string; time: string | null; tonight: boolean } {
  let match = text.match(/\b(?:at|by|around|from)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (match) {
    const hour = to24(Number(match[1]), match[3]);
    const minute = Number(match[2] ?? 0);
    if (hour < 24 && minute < 60) return { text: cut(text, match), time: `${pad(hour)}:${pad(minute)}`, tonight: false };
  }
  match = text.match(/\b(?:at|by|around)\s+(half past|quarter past|quarter to)\s+(\d{1,2})\b/i);
  if (match) {
    const base = guessHour(Number(match[2]));
    const phrase = match[1].toLowerCase();
    const [hour, minute] =
      phrase === "half past" ? [base, 30] : phrase === "quarter past" ? [base, 15] : [base - 1, 45];
    if (hour >= 0 && hour < 24) return { text: cut(text, match), time: `${pad(hour)}:${pad(minute)}`, tonight: false };
  }
  match = text.match(/\b(?:at|by|around)\s+(\d{1,2})(?::(\d{2}))?\b(?!\s*(?:st|nd|rd|th|%|days?|weeks?|months?))/i);
  if (match) {
    const raw = Number(match[1]);
    const minute = Number(match[2] ?? 0);
    const hour = match[2] && raw > 12 ? raw : guessHour(raw);
    if (hour < 24 && minute < 60) return { text: cut(text, match), time: `${pad(hour)}:${pad(minute)}`, tonight: false };
  }
  match = text.match(/\b(?:at\s+)?(noon|midday|lunchtime|lunch time)\b/i);
  if (match) return { text: cut(text, match), time: "12:00", tonight: false };
  match = text.match(/\btonight\b/i);
  if (match) return { text: cut(text, match), time: "19:00", tonight: true };
  match = text.match(/\b(?:in the|this)\s+(morning|afternoon|evening)\b/i);
  if (match) {
    const time = { morning: "09:00", afternoon: "15:00", evening: "18:00" }[
      match[1].toLowerCase() as "morning" | "afternoon" | "evening"
    ];
    return { text: cut(text, match), time, tonight: false };
  }
  // "tomorrow morning" — keep "tomorrow" for the date pass.
  match = text.match(/\b(tomorrow)\s+(morning|afternoon|evening|night)\b/i);
  if (match) {
    const part = match[2].toLowerCase();
    const time = { morning: "09:00", afternoon: "15:00", evening: "18:00", night: "19:00" }[
      part as "morning" | "afternoon" | "evening" | "night"
    ];
    const start = match.index ?? 0;
    const rest = `${text.slice(0, start)} ${match[1]} ${text.slice(start + match[0].length)}`;
    return { text: rest.replace(/\s+/g, " ").trim(), time, tonight: false };
  }
  return { text, time: null, tonight: false };
}

function takeRecurrence(text: string, now: Date): { text: string; recurrence: Recurrence; date: Date | null } {
  let match = text.match(new RegExp(`\\bevery\\s+${WEEKDAY_PATTERN}\\b`, "i"));
  if (match) {
    const target = weekdayIndex(match[1]);
    const ahead = (target - now.getDay() + 7) % 7;
    return { text: cut(text, match), recurrence: "weekly", date: addDays(now, ahead) };
  }
  match = text.match(/\b(?:every\s+(day|week|fortnight|other week|month|year)|(daily|weekly|fortnightly|monthly|yearly|annually))\b/i);
  if (match) {
    const word = (match[1] ?? match[2]).toLowerCase();
    const recurrence: Recurrence =
      word === "day" || word === "daily"
        ? "daily"
        : word === "week" || word === "weekly"
          ? "weekly"
          : word === "fortnight" || word === "other week" || word === "fortnightly"
            ? "biweekly"
            : word === "month" || word === "monthly"
              ? "monthly"
              : "yearly";
    return { text: cut(text, match), recurrence, date: null };
  }
  return { text, recurrence: "none", date: null };
}

function takeDate(text: string, now: Date): { text: string; date: Date | null } {
  const today = addDays(now, 0);
  let match = text.match(/\b(?:on\s+)?(?:the\s+)?day after tomorrow\b/i);
  if (match) return { text: cut(text, match), date: addDays(today, 2) };
  match = text.match(/\b(?:for\s+)?tomorrow\b/i);
  if (match) return { text: cut(text, match), date: addDays(today, 1) };
  match = text.match(/\b(?:for\s+)?today\b/i);
  if (match) return { text: cut(text, match), date: today };
  match = text.match(/\bin\s+(\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(day|week|month)s?\b/i);
  if (match) {
    const word = match[1].toLowerCase();
    const count = NUMBER_WORDS[word] ?? Number(word);
    const unit = match[2].toLowerCase();
    const date =
      unit === "month"
        ? new Date(today.getFullYear(), today.getMonth() + count, today.getDate())
        : addDays(today, unit === "week" ? count * 7 : count);
    return { text: cut(text, match), date };
  }
  match = text.match(/\bnext week\b/i);
  if (match) return { text: cut(text, match), date: addDays(today, 7) };
  match = text.match(/\b(?:this|on the|at the|over the)\s+weekend\b/i);
  if (match) {
    const ahead = (6 - today.getDay() + 7) % 7;
    return { text: cut(text, match), date: addDays(today, ahead) };
  }
  // "on the 12th of December", "12 December", "December 12th"
  match =
    text.match(new RegExp(`\\b(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+of)?\\s+${MONTH_PATTERN}\\b`, "i")) ??
    null;
  let day: number | null = null;
  let month: number | null = null;
  if (match) {
    day = Number(match[1]);
    month = monthIndex(match[2]);
  } else {
    match = text.match(new RegExp(`\\b(?:on\\s+)?${MONTH_PATTERN}\\s+(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"));
    if (match) {
      month = monthIndex(match[1]);
      day = Number(match[2]);
    }
  }
  if (match && day !== null && month !== null && month >= 0 && day >= 1 && day <= 31) {
    let date = new Date(today.getFullYear(), month, day);
    if (date < today) date = new Date(today.getFullYear() + 1, month, day);
    return { text: cut(text, match), date };
  }
  match = text.match(new RegExp(`\\b(?:on\\s+|this\\s+|next\\s+|coming\\s+|this coming\\s+)?${WEEKDAY_PATTERN}\\b`, "i"));
  if (match) {
    const target = weekdayIndex(match[1]);
    if (target >= 0) {
      const lead = match[0].toLowerCase();
      let ahead = (target - today.getDay() + 7) % 7;
      // "Friday" said on a Friday means next week; "this Friday" means today.
      if (ahead === 0 && !lead.startsWith("this")) ahead = 7;
      return { text: cut(text, match), date: addDays(today, ahead) };
    }
  }
  match = text.match(/\bon the (\d{1,2})(?:st|nd|rd|th)\b/i);
  if (match) {
    const dayOfMonth = Number(match[1]);
    if (dayOfMonth >= 1 && dayOfMonth <= 31) {
      let date = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
      if (date < today) date = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
      return { text: cut(text, match), date };
    }
  }
  return { text, date: null };
}

const GROCERY_TARGET =
  /\b(?:to|on|onto|in|into|for)\s+(?:the|my|our)?\s*(?:grocery|groceries|shopping)(?:\s+list)?\b/i;
const TODO_TARGET = /\b(?:to|on|onto|in|into)\s+(?:the|my|our)?\s*(?:to-?\s?do|todo|tasks?)(?:\s+list)?\b/i;
const CALENDAR_TARGET = /\b(?:to|on|in|into)\s+(?:the|my|our)?\s*(?:calendar|diary|schedule)\b/i;

const REMINDER_LEAD =
  /^(?:(?:can you|could you|please)\s+)*(?:remind (?:me|us)(?:\s+(?:to|about|that))?|(?:set|add|make|create)\s+(?:a\s+)?reminder(?:\s+(?:to|for|about|that))?|reminder(?:\s*:)?(?:\s+(?:to|for|about))?)\s+/i;
const GROCERY_LEAD =
  /^(?:(?:can you|could you|please)\s+)*(?:(?:we|i)\s+)?(?:need to buy|need to get|have to buy|buy|pick up|grab|(?:we're|we are|i'm|i am)\s+out of|(?:we've|we have|i've)\s+run out of|(?:we've|we have)\s+got no|out of|run out of)\s+/i;
const TODO_LEAD =
  /^(?:(?:can you|could you|please)\s+)*(?:(?:i|we)\s+)?(?:need to|have to|has to|got to|gotta|must|should|don't forget to|do not forget to|remember to|to-?do:?)\s+/i;
const EVENT_LEAD =
  /^(?:(?:can you|could you|please)\s+)*(?:(?:add|put|create|make|schedule|book)\s+(?:an?\s+)?(?:event|appointment)(?:\s+(?:for|called|named))?|(?:we|i)\s+have|(?:we've|we have|i've)\s+got)\s+/i;
const ADD_LEAD = /^(?:(?:can you|could you|please)\s+)*(?:add|put|write down|note down|note)\s+/i;

/** Leftover connecting words at the edges of the title ("… on", "for …"). */
function tidyTitle(text: string): string {
  let title = text
    .replace(/\b(?:please|thanks|thank you)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 4; i += 1) {
    const before = title;
    title = title
      .replace(/^(?:and|to|for|about|that|called|named|a|an)\s+/i, "")
      .replace(/\s+(?:on|at|for|by|in|and|to|the|this|next)$/i, "")
      .replace(/^[,:;\-\s]+|[,:;\-\s]+$/g, "")
      .trim();
    if (title === before) break;
  }
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : "";
}

/** "milk, eggs and some bread" → ["Milk", "Eggs", "Bread"]. */
export function splitItems(text: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const part of text.split(/\s*(?:,|&|\band\b|\bplus\b|\bas well as\b)\s*/i)) {
    const clean = tidyTitle(part.replace(/^(?:some|more|a few|a couple of|a bit of|the)\s+/i, ""));
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      items.push(clean);
    }
  }
  return items;
}

export function parseVoiceCommand(transcript: string, now: Date = new Date()): VoiceCommand {
  let text = normalise(transcript);
  let kind: VoiceKind | null = null;

  // Where it should go, when said outright.
  const targets: [RegExp, VoiceKind][] = [
    [GROCERY_TARGET, "grocery"],
    [TODO_TARGET, "todo"],
    [CALENDAR_TARGET, "event"],
  ];
  for (const [pattern, target] of targets) {
    const match = text.match(pattern);
    if (match) {
      kind ??= target;
      text = cut(text, match);
    }
  }

  // How it starts: "remind me to…", "buy…", "I need to…".
  let lead: VoiceKind | null = null;
  let match = text.match(REMINDER_LEAD);
  if (match) {
    lead = "reminder";
  } else if ((match = text.match(GROCERY_LEAD))) {
    lead = "grocery";
  } else if ((match = text.match(EVENT_LEAD))) {
    lead = "event";
  } else if ((match = text.match(TODO_LEAD))) {
    lead = "todo";
  } else if ((match = text.match(ADD_LEAD))) {
    lead = null;
  }
  if (match) text = cut(text, match);
  // "I need to buy…" after "add" ("add: need to buy bread").
  if (!lead && (match = text.match(GROCERY_LEAD))) {
    lead = "grocery";
    text = cut(text, match);
  }

  const recurring = takeRecurrence(text, now);
  text = recurring.text;
  const timed = takeTime(text);
  text = timed.text;
  const dated = takeDate(text, now);
  text = dated.text;

  const hasWhen = Boolean(dated.date || timed.time || recurring.recurrence !== "none" || timed.tonight);

  if (!kind) {
    if (lead === "reminder" || lead === "grocery" || lead === "event") kind = lead;
    else if (lead === "todo") kind = hasWhen ? "reminder" : "todo";
    else if (hasWhen) kind = "event";
    else {
      const parts = splitItems(text);
      kind = parts.length > 0 && parts.every(isKnownGrocery) ? "grocery" : "todo";
    }
  }

  // No day said: today, or tomorrow if that time has already passed.
  let date = dated.date ?? recurring.date ?? addDays(now, 0);
  if (!dated.date && !recurring.date && timed.time) {
    const [hour, minute] = timed.time.split(":").map(Number);
    if (hour * 60 + minute <= now.getHours() * 60 + now.getMinutes()) date = addDays(now, 1);
  }

  const title = tidyTitle(text);
  return {
    kind,
    title,
    items: splitItems(text),
    date: dateKey(date),
    time: timed.time,
    recurrence: recurring.recurrence,
  };
}

/** "Tomorrow", "Fri 14 Nov" — for the confirm card. */
export function describeDate(key: string, now: Date = new Date()): string {
  const today = dateKey(now);
  if (key === today) return "Today";
  if (key === dateKey(addDays(now, 1))) return "Tomorrow";
  return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
