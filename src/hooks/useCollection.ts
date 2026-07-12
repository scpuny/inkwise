// ─── useCollection — 合集 + 回收站 Hook ───
// 封装集合完整 CRUD + 回收站 + 系列规划 + 文件夹关联 + 搜索
// 通过 CollectionService 编排业务逻辑

import { useState, useCallback } from "react";
import type { Article, Collection, SeriesPlan, TrashItem, SearchResult } from "../domain";
import type { EventBus } from "../infrastructure/EventBus";
import { TauriDocumentStore } from "../infrastructure/TauriDocumentStore";
import { CollectionService } from "../services/CollectionService";
import { bus as globalBus } from "../lib/events/eventBus";

// 使用全局事件总线，确保与旧代码事件互通
const globalEventBus: EventBus = {
  emit: (event, payload) => { globalBus.emit(event, payload); },
  on: (event, handler) => { globalBus.on(event, handler); return () => globalBus.off(event, handler); },
  off: (event, handler) => { globalBus.off(event, handler); },
};

const DEFAULT_STORE = new TauriDocumentStore();
const DEFAULT_SERVICE = new CollectionService(DEFAULT_STORE, globalEventBus);

export function useCollection(service = DEFAULT_SERVICE) {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);

  // ── 合集 CRUD ──

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const cols = await service.list();
      setCollections(cols);
      return cols;
    } finally {
      setLoading(false);
    }
  }, [service]);

  const saveCollections = useCallback(async (cols: Collection[]) => {
    await service.saveCollections(cols);
    setCollections(cols);
  }, [service]);

  const createCollection = useCallback(async (title: string) => {
    const c = await service.create(title);
    setCollections((prev) => [...prev, c]);
    return c;
  }, [service]);

  const renameCollection = useCallback(async (id: string, title: string) => {
    await service.rename(id, title);
    setCollections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, [service]);

  const removeCollection = useCallback(async (id: string) => {
    await service.remove(id);
    setCollections((prev) => prev.filter((c) => c.id !== id));
  }, [service]);

  const updateCollection = useCallback(
    async (
      id: string,
      data: Partial<Pick<Collection, "title" | "description" | "coverImage" | "linkedFolder">>,
    ) => {
      await service.update(id, data);
      setCollections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data } : c)),
      );
    },
    [service],
  );

  // ── 文章 CRUD ──

  const addArticle = useCallback(
    async (collectionId: string, title: string): Promise<Article | null> => {
      const article = await service.addArticle(collectionId, title);
      if (article) {
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId ? { ...c, articles: [...c.articles, article!] } : c,
          ),
        );
      }
      return article;
    },
    [service],
  );

  const renameArticle = useCallback(
    async (collectionId: string, articleId: string, title: string) => {
      await service.renameArticle(collectionId, articleId, title);
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                articles: c.articles.map((a) =>
                  a.id === articleId ? { ...a, title, updatedAt: Date.now() } : a,
                ),
              }
            : c,
        ),
      );
    },
    [service],
  );

  const trashArticle = useCallback(
    async (collectionId: string, articleId: string, articleTitle: string) => {
      // Trash 操作涉及跨状态变更，先让 service 执行存储操作
      await service.trashArticle(collectionId, articleId, articleTitle);
      // 刷新合集和回收站
      const [cols, tr] = await Promise.all([service.list(), service.loadTrash()]);
      setCollections(cols);
      setTrash(tr);
    },
    [service],
  );

  // ── 回收站 ──

  const loadTrash = useCallback(async () => {
    const items = await service.loadTrash();
    setTrash(items);
    return items;
  }, [service]);

  const restoreArticle = useCallback(async (trashId: string) => {
    await service.restoreArticle(trashId);
    const [cols, tr] = await Promise.all([service.list(), service.loadTrash()]);
    setCollections(cols);
    setTrash(tr);
  }, [service]);

  const permanentlyDeleteArticle = useCallback(async (trashId: string) => {
    await service.permanentlyDeleteArticle(trashId);
    setTrash((prev) => prev.filter((t) => t.id !== trashId));
  }, [service]);

  const saveTrash = useCallback(async (items: TrashItem[]) => {
    await service.saveTrash(items);
    setTrash(items);
  }, [service]);

  const emptyTrash = useCallback(async () => {
    await service.emptyTrash();
    setTrash([]);
  }, [service]);

  // ── 文件夹关联 ──

  const linkCollectionFolder = useCallback(
    async (collectionId: string, folderPath: string) => {
      await service.linkCollectionFolder(collectionId, folderPath);
      setCollections((prev) =>
        prev.map((c) => (c.id === collectionId ? { ...c, linkedFolder: folderPath } : c)),
      );
    },
    [service],
  );

  const unlinkCollectionFolder = useCallback(
    async (collectionId: string) => {
      await service.unlinkCollectionFolder(collectionId);
      setCollections((prev) =>
        prev.map((c) => (c.id === collectionId ? { ...c, linkedFolder: undefined } : c)),
      );
    },
    [service],
  );

  const rescanProjectFolder = useCallback(
    async (folderPath: string) => {
      await service.rescanProjectFolder(folderPath);
    },
    [service],
  );

  // ── 系列规划 ──

  const loadAllSeriesPlans = useCallback(
    async (collectionId: string): Promise<SeriesPlan[]> => {
      return service.loadAllSeriesPlans(collectionId);
    },
    [service],
  );

  const loadSeriesPlan = useCallback(
    async (collectionId: string, seriesId: string): Promise<SeriesPlan | null> => {
      return service.loadSeriesPlan(collectionId, seriesId);
    },
    [service],
  );

  const saveSeriesPlan = useCallback(
    async (collectionId: string, plan: SeriesPlan) => {
      await service.saveSeriesPlan(collectionId, plan);
    },
    [service],
  );

  const deleteSeriesPlan = useCallback(
    async (collectionId: string, seriesId: string) => {
      await service.deleteSeriesPlan(collectionId, seriesId);
    },
    [service],
  );

  // ── 搜索 ──

  const searchArticleTitles = useCallback(
    (collections: Collection[], query: string): SearchResult[] => {
      return service.searchArticleTitles(collections, query);
    },
    [service],
  );

  const searchArticleContent = useCallback(
    async (collections: Collection[], query: string, excludeIds?: Set<string>): Promise<SearchResult[]> => {
      return service.searchArticleContent(collections, query, excludeIds);
    },
    [service],
  );

  // ── 内容/蓝图加载 ──

  const loadArticleContent = useCallback(
    async (articleId: string): Promise<string | null> => {
      return service.loadArticleContent(articleId);
    },
    [service],
  );

  const loadBlueprint = useCallback(
    async (articleId: string): Promise<unknown | null> => {
      return service.loadBlueprint(articleId);
    },
    [service],
  );

  // ── 便利方法 ──

  const refresh = useCallback(async () => {
    const [cols, tr] = await Promise.all([service.list(), service.loadTrash()]);
    setCollections(cols);
    setTrash(tr);
  }, [service]);

  return {
    // 状态
    collections,
    trash,
    loading,

    // 合集
    loadCollections,
    saveCollections,
    createCollection,
    renameCollection,
    removeCollection,
    updateCollection,

    // 文章
    addArticle,
    renameArticle,
    trashArticle,

    // 回收站
    loadTrash,
    restoreArticle,
    permanentlyDeleteArticle,
    emptyTrash,
    saveTrash,

    // 文件夹关联
    linkCollectionFolder,
    unlinkCollectionFolder,
    rescanProjectFolder,

    // 系列规划
    loadAllSeriesPlans,
    loadSeriesPlan,
    saveSeriesPlan,
    deleteSeriesPlan,

    // 搜索
    searchArticleTitles,
    searchArticleContent,

    // 内容/蓝图
    loadArticleContent,
    loadBlueprint,

    // 便利方法
    refresh,
  };
}
