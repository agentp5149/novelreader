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
