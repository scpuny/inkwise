// ─── CollectionService — 合集管理服务 ───
// 编排合集/文章/回收站/系列规划/文件夹关联等全套业务逻辑

import type { Article, Collection, SeriesPlan, TrashItem, SearchResult } from "../domain";
import type { DocumentStore } from "../infrastructure/DocumentStore";
import type { EventBus } from "../infrastructure/EventBus";

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class CollectionService {
  constructor(
    private readonly store: DocumentStore,
    private readonly events: EventBus,
  ) {}

  // ── 合集 CRUD ──

  async list(): Promise<Collection[]> {
    return this.store.loadCollections();
  }

  async create(title: string): Promise<Collection> {
    const col = await this.store.createCollection(title);
    this.events.emit("collections-changed");
    return col;
  }

  async rename(id: string, title: string): Promise<void> {
    await this.store.renameCollection(id, title);
    this.events.emit("collections-changed");
  }

  async remove(id: string): Promise<void> {
    await this.store.removeCollection(id);
    this.events.emit("collections-changed");
  }

  async update(
    id: string,
    data: Partial<Pick<Collection, "title" | "description" | "coverImage" | "linkedFolder">>,
  ): Promise<void> {
    await this.store.updateCollection(id, data);
    this.events.emit("collections-changed");
  }

  async saveCollections(collections: Collection[]): Promise<void> {
    await this.store.saveCollections(collections);
    this.events.emit("collections-changed");
  }

  // ── 文章 CRUD ──

  async addArticle(collectionId: string, title: string): Promise<Article | null> {
    const article = await this.store.addArticle(collectionId, title);
    this.events.emit("collections-changed");
    return article;
  }

  async renameArticle(collectionId: string, articleId: string, title: string): Promise<void> {
    await this.store.renameArticle(collectionId, articleId, title);
    this.events.emit("collections-changed");
  }

  async trashArticle(collectionId: string, articleId: string, articleTitle: string): Promise<void> {
    const all = await this.store.loadCollections();
    const col = all.find((c) => c.id === collectionId);
    if (!col) return;

    const aIdx = col.articles.findIndex((a) => a.id === articleId);
    if (aIdx < 0) return;
    col.articles.splice(aIdx, 1);

    const trash = await this.store.loadTrash();
    trash.push({
      id: articleId,
      title: articleTitle,
      collectionId,
      collectionTitle: col.title,
      deletedAt: Date.now(),
    });

    await this.store.saveCollections(all);
    await this.store.saveTrash(trash);
    this.events.emit("collections-changed");
  }

  // ── 回收站 ──

  async loadTrash(): Promise<TrashItem[]> {
    return this.store.loadTrash();
  }

  async restoreArticle(trashId: string): Promise<void> {
    const trash = await this.store.loadTrash();
    const idx = trash.findIndex((t) => t.id === trashId);
    if (idx < 0) return;

    const item = trash[idx];
    trash.splice(idx, 1);

    const all = await this.store.loadCollections();
    let col = all.find((c) => c.id === item.collectionId);
    if (!col) {
      col = {
        id: item.collectionId,
        title: item.collectionTitle,
        articles: [],
        createdAt: Date.now(),
      };
      all.push(col);
    }
    col.articles.push({
      id: item.id,
      title: item.title,
      createdAt: item.deletedAt,
      updatedAt: item.deletedAt,
    });

    await this.store.saveTrash(trash);
    await this.store.saveCollections(all);
    this.events.emit("collections-changed");
  }

  async saveTrash(items: TrashItem[]): Promise<void> {
    await this.store.saveTrash(items);
    this.events.emit("collections-changed");
  }

  async permanentlyDeleteArticle(trashId: string): Promise<void> {
    await this.store.permanentlyDeleteArticle(trashId);
    this.events.emit("collections-changed");
  }

  async emptyTrash(): Promise<void> {
    await this.store.emptyTrash();
    this.events.emit("collections-changed");
  }

  // ── 文件夹关联 ──

  async linkCollectionFolder(collectionId: string, folderPath: string): Promise<void> {
    await this.store.linkCollectionFolder(collectionId, folderPath);
    this.events.emit("collections-changed");
  }

  async unlinkCollectionFolder(collectionId: string): Promise<void> {
    await this.store.unlinkCollectionFolder(collectionId);
    this.events.emit("collections-changed");
  }

  async rescanProjectFolder(folderPath: string): Promise<void> {
    await this.store.rescanProjectFolder(folderPath);
  }

  // ── 系列规划 ──

  async loadAllSeriesPlans(collectionId: string): Promise<SeriesPlan[]> {
    return this.store.loadAllSeriesPlans(collectionId);
  }

  async loadSeriesPlan(collectionId: string, seriesId: string): Promise<SeriesPlan | null> {
    return this.store.loadSeriesPlan(collectionId, seriesId);
  }

  async saveSeriesPlan(collectionId: string, plan: SeriesPlan): Promise<void> {
    await this.store.saveSeriesPlan(collectionId, plan);
    this.events.emit("collections-changed");
  }

  async deleteSeriesPlan(collectionId: string, seriesId: string): Promise<void> {
    await this.store.deleteSeriesPlan(collectionId, seriesId);
    this.events.emit("collections-changed");
  }

  // ── 搜索 ──

  searchArticleTitles(collections: Collection[], query: string): SearchResult[] {
    return this.store.searchArticleTitles(collections, query);
  }

  async searchArticleContent(
    collections: Collection[],
    query: string,
    excludeIds?: Set<string>,
  ): Promise<SearchResult[]> {
    return this.store.searchArticleContent(collections, query, excludeIds);
  }

  // ── 内容/蓝图加载（桥接） ──

  async loadArticleContent(articleId: string): Promise<string | null> {
    return this.store.loadArticleContent(articleId);
  }

  async loadBlueprint(articleId: string): Promise<unknown | null> {
    return this.store.loadBlueprint(articleId);
  }
}
