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
