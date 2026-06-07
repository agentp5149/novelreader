import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSearch, parseNovelMeta, parseChapterListPage, parseLastPage, parseChapter, parseHome, parseRanking } from "../source/novelfire";

const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("parseSearch", () => {
  it("extracts only the real search results, excluding popular suggestions", () => {
    const results = parseSearch(fx("search.html"));
    expect(results.length).toBe(8);
    const first = results[0];
    expect(first.slug).toBe("shadow-slave");
    expect(first.title).toBe("Shadow Slave");
    expect(first.coverUrl).toBe("https://novelfire.net/server-1/shadow-slave.jpg");
    expect(
      results.every((r) => r.coverUrl.startsWith("https://novelfire.net/server-1/"))
    ).toBe(true);
  });
});

describe("parseHome", () => {
  it("extracts the recommended and completed sections with absolute covers", () => {
    const feed = parseHome(fx("home.html"));
    expect(feed.recommended.length).toBeGreaterThan(0);
    expect(feed.completed.length).toBeGreaterThan(0);

    const rec = feed.recommended[0];
    expect(rec.slug).toBe("role-playing-a-dual-personality-as-a-background-character-in-a-manga");
    expect(rec.title).toBe("Role-Playing a Dual Personality as a Background Character in a Manga");

    const comp = feed.completed[0];
    expect(comp.slug).toBe("transmigration-married-to-my-ex-fiances-uncle");

    const all = [...feed.recommended, ...feed.completed];
    expect(
      all.every((n) => n.coverUrl.startsWith("https://novelfire.net/server-1/"))
    ).toBe(true);
    expect(all.every((n) => n.slug.length > 0 && n.title.length > 0)).toBe(true);
  });
});

describe("parseRanking", () => {
  it("extracts the three ranking tabs with ordered entries and stats", () => {
    const tabs = parseRanking(fx("home.html"));
    expect(tabs.map((t) => t.label)).toEqual(["Most Read", "New Trend", "User Rated"]);

    const mostRead = tabs[0];
    expect(mostRead.key).toBe("most-read");
    expect(mostRead.entries.length).toBe(10);
    expect(mostRead.entries[0].rank).toBe(1);
    expect(mostRead.entries[0].slug).toBe("shadow-slave");
    expect(mostRead.entries[0].stats.length).toBeGreaterThan(0);
    expect(
      mostRead.entries.every((e) => e.coverUrl.startsWith("https://novelfire.net/server-1/"))
    ).toBe(true);

    const userRated = tabs[2];
    expect(userRated.key).toBe("user-rated");
    expect(typeof userRated.entries[0].rating).toBe("number");
  });
});

describe("parseHome", () => {
  it("includes the ranking tabs alongside recommended and completed", () => {
    const feed = parseHome(fx("home.html"));
    expect(feed.ranking.length).toBe(3);
    expect(feed.ranking[0].entries[0].rank).toBe(1);
  });
});

describe("parseNovelMeta", () => {
  it("extracts title, author, cover, synopsis", () => {
    const meta = parseNovelMeta(fx("book.html"), "shadow-slave");
    expect(meta.title).toBe("Shadow Slave");
    expect(meta.author).toBe("Guiltythree");
    expect(meta.coverUrl).toBe("https://novelfire.net/server-1/shadow-slave.jpg");
    expect(meta.synopsis).toContain("Sunny never expected");
    expect(meta.synopsis.length).toBeGreaterThan(100);
    expect(meta.synopsis).not.toContain("Show More");
  });
});

describe("parseChapterListPage", () => {
  it("extracts chapters from one chapters page", () => {
    const chapters = parseChapterListPage(fx("chapters.html"), "shadow-slave");
    expect(chapters.length).toBe(100);
    expect(chapters[0]).toEqual({
      id: "shadow-slave/chapter-1",
      number: 1,
      title: "Chapter 1 - 1: Nightmare Begins",
      url: "https://novelfire.net/book/shadow-slave/chapter-1",
      updatedAt: "2022-06-02 14:30:56"
    });
  });

  it("detects the last pagination page", () => {
    expect(parseLastPage(fx("chapters.html"))).toBeGreaterThanOrEqual(6);
  });
});

describe("parseChapter", () => {
  it("extracts title, text, and next id", () => {
    const ch = parseChapter(fx("chapter.html"), "shadow-slave/chapter-1");
    expect(ch.id).toBe("shadow-slave/chapter-1");
    expect(ch.title).toContain("Nightmare Begins");
    expect(ch.text.length).toBeGreaterThan(200);
    expect(ch.next).toBe("shadow-slave/chapter-2");
    expect(ch.prev).toBeUndefined();
  });
});
