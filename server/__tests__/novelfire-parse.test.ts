import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSearch, parseNovelMeta, parseChapterListPage, parseLastPage } from "../source/novelfire";

const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("parseSearch", () => {
  it("extracts novels from search HTML", () => {
    const results = parseSearch(fx("search.html"));
    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.slug).toBe("shadow-slave");
    expect(first.title).toBe("Shadow Slave");
    expect(first.coverUrl).toBe("https://novelfire.net/server-1/shadow-slave.jpg");
  });
});

describe("parseNovelMeta", () => {
  it("extracts title, author, cover, synopsis", () => {
    const meta = parseNovelMeta(fx("book.html"), "shadow-slave");
    expect(meta.title).toBe("Shadow Slave");
    expect(meta.author).toBe("Guiltythree");
    expect(meta.coverUrl).toBe("https://novelfire.net/server-1/shadow-slave.jpg");
    expect(meta.synopsis).toContain("Sunny never expected");
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
