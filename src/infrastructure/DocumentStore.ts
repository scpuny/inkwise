// ─── DocumentStore 接口 ───
// 抽象文档持久化操作，可被 Tauri / localStorage / Mock 实现

import type {
  ArticleDocument,
  ArticleBlueprint,
  Article,
  Collection,
  SeriesPlan,
  TrashItem,
  SearchResult,
  VersionEntry,
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
  renameCollection(id: string, title: string): Promise<void>;
  removeCollection(id: string): Promise<void>;
  updateCollection(
    id: string,
    data: Partial<Pick<Collection, "title" | "description" | "coverImage" | "linkedFolder">>,
  ): Promise<void>;

  // ── 文章 CRUD ──
  addArticle(collectionId: string, title: string): Promise<Article | null>;
  renameArticle(collectionId: string, articleId: string, title: string): Promise<void>;

  // ── 回收站 ──
  loadTrash(): Promise<TrashItem[]>;
  saveTrash(items: TrashItem[]): Promise<void>;
  permanentlyDeleteArticle(trashId: string): Promise<void>;
  emptyTrash(): Promise<void>;

  // ── 系列规划 ──
  loadSeriesPlan(collectionId: string, seriesId: string): Promise<SeriesPlan | null>;
  loadAllSeriesPlans(collectionId: string): Promise<SeriesPlan[]>;
  saveSeriesPlan(collectionId: string, plan: SeriesPlan): Promise<void>;
  deleteSeriesPlan(collectionId: string, seriesId: string): Promise<void>;

  // ── 文件夹关联 ──
  linkCollectionFolder(collectionId: string, folderPath: string): Promise<void>;
  unlinkCollectionFolder(collectionId: string): Promise<void>;
  rescanProjectFolder(folderPath: string): Promise<void>;

  // ── 搜索 ──
  searchArticleTitles(collections: Collection[], query: string): SearchResult[];
  searchArticleContent(
    collections: Collection[],
    query: string,
    excludeIds?: Set<string>,
  ): Promise<SearchResult[]>;

  // ── 内容加载（桥接旧模块） ──
  loadArticleContent(articleId: string): Promise<string | null>;
  saveArticleContent(articleId: string, content: string): Promise<void>;
  loadArticleMeta(articleId: string): Promise<{ id: string; collectionId: string; title: string; createdAt: number; updatedAt: number } | null>;
  loadBlueprint(articleId: string): Promise<ArticleBlueprint | null>;
  saveBlueprint(articleId: string, blueprint: ArticleBlueprint): Promise<void>;

  // ── 版本快照 ──
  saveVersionSnapshot(articleId: string, content: string): Promise<void>;
  getVersionHistory(articleId: string): Promise<VersionEntry[]>;
  loadVersionContent(articleId: string, versionId: string): Promise<string | null>;
  restoreVersion(articleId: string, versionId: string): Promise<string | null>;

  // ── 提供商配置 ──
  getProvidersSync(): unknown[];

  // ── 数据迁移 ──
  migrateArticleDocument(id: string): Promise<ArticleDocument | null>;
}
