import Dexie, { type Table } from "dexie";
import type { ChapterMeta } from "../shared/types";

export interface LibraryNovel {
  slug: string;
  title: string;
  author: string;
  coverUrl: string;
  synopsis: string;
  addedAt: number;
}

export interface StoredChapter extends ChapterMeta {
  novelSlug: string;
  downloaded: number; // 0 | 1 (indexable boolean)
}

export interface StoredContent {
  id: string;   // chapter id
  text: string;
  title: string;
}

export interface Progress {
  novelSlug: string;
  lastChapterId: string;
  scrollPct: number;
  updatedAt: number;
}

export interface Settings {
  key: "settings";
  fontSize: number;
  lineHeight: number;
  theme: "light" | "dark" | "sepia";
}

export class ReaderDB extends Dexie {
  novels!: Table<LibraryNovel, string>;
  chapters!: Table<StoredChapter, string>;
  contents!: Table<StoredContent, string>;
  progress!: Table<Progress, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("webnovel-reader");
    this.version(1).stores({
      novels: "slug, addedAt",
      chapters: "id, novelSlug, [novelSlug+number], downloaded",
      contents: "id",
      progress: "novelSlug",
      settings: "key"
    });
  }
}

export const db = new ReaderDB();

export const DEFAULT_SETTINGS: Settings = {
  key: "settings",
  fontSize: 18,
  lineHeight: 1.7,
  theme: "dark"
};
