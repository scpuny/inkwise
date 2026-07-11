// TauriDocumentStore — DocumentStore 的 Tauri/桥接实现
// 当前通过旧存储函数实现，Phase 3 后改为直接调 SQLite

import type { ArticleDocument, Collection, SeriesPlan, TrashItem } from "../domain";
import type { DocumentStore } from "./DocumentStore";

// 旧存储导入（桥接模式，后续逐步替换）
import { loadArticleDocument, saveArticleDocument, createDefaultDocument } from "../lib/storage/articleDocument";
import { loadArticleContent, saveArticleContent } from "../lib/storage/articles";
import { loadCollections, saveCollections, addCollection, loadTrash, saveTrash, restoreArticle, permanentlyDeleteArticle, emptyTrash } from "../lib/storage/collections";
import { loadCollections as loadSeriesPlan, saveSeriesPlan, deleteSeriesPlan } from "../lib/storage/collections";
import { genId } from "../lib/storage/collections/crud";

export class TauriDocumentStore implements DocumentStore {
  // ── 文档 ──

  async loadDocument(id: string): Promise<ArticleDocument | null> {
    return loadArticleDocument(id);
  }

  async saveDocument(doc: ArticleDocument): Promise<void> {
    await saveArticleDocument(doc);
  }

  async deleteDocument(id: string): Promise<void> {
    await permanentlyDeleteArticle(id);
  }

  // ── 合集 ──

  async loadCollections(): Promise<Collection[]> {
    // 桥接：旧 loadCollections 返回的 Collection 格式不同，需要转换
    const cols = await loadCollections();
    return cols.map((c: any) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt || c.created_at || Date.now(),
      articles: (c.articles || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        createdAt: a.createdAt || a.created_at || Date.now(),
        updatedAt: a.updatedAt || a.updated_at || Date.now(),
      })),
    }));
  }

  async saveCollections(collections: Collection[]): Promise<void> {
    await saveCollections(collections as any);
  }

  async createCollection(title: string): Promise<Collection> {
    return addCollection(title) as Promise<Collection>;
  }

  // ── 回收站 ──

  async loadTrash(): Promise<TrashItem[]> {
    return loadTrash() as Promise<TrashItem[]>;
  }

  async saveTrash(items: TrashItem[]): Promise<void> {
    await saveTrash(items as any);
  }

  // ── 系列规划 ──

  async loadSeriesPlan(collectionId: string, seriesId: string): Promise<SeriesPlan | null> {
    const cols = await loadCollections();
    const col = cols.find((c: any) => c.id === collectionId);
    if (!col) return null;
    // SeriesPlan 存储在合集扩展字段中 — 桥接逻辑
    return (col as any).seriesPlan || null;
  }

  async saveSeriesPlan(collectionId: string, plan: SeriesPlan): Promise<void> {
    await saveSeriesPlan(collectionId, plan);
  }

  async deleteSeriesPlan(collectionId: string, seriesId: string): Promise<void> {
    await deleteSeriesPlan(collectionId, seriesId);
  }
}
