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
