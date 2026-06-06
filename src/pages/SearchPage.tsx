import { useState } from "react";
import { api } from "../api";
import type { SearchResult } from "../../shared/types";
import { NovelCard } from "../components/NovelCard";

export function SearchPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setResults(await api.search(q.trim()));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <form className="row" onSubmit={run}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search novels…"
          style={{ flex: 1 }}
        />
        <button type="submit">Search</button>
      </form>
      {loading && <p>Searching…</p>}
      {error && <p style={{ color: "salmon" }}>{error}</p>}
      <div className="grid" style={{ marginTop: 16 }}>
        {results.map((r) => (
          <NovelCard key={r.slug} {...r} />
        ))}
      </div>
    </div>
  );
}
