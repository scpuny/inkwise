// ─── CollectionService — 合集管理服务 ───
import type { Collection, TrashItem } from "../domain";
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

  async list(): Promise<Collection[]> {
    return this.store.loadCollections();
  }

  async create(title: string): Promise<Collection> {
    const col = await this.store.createCollection(title);
    this.events.emit("collections-changed");
    return col;
  }

  async rename(id: string, title: string): Promise<void> {
    const all = await this.store.loadCollections();
    const col = all.find((c) => c.id === id);
    if (col) {
      col.title = title;
      await this.store.saveCollections(all);
      this.events.emit("collections-changed");
    }
  }

  async remove(id: string): Promise<void> {
    const all = await this.store.loadCollections();
    const idx = all.findIndex((c) => c.id === id);
    if (idx >= 0) {
      all.splice(idx, 1);
      await this.store.saveCollections(all);
      this.events.emit("collections-changed");
    }
  }

  /** 把文章移入回收站 */
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

  /** 从回收站恢复文章 */
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
}
