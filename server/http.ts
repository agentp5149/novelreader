const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// A full Chrome-on-Windows header set. NovelFire sits behind Cloudflare, which
// rejects requests that don't look like a real browser at the HTTP layer.
// (Accept-Encoding is intentionally omitted so the fetch impl can negotiate and
// auto-decompress the response itself.)
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1"
};

interface FetcherOptions {
  fetchImpl?: typeof fetch;
  minIntervalMs?: number;
  cacheTtlMs?: number;
}

export function makeFetcher(opts: FetcherOptions = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const minIntervalMs = opts.minIntervalMs ?? 800;
  const cacheTtlMs = opts.cacheTtlMs ?? 5 * 60 * 1000;
  const cache = new Map<string, { at: number; body: string }>();
  let lastCall = 0;

  async function gate() {
    const wait = lastCall + minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
  }

  return async function fetchHtml(url: string): Promise<string> {
    const hit = cache.get(url);
    if (hit && Date.now() - hit.at < cacheTtlMs) return hit.body;
    await gate();
    const res = await fetchImpl(url, { headers: BROWSER_HEADERS });
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
    const body = await res.text();
    cache.set(url, { at: Date.now(), body });
    return body;
  };
}

export type FetchHtml = ReturnType<typeof makeFetcher>;
