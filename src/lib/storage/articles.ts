// Article persistence layer — Tauri invoke + localStorage fallback
// Each article has:
//   - Content: stored as {id}.md (individual file, future-proof for indexing)
//   - Metadata: title, dates, collection membership

import { isTauriEnv, invokeOrFallback, tryInvoke, TauriCommands } from "../bridge/tauri";

export interface ArticleMeta {
  id: string;
  collectionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

// ─── Article content ───

export async function saveArticleContent(id: string, content: string): Promise<void> {
  if (isTauriEnv()) {
    try {
      // Try DB-first (SQLite)
      await tryInvoke(TauriCommands.SaveArticleDb, {
        article: { id, content, title: "", collection_id: "", created_at: Date.now(), updated_at: Date.now() },
      });
      return;
    } catch {
      // Fallback: JSON file
      try {
        await invokeOrFallback(TauriCommands.SaveArticle, { id, content }, () => {});
        return;
      } catch { /* both failed, try localStorage */ }
    }
  }
  // Browser fallback
  try {
    localStorage.setItem(`article:${id}`, content);
  } catch { /* ignore */ }
}

export async function loadArticleContent(id: string): Promise<string | null> {
  if (isTauriEnv()) {
    // Try DB-first (SQLite)
    try {
      const row = await tryInvoke<Record<string, unknown> | null>(TauriCommands.GetArticleDb, { id });
      if (row && typeof row.content === "string") return row.content;
    } catch { /* fallback */ }
    // Fallback: JSON file
    try {
      const result = await invokeOrFallback<string | null>(TauriCommands.LoadArticle, { id }, () => null);
      if (result !== null && result !== undefined) return result;
    } catch { /* fallback */ }
  }
  try {
    return localStorage.getItem(`article:${id}`);
  } catch {
    return null;
  }
}

export async function deleteArticleContent(id: string): Promise<void> {
  if (isTauriEnv()) {
    try {
      await invokeOrFallback(TauriCommands.DeleteArticle, { id }, () => {});
      return;
    } catch { /* fallback */ }
  }
  try {
    localStorage.removeItem(`article:${id}`);
  } catch { /* ignore */ }
}

// ─── Article metadata ───

export async function saveArticleMeta(meta: ArticleMeta): Promise<void> {
  if (isTauriEnv()) {
    try {
      await invokeOrFallback(TauriCommands.SaveArticleMeta, { meta }, () => {});
      return;
    } catch { /* fallback */ }
  }
  try {
    localStorage.setItem(`meta:${meta.id}`, JSON.stringify(meta));
  } catch { /* ignore */ }
}

export async function loadArticleMeta(id: string): Promise<ArticleMeta | null> {
  if (isTauriEnv()) {
    try {
      return await invokeOrFallback<ArticleMeta | null>(TauriCommands.LoadArticleMeta, { id }, () => null);
    } catch { /* fallback */ }
  }
  try {
    const raw = localStorage.getItem(`meta:${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Article tags / indexing (reserved for future codegraph/vector) ───

export interface ArticleIndex {
  articleId: string;
  tags: string[];
  embedding?: number[];       // 🔮 reserved for vector embedding
}

const INDEX_KEY_PREFIX = "index:";

export async function saveArticleIndex(index: ArticleIndex): Promise<void> {
  try {
    localStorage.setItem(INDEX_KEY_PREFIX + index.articleId, JSON.stringify(index));
  } catch { /* ignore */ }
}

export async function loadArticleIndex(articleId: string): Promise<ArticleIndex | null> {
  try {
    const raw = localStorage.getItem(INDEX_KEY_PREFIX + articleId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
