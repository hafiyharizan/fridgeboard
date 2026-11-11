import { afterEach, describe, expect, it, vi } from "vitest";
import {
  askModel,
  assistantConfig,
  AssistantError,
  DEFAULT_OLLAMA_URL,
  ollamaRequestBody,
  readOllamaAnswer,
} from "@/lib/assistant/provider";

describe("assistantConfig", () => {
  it("is off unless a provider is named and fully set up", () => {
    expect(assistantConfig({})).toBeNull();
    expect(assistantConfig({ ASSISTANT_PROVIDER: "openai" })).toBeNull();
    expect(assistantConfig({ ASSISTANT_PROVIDER: "ollama" })).toBeNull();
    expect(assistantConfig({ ASSISTANT_PROVIDER: "anthropic" })).toBeNull();
    expect(assistantConfig({ ASSISTANT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "  " })).toBeNull();
  });

  it("reads Ollama with the default address", () => {
    expect(assistantConfig({ ASSISTANT_PROVIDER: " Ollama ", OLLAMA_MODEL: "qwen3.5:9b" })).toEqual({
      provider: "ollama",
      url: DEFAULT_OLLAMA_URL,
      model: "qwen3.5:9b",
    });
    expect(
      assistantConfig({ ASSISTANT_PROVIDER: "ollama", OLLAMA_MODEL: "m", OLLAMA_URL: "https://box.example/ollama/" }),
    ).toMatchObject({ url: "https://box.example/ollama" });
  });

  it("refuses an address that isn't http(s)", () => {
    for (const OLLAMA_URL of ["file:///etc/passwd", "not a url", "ftp://box"]) {
      expect(assistantConfig({ ASSISTANT_PROVIDER: "ollama", OLLAMA_MODEL: "m", OLLAMA_URL })).toBeNull();
    }
  });

  it("reads Anthropic", () => {
    expect(assistantConfig({ ASSISTANT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "key" })).toEqual({
      provider: "anthropic",
      apiKey: "key",
    });
  });
});

describe("ollamaRequestBody", () => {
  const turns = [
    { role: "user" as const, text: "What is on today?" },
    { role: "assistant" as const, text: "Dentist at 3." },
    { role: "user" as const, text: "And tomorrow?" },
  ];
  it("sends the system prompt first, a set context size and no streaming", () => {
    const body = ollamaRequestBody("m", "SYSTEM", turns, true);
    expect(body.stream).toBe(false);
    expect(body.think).toBe(false);
    expect(body.options.num_ctx).toBeGreaterThanOrEqual(8192);
    expect(body.keep_alive).toBe("30m");
    expect(body.messages[0]).toEqual({ role: "system", content: "SYSTEM" });
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "And tomorrow?" });
  });
  it("can leave the think option out", () => {
    expect(ollamaRequestBody("m", "S", turns, false)).not.toHaveProperty("think");
  });
});

describe("readOllamaAnswer", () => {
  it("returns the text and drops a leaked reasoning block", () => {
    expect(readOllamaAnswer({ message: { content: " Dentist at 3 PM. " } })).toBe("Dentist at 3 PM.");
    expect(readOllamaAnswer({ message: { content: "<think>hmm\nlet me see</think>\nNothing on." } })).toBe(
      "Nothing on.",
    );
  });
  it("is empty for anything unexpected", () => {
    for (const payload of [null, {}, { message: {} }, { message: { content: 5 } }, { error: "x" }]) {
      expect(readOllamaAnswer(payload)).toBe("");
    }
  });
});

describe("askModel with Ollama", () => {
  const config = { provider: "ollama" as const, url: "http://localhost:11434", model: "m" };
  const turns = [{ role: "user" as const, text: "Hi" }];
  const signal = () => new AbortController().signal;
  const reply = (body: unknown, status = 200) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

  afterEach(() => vi.unstubAllGlobals());

  it("posts to /api/chat and returns the answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ message: { content: "Hello." } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(askModel(config, "S", turns, signal())).resolves.toBe("Hello.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:11434/api/chat");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST", redirect: "error" });
  });

  it("asks again without the think option when the model refuses it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ error: "this model does not support thinking" }, 400))
      .mockResolvedValueOnce(reply({ message: { content: "Hello." } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(askModel(config, "S", turns, signal())).resolves.toBe("Hello.");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty("think");
  });

  it("reports a server that is off, slow, failing or silent", async () => {
    const cases: [() => Promise<Response>, string][] = [
      [() => Promise.reject(new TypeError("fetch failed")), "unreachable"],
      [() => Promise.reject(new DOMException("timed out", "TimeoutError")), "timeout"],
      [() => Promise.resolve(reply({ error: "model not found" }, 404)), "failed"],
      [() => Promise.resolve(reply("<html>", 200)), "failed"],
      [() => Promise.resolve(reply({ message: { content: "  " } })), "empty"],
    ];
    for (const [respond, kind] of cases) {
      vi.stubGlobal("fetch", vi.fn().mockImplementation(respond));
      const failure = await askModel(config, "S", turns, signal()).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(AssistantError);
      expect((failure as AssistantError).kind).toBe(kind);
    }
  });
});
