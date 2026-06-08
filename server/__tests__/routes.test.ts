import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { makeApiRouter } from "../routes";
import type { SourceAdapter } from "../source/adapter";

const fakeAdapter: SourceAdapter = {
  search: async (q) => [{ slug: "x", title: "X " + q, coverUrl: "c" }],
  getNovel: async (slug) => ({
    slug, title: "X", author: "A", coverUrl: "c", synopsis: "s",
    chapters: [
      { id: `${slug}/chapter-1`, number: 1, title: "Chapter 1", url: "u1" },
      { id: `${slug}/chapter-2`, number: 2, title: "Chapter 2", url: "u2" }
    ]
  }),
  getChapter: async (id) => ({ id, title: "T", text: "body", next: undefined, prev: undefined }),
  getHome: async () => ({
    recommended: [{ slug: "r", title: "R", coverUrl: "c" }],
    completed: [{ slug: "c", title: "C", coverUrl: "c" }],
    ranking: [
      {
        key: "most-read",
        label: "Most Read",
        entries: [{ rank: 1, slug: "n1", title: "N1", coverUrl: "c", stats: [] }]
      }
    ]
  })
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

  it("GET /api/home returns curated sections", async () => {
    const res = await request(makeApp()).get("/api/home");
    expect(res.status).toBe(200);
    expect(res.body.recommended[0].slug).toBe("r");
    expect(res.body.completed[0].slug).toBe("c");
    expect(res.body.ranking[0].entries[0].rank).toBe(1);
  });

  it("GET /api/epub?slug= returns an epub attachment", async () => {
    const res = await request(makeApp()).get("/api/epub?slug=abc");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/epub+zip");
    expect(res.headers["content-disposition"]).toContain("abc.epub");
  });

  it("GET /api/epub without slug returns 400", async () => {
    const res = await request(makeApp()).get("/api/epub");
    expect(res.status).toBe(400);
  });
});
