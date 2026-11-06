// Headlines for the Home news card. Feeds are fetched by /api/news on the
// server (RSS has no CORS) and parsed here with plain string handling, so no
// XML dependency is needed. Everything from a feed is treated as untrusted
// text: tags are stripped, entities decoded, and only http(s) links kept.

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string | null;
};

/** `local`: a Perth/WA feed whose stories are all kept. Others are filtered to Perth. */
export type NewsFeed = { url: string; source: string; local?: boolean };

/**
 * Perth and WA news: ABC News WA and WAtoday in full, plus national ABC
 * stories that are about Perth or WA.
 */
export const DEFAULT_NEWS_FEEDS: NewsFeed[] = [
  { url: "https://www.abc.net.au/news/feed/5313390/rss.xml", source: "ABC News WA", local: true },
  { url: "https://www.watoday.com.au/rss/feed.xml", source: "WAtoday", local: true },
  { url: "https://www.abc.net.au/news/feed/10719986/rss.xml", source: "ABC News" },
];

/**
 * NEWS_FEEDS overrides the defaults: comma-separated `url`, `Label|url` or
 * `Label|url|local` entries (`local` keeps every story; otherwise only Perth
 * and WA stories are shown). Anything that isn't an https URL is ignored.
 */
export function newsFeedsFromEnv(value: string | undefined): NewsFeed[] {
  if (!value?.trim()) return DEFAULT_NEWS_FEEDS;
  const feeds = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .flatMap((entry): NewsFeed[] => {
      const parts = entry.split("|").map((part) => part.trim());
      const [label, raw, flag] = parts.length > 1 ? parts : ["", parts[0]];
      try {
        const url = new URL(raw);
        if (url.protocol !== "https:") return [];
        const feed: NewsFeed = { url: url.toString(), source: label || url.hostname.replace(/^www\./, "") };
        if (flag?.toLowerCase() === "local") feed.local = true;
        return [feed];
      } catch {
        return [];
      }
    });
  return feeds.length ? feeds.slice(0, 6) : DEFAULT_NEWS_FEEDS;
}

// Perth, WA and Perth-area places. "WA" must be upper case on its own.
const PERTH_WORDS =
  /\b(perth|western australia(n)?|fremantle|freo|joondalup|rockingham|mandurah|kwinana|armadale|midland|cannington|subiaco|cottesloe|scarborough|ellenbrook|baldivis|wanneroo|morley|northbridge|optus stadium|rottnest|swan river|perth hills|wheatbelt|pilbara|kimberley|goldfields|kalgoorlie|bunbury|busselton|margaret river|albany|geraldton|broome|karratha|port hedland|wa police|wa labor|wa liberals?|wacca|west coast eagles|fremantle dockers|perth glory|perth scorchers|perth wildcats)\b/i;
const WA_ABBREVIATION = /(^|[^A-Za-z])WA([^A-Za-z]|$)/;

/** Whether a headline is about Perth or Western Australia. */
export function isPerthStory(item: Pick<NewsItem, "title">): boolean {
  return PERTH_WORDS.test(item.title) || WA_ABBREVIATION.test(item.title);
}

/** Keeps local feeds whole and filters the rest to Perth and WA stories. */
export function perthOnly(groups: NewsItem[][], feeds: NewsFeed[]): NewsItem[][] {
  return groups.map((items, index) => (feeds[index]?.local ? items : items.filter(isPerthStory)));
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  deg: "°",
  middot: "·",
  eacute: "é",
  pound: "£",
  euro: "€",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point < 0x110000 ? String.fromCodePoint(point) : "";
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Plain text from an RSS field: CDATA unwrapped, tags removed, entities decoded. */
export function cleanText(raw: string): string {
  const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Decode first so encoded markup (&lt;b&gt;) is stripped as well.
  return decodeEntities(decodeEntities(unwrapped).replace(/<[^>]*>/g, " "))
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function field(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function safeLink(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isoDate(raw: string): string | null {
  if (!raw) return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/**
 * `<tag ...>...</tag>` blocks, found with a single forward scan. (A lazy
 * regex over the whole feed can go quadratic on a malformed one.)
 */
function blocksOf(xml: string, tag: string, max: number): string[] {
  const lower = xml.toLowerCase();
  const open = `<${tag}`;
  const close = `</${tag}>`;
  const blocks: string[] = [];
  let from = 0;
  while (blocks.length < max) {
    const start = lower.indexOf(open, from);
    if (start === -1) break;
    const next = lower[start + open.length];
    if (next !== ">" && !/\s/.test(next ?? "")) {
      from = start + open.length;
      continue;
    }
    const end = lower.indexOf(close, start);
    if (end === -1) break;
    blocks.push(xml.slice(start, end + close.length));
    from = end + close.length;
  }
  return blocks;
}

/** Field blocks are capped too, so one huge item can't dominate the work. */
const MAX_BLOCK = 20_000;

/** Parses RSS 2.0 <item>s and Atom <entry>s. */
export function parseFeed(xml: string, source: string, limit = 20): NewsItem[] {
  const scan = limit * 3;
  const found = blocksOf(xml, "item", scan);
  const blocks = (found.length ? found : blocksOf(xml, "entry", scan)).map((block) => block.slice(0, MAX_BLOCK));
  const items: NewsItem[] = [];
  for (const block of blocks) {
    const title = field(block, "title").slice(0, 220);
    const atomHref = block.match(/<link[^>]*href="([^"]+)"/i)?.[1];
    const link = safeLink(decodeEntities(field(block, "link") || atomHref || field(block, "guid")));
    if (!title || !link) continue;
    const publishedAt = isoDate(field(block, "pubDate") || field(block, "published") || field(block, "updated") || field(block, "dc:date"));
    items.push({ id: link, title, link, source, publishedAt });
    if (items.length >= limit) break;
  }
  return items;
}

const titleKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Newest first, without the same story twice across feeds. */
export function mergeNews(groups: NewsItem[][], limit = 12): NewsItem[] {
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of groups.flat().sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))) {
    const key = titleKey(item.title);
    if (seen.has(key) || seen.has(item.link)) continue;
    seen.add(key);
    seen.add(item.link);
    merged.push(item);
    if (merged.length >= limit) break;
  }
  return merged;
}

export function newsAge(publishedAt: string | null, now: Date): string {
  if (!publishedAt) return "";
  const minutes = Math.round((now.getTime() - Date.parse(publishedAt)) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}
