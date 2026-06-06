# Web Novel Reader — Design Spec

**Date:** 2026-06-06
**Status:** Approved (pending final user review)

## Summary

A personal, cloud-hosted **web-novel / light-novel reader** delivered as an installable
**PWA** (Progressive Web App). It can be opened on an iPhone via the browser and added to the
home screen for an app-like experience. Content is read from **NovelFire** by scraping its
public web pages (NovelFire has no official API). v1 covers the essential reader loop:
**search → read → download for offline**.

This is a **personal, self-hosted tool**. Because it scrapes a third-party site and serves
content NovelFire does not license for redistribution, it is not intended for app-store
publication or operation as a public service.

## Goals (v1 scope)

- **Search** NovelFire by title.
- **Novel page** — cover, title, author, synopsis, and full chapter list.
- **Library** — save novels being read; resume where you left off.
- **Reader** — clean text view with adjustable font size and line spacing, and
  light/dark/sepia themes; remembers scroll position per chapter.
- **Download** chapters for offline reading (stored on-device).
- **Installable PWA** — works on iPhone via "Add to Home Screen", including offline access to
  downloaded chapters.

## Non-Goals (explicitly out of v1, designed to slot in later)

- MyAnimeList / AniList progress sync.
- Multiple sources / Tachiyomi-style extension framework (v1 hardcodes one source).
- EPUB / local-file import.
- User accounts and cross-device sync (all state is local to the device).

## Architecture

Single full-stack TypeScript app, one repository, one deploy.

```
┌─────────────────────────────┐        ┌──────────────────────────┐
│   React PWA (the reader)     │  HTTP  │  Node/Express backend     │
│  - Search / Library / Reader │ ─────► │  - GET /api/search        │
│  - IndexedDB (downloads +    │        │  - GET /api/novel         │
│    progress + settings)      │        │  - GET /api/chapter       │
│  - Service worker (offline)  │        │  - SourceAdapter layer    │
└─────────────────────────────┘        │     └ NovelFireAdapter     │
                                        │  - cache + rate-limit      │
                                        └──────────────────────────┘
                                                    │ scrapes
                                                    ▼ NovelFire HTML
```

### Components

- **Frontend:** React + Vite + TypeScript. `vite-plugin-pwa` for installability/offline
  service worker. Dexie as the IndexedDB wrapper.
- **Backend:** Node + Express + TypeScript. `cheerio` for HTML parsing. A cache layer plus
  polite rate-limiting and a real User-Agent header.
- **Source boundary:** a `SourceAdapter` interface — `search(query)`, `getNovel(id)`,
  `getChapter(id)` — with a single implementation, `NovelFireAdapter`. Adding a future source
  means writing another adapter behind the same interface; nothing else changes.

## Data Flow

1. **Search:** PWA → `GET /api/search?q=` → backend scrapes NovelFire search results →
   returns `[{ id, title, coverUrl }]`.
2. **Open novel:** → `GET /api/novel?id=` → returns metadata + chapter list. "Add to Library"
   writes the novel to IndexedDB.
3. **Read:** → `GET /api/chapter?id=` → returns sanitized chapter text → reader renders it and
   saves scroll position to IndexedDB.
4. **Download:** fetches chapter text and writes `ChapterContent` to IndexedDB. The reader
   prefers a local copy when present, so offline reading works transparently.

## Data Model (IndexedDB, on-device)

- **LibraryNovel:** `{ id, source, title, author, coverUrl, synopsis, addedAt }`
- **Chapter:** `{ id, novelId, title, number, url, downloaded }`
- **ChapterContent:** `{ chapterId, text }` (only present for downloaded chapters)
- **Progress:** `{ novelId, lastChapterId, scrollPct, updatedAt }`
- **Settings:** `{ fontSize, lineHeight, theme }`

## Scraping Design & Primary Risk

`NovelFireAdapter` maps NovelFire's pages to the clean data shapes above. Because NovelFire
has no API, the primary risk is that a **NovelFire site-layout redesign** breaks the adapter.
Containment:

- All NovelFire-specific selectors live in **one file**.
- The adapter is tested against **saved HTML fixtures**, not the live site, so tests are stable
  and offline.
- On a parse failure the adapter throws a clear **"source layout changed"** error so breakage
  is obvious rather than silent.

The first implementation step is a short recon of NovelFire's actual URL and HTML patterns
(search URL, novel page, chapter-list pagination, chapter content container).

## Content Freshness

The app stores **no catalog of its own** — every search and novel view fetches **live** from
NovelFire at request time. Therefore:

- New novels NovelFire adds are immediately searchable.
- New chapters appear in a novel's chapter list as soon as NovelFire posts them (refresh the
  novel page).
- **Downloaded** chapters are an intentional frozen offline copy; the live chapter list always
  reflects NovelFire's current state.
- Only a NovelFire **layout redesign** requires maintenance (updating selectors) — adding more
  novels/chapters never does.

## Costs

- **Build:** $0 — all open-source, developed on the existing Windows PC.
- **Run (cloud):** likely $0 on a free tier (Render/Railway/Fly.io); HTTPS included (and
  required for iPhone PWA install); NovelFire access is free (public site).
- **Free-tier caveat:** the service "sleeps" after inactivity, so the first load after idle can
  take ~30–60s to wake. An always-on paid tier is ~$5–7/month — opt-in only, never a surprise.
- **Optional custom domain:** ~$10/year (otherwise use the host's free subdomain).

## Error Handling

- Scrape failure / site down → friendly error with retry; never a blank screen.
- Offline + chapter downloaded → serve from IndexedDB; not downloaded → clear "you're offline"
  message.
- Rate-limiting / backoff to avoid IP blocks.
- Sanitize scraped HTML before rendering (strip scripts/ads/tracking).

## Testing

- **Adapter:** unit tests against saved NovelFire HTML fixtures (stable, no live-site
  dependency).
- **Backend:** endpoint tests with the adapter mocked.
- **Frontend:** component tests for reader and library; one end-to-end happy path
  (search → read → download → offline read).

## Tech Stack

- **Language:** TypeScript (frontend and backend).
- **Frontend:** React, Vite, `vite-plugin-pwa`, Dexie (IndexedDB).
- **Backend:** Node, Express, `cheerio`.
- **Hosting:** single always-on web service on Render/Railway/Fly.io, starting on a free tier.
