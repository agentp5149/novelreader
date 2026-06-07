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
