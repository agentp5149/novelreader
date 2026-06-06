import * as cheerio from "cheerio";
import type { SearchResult, Novel, ChapterMeta, ChapterContent } from "../../shared/types";
import { SourceLayoutError } from "./adapter";

export const BASE = "https://novelfire.net";

function abs(src: string): string {
  if (!src) return "";
  return src.startsWith("http") ? src : `${BASE}${src.startsWith("/") ? "" : "/"}${src}`;
}

function slugFromBookHref(href: string): string {
  // "/book/shadow-slave" -> "shadow-slave"
  return href.replace(/^.*\/book\//, "").replace(/\/$/, "");
}

export function parseSearch(html: string): SearchResult[] {
  const $ = cheerio.load(html);
  const items = $("li.novel-item");
  const results: SearchResult[] = [];
  items.each((_, el) => {
    const a = $(el).find('a[href^="/book/"]').first();
    const href = a.attr("href");
    if (!href) return;
    const title = $(el).find("h4.novel-title").text().trim();
    const cover = $(el).find("figure.novel-cover img").attr("src") ?? "";
    results.push({ slug: slugFromBookHref(href), title, coverUrl: abs(cover) });
  });
  return results;
}

export function parseNovelMeta(
  html: string,
  slug: string
): Omit<Novel, "chapters"> {
  const $ = cheerio.load(html);
  const title = $("h1.novel-title").first().text().trim();
  if (!title) throw new SourceLayoutError("novel title not found");
  const author = $('span[itemprop="author"]').first().text().trim();
  const cover = $("figure.cover img").first().attr("src") ?? "";
  const synopsis = $(".summary .content p")
    .map((_, p) => $(p).text().trim())
    .get()
    .join(" ")
    .trim();
  return { slug, title, author, coverUrl: abs(cover), synopsis };
}

export function parseChapterListPage(html: string, slug: string): ChapterMeta[] {
  const $ = cheerio.load(html);
  const out: ChapterMeta[] = [];
  $("ul.chapter-list li a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const number = parseInt($(el).find("span.chapter-no").text().trim(), 10);
    const title = $(el).find("strong.chapter-title").text().trim();
    const updatedAt = $(el).find("time.chapter-update").attr("datetime") ?? undefined;
    const id = href.replace(/^.*\/book\//, "").replace(/\/$/, "");
    out.push({ id, number, title, url: abs(href), updatedAt });
  });
  return out;
}

export function parseLastPage(html: string): number {
  const $ = cheerio.load(html);
  let max = 1;
  $(".pagination a.page-link").each((_, el) => {
    const n = parseInt($(el).text().trim(), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  });
  return max;
}

function chapterIdFromHref(href: string | undefined): string | undefined {
  if (!href || href.startsWith("javascript")) return undefined;
  return href.replace(/^.*\/book\//, "").replace(/\/$/, "");
}

export function parseChapter(html: string, id: string): ChapterContent {
  const $ = cheerio.load(html);
  const title = $(".titles .chapter-title").first().text().trim();
  const container = $("#chapter-container");
  if (container.length === 0) throw new SourceLayoutError("chapter container not found");
  container.find("script, ins, .nf-ads, iframe").remove();
  const text = container
    .find("p")
    .map((_, p) => $(p).text().trim())
    .get()
    .filter((t) => t.length > 0)
    .join("\n\n");
  const next = chapterIdFromHref($('a.nextchap[rel="next"]').attr("href"));
  const prev = chapterIdFromHref($('a.prevchap[rel="prev"]').attr("href"));
  return { id, title, text, prev, next };
}
