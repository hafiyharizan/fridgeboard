import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rss = (title: string) =>
  `<rss><channel><item><title>${title}</title><link>https://www.abc.net.au/news/1</link><pubDate>Wed, 04 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>`;

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

describe("GET /api/news", () => {
  beforeEach(() => {
    vi.stubEnv("NEWS_FEEDS", "Test|https://feeds.example.com/rss");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns headlines from the configured feed", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      void url;
      return new Response(rss("Hello Perth"));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();
    const body = await (await GET()).json();
    expect(body.items.map((item: { title: string }) => item.title)).toEqual(["Hello Perth"]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://feeds.example.com/rss");
  });

  it("follows https redirects but refuses to leave https", async () => {
    const fetchMock = vi.fn(async (url: URL) =>
      url.pathname === "/rss"
        ? new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } })
        : new Response(rss("Should not load")),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();
    const response = await GET();
    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops after a few redirects", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 301, headers: { location: "/again" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();
    expect((await GET()).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("refuses feeds that say they are too large", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(rss("Big"), { headers: { "content-length": "5000000" } })));
    const { GET } = await loadRoute();
    expect((await GET()).status).toBe(502);
  });

  it("shares one refresh between concurrent requests and then caches", async () => {
    const fetchMock = vi.fn(async () => new Response(rss("Once")));
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await loadRoute();
    await Promise.all([GET(), GET(), GET()]);
    await GET();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
