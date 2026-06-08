import { Router } from "express";
import type { SourceAdapter } from "./source/adapter";
import { buildEpub } from "./epub";

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

  r.get("/home", async (_req, res) => {
    try {
      res.json(await adapter.getHome());
    } catch (e) {
      res.status(502).json({ error: (e as Error).message });
    }
  });

  r.get("/epub", async (req, res) => {
    const slug = String(req.query.slug ?? "").trim();
    if (!slug) return res.status(400).json({ error: "missing slug" });
    const from = parseInt(String(req.query.from ?? ""), 10);
    const to = parseInt(String(req.query.to ?? ""), 10);
    const ranged = !Number.isNaN(from) && !Number.isNaN(to);
    try {
      const novel = await adapter.getNovel(slug);
      const selected = ranged
        ? novel.chapters.slice(Math.max(0, from - 1), to)
        : novel.chapters;
      const chapters = [];
      for (const ch of selected) {
        const content = await adapter.getChapter(ch.id);
        chapters.push({ title: ch.title || content.title, text: content.text });
      }
      const buf = await buildEpub(
        { title: novel.title, author: novel.author, slug },
        chapters
      );
      const safe = slug.replace(/[^a-z0-9-]/gi, "-");
      const name = ranged ? `${safe}-${from}-${to}.epub` : `${safe}.epub`;
      res.setHeader("Content-Type", "application/epub+zip");
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
      res.send(buf);
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
