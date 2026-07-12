// TauriDocumentStore — DocumentStore 的 Tauri/桥接实现
// 当前通过旧存储函数实现，Phase 3 后改为直接调 SQLite

import type {
  ArticleDocument,
  ArticleBlueprint,
  Article,
  Collection,
  SeriesPlan,
  TrashItem,
  SearchResult,
} from "../domain";
import type { DocumentStore } from "./DocumentStore";

// 旧存储导入（桥接模式，后续逐步替换）
import {
  loadArticleDocument,
  saveArticleDocument,
  createDefaultDocument,
  migrateArticleDocument,
} from "../lib/storage/articleDocument";
import { loadArticleContent, saveArticleContent, loadArticleMeta } from "../lib/storage/articles";
import {
  loadCollections,
  saveCollections,
  addCollection,
  renameCollection as oldRenameCollection,
  removeCollection as oldRemoveCollection,
  updateCollection as oldUpdateCollection,
  addArticle as oldAddArticle,
  renameArticle as oldRenameArticle,
  trashArticle as oldTrashArticle,
  loadTrash,
  saveTrash,
  restoreArticle,
  permanentlyDeleteArticle as oldPermanentlyDeleteArticle,
  emptyTrash as oldEmptyTrash,
  unlinkCollectionFolder as oldUnlinkCollectionFolder,
  loadAllSeriesPlans as oldLoadAllSeriesPlans,
  loadSeriesPlan as oldLoadSeriesPlan,
  saveSeriesPlan as oldSaveSeriesPlan,
  deleteSeriesPlan as oldDeleteSeriesPlan,
  searchArticleTitles as oldSearchArticleTitles,
  searchArticleContent as oldSearchArticleContent,
  type SeriesPlan as OldSeriesPlan,
} from "../lib/storage/collections";
import {
  linkCollectionFolder as oldLinkCollectionFolder,
  rescanProjectFolder as oldRescanProjectFolder,
} from "../lib/storage/collections/projectContext";
import { loadBlueprint as oldLoadBlueprint, saveBlueprint as oldSaveBlueprint } from "../lib/ai/article/blueprint";
import { saveVersionSnapshot as oldSaveVersionSnapshot } from "../lib/storage/articleVersions";
import { getProvidersSync as oldGetProvidersSync } from "../lib/storage/providerModels";
import { genId } from "../lib/storage/collections/crud";

/** 将旧 Collection 格式转换为新域类型 */
function toDomainCollection(c: any): Collection {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt || c.created_at || Date.now(),
    articles: (c.articles || []).map((a: any) => ({
      id: a.id,
      title: a.title,
      createdAt: a.createdAt || a.created_at || Date.now(),
      updatedAt: a.updatedAt || a.updated_at || Date.now(),
      pinned: a.pinned,
      description: a.description,
      tags: a.tags,
      phase: a.phase,
      blueprint: a.blueprint,
    })),
    description: c.description,
    coverImage: c.coverImage,
    linkedFolder: c.linkedFolder,
  };
}

export class TauriDocumentStore implements DocumentStore {
  // ── 文档 ──

  async loadDocument(id: string): Promise<ArticleDocument | null> {
    return loadArticleDocument(id);
  }

  async saveDocument(doc: ArticleDocument): Promise<void> {
    // During migration: save to both backends for consistency
    if (doc.content) {
      await saveArticleContent(doc.id, doc.content);
    }
    await saveArticleDocument(doc);
  }

  async deleteDocument(id: string): Promise<void> {
    await oldPermanentlyDeleteArticle(id);
  }

  // ── 合集 ──

  async loadCollections(): Promise<Collection[]> {
    const cols = await loadCollections();
    return cols.map(toDomainCollection);
  }

  async saveCollections(collections: Collection[]): Promise<void> {
    await saveCollections(collections as any);
  }

  async createCollection(title: string): Promise<Collection> {
    const col = await addCollection(title);
    return toDomainCollection(col);
  }

  async renameCollection(id: string, title: string): Promise<void> {
    await oldRenameCollection(id, title);
  }

  async removeCollection(id: string): Promise<void> {
    await oldRemoveCollection(id);
  }

  async updateCollection(
    id: string,
    data: Partial<Pick<Collection, "title" | "description" | "coverImage" | "linkedFolder">>,
  ): Promise<void> {
    await oldUpdateCollection(id, data);
  }

  // ── 文章 CRUD ──

  async addArticle(collectionId: string, title: string): Promise<Article | null> {
    const article = await oldAddArticle(collectionId, title);
    if (!article) return null;
    return {
      id: article.id,
      title: article.title,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
      pinned: article.pinned,
      description: article.description,
      tags: article.tags,
      phase: article.phase,
      blueprint: article.blueprint,
    };
  }

  async renameArticle(collectionId: string, articleId: string, title: string): Promise<void> {
    await oldRenameArticle(collectionId, articleId, title);
  }

  // ── 回收站 ──

  async loadTrash(): Promise<TrashItem[]> {
    return loadTrash() as Promise<TrashItem[]>;
  }

  async saveTrash(items: TrashItem[]): Promise<void> {
    await saveTrash(items as any);
  }

  async permanentlyDeleteArticle(trashId: string): Promise<void> {
    await oldPermanentlyDeleteArticle(trashId);
  }

  async emptyTrash(): Promise<void> {
    await oldEmptyTrash();
  }

  // ── 系列规划 ──

  async loadSeriesPlan(collectionId: string, seriesId: string): Promise<SeriesPlan | null> {
    return oldLoadSeriesPlan(collectionId, seriesId) as Promise<SeriesPlan | null>;
  }

  async loadAllSeriesPlans(collectionId: string): Promise<SeriesPlan[]> {
    return oldLoadAllSeriesPlans(collectionId) as Promise<SeriesPlan[]>;
  }

  async saveSeriesPlan(collectionId: string, plan: SeriesPlan): Promise<void> {
    await oldSaveSeriesPlan(collectionId, plan as any);
  }

  async deleteSeriesPlan(collectionId: string, seriesId: string): Promise<void> {
    await oldDeleteSeriesPlan(collectionId, seriesId);
  }

  // ── 文件夹关联 ──

  async linkCollectionFolder(collectionId: string, folderPath: string): Promise<void> {
    await oldLinkCollectionFolder(collectionId, folderPath);
  }

  async unlinkCollectionFolder(collectionId: string): Promise<void> {
    await oldUnlinkCollectionFolder(collectionId);
  }

  async rescanProjectFolder(folderPath: string): Promise<void> {
    await oldRescanProjectFolder(folderPath);
  }

  // ── 搜索 ──

  searchArticleTitles(collections: Collection[], query: string): SearchResult[] {
    return oldSearchArticleTitles(collections as any, query) as SearchResult[];
  }

  async searchArticleContent(
    collections: Collection[],
    query: string,
    excludeIds?: Set<string>,
  ): Promise<SearchResult[]> {
    return oldSearchArticleContent(collections as any, query, excludeIds) as Promise<SearchResult[]>;
  }

  // ── 内容加载（桥接旧模块） ──

  async loadArticleContent(articleId: string): Promise<string | null> {
    return loadArticleContent(articleId);
  }

  async saveArticleContent(articleId: string, content: string): Promise<void> {
    await saveArticleContent(articleId, content);
  }

  async loadArticleMeta(articleId: string): Promise<{ id: string; collectionId: string; title: string; createdAt: number; updatedAt: number } | null> {
    return loadArticleMeta(articleId);
  }

  async loadBlueprint(articleId: string): Promise<ArticleBlueprint | null> {
    return oldLoadBlueprint(articleId) as Promise<ArticleBlueprint | null>;
  }

  async saveBlueprint(articleId: string, blueprint: ArticleBlueprint): Promise<void> {
    await oldSaveBlueprint(articleId, blueprint as any);
  }

  async saveVersionSnapshot(articleId: string, content: string): Promise<void> {
    await oldSaveVersionSnapshot(articleId, content);
  }

  getProvidersSync(): unknown[] {
    return oldGetProvidersSync() as unknown[];
  }

  // ── 数据迁移 ──

  async migrateArticleDocument(id: string): Promise<ArticleDocument | null> {
    return migrateArticleDocument(id);
  }
}
