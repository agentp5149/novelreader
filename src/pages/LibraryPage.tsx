import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export function LibraryPage() {
  const novels = useLiveQuery(() => db.novels.orderBy("addedAt").reverse().toArray());
  const progress = useLiveQuery(() => db.progress.toArray());

  if (!novels) return <div className="container">Loading…</div>;
  if (novels.length === 0)
    return (
      <div className="container">
        <p>Your library is empty.</p>
        <Link to="/search">Search for novels →</Link>
      </div>
    );

  const resumeFor = (slug: string) =>
    progress?.find((p) => p.novelSlug === slug)?.lastChapterId;

  return (
    <div className="container">
      <div className="grid">
        {novels.map((n) => {
          const resume = resumeFor(n.slug);
          return (
            <div key={n.slug}>
              <Link className="card" to={`/novel/${n.slug}`}>
                <img src={n.coverUrl} alt={n.title} loading="lazy" />
                <span>{n.title}</span>
              </Link>
              {resume && (
                <Link to={`/read/${n.slug}/${resume}`} style={{ fontSize: 12 }}>
                  Resume →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
