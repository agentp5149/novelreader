const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

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
    const res = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" }
    });
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
    const body = await res.text();
    cache.set(url, { at: Date.now(), body });
    return body;
  };
}

export type FetchHtml = ReturnType<typeof makeFetcher>;
