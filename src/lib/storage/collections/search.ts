// search.ts — 文章搜索（标题 + 全文）
import type { Collection, SearchResult } from "./types";

/**
 * 按标题搜索文章（同步，内存搜索）
 */
export function searchArticleTitles(collections: Collection[], query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const col of collections) {
    for (const article of col.articles) {
      const titleLower = article.title.toLowerCase();
      let score = 0;
      if (titleLower === q) score = 100;
      else if (titleLower.startsWith(q)) score = 80;
      else if (titleLower.includes(q)) score = 50;
      else if (q.length >= 2 && titleLower.split(/[\s\u4e00-\u9fff]+/).some(
        (w) => w.startsWith(q) || q.startsWith(w),
      )) score = 30;
      else continue;

      results.push({
        articleId: article.id, collectionId: col.id,
        collectionTitle: col.title, title: article.title,
        matchType: "title", score,
      });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * 全文搜索文章内容（异步，读取文章内容）
 */
export async function searchArticleContent(
  collections: Collection[],
  query: string,
  excludeIds: Set<string> = new Set(),
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const col of collections) {
    for (const article of col.articles) {
      if (excludeIds.has(article.id)) continue;
      try {
        const { loadArticleContent } = await import("../articles");
        const content = await loadArticleContent(article.id);
        if (!content) continue;
        const contentLower = content.toLowerCase();
        const idx = contentLower.indexOf(q);
        if (idx === -1) continue;
        const start = Math.max(0, idx - 30);
        const end = Math.min(content.length, idx + q.length + 40);
        let snippet = content.slice(start, end);
        if (start > 0) snippet = "…" + snippet;
        if (end < content.length) snippet = snippet + "…";
        results.push({
          articleId: article.id, collectionId: col.id,
          collectionTitle: col.title, title: article.title,
          matchType: "content", snippet, score: 20,
        });
      } catch {}
    }
  }
  return results;
}
