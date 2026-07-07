// search.ts — 合集搜索桥接层
//
// 提供 searchArticleTitles / searchArticleContent 函数供 SearchPanel 使用。
// v2.0.0+ 内部改为调 SQLite FTS，保留对旧 SearchPanel 的兼容。
// 新代码应直接调 lib/ai/vectorSearch.ts 中的 semanticSearch。

import { semanticSearch } from "../../ai/vectorSearch";
import type { Collection } from "./types";

export type { SearchResult } from "./types";

/**
 * 搜索文章标题（同步，基于已加载的合集数据）
 */
export function searchArticleTitles(
  collections: Collection[],
  query: string,
): Array<{
  articleId: string;
  collectionId: string;
  collectionTitle: string;
  title: string;
  matchType: "title" | "content";
  snippet?: string;
  score: number;
}> {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  const results: Array<{
    articleId: string;
    collectionId: string;
    collectionTitle: string;
    title: string;
    matchType: "title" | "content";
    snippet?: string;
    score: number;
  }> = [];

  for (const col of collections) {
    for (const article of col.articles) {
      if (article.title.toLowerCase().includes(lower)) {
        results.push({
          articleId: article.id,
          collectionId: col.id,
          collectionTitle: col.title,
          title: article.title,
          matchType: "title",
          score: 2.0, // Title match gets higher score
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 20);
}

/**
 * 搜索文章内容（异步，调 SQLite FTS 或向量搜索）
 * excludeIds 用于排除已在标题搜索结果中的文章
 */
export async function searchArticleContent(
  collections: Collection[],
  query: string,
  excludeIds?: Set<string>,
): Promise<Array<{
  articleId: string;
  collectionId: string;
  collectionTitle: string;
  title: string;
  matchType: "title" | "content";
  snippet?: string;
  score: number;
}>> {
  const results = await semanticSearch(query, 20);
  const collectionMap = new Map(collections.flatMap((c) =>
    c.articles.map((a) => [a.id, { collectionId: c.id, collectionTitle: c.title, title: a.title }]),
  ));

  return results
    .filter((r) => !excludeIds?.has(r.articleId))
    .map((r) => {
      const meta = collectionMap.get(r.articleId);
      return {
        articleId: r.articleId,
        collectionId: meta?.collectionId ?? r.collectionId,
        collectionTitle: meta?.collectionTitle ?? r.collectionTitle,
        title: meta?.title ?? r.title,
        matchType: "content" as const,
        snippet: r.snippet,
        score: r.score,
      };
    });
}
