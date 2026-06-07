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
