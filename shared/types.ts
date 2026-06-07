export interface SearchResult {
  slug: string;
  title: string;
  coverUrl: string;
}

export interface ChapterMeta {
  id: string;        // e.g. "shadow-slave/chapter-1"
  number: number;
  title: string;
  url: string;       // absolute
  updatedAt?: string;
}

export interface Novel {
  slug: string;
  title: string;
  author: string;
  coverUrl: string;
  synopsis: string;
  chapters: ChapterMeta[];
}

export interface ChapterContent {
  id: string;
  title: string;
  text: string;      // paragraphs joined by "\n\n"
  prev?: string;     // chapter id or undefined
  next?: string;     // chapter id or undefined
}

export interface RankStat {
  icon: string;      // emoji standing in for NovelFire's icon font (👁 🔖 💬 ✓ ✍)
  text: string;      // e.g. "1.3M (Monthly)", "25.1K", "493 Comments"
}

export interface RankEntry {
  rank: number;      // 1-based position within the tab
  slug: string;
  title: string;
  coverUrl: string;
  rating?: number;   // present on the "User Rated" tab
  stats: RankStat[];
}

export interface RankingTab {
  key: string;       // "most-read" | "new-trend" | "user-rated"
  label: string;     // "Most Read" | "New Trend" | "User Rated"
  entries: RankEntry[];
}

export interface HomeFeed {
  recommended: SearchResult[];
  completed: SearchResult[];
  ranking: RankingTab[];
}
