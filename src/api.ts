import type { SearchResult, Novel, ChapterContent } from "../shared/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  search: (q: string) =>
    getJson<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`),
  novel: (slug: string) =>
    getJson<Novel>(`/api/novel?slug=${encodeURIComponent(slug)}`),
  chapter: (id: string) =>
    getJson<ChapterContent>(`/api/chapter?id=${encodeURIComponent(id)}`)
};
