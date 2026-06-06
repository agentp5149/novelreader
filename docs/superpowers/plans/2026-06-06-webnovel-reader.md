# Web Novel Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal, cloud-hosted web-novel reader PWA that searches NovelFire, reads chapters, and downloads them for offline reading on iPhone.

**Architecture:** Single full-stack TypeScript app. An Express backend scrapes NovelFire (behind a `SourceAdapter` boundary) and exposes `/api/search`, `/api/novel`, `/api/chapter`; it also serves the built React client in production. The React PWA stores library, downloaded chapters, progress, and settings in IndexedDB (Dexie), so downloaded chapters read offline.

**Tech Stack:** TypeScript, Node + Express, cheerio (HTML parsing), Vitest + supertest (tests), React + Vite, react-router-dom, vite-plugin-pwa, Dexie.

**Spec:** `docs/superpowers/specs/2026-06-06-webnovel-reader-design.md`

---

## NovelFire scraping reference (verified against live HTML 2026-06-06)

- **Base URL:** `https://novelfire.net`
- **Required header:** `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36` — without it the site returns HTTP 403.
- **Search:** `GET /search?keyword=<url-encoded query>`
  - result item: `li.novel-item`
  - link/slug: `li.novel-item a[href^="/book/"]` → href is `/book/<slug>`; slug = segment after `/book/`
  - title: `li.novel-item h4.novel-title` (text, trimmed)
  - cover: `li.novel-item figure.novel-cover img` → `src` (may be relative like `/server-1/x.jpg`; resolve against base)
- **Novel page:** `GET /book/<slug>`
  - title: `h1.novel-title`
  - author: `span[itemprop="author"]` (text)
  - cover: `figure.cover img` → `src` (absolute)
  - synopsis: `.summary .content` → concatenate inner `<p>` text, trimmed
- **Chapter list (paginated, 100/page):** `GET /book/<slug>/chapters?page=<n>`
  - items: `ul.chapter-list li a`
  - href → `/book/<slug>/chapter-<n>`
  - number: `span.chapter-no` (text → int)
  - title: `strong.chapter-title` (text)
  - updatedAt: `time.chapter-update` → `datetime` attribute
  - pagination: `.pagination a.page-link` whose text is numeric; last page = max of those numbers (absent ⇒ single page)
- **Chapter content:** `GET /book/<slug>/chapter-<n>`
  - title: `.titles .chapter-title` (text)
  - body: `#chapter-container` → concatenate inner `<p>` text with `\n\n`
  - next: `a.nextchap[rel="next"]` → `href` (ignore if `javascript:;`)
  - prev: `a.prevchap[rel="prev"]` → `href` (ignore if `javascript:;`)

Captured fixtures already exist in `recon/{search,book,chapters,chapter}.html` and will be moved into the test suite in Task 3.

---

## ID conventions (used across backend and frontend)

- **Novel slug:** the `/book/<slug>` segment, e.g. `shadow-slave`.
- **Chapter id:** path after `/book/`, e.g. `shadow-slave/chapter-1`.
- **Chapter URL:** `https://novelfire.net/book/<chapter-id>`.
- **API:** `/api/search?q=`, `/api/novel?slug=`, `/api/chapter?id=`.

---

## Task 1: Project scaffold and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitignore`
- Create: `server/index.ts`, `src/main.tsx`, `src/App.tsx`
- Test: `server/__tests__/health.test.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "webnovel-reader",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently -k \"npm:dev:server\" \"npm:dev:client\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite",
    "build": "vite build",
    "start": "cross-env NODE_ENV=production tsx server/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "dexie": "^4.0.8",
    "dexie-react-hooks": "^1.1.7",
    "express": "^4.19.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/supertest": "^6.0.2",
    "@vitejs/plugin-react": "^4.3.1",
    "concurrently": "^8.2.2",
    "cross-env": "^7.0.3",
    "supertest": "^7.0.0",
    "tsx": "^4.16.0",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vite-plugin-pwa": "^0.20.1",
    "vitest": "^2.0.4"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node", "vite/client"],
    "noEmit": true
  },
  "include": ["src", "server", "shared", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Web Novel Reader",
        short_name: "Novels",
        start_url: "/",
        display: "standalone",
        background_color: "#111111",
        theme_color: "#111111",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ],
  build: { outDir: "dist" },
  server: { proxy: { "/api": "http://localhost:3001" } }
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["server/**/*.test.ts"] }
});
```

- [ ] **Step 5: Create `.gitignore`**

```
node_modules
dist
dev-dist
recon
*.local
.DS_Store
```

- [ ] **Step 6: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Web Novel Reader</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create minimal `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Create minimal `src/App.tsx`**

```tsx
export function App() {
  return <h1>Web Novel Reader</h1>;
}
```

- [ ] **Step 9: Create `server/index.ts`**

```ts
import express from "express";

export const app = express();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  app.get("*", (_req, res) => res.sendFile("index.html", { root: "dist" }));
}

const port = Number(process.env.PORT) || 3001;
if (process.env.VITEST !== "true") {
  app.listen(port, () => console.log(`server on :${port}`));
}
```

- [ ] **Step 10: Write the failing health test** in `server/__tests__/health.test.ts`

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../index";

describe("health", () => {
  it("returns ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 11: Install dependencies**

Run: `npm install`
Expected: completes without errors; `node_modules` created.

- [ ] **Step 12: Run the test to verify it passes**

Run: `npx cross-env VITEST=true vitest run`
Expected: PASS (1 test). The `VITEST` guard stops the server from calling `listen()` during tests.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: scaffold full-stack app with health endpoint"
```

---

## Task 2: Shared API types

**Files:**
- Create: `shared/types.ts`

- [ ] **Step 1: Create `shared/types.ts`**

```ts
export interface SearchResult {
  slug: string;
  title: string;
  coverUrl: string;
}

export interface ChapterMeta {
  id: string;        // e.g. "shadow-slave/chapter-1"
  number: number;
  title: string;
  url: string;       // absolute
  updatedAt?: string;
}

export interface Novel {
  slug: string;
  title: string;
  author: string;
  coverUrl: string;
  synopsis: string;
  chapters: ChapterMeta[];
}

export interface ChapterContent {
  id: string;
  title: string;
  text: string;      // paragraphs joined by "\n\n"
  prev?: string;     // chapter id or undefined
  next?: string;     // chapter id or undefined
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/types.ts
git commit -m "feat: shared API types"
```

---

## Task 3: Move recon HTML into test fixtures

**Files:**
- Create: `server/__tests__/fixtures/search.html`, `book.html`, `chapters.html`, `chapter.html` (moved from `recon/`)

- [ ] **Step 1: Move the captured fixtures**

Run:
```bash
mkdir -p server/__tests__/fixtures
cp recon/search.html server/__tests__/fixtures/search.html
cp recon/book.html server/__tests__/fixtures/book.html
cp recon/chapters.html server/__tests__/fixtures/chapters.html
cp recon/chapter.html server/__tests__/fixtures/chapter.html
```
Expected: four files present under `server/__tests__/fixtures/`.

- [ ] **Step 2: Verify fixtures are non-empty**

Run: `wc -c server/__tests__/fixtures/*.html`
Expected: each file is tens of KB (search ~55KB, book ~45KB, chapters ~70KB, chapter ~54KB).

- [ ] **Step 3: Commit**

```bash
git add server/__tests__/fixtures
git commit -m "test: add NovelFire HTML fixtures"
```

---

## Task 4: SourceAdapter interface

**Files:**
- Create: `server/source/adapter.ts`

- [ ] **Step 1: Create `server/source/adapter.ts`**

```ts
import type { SearchResult, Novel, ChapterContent } from "../../shared/types";

export interface SourceAdapter {
  /** Search the source by free-text query. */
  search(query: string): Promise<SearchResult[]>;
  /** Fetch novel metadata plus the full (paginated) chapter list. */
  getNovel(slug: string): Promise<Novel>;
  /** Fetch a single chapter's text and prev/next ids. */
  getChapter(id: string): Promise<ChapterContent>;
}

/** Thrown when scraped HTML no longer matches expected selectors. */
export class SourceLayoutError extends Error {
  constructor(what: string) {
    super(`Source layout changed: ${what}`);
    this.name = "SourceLayoutError";
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add server/source/adapter.ts
git commit -m "feat: SourceAdapter interface and SourceLayoutError"
```

---

## Task 5: NovelFire parser — search results

The adapter is split into **pure parse functions** (HTML string → data, tested against fixtures) and the adapter class (fetch + parse + pagination, tested with a mocked fetcher). This task adds the search parser.

**Files:**
- Create: `server/source/novelfire.ts`
- Test: `server/__tests__/novelfire-parse.test.ts`

- [ ] **Step 1: Write the failing test** in `server/__tests__/novelfire-parse.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseSearch } from "../source/novelfire";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/__tests__/novelfire-parse.test.ts`
Expected: FAIL — `parseSearch` is not exported / file missing.

- [ ] **Step 3: Create `server/source/novelfire.ts` with `parseSearch`**

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/__tests__/novelfire-parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/source/novelfire.ts server/__tests__/novelfire-parse.test.ts
git commit -m "feat: parse NovelFire search results"
```

---

## Task 6: NovelFire parser — novel metadata and chapter-list page

**Files:**
- Modify: `server/source/novelfire.ts`
- Test: `server/__tests__/novelfire-parse.test.ts`

- [ ] **Step 1: Add failing tests** (append to `novelfire-parse.test.ts`)

```ts
import { parseNovelMeta, parseChapterListPage, parseLastPage } from "../source/novelfire";

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/__tests__/novelfire-parse.test.ts`
Expected: FAIL — new functions not exported.

- [ ] **Step 3: Add the parsers** (append to `server/source/novelfire.ts`)

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/__tests__/novelfire-parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/source/novelfire.ts server/__tests__/novelfire-parse.test.ts
git commit -m "feat: parse NovelFire novel metadata and chapter list"
```

---

## Task 7: NovelFire parser — chapter content

**Files:**
- Modify: `server/source/novelfire.ts`
- Test: `server/__tests__/novelfire-parse.test.ts`

- [ ] **Step 1: Add failing test** (append)

```ts
import { parseChapter } from "../source/novelfire";

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/__tests__/novelfire-parse.test.ts`
Expected: FAIL — `parseChapter` not exported.

- [ ] **Step 3: Add the parser** (append to `server/source/novelfire.ts`)

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/__tests__/novelfire-parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/source/novelfire.ts server/__tests__/novelfire-parse.test.ts
git commit -m "feat: parse NovelFire chapter content"
```

---

## Task 8: HTTP fetcher with User-Agent, cache, and rate-limit

**Files:**
- Create: `server/http.ts`
- Test: `server/__tests__/http.test.ts`

- [ ] **Step 1: Write the failing test** in `server/__tests__/http.test.ts`

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/__tests__/http.test.ts`
Expected: FAIL — `makeFetcher` missing.

- [ ] **Step 3: Create `server/http.ts`**

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/__tests__/http.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/http.ts server/__tests__/http.test.ts
git commit -m "feat: HTTP fetcher with UA, cache, rate-limit"
```

---

## Task 9: NovelFireAdapter class (fetch + parse + pagination)

**Files:**
- Modify: `server/source/novelfire.ts`
- Test: `server/__tests__/novelfire-adapter.test.ts`

- [ ] **Step 1: Write the failing test** in `server/__tests__/novelfire-adapter.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NovelFireAdapter } from "../source/novelfire";

const fx = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("NovelFireAdapter.getNovel", () => {
  it("merges metadata with all paginated chapters", async () => {
    // fetcher returns book page, then 2 chapter pages (page 2 = empty list -> stop after last page)
    const fetchHtml = async (url: string) => {
      if (url === "https://novelfire.net/book/shadow-slave") return fx("book.html");
      if (url.includes("/chapters")) return fx("chapters.html");
      throw new Error("unexpected url " + url);
    };
    const adapter = new NovelFireAdapter(fetchHtml);
    const novel = await adapter.getNovel("shadow-slave");
    expect(novel.title).toBe("Shadow Slave");
    // chapters.html has 100 items; parseLastPage >= 6, so it fetches multiple pages
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/__tests__/novelfire-adapter.test.ts`
Expected: FAIL — `NovelFireAdapter` not exported.

- [ ] **Step 3: Add the adapter class** (append to `server/source/novelfire.ts`)

```ts
import type { SourceAdapter } from "./adapter";
import type { FetchHtml } from "../http";

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
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/__tests__/novelfire-adapter.test.ts`
Expected: PASS. (The test's fetcher returns `chapters.html` for every chapter page; the loop runs `lastPage` times, so `chapters.length` is `100 * lastPage` ≥ 100.)

- [ ] **Step 5: Commit**

```bash
git add server/source/novelfire.ts server/__tests__/novelfire-adapter.test.ts
git commit -m "feat: NovelFireAdapter with pagination"
```

---

## Task 10: API routes

**Files:**
- Create: `server/routes.ts`
- Modify: `server/index.ts`
- Test: `server/__tests__/routes.test.ts`

- [ ] **Step 1: Write the failing test** in `server/__tests__/routes.test.ts`

```ts
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { makeApiRouter } from "../routes";
import type { SourceAdapter } from "../source/adapter";

const fakeAdapter: SourceAdapter = {
  search: async (q) => [{ slug: "x", title: "X " + q, coverUrl: "c" }],
  getNovel: async (slug) => ({
    slug, title: "X", author: "A", coverUrl: "c", synopsis: "s", chapters: []
  }),
  getChapter: async (id) => ({ id, title: "T", text: "body", next: undefined, prev: undefined })
};

function makeApp() {
  const app = express();
  app.use("/api", makeApiRouter(fakeAdapter));
  return app;
}

describe("api routes", () => {
  it("GET /api/search?q= returns results", async () => {
    const res = await request(makeApp()).get("/api/search?q=hi");
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe("X hi");
  });

  it("GET /api/search without q returns 400", async () => {
    const res = await request(makeApp()).get("/api/search");
    expect(res.status).toBe(400);
  });

  it("GET /api/novel?slug= returns a novel", async () => {
    const res = await request(makeApp()).get("/api/novel?slug=abc");
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("abc");
  });

  it("GET /api/chapter?id= returns a chapter", async () => {
    const res = await request(makeApp()).get("/api/chapter?id=abc/chapter-1");
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("body");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run server/__tests__/routes.test.ts`
Expected: FAIL — `makeApiRouter` missing.

- [ ] **Step 3: Create `server/routes.ts`**

```ts
import { Router } from "express";
import type { SourceAdapter } from "./source/adapter";

export function makeApiRouter(adapter: SourceAdapter): Router {
  const r = Router();

  r.get("/search", async (req, res) => {
    const q = String(req.query.q ?? "").trim();
    if (!q) return res.status(400).json({ error: "missing q" });
    try {
      res.json(await adapter.search(q));
    } catch (e) {
      res.status(502).json({ error: (e as Error).message });
    }
  });

  r.get("/novel", async (req, res) => {
    const slug = String(req.query.slug ?? "").trim();
    if (!slug) return res.status(400).json({ error: "missing slug" });
    try {
      res.json(await adapter.getNovel(slug));
    } catch (e) {
      res.status(502).json({ error: (e as Error).message });
    }
  });

  r.get("/chapter", async (req, res) => {
    const id = String(req.query.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "missing id" });
    try {
      res.json(await adapter.getChapter(id));
    } catch (e) {
      res.status(502).json({ error: (e as Error).message });
    }
  });

  return r;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run server/__tests__/routes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire routes into `server/index.ts`** — replace the file contents with:

```ts
import express from "express";
import { makeApiRouter } from "./routes";
import { makeFetcher } from "./http";
import { NovelFireAdapter } from "./source/novelfire";

export const app = express();

const adapter = new NovelFireAdapter(makeFetcher());
app.use("/api", makeApiRouter(adapter));
app.get("/api/health", (_req, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  app.get("*", (_req, res) => res.sendFile("index.html", { root: "dist" }));
}

const port = Number(process.env.PORT) || 3001;
if (process.env.VITEST !== "true") {
  app.listen(port, () => console.log(`server on :${port}`));
}
```

- [ ] **Step 6: Run the full suite**

Run: `npx cross-env VITEST=true vitest run`
Expected: PASS (all tests across files).

- [ ] **Step 7: Manual smoke test against live NovelFire**

Run: `npm run dev:server` then in another shell:
`curl "http://localhost:3001/api/search?q=shadow%20slave"`
Expected: JSON array including `{"slug":"shadow-slave",...}`. Stop the server afterward.

- [ ] **Step 8: Commit**

```bash
git add server/routes.ts server/index.ts server/__tests__/routes.test.ts
git commit -m "feat: API routes wired to NovelFireAdapter"
```

---

## Task 11: Client IndexedDB schema (Dexie)

**Files:**
- Create: `src/db.ts`

- [ ] **Step 1: Create `src/db.ts`**

```ts
import Dexie, { type Table } from "dexie";
import type { ChapterMeta } from "../shared/types";

export interface LibraryNovel {
  slug: string;
  title: string;
  author: string;
  coverUrl: string;
  synopsis: string;
  addedAt: number;
}

export interface StoredChapter extends ChapterMeta {
  novelSlug: string;
  downloaded: number; // 0 | 1 (indexable boolean)
}

export interface StoredContent {
  id: string;   // chapter id
  text: string;
  title: string;
}

export interface Progress {
  novelSlug: string;
  lastChapterId: string;
  scrollPct: number;
  updatedAt: number;
}

export interface Settings {
  key: "settings";
  fontSize: number;
  lineHeight: number;
  theme: "light" | "dark" | "sepia";
}

export class ReaderDB extends Dexie {
  novels!: Table<LibraryNovel, string>;
  chapters!: Table<StoredChapter, string>;
  contents!: Table<StoredContent, string>;
  progress!: Table<Progress, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("webnovel-reader");
    this.version(1).stores({
      novels: "slug, addedAt",
      chapters: "id, novelSlug, [novelSlug+number], downloaded",
      contents: "id",
      progress: "novelSlug",
      settings: "key"
    });
  }
}

export const db = new ReaderDB();

export const DEFAULT_SETTINGS: Settings = {
  key: "settings",
  fontSize: 18,
  lineHeight: 1.7,
  theme: "dark"
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/db.ts
git commit -m "feat: Dexie IndexedDB schema"
```

---

## Task 12: Client API wrappers

**Files:**
- Create: `src/api.ts`

- [ ] **Step 1: Create `src/api.ts`**

```ts
import type { SearchResult, Novel, ChapterContent } from "../shared/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  search: (q: string) =>
    getJson<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
  novel: (slug: string) =>
    getJson<Novel>(`/api/novel?slug=${encodeURIComponent(slug)}`),
  chapter: (id: string) =>
    getJson<ChapterContent>(`/api/chapter?id=${encodeURIComponent(id)}`)
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat: client API wrappers"
```

---

## Task 13: Settings hook and global styles

**Files:**
- Create: `src/settings.ts`, `src/styles.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Create `src/settings.ts`**

```ts
import { useLiveQuery } from "dexie-react-hooks";
import { db, DEFAULT_SETTINGS, type Settings } from "./db";

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<void>] {
  const settings = useLiveQuery(() => db.settings.get("settings")) ?? DEFAULT_SETTINGS;
  const update = async (patch: Partial<Settings>) => {
    await db.settings.put({ ...settings, ...patch, key: "settings" });
  };
  return [settings, update];
}
```

- [ ] **Step 2: Create `src/styles.css`**

```css
:root { --bg: #111; --fg: #eee; --muted: #888; --accent: #66aacc; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--fg); }
a { color: inherit; }
.container { max-width: 720px; margin: 0 auto; padding: 16px; padding-bottom: 64px; }
.nav { position: sticky; top: 0; display: flex; gap: 16px; padding: 12px 16px;
  background: #000; border-bottom: 1px solid #222; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
.card img { width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 8px; }
.card span { display: block; font-size: 13px; margin-top: 4px; }
input, button, select { font: inherit; padding: 8px 10px; border-radius: 8px;
  border: 1px solid #333; background: #1a1a1a; color: var(--fg); }
button { cursor: pointer; }
.row { display: flex; gap: 8px; align-items: center; }
.chapter-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #222; }
.reader { white-space: pre-wrap; }
.reader.theme-light { background: #fff; color: #111; }
.reader.theme-sepia { background: #f4ecd8; color: #5b4636; }
.reader.theme-dark { background: #111; color: #ddd; }
.reader-wrap { min-height: 100vh; }
```

- [ ] **Step 3: Import styles in `src/main.tsx`** — add as the first import:

```tsx
import "./styles.css";
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts src/styles.css src/main.tsx
git commit -m "feat: settings hook and global styles"
```

---

## Task 14: Routing shell and navigation

**Files:**
- Modify: `src/App.tsx`
- Create: `src/pages/SearchPage.tsx`, `src/pages/LibraryPage.tsx`, `src/pages/NovelPage.tsx`, `src/pages/ReaderPage.tsx` (placeholders, filled in later tasks)

- [ ] **Step 1: Create placeholder pages**

`src/pages/SearchPage.tsx`:
```tsx
export function SearchPage() { return <div className="container">Search</div>; }
```
`src/pages/LibraryPage.tsx`:
```tsx
export function LibraryPage() { return <div className="container">Library</div>; }
```
`src/pages/NovelPage.tsx`:
```tsx
export function NovelPage() { return <div className="container">Novel</div>; }
```
`src/pages/ReaderPage.tsx`:
```tsx
export function ReaderPage() { return <div className="container">Reader</div>; }
```

- [ ] **Step 2: Replace `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { SearchPage } from "./pages/SearchPage";
import { LibraryPage } from "./pages/LibraryPage";
import { NovelPage } from "./pages/NovelPage";
import { ReaderPage } from "./pages/ReaderPage";

export function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <Link to="/">Library</Link>
        <Link to="/search">Search</Link>
      </nav>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/novel/:slug" element={<NovelPage />} />
        <Route path="/read/:novelSlug/*" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

Note: the reader route uses a wildcard so a chapter id like `shadow-slave/chapter-1` (which contains a slash) is captured. The reader reads `novelSlug` from params and the chapter id from the splat.

- [ ] **Step 3: Type-check and dev smoke**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run dev` and open `http://localhost:5173`; verify nav links switch between Library and Search. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages
git commit -m "feat: routing shell and nav"
```

---

## Task 15: Search page

**Files:**
- Modify: `src/pages/SearchPage.tsx`
- Create: `src/components/NovelCard.tsx`

- [ ] **Step 1: Create `src/components/NovelCard.tsx`**

```tsx
import { Link } from "react-router-dom";

export function NovelCard(props: { slug: string; title: string; coverUrl: string }) {
  return (
    <Link className="card" to={`/novel/${props.slug}`}>
      <img src={props.coverUrl} alt={props.title} loading="lazy" />
      <span>{props.title}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Replace `src/pages/SearchPage.tsx`**

```tsx
import { useState } from "react";
import { api } from "../api";
import type { SearchResult } from "../../shared/types";
import { NovelCard } from "../components/NovelCard";

export function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await api.search(q.trim()));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <form className="row" onSubmit={run}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search novels…"
          style={{ flex: 1 }}
        />
        <button type="submit">Search</button>
      </form>
      {loading && <p>Searching…</p>}
      {error && <p style={{ color: "salmon" }}>{error}</p>}
      <div className="grid" style={{ marginTop: 16 }}>
        {results.map((r) => (
          <NovelCard key={r.slug} {...r} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and manual test**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run dev`, go to `/search`, search "shadow slave", verify covers + titles appear. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/SearchPage.tsx src/components/NovelCard.tsx
git commit -m "feat: search page"
```

---

## Task 16: Novel page with Add to Library and chapter list

**Files:**
- Modify: `src/pages/NovelPage.tsx`

- [ ] **Step 1: Replace `src/pages/NovelPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { api } from "../api";
import { db } from "../db";
import type { Novel } from "../../shared/types";

export function NovelPage() {
  const { slug = "" } = useParams();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inLibrary = useLiveQuery(() => db.novels.get(slug), [slug]);

  useEffect(() => {
    let cancelled = false;
    setNovel(null);
    setError(null);
    api
      .novel(slug)
      .then((n) => !cancelled && setNovel(n))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function addToLibrary() {
    if (!novel) return;
    await db.novels.put({
      slug: novel.slug,
      title: novel.title,
      author: novel.author,
      coverUrl: novel.coverUrl,
      synopsis: novel.synopsis,
      addedAt: Date.now()
    });
    await db.chapters.bulkPut(
      novel.chapters.map((c) => ({ ...c, novelSlug: novel.slug, downloaded: 0 }))
    );
  }

  if (error) return <div className="container" style={{ color: "salmon" }}>{error}</div>;
  if (!novel) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
        <img src={novel.coverUrl} alt={novel.title} style={{ width: 120, borderRadius: 8 }} />
        <div>
          <h2 style={{ margin: "0 0 4px" }}>{novel.title}</h2>
          <p style={{ color: "var(--muted)", margin: "0 0 8px" }}>{novel.author}</p>
          <button onClick={addToLibrary} disabled={!!inLibrary}>
            {inLibrary ? "In library" : "Add to library"}
          </button>
        </div>
      </div>
      <p style={{ marginTop: 16 }}>{novel.synopsis}</p>
      <h3>Chapters ({novel.chapters.length})</h3>
      <div>
        {novel.chapters.map((c) => (
          <div className="chapter-row" key={c.id}>
            <Link to={`/read/${novel.slug}/${c.id}`}>{c.title}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and manual test**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run dev`, open a novel from search, verify metadata + chapter list render and "Add to library" works (button switches to "In library"). Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/NovelPage.tsx
git commit -m "feat: novel page with add-to-library and chapter list"
```

---

## Task 17: Reader page with offline-first fetch, settings, progress, and download

**Files:**
- Modify: `src/pages/ReaderPage.tsx`

- [ ] **Step 1: Replace `src/pages/ReaderPage.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";
import { db } from "../db";
import { useSettings } from "../settings";
import type { ChapterContent } from "../../shared/types";

export function ReaderPage() {
  const { novelSlug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [settings, updateSettings] = useSettings();

  // chapter id is everything after "/read/<novelSlug>/"
  const chapterId = decodeURIComponent(
    location.pathname.split(`/read/${novelSlug}/`)[1] ?? ""
  );

  const [chapter, setChapter] = useState<ChapterContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Load: prefer downloaded copy, else network.
  useEffect(() => {
    let cancelled = false;
    setChapter(null);
    setError(null);
    (async () => {
      const local = await db.contents.get(chapterId);
      if (local) {
        if (!cancelled) setChapter({ id: chapterId, title: local.title, text: local.text });
        // still fetch prev/next from network in background if online
        try {
          const net = await api.chapter(chapterId);
          if (!cancelled) setChapter(net);
        } catch { /* offline: keep local */ }
        return;
      }
      try {
        const net = await api.chapter(chapterId);
        if (!cancelled) setChapter(net);
      } catch (e) {
        if (!cancelled)
          setError(
            navigator.onLine
              ? (e as Error).message
              : "You're offline and this chapter isn't downloaded."
          );
      }
    })();
    return () => { cancelled = true; };
  }, [chapterId]);

  // Save progress on scroll.
  useEffect(() => {
    function onScroll() {
      const max = document.body.scrollHeight - window.innerHeight;
      const pct = max > 0 ? window.scrollY / max : 0;
      db.progress.put({
        novelSlug,
        lastChapterId: chapterId,
        scrollPct: pct,
        updatedAt: Date.now()
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [novelSlug, chapterId]);

  // Restore scroll once chapter renders.
  useEffect(() => {
    if (!chapter) return;
    (async () => {
      const p = await db.progress.get(novelSlug);
      if (p && p.lastChapterId === chapterId) {
        const max = document.body.scrollHeight - window.innerHeight;
        window.scrollTo(0, p.scrollPct * max);
      } else {
        window.scrollTo(0, 0);
      }
    })();
  }, [chapter, novelSlug, chapterId]);

  async function download() {
    if (!chapter) return;
    await db.contents.put({ id: chapter.id, text: chapter.text, title: chapter.title });
    await db.chapters.update(chapter.id, { downloaded: 1 });
  }

  if (error) return <div className="container" style={{ color: "salmon" }}>{error}</div>;
  if (!chapter) return <div className="container">Loading…</div>;

  return (
    <div className={`reader-wrap reader theme-${settings.theme}`} ref={wrapRef}>
      <div className="nav">
        <button onClick={() => navigate(`/novel/${novelSlug}`)}>← Chapters</button>
        <button onClick={() => setShowSettings((s) => !s)}>Aa</button>
        <button onClick={download}>Download</button>
      </div>

      {showSettings && (
        <div className="container row" style={{ flexWrap: "wrap" }}>
          <label>Font
            <input type="range" min={14} max={28} value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })} />
          </label>
          <label>Theme
            <select value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as typeof settings.theme })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="sepia">Sepia</option>
            </select>
          </label>
        </div>
      )}

      <div className="container reader"
        style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}>
        <h2>{chapter.title}</h2>
        <div>{chapter.text}</div>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 24 }}>
          <button disabled={!chapter.prev}
            onClick={() => chapter.prev && navigate(`/read/${novelSlug}/${chapter.prev}`)}>
            ← Prev
          </button>
          <button disabled={!chapter.next}
            onClick={() => chapter.next && navigate(`/read/${novelSlug}/${chapter.next}`)}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and manual test**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run dev`. Open a chapter, verify: text renders; font slider + theme work; Prev/Next navigate; "Download" then reload still shows the chapter; scroll position restores on return. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ReaderPage.tsx
git commit -m "feat: reader with offline-first load, settings, progress, download"
```

---

## Task 18: Library page with resume

**Files:**
- Modify: `src/pages/LibraryPage.tsx`

- [ ] **Step 1: Replace `src/pages/LibraryPage.tsx`**

```tsx
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function LibraryPage() {
  const novels = useLiveQuery(() => db.novels.orderBy("addedAt").reverse().toArray());
  const progress = useLiveQuery(() => db.progress.toArray());

  if (!novels) return <div className="container">Loading…</div>;
  if (novels.length === 0)
    return (
      <div className="container">
        <p>Your library is empty.</p>
        <Link to="/search">Search for novels →</Link>
      </div>
    );

  const resumeFor = (slug: string) =>
    progress?.find((p) => p.novelSlug === slug)?.lastChapterId;

  return (
    <div className="container">
      <div className="grid">
        {novels.map((n) => {
          const resume = resumeFor(n.slug);
          return (
            <div key={n.slug}>
              <Link className="card" to={`/novel/${n.slug}`}>
                <img src={n.coverUrl} alt={n.title} loading="lazy" />
                <span>{n.title}</span>
              </Link>
              {resume && (
                <Link to={`/read/${n.slug}/${resume}`} style={{ fontSize: 12 }}>
                  Resume →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and manual test**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run dev`. Add a novel, read part of a chapter, return to Library: verify the novel appears with a working "Resume" link. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LibraryPage.tsx
git commit -m "feat: library page with resume"
```

---

## Task 19: PWA icons and production build verification

**Files:**
- Create: `public/icon-192.png`, `public/icon-512.png`

- [ ] **Step 1: Generate placeholder PNG icons**

Run:
```bash
mkdir -p public
# 1x1 transparent PNG scaled by the browser is acceptable for v1 placeholders
node -e "const b=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');require('fs').writeFileSync('public/icon-192.png',b);require('fs').writeFileSync('public/icon-512.png',b);"
```
Expected: two PNG files exist in `public/`. (Replace with real artwork later.)

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: `dist/` is created with `index.html`, hashed JS/CSS, a service worker (`sw.js`), and `manifest.webmanifest`.

- [ ] **Step 3: Verify production server serves the SPA + API**

Run: `npm start` then in another shell:
`curl -s http://localhost:3001/ | grep -o "<div id=\"root\">"` → expect a match.
`curl -s "http://localhost:3001/api/search?q=shadow%20slave"` → expect JSON results.
Stop the server.

- [ ] **Step 4: Commit**

```bash
git add public
git commit -m "feat: PWA icons and verified production build"
```

---

## Task 20: Deployment config and README

**Files:**
- Create: `render.yaml`, `README.md`

- [ ] **Step 1: Create `render.yaml`**

```yaml
services:
  - type: web
    name: webnovel-reader
    runtime: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
```

- [ ] **Step 2: Create `README.md`**

````markdown
# Web Novel Reader

Personal web-novel reader PWA. Searches NovelFire, reads chapters, and downloads
them for offline reading. Installable on iPhone via Safari → Share → Add to Home Screen.

> Personal, self-hosted tool. It scrapes a third-party site; do not operate it as a
> public service or publish it to an app store.

## Develop

```bash
npm install
npm run dev      # client on :5173 (proxies /api to server on :3001)
npm test         # run the test suite
```

## Production

```bash
npm run build    # builds the client into dist/
npm start        # Express serves dist/ + /api on $PORT (default 3001)
```

## Deploy (Render free tier)

Push to GitHub and create a new Web Service from this repo, or use `render.yaml`.
Build: `npm install && npm run build`. Start: `npm start`.

## Architecture

- `server/` — Express API + NovelFire scraper behind a `SourceAdapter` interface.
- `src/` — React PWA; library, downloads, progress, and settings live in IndexedDB.
- `shared/types.ts` — API types shared by client and server.

To add another source later, implement `SourceAdapter` (see `server/source/adapter.ts`)
and select it in `server/index.ts`.
````

- [ ] **Step 3: Run the full test suite one last time**

Run: `npx cross-env VITEST=true vitest run`
Expected: PASS (all tests).

- [ ] **Step 4: Commit**

```bash
git add render.yaml README.md
git commit -m "docs: deployment config and README"
```

---

## Self-Review Notes (completed by plan author)

- **Spec coverage:** Search (Task 15) ✓; novel page + chapter list (Task 16) ✓; library + resume (Tasks 11, 18) ✓; reader with font/theme/scroll (Tasks 13, 17) ✓; download offline (Tasks 11, 17) ✓; PWA install (Tasks 1, 19) ✓; scraping behind SourceAdapter with fixtures + SourceLayoutError (Tasks 4–9) ✓; cloud deploy (Task 20) ✓. Non-goals (tracking, multi-source, EPUB, accounts) intentionally excluded.
- **Type consistency:** `SearchResult`/`Novel`/`ChapterMeta`/`ChapterContent` defined once in `shared/types.ts` and reused; chapter id format `slug/chapter-N` consistent across parser, adapter, routes, db, and pages; `downloaded` stored as `0|1` for IndexedDB indexability.
- **Placeholders:** none — every step contains complete code or exact commands. Icons in Task 19 are intentional functional placeholders flagged for later replacement.
- **Known live-dependency steps:** Tasks 10/15/16/17 include manual smoke tests against live NovelFire; automated tests never hit the network (fixtures + mocked fetchers only).
```
