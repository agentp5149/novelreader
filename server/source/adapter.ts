import type { SearchResult, Novel, ChapterContent } from "../../shared/types";

export interface SourceAdapter {
  /** Search the source by free-text query. */
  search(query: string): Promise<SearchResult[]>;
  /** Fetch novel metadata plus the full (paginated) chapter list. */
  getNovel(slug: string): Promise<Novel>;
  /** Fetch a single chapter's text and prev/next ids. */
  getChapter(id: string): Promise<ChapterContent>;
}

/** Thrown when scraped HTML no longer matches expected selectors. */
export class SourceLayoutError extends Error {
  constructor(what: string) {
    super(`Source layout changed: ${what}`);
    this.name = "SourceLayoutError";
  }
}
