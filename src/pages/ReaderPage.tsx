import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { api } from "../api";
import { db } from "../db";
import { useSettings } from "../settings";
import type { ChapterContent } from "../../shared/types";

export function ReaderPage() {
  const { novelSlug = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [settings, updateSettings] = useSettings();

  // chapter id is everything after "/read/<novelSlug>/"
  const chapterId = decodeURIComponent(
    location.pathname.split(`/read/${novelSlug}/`)[1] ?? ""
  );

  const [chapter, setChapter] = useState<ChapterContent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // Load: prefer downloaded copy, else network.
  useEffect(() => {
    let cancelled = false;
    setChapter(null);
    setError(null);
    (async () => {
      const local = await db.contents.get(chapterId);
      if (local) {
        if (!cancelled) setChapter({ id: chapterId, title: local.title, text: local.text });
        // still fetch prev/next from network in background if online
        try {
          const net = await api.chapter(chapterId);
          if (!cancelled) setChapter(net);
        } catch { /* offline: keep local */ }
        return;
      }
      try {
        const net = await api.chapter(chapterId);
        if (!cancelled) setChapter(net);
      } catch (e) {
        if (!cancelled)
          setError(
            navigator.onLine
              ? (e as Error).message
              : "You're offline and this chapter isn't downloaded."
          );
      }
    })();
    return () => { cancelled = true; };
  }, [chapterId]);

  // Save progress on scroll (throttled to avoid IndexedDB write storms).
  useEffect(() => {
    let timer: number | undefined;
    function onScroll() {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        const max = document.body.scrollHeight - window.innerHeight;
        const pct = max > 0 ? window.scrollY / max : 0;
        db.progress.put({
          novelSlug,
          lastChapterId: chapterId,
          scrollPct: pct,
          updatedAt: Date.now()
        });
      }, 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [novelSlug, chapterId]);

  // Restore scroll once chapter renders (after layout via rAF).
  useEffect(() => {
    if (!chapter) return;
    let raf = 0;
    (async () => {
      const p = await db.progress.get(novelSlug);
      raf = requestAnimationFrame(() => {
        if (p && p.lastChapterId === chapterId) {
          const max = document.body.scrollHeight - window.innerHeight;
          window.scrollTo(0, p.scrollPct * max);
        } else {
          window.scrollTo(0, 0);
        }
      });
    })();
    return () => cancelAnimationFrame(raf);
  }, [chapter, novelSlug, chapterId]);

  async function download() {
    if (!chapter) return;
    await db.contents.put({ id: chapter.id, text: chapter.text, title: chapter.title });
    await db.chapters.update(chapter.id, { downloaded: 1 });
  }

  if (error) return <div className="container" style={{ color: "salmon" }}>{error}</div>;
  if (!chapter) return <div className="container">Loading…</div>;

  return (
    <div className={`reader-wrap reader theme-${settings.theme}`}>
      <div className="nav">
        <button onClick={() => navigate(`/novel/${novelSlug}`)}>← Chapters</button>
        <button onClick={() => setShowSettings((s) => !s)}>Aa</button>
        <button onClick={download}>Download</button>
      </div>

      {showSettings && (
        <div className="container row" style={{ flexWrap: "wrap" }}>
          <label>Font
            <input type="range" min={14} max={28} value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })} />
          </label>
          <label>Theme
            <select value={settings.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as typeof settings.theme })}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="sepia">Sepia</option>
            </select>
          </label>
        </div>
      )}

      <div className="container reader"
        style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight }}>
        <h2>{chapter.title}</h2>
        <div>{chapter.text}</div>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 24 }}>
          <button disabled={!chapter.prev}
            onClick={() => chapter.prev && navigate(`/read/${novelSlug}/${chapter.prev}`)}>
            ← Prev
          </button>
          <button disabled={!chapter.next}
            onClick={() => chapter.next && navigate(`/read/${novelSlug}/${chapter.next}`)}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
