import { describe, expect, it } from "vitest";
import { cleanText, DEFAULT_NEWS_FEEDS, isPerthStory, mergeNews, newsAge, newsFeedsFromEnv, parseFeed, perthOnly } from "@/lib/news";

const rss = `<?xml version="1.0"?><rss><channel><title>ABC</title>
<item><title><![CDATA[Perth hits 30&deg; &amp; more]]></title><link>https://www.abc.net.au/news/1</link>
<pubDate>Wed, 04 Nov 2026 10:00:00 GMT</pubDate></item>
<item><title>Rate &#8217;steady&#x2019; <b>call</b></title><link>https://www.abc.net.au/news/2</link>
<pubDate>Wed, 04 Nov 2026 11:30:00 GMT</pubDate></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
<item><title></title><link>https://example.com/empty</link></item>
</channel></rss>`;

describe("parseFeed", () => {
  it("reads RSS items, cleans titles and keeps only http(s) links", () => {
    const items = parseFeed(rss, "ABC News");
    expect(items.map((item) => item.title)).toEqual(["Perth hits 30° & more", "Rate ’steady’ call"]);
    expect(items[0]).toMatchObject({ link: "https://www.abc.net.au/news/1", source: "ABC News", publishedAt: "2026-11-04T10:00:00.000Z" });
  });
  it("reads Atom entries", () => {
    const atom = `<feed><entry><title>Atom story</title><link rel="alternate" href="https://x.test/a"/><updated>2026-11-04T09:00:00Z</updated></entry></feed>`;
    expect(parseFeed(atom, "X")).toEqual([{ id: "https://x.test/a", title: "Atom story", link: "https://x.test/a", source: "X", publishedAt: "2026-11-04T09:00:00.000Z" }]);
  });
  it("stays fast on a malformed feed", () => {
    const junk = "<item ".repeat(300_000);
    const started = Date.now();
    expect(parseFeed(junk, "X")).toEqual([]);
    expect(Date.now() - started).toBeLessThan(500);
  });
  it("ignores look-alike tags such as <itemized>", () => {
    expect(parseFeed("<itemized><title>No</title><link>https://x.test</link></itemized>", "X")).toEqual([]);
  });
  it("survives junk", () => {
    expect(parseFeed("not xml at all", "X")).toEqual([]);
    expect(parseFeed("<item><title>No link</title></item>", "X")).toEqual([]);
  });
  it("strips encoded markup", () => {
    expect(cleanText("&lt;script&gt;x&lt;/script&gt; Hello")).toBe("x Hello");
  });
});

describe("mergeNews", () => {
  it("sorts newest first and drops duplicate stories across feeds", () => {
    const a = parseFeed(rss, "ABC News WA");
    const b = [{ ...a[1], source: "ABC News" }, { id: "z", title: "Older", link: "https://z.test", source: "ABC News", publishedAt: "2026-11-01T00:00:00.000Z" }];
    const merged = mergeNews([a, b]);
    expect(merged.map((item) => item.title)).toEqual(["Rate ’steady’ call", "Perth hits 30° & more", "Older"]);
    expect(mergeNews([a, b], 1)).toHaveLength(1);
  });
});

describe("feeds from env", () => {
  it("defaults to ABC", () => {
    expect(newsFeedsFromEnv(undefined)).toBe(DEFAULT_NEWS_FEEDS);
    expect(newsFeedsFromEnv("  ")).toBe(DEFAULT_NEWS_FEEDS);
  });
  it("accepts labelled https feeds and ignores the rest", () => {
    expect(newsFeedsFromEnv("FMT|https://www.freemalaysiatoday.com/feed/, http://insecure.test/rss, nonsense, https://www.bernama.com/en/rss")).toEqual([
      { url: "https://www.freemalaysiatoday.com/feed/", source: "FMT" },
      { url: "https://www.bernama.com/en/rss", source: "bernama.com" },
    ]);
    expect(newsFeedsFromEnv("http://only-insecure.test")).toBe(DEFAULT_NEWS_FEEDS);
  });
});

describe("newsAge", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  it("describes how old a story is", () => {
    expect(newsAge("2026-11-04T11:59:40Z", now)).toBe("Just now");
    expect(newsAge("2026-11-04T11:35:00Z", now)).toBe("25 min ago");
    expect(newsAge("2026-11-04T09:00:00Z", now)).toBe("3 h ago");
    expect(newsAge("2026-11-03T08:00:00Z", now)).toBe("Yesterday");
    expect(newsAge(null, now)).toBe("");
  });
});

describe("Perth filter", () => {
  it("recognises Perth and WA headlines", () => {
    expect(isPerthStory({ title: "Train delays across Perth tonight" })).toBe(true);
    expect(isPerthStory({ title: "WA Premier announces budget" })).toBe(true);
    expect(isPerthStory({ title: "Storm warning for Mandurah" })).toBe(true);
    expect(isPerthStory({ title: "Sydney rents rise again" })).toBe(false);
    expect(isPerthStory({ title: "Washington talks stall" })).toBe(false);
    expect(isPerthStory({ title: "Kiwa wins award" })).toBe(false);
  });
  it("keeps local feeds whole and filters the rest", () => {
    const item = (title: string) => ({ id: title, title, link: "https://x.test/" + title, source: "s", publishedAt: null });
    const groups = [[item("Council meeting")], [item("Sydney news"), item("Perth news")]];
    const feeds = [
      { url: "https://a.test", source: "Local", local: true },
      { url: "https://b.test", source: "National" },
    ];
    expect(perthOnly(groups, feeds).map((g) => g.map((i) => i.title))).toEqual([["Council meeting"], ["Perth news"]]);
  });
  it("reads the local flag from NEWS_FEEDS", () => {
    expect(newsFeedsFromEnv("Mine|https://a.test/rss|local")).toEqual([
      { url: "https://a.test/rss", source: "Mine", local: true },
    ]);
  });
});
