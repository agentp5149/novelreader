import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NovelFireAdapter } from "../source/novelfire";

const fx = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("NovelFireAdapter.getNovel", () => {
  it("merges metadata with all paginated chapters", async () => {
    const fetchHtml = async (url: string) => {
      if (url === "https://novelfire.net/book/shadow-slave") return fx("book.html");
      if (url.includes("/chapters")) return fx("chapters.html");
      throw new Error("unexpected url " + url);
    };
    const adapter = new NovelFireAdapter(fetchHtml);
    const novel = await adapter.getNovel("shadow-slave");
    expect(novel.title).toBe("Shadow Slave");
    expect(novel.chapters.length).toBeGreaterThanOrEqual(100);
    expect(novel.chapters[0].id).toBe("shadow-slave/chapter-1");
  });
});

describe("NovelFireAdapter.search", () => {
  it("returns parsed search results", async () => {
    const fetchHtml = async () => fx("search.html");
    const adapter = new NovelFireAdapter(fetchHtml);
    const results = await adapter.search("shadow");
    expect(results[0].slug).toBe("shadow-slave");
  });
});

describe("NovelFireAdapter.getChapter", () => {
  it("returns parsed chapter", async () => {
    const fetchHtml = async () => fx("chapter.html");
    const adapter = new NovelFireAdapter(fetchHtml);
    const ch = await adapter.getChapter("shadow-slave/chapter-1");
    expect(ch.next).toBe("shadow-slave/chapter-2");
  });
});

describe("NovelFireAdapter.getHome", () => {
  it("fetches the home page and returns curated sections", async () => {
    const fetchHtml = async (url: string) => {
      if (url === "https://novelfire.net/home") return fx("home.html");
      throw new Error("unexpected url " + url);
    };
    const adapter = new NovelFireAdapter(fetchHtml);
    const feed = await adapter.getHome();
    expect(feed.recommended.length).toBeGreaterThan(0);
    expect(feed.completed.length).toBeGreaterThan(0);
  });
});
