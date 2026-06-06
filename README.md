# Web Novel Reader

Personal web-novel reader PWA. Searches NovelFire, reads chapters, and downloads
them for offline reading. Installable on iPhone via Safari -> Share -> Add to Home Screen.

> Personal, self-hosted tool. It scrapes a third-party site; do not operate it as a
> public service or publish it to an app store.

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
- src/ -- React PWA; library, downloads, progress, and settings live in IndexedDB.
- shared/types.ts -- API types shared by client and server.

To add another source later, implement SourceAdapter (see server/source/adapter.ts)
and select it in server/index.ts.
