# NovelReader

Personal web-novel reader PWA. Browse NovelFire's home (recommended, ranking,
completed), search, read chapters, and download them for offline reading.
Installable on iPhone via Safari -> Share -> Add to Home Screen.

> Personal, self-hosted tool. It scrapes a third-party site; do not operate it as a
> public service or publish it to an app store.

## Features

- **Home** -- recommended and completed novels plus a ranking board with three tabs
  (Most Read / New Trend / User Rated), pulled live from the NovelFire home page.
- **Search** novels by title.
- **Novel page** -- synopsis, plus the full chapter list grouped into tabs of 100
  with a "go to chapter #" jump box; reopens at your last-read chapter.
- **Reader** -- offline-first (downloaded copy preferred), adjustable font/theme,
  saved scroll progress.
- **Library** -- saved novels with resume links; stored in IndexedDB.

## Develop

    npm install
    npm run dev      # client on :5173 (proxies /api to server on :3001)
    npm test         # run the test suite

## Production

    npm run build    # builds the client into dist/
    npm start        # Express serves dist/ + /api on $PORT (default 3001)

## Deploy (Render free tier)

Push to GitHub and create a new Web Service from this repo, or use render.yaml.
Build: npm install && npm run build. Start: npm start.

## Architecture

- server/ -- Express API + NovelFire scraper behind a SourceAdapter interface.
  Endpoints: /api/home, /api/search, /api/novel, /api/chapter.
- src/ -- React PWA; library, downloads, progress, and settings live in IndexedDB.
- shared/types.ts -- API types shared by client and server.

NovelFire requires a browser User-Agent (the scraper sends one); requests are
rate-limited and cached server-side. To add another source later, implement
SourceAdapter (see server/source/adapter.ts) and select it in server/index.ts.
