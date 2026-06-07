import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { HomeFeed, SearchResult, RankingTab } from "../../shared/types";
import { NovelCard } from "../components/NovelCard";

export function HomePage() {
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .home()
      .then((f) => !cancelled && setFeed(f))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container">
      <div className="hero">
        <h1 className="hero-title">NovelReader</h1>
        <p className="hero-sub">Discover web &amp; light novels from NovelFire.</p>
      </div>

      {error && <p className="error">Couldn't load NovelFire home: {error}</p>}
      {!feed && !error && <p style={{ color: "var(--muted)" }}>Loading tonight's selection…</p>}

      {feed && (
        <>
          <Section title="Recommended" items={feed.recommended} />
          <RankingSection tabs={feed.ranking} />
          <Section title="Completed" items={feed.completed} />
        </>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: SearchResult[] }) {
  if (!items.length) return null;
  return (
    <section className="home-section">
      <h2 className="section-title">{title}</h2>
      <div className="grid">
        {items.map((n) => (
          <NovelCard key={n.slug} {...n} />
        ))}
      </div>
    </section>
  );
}

function RankingSection({ tabs }: { tabs: RankingTab[] }) {
  const [active, setActive] = useState(0);
  if (!tabs.length) return null;
  const tab = tabs[active] ?? tabs[0];

  return (
    <section className="home-section">
      <h2 className="section-title">Ranking</h2>
      <div className="rank-tabs">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            className={i === active ? "rank-tab active" : "rank-tab"}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="rank-list">
        {tab.entries.map((e) => (
          <Link key={e.slug} className="rank-item" to={`/novel/${e.slug}`}>
            <span className={e.rank <= 3 ? "rank-num top" : "rank-num"}>{e.rank}</span>
            <img className="rank-cover" src={e.coverUrl} alt={e.title} loading="lazy" />
            <div className="rank-body">
              <div className="rank-title">{e.title}</div>
              <div className="rank-stats">
                {e.rating !== undefined && <span>★ {e.rating}</span>}
                {e.stats.map((s, i) => (
                  <span key={i}>
                    {s.icon} {s.text}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
