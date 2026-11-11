// Household assistant: what a request may contain, and how often one member
// may ask. Pure, so it can be unit tested.

export type Turn = { role: "user" | "assistant"; text: string };

export const MAX_QUESTION_LENGTH = 500;
export const MAX_HISTORY_TURNS = 6;
export const MAX_TURN_LENGTH = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AskRequest = {
  question: string;
  history: Turn[];
  /** Member picked in "Who's adding?" on a kitchen display; checked against the household later. */
  asker: string | null;
};

function trimTo(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * Reads `{ question, history?, asker? }`. Returns a plain-language error for
 * a question that is missing or too long; anything odd in the optional parts
 * is dropped rather than refused.
 */
export function parseAskRequest(body: unknown): AskRequest | { error: string } {
  if (!body || typeof body !== "object") return { error: "Ask a question first." };
  const { question, history, asker } = body as { question?: unknown; history?: unknown; asker?: unknown };
  if (typeof question !== "string" || !question.trim()) return { error: "Ask a question first." };
  if (question.trim().length > MAX_QUESTION_LENGTH)
    return { error: `Keep the question under ${MAX_QUESTION_LENGTH} characters.` };

  const turns: Turn[] = [];
  if (Array.isArray(history)) {
    for (const entry of history.slice(-MAX_HISTORY_TURNS)) {
      const { role, text } = (entry ?? {}) as { role?: unknown; text?: unknown };
      if ((role !== "user" && role !== "assistant") || typeof text !== "string" || !text.trim()) continue;
      turns.push({ role, text: trimTo(text, MAX_TURN_LENGTH) });
    }
  }
  // A conversation starts with the person, not the assistant.
  while (turns.length && turns[0].role === "assistant") turns.shift();

  return {
    question: question.trim(),
    history: turns,
    asker: typeof asker === "string" && UUID.test(asker) ? asker : null,
  };
}

export type RateLimiter = {
  /** Records the request and returns true, or returns false when over the limit. */
  allow: (key: string, now?: number) => boolean;
};

/**
 * At most `limit` requests per `windowMs` for each key, counted over a
 * sliding window. In memory: on serverless that is per instance, which is
 * enough to stop a stuck button or a loop in a household app.
 */
export function createRateLimiter(limit: number, windowMs: number, maxKeys = 500): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    allow(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      // Re-insert so the map stays ordered by last use, then drop the oldest keys.
      hits.delete(key);
      hits.set(key, recent);
      while (hits.size > maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest === undefined) break;
        hits.delete(oldest);
      }
      return true;
    },
  };
}
