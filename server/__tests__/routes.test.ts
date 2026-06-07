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
