// vectorSearch.ts — 向量语义搜索服务
//
// 提供语义搜索能力，优先调 Tauri vector_search（Node.js embedder），
// 降级到 SQLite FTS (search_articles_db)，再降级到浏览器端关键词搜索。
//
// 使用方式:
//   import { semanticSearch } from "./vectorSearch";
//   const results = await semanticSearch("我的搜索词");

import { TauriCommands, tryInvoke, isTauriEnv } from "../bridge/tauri";
import type { SearchResult } from "../storage/collections/types";

export { type SearchResult };

/** 向量搜索结果（后端原始格式） */
export interface VectorSearchItem {
  chunkId: string;
  articleId: string;
  content: string;
  score: number;
}

/** 向量索引统计 */
export interface VectorStats {
  total: number;
}

/** 索引结果 */
export interface IndexResult {
  total: number;
  indexed: number;
  skipped: number;
  errors: number;
}

/** 索引进度事件 */
export interface IndexProgress {
  current: number;
  total: number;
  articleId: string;
  indexed: number;
  skipped: number;
  errors: number;
}

/**
 * 语义搜索：优先向量搜索，降级到 SQLite FTS
 *
 * @param query   搜索关键词
 * @param limit   最大结果数（默认 10）
 * @param threshold 相似度阈值（0~1，默认 0.6）
 */
export async function semanticSearch(
  query: string,
  limit: number = 10,
  threshold: number = 0.6,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  // Tier 1: Tauri vector_search (语义检索)
  if (isTauriEnv()) {
    try {
      const vectorResults = await tryInvoke<VectorSearchItem[]>(TauriCommands.VectorSearch, {
        query: query.trim(),
        k: limit,
        threshold,
      });

      if (vectorResults && vectorResults.length > 0) {
        // Convert vector search results to SearchResult format
        return vectorResults.map((item) => ({
          articleId: item.articleId,
          collectionId: "",
          collectionTitle: "",
          title: item.articleId, // Vector search doesn't return titles
          matchType: "content" as const,
          snippet: item.content.slice(0, 200),
          score: item.score,
        }));
      }
    } catch (err) {
      console.warn("[vectorSearch] vector_search failed, falling back to FTS:", err);
    }
  }

  // Tier 2: Tauri SQLite FTS
  if (isTauriEnv()) {
    try {
      const ftsResults = await tryInvoke<Array<{
        article_id: string;
        collection_id: string;
        collection_title: string;
        title: string;
        snippet: string;
      }>>(TauriCommands.SearchArticleDb, {
        query: query.trim(),
        limit,
      });

      if (ftsResults && ftsResults.length > 0) {
        return ftsResults.map((item) => ({
          articleId: item.article_id,
          collectionId: item.collection_id,
          collectionTitle: item.collection_title,
          title: item.title,
          matchType: "content" as const,
          snippet: item.snippet,
          score: 1.0, // FTS 不返回分数
        }));
      }
    } catch (err) {
      console.warn("[vectorSearch] FTS search failed:", err);
    }
  }

  // Tier 3: 浏览器端关键词搜索（降级）
  return keywordSearch(query, limit);
}

/**
 * 获取向量索引统计
 */
export async function getVectorStats(): Promise<VectorStats> {
  if (!isTauriEnv()) return { total: 0 };
  try {
    const total = await tryInvoke<number>(TauriCommands.GetVectorStats);
    return { total };
  } catch {
    return { total: 0 };
  }
}

/**
 * 启动全量索引（后台线程，进度通过事件推送）
 */
export async function startFullIndex(): Promise<void> {
  if (!isTauriEnv()) return;
  try {
    await tryInvoke(TauriCommands.IndexAllVectors);
  } catch (err) {
    console.error("[vectorSearch] startFullIndex failed:", err);
  }
}

/**
 * 监听向量索引进度事件
 * 返回取消订阅函数
 */
export function onIndexProgress(
  handlers: {
    onStart?: (total: number) => void;
    onProgress?: (progress: IndexProgress) => void;
    onDone?: (result: IndexResult) => void;
    onError?: (error: string) => void;
    onWarn?: (warning: string) => void;
  },
): () => void {
  if (typeof window === "undefined") return () => {};

  const unsubFns: (() => void)[] = [];

  // Tauri event listener setup
  // In Tauri, events are listened via listen() from @tauri-apps/api/event
  const setupTauriListeners = async () => {
    try {
      const { listen } = await import("@tauri-apps/api/event");

      const unsubStart = await listen<{ total: number }>("vector:index-start", (e) => {
        handlers.onStart?.(e.payload.total);
      });
      unsubFns.push(unsubStart);

      const unsubProgress = await listen<IndexProgress>("vector:index-progress", (e) => {
        handlers.onProgress?.(e.payload);
      });
      unsubFns.push(unsubProgress);

      const unsubDone = await listen<IndexResult>("vector:index-done", (e) => {
        handlers.onDone?.(e.payload);
      });
      unsubFns.push(unsubDone);

      const unsubError = await listen<{ error: string }>("vector:index-error", (e) => {
        handlers.onError?.(e.payload.error);
      });
      unsubFns.push(unsubError);

      const unsubWarn = await listen<{ warning: string }>("vector:index-warn", (e) => {
        handlers.onWarn?.(e.payload.warning);
      });
      unsubFns.push(unsubWarn);
    } catch {
      // Not in Tauri environment, events not available
    }
  };

  setupTauriListeners();

  return () => {
    unsubFns.forEach((fn) => fn());
  };
}

/**
 * 浏览器端关键词搜索（终极降级）
 */
async function keywordSearch(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const { loadCollections } = await import("../storage/collections");
    const collections = await loadCollections();
    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const col of collections) {
      for (const article of col.articles) {
        const titleMatch = article.title.toLowerCase().includes(lowerQuery);
        if (titleMatch) {
          results.push({
            articleId: article.id,
            collectionId: col.id,
            collectionTitle: col.title,
            title: article.title,
            matchType: "title",
            snippet: "",
            score: 2.0,
          });
        }
      }
    }

    // Sort by score desc
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  } catch {
    return [];
  }
}
