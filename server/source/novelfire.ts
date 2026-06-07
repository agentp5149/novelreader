import * as cheerio from "cheerio";
import type {
  SearchResult,
  Novel,
  ChapterMeta,
  ChapterContent,
  HomeFeed,
  RankStat,
  RankEntry,
  RankingTab
} from "../../shared/types";
import { SourceLayoutError } from "./adapter";
import type { SourceAdapter } from "./adapter";
import type { FetchHtml } from "../http";

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
  // The search page also renders a "Some Popular Novels" suggestion section
  // whose items are unrelated to the query — exclude it.
  $("section.popular-novels").remove();
  const results: SearchResult[] = [];
  $("li.novel-item").each((_, el) => {
    const a = $(el).find('a[href^="/book/"]').first();
    const href = a.attr("href");
    if (!href) return;
    const title = $(el).find("h4.novel-title").text().trim();
    const img = $(el).find("figure.novel-cover img").first();
    // Lazy-loaded images keep the real URL in data-src and a placeholder in src.
    const cover = img.attr("data-src") ?? img.attr("src") ?? "";
    results.push({ slug: slugFromBookHref(href), title, coverUrl: abs(cover) });
  });
  return results;
}

// NovelFire renders stats with an icon font we don't ship; map each icon class
// to an equivalent emoji so the meaning survives in our own design.
const RANK_ICON: Record<string, string> = {
  "icon-eye": "👁",
  "icon-bookmark": "🔖",
  "icon-commenting-o": "💬",
  "icon-ok": "✓",
  "icon-pencil-2": "✍"
};

function rankSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rankingFromDoc($: cheerio.CheerioAPI): RankingTab[] {
  const tabs: RankingTab[] = [];
  $(".index-rank .rank-container").each((_, rc) => {
    const label = $(rc).find("h3").first().text().trim();
    const entries: RankEntry[] = [];
    $(rc)
      .find("li.novel-item")
      .each((i, el) => {
        const href = $(el).find('a[href^="/book/"]').first().attr("href");
        if (!href) return;
        const title = $(el).find("h4.novel-title").first().text().trim();
        const img = $(el).find(".novel-cover img").first();
        const cover = img.attr("data-src") ?? img.attr("src") ?? "";
        const ratingAttr = $(el).find(".info-rating").attr("data-rating");
        const rating = ratingAttr ? Number(ratingAttr) : undefined;
        const stats: RankStat[] = [];
        $(el)
          .find(".item-body span")
          .each((_, sp) => {
            const text = $(sp).text().trim();
            if (!text) return;
            const iconClass = ($(sp).find("i").attr("class") ?? "")
              .split(/\s+/)
              .find((c) => c.startsWith("icon-")) ?? "";
            stats.push({ icon: RANK_ICON[iconClass] ?? "", text });
          });
        entries.push({
          rank: i + 1,
          slug: slugFromBookHref(href),
          title,
          coverUrl: abs(cover),
          rating,
          stats
        });
      });
    if (entries.length) tabs.push({ key: rankSlug(label), label, entries });
  });
  return tabs;
}

export function parseRanking(html: string): RankingTab[] {
  return rankingFromDoc(cheerio.load(html));
}

export function parseHome(html: string): HomeFeed {
  const $ = cheerio.load(html);

  // Parse the simple novel-list cards inside one home section.
  const itemsIn = (section: ReturnType<typeof $>): SearchResult[] => {
    const out: SearchResult[] = [];
    section.find("li.novel-item").each((_, el) => {
      const a = $(el).find('a[href^="/book/"]').first();
      const href = a.attr("href");
      if (!href) return;
      const title = $(el).find("h4.novel-title").first().text().trim();
      const img = $(el).find(".novel-cover img").first();
      // Covers are lazy-loaded: real URL lives in data-src, placeholder in src.
      const cover = img.attr("data-src") ?? img.attr("src") ?? "";
      out.push({ slug: slugFromBookHref(href), title, coverUrl: abs(cover) });
    });
    return out;
  };

  // Home sections are identified by their <h3> heading text.
  const sectionFor = (heading: string): SearchResult[] => {
    let found: SearchResult[] = [];
    $("section").each((_, sec) => {
      if (found.length) return;
      const h3 = $(sec).find("h3").first().text().trim().toLowerCase();
      if (h3 === heading.toLowerCase()) found = itemsIn($(sec));
    });
    return found;
  };

  const recommended = sectionFor("Recommends");
  const completed = sectionFor("Completed Stories");
  const ranking = rankingFromDoc($);
  if (recommended.length === 0 && completed.length === 0 && ranking.length === 0) {
    throw new SourceLayoutError("home sections not found");
  }
  return { recommended, completed, ranking };
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

  // Description: prefer the summary paragraphs; fall back through the summary
  // block's raw text, then the page's meta description, so it's rarely empty.
  const content = $(".summary .content").first().clone();
  content.find(".expand, script, style").remove();
  let synopsis = content
    .find("p")
    .map((_, p) => $(p).text().trim())
    .get()
    .filter((t) => t.length > 0)
    .join("\n\n")
    .trim();
  if (!synopsis) synopsis = content.text().replace(/\s+/g, " ").trim();
  if (!synopsis) {
    synopsis =
      $('meta[property="og:description"]').attr("content")?.trim() ??
      $('meta[name="description"]').attr("content")?.trim() ??
      "";
  }

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

export class NovelFireAdapter implements SourceAdapter {
  constructor(private fetchHtml: FetchHtml | ((url: string) => Promise<string>)) {}

  async search(query: string): Promise<SearchResult[]> {
    const url = `${BASE}/search?keyword=${encodeURIComponent(query)}`;
    return parseSearch(await this.fetchHtml(url));
  }

  async getNovel(slug: string): Promise<Novel> {
    const meta = parseNovelMeta(await this.fetchHtml(`${BASE}/book/${slug}`), slug);
    const firstPage = await this.fetchHtml(`${BASE}/book/${slug}/chapters?page=1`);
    const lastPage = parseLastPage(firstPage);
    const chapters: ChapterMeta[] = parseChapterListPage(firstPage, slug);
    for (let p = 2; p <= lastPage; p++) {
      const html = await this.fetchHtml(`${BASE}/book/${slug}/chapters?page=${p}`);
      chapters.push(...parseChapterListPage(html, slug));
    }
    chapters.sort((a, b) => a.number - b.number);
    return { ...meta, chapters };
  }

  async getChapter(id: string): Promise<ChapterContent> {
    return parseChapter(await this.fetchHtml(`${BASE}/book/${id}`), id);
  }

  async getHome(): Promise<HomeFeed> {
    return parseHome(await this.fetchHtml(`${BASE}/home`));
  }
}
