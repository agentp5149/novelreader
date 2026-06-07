import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { api } from "../api";
import { db } from "../db";
import type { Novel, ChapterMeta } from "../../shared/types";

const CHAPTERS_PER_GROUP = 100;

export function NovelPage() {
  const { slug = "" } = useParams();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inLibrary = useLiveQuery(() => db.novels.get(slug), [slug]);
  const progress = useLiveQuery(() => db.progress.get(slug), [slug]);
  const [activeGroup, setActiveGroup] = useState(0);
  const [gotoValue, setGotoValue] = useState("");
  const [gotoError, setGotoError] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState<number | null>(null);

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

  // Split the full chapter list into tabs of 100.
  const groups = useMemo<ChapterMeta[][]>(() => {
    if (!novel) return [];
    const out: ChapterMeta[][] = [];
    for (let i = 0; i < novel.chapters.length; i += CHAPTERS_PER_GROUP) {
      out.push(novel.chapters.slice(i, i + CHAPTERS_PER_GROUP));
    }
    return out;
  }, [novel]);

  // Open the group containing the last-read chapter (else the first group).
  useEffect(() => {
    if (!novel) return;
    let initial = 0;
    const lastId = progress?.lastChapterId;
    if (lastId) {
      const idx = novel.chapters.findIndex((c) => c.id === lastId);
      if (idx >= 0) initial = Math.floor(idx / CHAPTERS_PER_GROUP);
    }
    setActiveGroup(initial);
  }, [novel, progress]);

  // Jump to a chapter by number: open its group and flag its row for scrolling.
  function goToChapter(e: React.FormEvent) {
    e.preventDefault();
    if (!novel) return;
    const n = parseInt(gotoValue, 10);
    if (Number.isNaN(n)) return;
    let idx = novel.chapters.findIndex((c) => c.number === n);
    if (idx < 0 && n >= 1 && n <= novel.chapters.length) idx = n - 1; // fallback to nth
    if (idx < 0) {
      setGotoError(`No chapter ${n} (1–${novel.chapters.length})`);
      return;
    }
    setGotoError(null);
    setActiveGroup(Math.floor(idx / CHAPTERS_PER_GROUP));
    setJumpTo(idx);
  }

  // Once the target group renders, scroll its row into view and flash it.
  useEffect(() => {
    if (jumpTo === null) return;
    const el = document.getElementById(`chrow-${jumpTo}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("flash");
    const t = window.setTimeout(() => el.classList.remove("flash"), 1500);
    return () => window.clearTimeout(t);
  }, [jumpTo, activeGroup]);

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
      <section className="synopsis">
        <h3 className="section-title">Synopsis</h3>
        {novel.synopsis ? (
          <p className="synopsis-text">{novel.synopsis}</p>
        ) : (
          <p className="muted">No description available for this novel.</p>
        )}
      </section>

      <h3 className="section-title">Chapters ({novel.chapters.length})</h3>
      {groups.length > 1 && (
        <>
          <div className="chapter-tools">
            <form className="goto-form" onSubmit={goToChapter}>
              <input
                type="number"
                min={1}
                max={novel.chapters.length}
                value={gotoValue}
                onChange={(e) => setGotoValue(e.target.value)}
                placeholder="Go to chapter #"
              />
              <button type="submit">Go</button>
            </form>
            {gotoError && <span className="error">{gotoError}</span>}
          </div>
          <div className="chapter-tabs">
            {groups.map((g, i) => (
              <button
                key={i}
                className={i === activeGroup ? "chapter-tab active" : "chapter-tab"}
                onClick={() => setActiveGroup(i)}
              >
                {i * CHAPTERS_PER_GROUP + 1}–{i * CHAPTERS_PER_GROUP + g.length}
              </button>
            ))}
          </div>
        </>
      )}
      <div>
        {(groups[activeGroup] ?? groups[0] ?? []).map((c, i) => (
          <div
            className="chapter-row"
            id={`chrow-${activeGroup * CHAPTERS_PER_GROUP + i}`}
            key={c.id}
          >
            <Link
              className={c.id === progress?.lastChapterId ? "current" : undefined}
              to={`/read/${novel.slug}/${c.id}`}
            >
              {c.title}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
