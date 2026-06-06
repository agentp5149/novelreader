import { describe, it, expect, vi } from "vitest";
import { makeFetcher } from "../http";

describe("makeFetcher", () => {
  it("sends a browser User-Agent and returns body text", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response("<html>ok</html>", { status: 200 })
    );
    const fetchHtml = makeFetcher({ fetchImpl: fakeFetch as any, minIntervalMs: 0 });
    const body = await fetchHtml("https://novelfire.net/x");
    expect(body).toBe("<html>ok</html>");
    const headers = (fakeFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toContain("Mozilla/5.0");
  });

  it("caches repeated URLs (one network call)", async () => {
    const fakeFetch = vi.fn(async () => new Response("<html>y</html>", { status: 200 }));
    const fetchHtml = makeFetcher({ fetchImpl: fakeFetch as any, minIntervalMs: 0 });
    await fetchHtml("https://novelfire.net/y");
    await fetchHtml("https://novelfire.net/y");
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it("throws on non-200", async () => {
    const fakeFetch = vi.fn(async () => new Response("nope", { status: 403 }));
    const fetchHtml = makeFetcher({ fetchImpl: fakeFetch as any, minIntervalMs: 0 });
    await expect(fetchHtml("https://novelfire.net/z")).rejects.toThrow(/403/);
  });
});
