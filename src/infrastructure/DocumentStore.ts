// ─── DocumentStore 接口 ───
// 抽象文档持久化操作，可被 Tauri / localStorage / Mock 实现

import type {
  ArticleDocument,
  Collection,
  SeriesPlan,
  TrashItem,
} from "../domain";

export interface DocumentStore {
  // ── 文档 ──
  loadDocument(id: string): Promise<ArticleDocument | null>;
  saveDocument(doc: ArticleDocument): Promise<void>;
  deleteDocument(id: string): Promise<void>;

  // ── 合集 ──
  loadCollections(): Promise<Collection[]>;
  saveCollections(collections: Collection[]): Promise<void>;
  createCollection(title: string): Promise<Collection>;

  // ── 回收站 ──
  loadTrash(): Promise<TrashItem[]>;
  saveTrash(items: TrashItem[]): Promise<void>;

  // ── 系列规划 ──
  loadSeriesPlan(collectionId: string, seriesId: string): Promise<SeriesPlan | null>;
  saveSeriesPlan(collectionId: string, plan: SeriesPlan): Promise<void>;
  deleteSeriesPlan(collectionId: string, seriesId: string): Promise<void>;
}
