// Household assistant: the model behind it. Chosen by ASSISTANT_PROVIDER on
// the server ("ollama" or "anthropic"); unset means the feature is off.
// Server only: the model address and API key never come from a request.

import type { Turn } from "@/lib/assistant/limits";

export type AssistantConfig =
  | { provider: "ollama"; url: string; model: string }
  | { provider: "anthropic"; apiKey: string };

/** Why a question couldn't be answered; the route turns it into plain words. */
export type AssistantFailure = "timeout" | "unreachable" | "refused" | "empty" | "failed";

export class AssistantError extends Error {
  constructor(readonly kind: AssistantFailure) {
    super(kind);
    this.name = "AssistantError";
  }
}

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
export const ANTHROPIC_MODEL = "claude-haiku-5-5";

/** Ollama's default context is too small for the household snapshot. */
const OLLAMA_CONTEXT_TOKENS = 8192;
/** Keep the model loaded between questions, so only the first one is slow. */
const OLLAMA_KEEP_ALIVE = "30m";
const MAX_ANSWER_TOKENS = 2000;

type Env = Record<string, string | undefined>;

/** The configured provider, or null when the feature is off or half set up. */
export function assistantConfig(env: Env = process.env): AssistantConfig | null {
  const provider = env.ASSISTANT_PROVIDER?.trim().toLowerCase();
  if (provider === "ollama") {
    const model = env.OLLAMA_MODEL?.trim();
    if (!model) return null;
    try {
      const url = new URL(env.OLLAMA_URL?.trim() || DEFAULT_OLLAMA_URL);
      if (url.protocol !== "http:" && url.protocol !== "https:") return null;
      return { provider, url: url.href.replace(/\/+$/, ""), model };
    } catch {
      return null;
    }
  }
  if (provider === "anthropic") {
    const apiKey = env.ANTHROPIC_API_KEY?.trim();
    return apiKey ? { provider, apiKey } : null;
  }
  return null;
}

/** Body for Ollama's POST /api/chat. `think: false` skips the reasoning pass on models that have one. */
export function ollamaRequestBody(model: string, system: string, turns: Turn[], disableThinking: boolean) {
  return {
    model,
    stream: false,
    keep_alive: OLLAMA_KEEP_ALIVE,
    ...(disableThinking ? { think: false } : {}),
    options: { num_ctx: OLLAMA_CONTEXT_TOKENS, num_predict: MAX_ANSWER_TOKENS, temperature: 0.2 },
    messages: [
      { role: "system", content: system },
      ...turns.map((turn) => ({ role: turn.role, content: turn.text })),
    ],
  };
}

/** The answer text from an Ollama chat response, without any leaked reasoning block. */
export function readOllamaAnswer(payload: unknown): string {
  const content = (payload as { message?: { content?: unknown } } | null)?.message?.content;
  if (typeof content !== "string") return "";
  return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

async function askOllama(
  config: Extract<AssistantConfig, { provider: "ollama" }>,
  system: string,
  turns: Turn[],
  signal: AbortSignal,
): Promise<string> {
  const post = (disableThinking: boolean) =>
    fetch(`${config.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaRequestBody(config.model, system, turns, disableThinking)),
      redirect: "error",
      cache: "no-store",
      signal,
    });

  let response: Response;
  try {
    response = await post(true);
    // A model with no reasoning pass may refuse the "think" option: ask again without it.
    if (response.status === 400 && /think/i.test(await response.text())) response = await post(false);
  } catch (error) {
    throw new AssistantError(signal.aborted || isAbort(error) ? "timeout" : "unreachable");
  }
  if (!response.ok) throw new AssistantError("failed");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new AssistantError(isAbort(error) ? "timeout" : "failed");
  }
  const answer = readOllamaAnswer(payload);
  if (!answer) throw new AssistantError("empty");
  return answer;
}

async function askAnthropic(
  config: Extract<AssistantConfig, { provider: "anthropic" }>,
  system: string,
  turns: Turn[],
  signal: AbortSignal,
): Promise<string> {
  // Loaded only when this provider is in use.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: config.apiKey, maxRetries: 1 });
  try {
    const response = await client.messages.create(
      {
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_ANSWER_TOKENS,
        output_config: { effort: "low" },
        system,
        messages: turns.map((turn) => ({ role: turn.role, content: turn.text })),
      },
      { signal },
    );
    if (response.stop_reason === "refusal") throw new AssistantError("refused");
    const answer = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    if (!answer) throw new AssistantError("empty");
    return answer;
  } catch (error) {
    if (error instanceof AssistantError) throw error;
    if (error instanceof Anthropic.APIUserAbortError) throw new AssistantError("timeout");
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw new AssistantError("timeout");
    if (error instanceof Anthropic.APIConnectionError) throw new AssistantError("unreachable");
    throw new AssistantError("failed");
  }
}

/**
 * One answer from the configured model. `turns` ends with the question.
 * Throws AssistantError; `signal` carries the server-side timeout.
 */
export function askModel(
  config: AssistantConfig,
  system: string,
  turns: Turn[],
  signal: AbortSignal,
): Promise<string> {
  return config.provider === "ollama"
    ? askOllama(config, system, turns, signal)
    : askAnthropic(config, system, turns, signal);
}
