// Collection/article data model — persisted via Tauri backend or localStorage

import { isTauriEnv, invokeOrFallback } from "./tauri";

export type Article = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

export type Collection = {
  id: string;
  title: string;
  articles: Article[];
  createdAt: number;
  linkedFolder?: string;
};

export type TrashItem = {
  id: string;
  title: string;
  collectionId: string;
  collectionTitle: string;
  deletedAt: number;
};

const COLLECTIONS_KEY = "aiwriter-collections";
const TRASH_KEY = "aiwriter-trash";
const SEEDED_KEY = "aiwriter-seeded-v1";

let nextId = Date.now();
export function genId(): string {
  return `id_${(nextId++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Tauri ↔ frontend type bridge ───

/**
 * Tauri's Collection uses `articleIds` (id list only).
 * Frontend's Collection uses `articles` (full objects).
 * These functions convert between the two representations.
 */
function fromTauriCollection(raw: Record<string, unknown>): Collection {
  return {
    id: (raw.id as string) ?? "",
    title: (raw.title as string) ?? "",
    createdAt: Number(raw.createdAt ?? raw.created_at ?? 0),
    linkedFolder: (raw.linkedFolder as string) ?? undefined,
    articles: Array.isArray(raw.articles)
      ? (raw.articles as Record<string, unknown>[]).map((a) => ({
          id: (a.id as string) ?? "",
          title: (a.title as string) ?? "无标题",
          createdAt: Number(a.createdAt ?? a.created_at ?? 0),
          updatedAt: Number(a.updatedAt ?? a.updated_at ?? 0),
        }))
      : [],
  };
}

function toTauriCollection(c: Collection): Record<string, unknown> {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    linkedFolder: c.linkedFolder ?? null,
    articles: c.articles.map((a) => ({
      id: a.id,
      title: a.title,
      collectionId: c.id,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
  };
}

// ─── Internal storage helpers ───

function browserLoad<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function browserSave<T>(key: string, data: T): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}

/* ─── Seed data on first launch ─── */
export function seedIfEmpty(): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(SEEDED_KEY)) return;

  const autumnId = genId();
  const nightId = genId();
  const coffeeId = genId();

  const essayCol: Collection = {
    id: genId(),
    title: "随笔",
    articles: [
      { id: autumnId, title: "秋日的午后", createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 86400000 },
      { id: nightId, title: "城市夜景漫步", createdAt: Date.now() - 86400000 * 7, updatedAt: Date.now() - 86400000 * 2 },
      { id: coffeeId, title: "一杯咖啡的时间", createdAt: Date.now() - 86400000 * 14, updatedAt: Date.now() - 86400000 * 5 },
    ],
    createdAt: Date.now() - 86400000 * 30,
  };

  const reactId = genId();
  const cssId = genId();

  const techCol: Collection = {
    id: genId(),
    title: "技术博客",
    articles: [
      { id: reactId, title: "React 状态管理演进", createdAt: Date.now() - 86400000 * 10, updatedAt: Date.now() - 86400000 * 3 },
      { id: cssId, title: "CSS 容器查询指南", createdAt: Date.now() - 86400000 * 20, updatedAt: Date.now() - 86400000 * 8 },
    ],
    createdAt: Date.now() - 86400000 * 60,
  };

  browserSave(COLLECTIONS_KEY, [essayCol, techCol]);

  // Save initial seed content
  const seedArticles = [
    { id: autumnId, content: [
      "# 秋日的午后", "",
      "午后的阳光透过窗帘，在书桌上洒下温柔的光影。空气中漂着茶香，远处传来几声鸟鸣。", "",
      "秋日是一年中最温柔的时节，不冷也不热，刚刚好。",
    ].join("\n") },
    { id: nightId, content: [
      "# 城市夜景漫步", "",
      "夜幕降临，城市的蝎虹灯次第亮起。沿着江边漫步，看着对岸的灯火在水面上抖动。", "",
      "白天的喧嚣逐渐远去，夜晚的城市显现出另一种生命力。",
    ].join("\n") },
    { id: coffeeId, content: [
      "# 一杯咖啡的时间", "",
      "咖啡馆里漂着烘焙豆子的香气。一杯热美式放在面前，升腾的热气画出柔和的曲线。", "",
      "有时候，生活需要的不是更多，而是一杯咖啡的时间。",
    ].join("\n") },
    { id: reactId, content: [
      "# React 状态管理演进", "",
      "React 的状态管理经历了从简单到复杂，再回归简洁的演变过程。", "",
      "从最早的 setState，到 Redux 时代，再到 Context + Hooks，最后到原子化状态管理，每一步都是对前一种方案的反思与进化。",
    ].join("\n") },
    { id: cssId, content: [
      "# CSS 容器查询指南", "",
      "容器查询（Container Queries）允许我们基于父容器的尺寸来调整样式，而非只能依赖视口宽度。", "",
      "这是 CSS 响应式设计的重大进步，让组件级响应式变得可行。",
    ].join("\n") },
  ];
  for (const { id, content: text } of seedArticles) {
    try { localStorage.setItem("article:" + id, text); } catch {}
  }
  localStorage.setItem(SEEDED_KEY, "1");
}

/* ─── Collections ─── */
export async function loadCollections(): Promise<Collection[]> {
  if (isTauriEnv()) {
    try {
      const raw = await invokeOrFallback("get_collections", undefined, () => browserLoad(COLLECTIONS_KEY, []));
      if (Array.isArray(raw)) {
        return (raw as Record<string, unknown>[]).map(fromTauriCollection);
      }
      return [];
    } catch {
      return browserLoad<Collection[]>(COLLECTIONS_KEY, []);
    }
  }
  return browserLoad<Collection[]>(COLLECTIONS_KEY, []);
}

export async function saveCollections(collections: Collection[]): Promise<void> {
  browserSave(COLLECTIONS_KEY, collections);
  if (isTauriEnv()) {
    const tauriCols = collections.map(toTauriCollection);
    try { await invokeOrFallback("set_collections", { collections: tauriCols }, () => {}); } catch { /* fallback to localStorage */ }
  }
}

export async function addCollection(title: string): Promise<Collection> {
  const c: Collection = { id: genId(), title, articles: [], createdAt: Date.now() };
  const all = await loadCollections();
  all.push(c);
  await saveCollections(all);
  return c;
}

export async function renameCollection(id: string, title: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === id);
  if (c) { c.title = title; await saveCollections(all); }
}

export async function removeCollection(id: string): Promise<void> {
  const all = await loadCollections();
  await saveCollections(all.filter((c) => c.id !== id));
}

export async function addArticle(collectionId: string, title: string): Promise<Article | null> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return null;
  const a: Article = { id: genId(), title, createdAt: Date.now(), updatedAt: Date.now() };
  c.articles.push(a);
  await saveCollections(all);
  return a;
}

export async function renameArticle(collectionId: string, articleId: string, title: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return;
  const a = c.articles.find((x) => x.id === articleId);
  if (a) { a.title = title; a.updatedAt = Date.now(); await saveCollections(all); }
}

export async function trashArticle(collectionId: string, articleId: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return;
  const idx = c.articles.findIndex((x) => x.id === articleId);
  if (idx === -1) return;
  const [article] = c.articles.splice(idx, 1);
  const trash = await loadTrash();
  trash.push({ id: article.id, title: article.title, collectionId, collectionTitle: c.title, deletedAt: Date.now() });
  await saveTrash(trash);
  await saveCollections(all);
}

/* ─── Trash ─── */
export async function loadTrash(): Promise<TrashItem[]> {
  if (isTauriEnv()) {
    try {
      const raw = await invokeOrFallback("get_trash", undefined, () => browserLoad(TRASH_KEY, []));
      return Array.isArray(raw) ? (raw as TrashItem[]) : [];
    } catch {
      return browserLoad(TRASH_KEY, []);
    }
  }
  return browserLoad(TRASH_KEY, []);
}

export async function saveTrash(items: TrashItem[]): Promise<void> {
  browserSave(TRASH_KEY, items);
  if (isTauriEnv()) {
    try { await invokeOrFallback("set_trash", { trash: items }, () => {}); } catch { /* fallback to localStorage */ }
  }
}

export async function restoreArticle(trashId: string): Promise<void> {
  const trash = await loadTrash();
  const idx = trash.findIndex((t) => t.id === trashId);
  if (idx === -1) return;
  const item = trash[idx];
  trash.splice(idx, 1);
  await saveTrash(trash);
  const all = await loadCollections();
  let c = all.find((x) => x.id === item.collectionId);
  if (!c) {
    c = { id: item.collectionId, title: item.collectionTitle, articles: [], createdAt: Date.now() };
    all.push(c);
  }
  c.articles.push({ id: item.id, title: item.title, createdAt: item.deletedAt, updatedAt: item.deletedAt });
  await saveCollections(all);
}

export async function permanentlyDeleteArticle(trashId: string): Promise<void> {
  const trash = await loadTrash();
  await saveTrash(trash.filter((t) => t.id !== trashId));
}

export async function emptyTrash(): Promise<void> {
  await saveTrash([]);
}

/* ─── Folder linking ─── */

export async function linkCollectionFolder(collectionId: string, folderPath: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return;
  c.linkedFolder = folderPath;
  await saveCollections(all);
}

export async function unlinkCollectionFolder(collectionId: string): Promise<void> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c) return;
  c.linkedFolder = undefined;
  await saveCollections(all);
}

export async function getCollectionFolderContext(collectionId: string): Promise<string> {
  const all = await loadCollections();
  const c = all.find((x) => x.id === collectionId);
  if (!c?.linkedFolder) return "";

  // Try cached index first
  const cacheKey = "folder_index:" + c.id;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Use cache if less than 1 hour old
      if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
        return parsed.content || "";
      }
    }
  } catch {}

  // Build fresh index (Tauri mode)
  if (isTauriEnv()) {
    try {
      const ctx = await invokeOrFallback<string>("build_folder_index", { path: c.linkedFolder }, () => "");
      if (ctx) {
        // Cache it
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ content: ctx, timestamp: Date.now() }));
        } catch {}
        return ctx;
      }
    } catch { return ""; }
  }
  return "";
}

/* ─── Search ─── */

export interface SearchResult {
  articleId: string;
  collectionId: string;
  collectionTitle: string;
  title: string;
  matchType: "title" | "content";
  snippet?: string;
  score: number;
}

/**
 * Search articles by title across all collections.
 * Returns results sorted by relevance (exact match first, then prefix, then substring).
 */
export function searchArticleTitles(collections: Collection[], query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  for (const col of collections) {
    for (const article of col.articles) {
      const titleLower = article.title.toLowerCase();
      let score = 0;
      let matchType: "title" | "content" = "title";

      if (titleLower === q) {
        score = 100;
      } else if (titleLower.startsWith(q)) {
        score = 80;
      } else if (titleLower.includes(q)) {
        score = 50;
      } else if (q.length >= 2 && titleLower.split(/[\s\u4e00-\u9fff]+/).some((w) => w.startsWith(q) || q.startsWith(w))) {
        score = 30;
      } else {
        continue;
      }

      results.push({
        articleId: article.id,
        collectionId: col.id,
        collectionTitle: col.title,
        title: article.title,
        matchType,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Search article content. Loads content for each article and searches.
 * This is async because it reads from storage. Only searches articles whose titles
 * didn't already match perfectly (to avoid duplication).
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
        const { loadArticleContent } = await import("./articles");
        const content = await loadArticleContent(article.id);
        if (!content) continue;

        const contentLower = content.toLowerCase();
        const idx = contentLower.indexOf(q);
        if (idx === -1) continue;

        // Generate snippet around the match
        const start = Math.max(0, idx - 30);
        const end = Math.min(content.length, idx + q.length + 40);
        let snippet = content.slice(start, end);
        if (start > 0) snippet = "…" + snippet;
        if (end < content.length) snippet = snippet + "…";

        results.push({
          articleId: article.id,
          collectionId: col.id,
          collectionTitle: col.title,
          title: article.title,
          matchType: "content",
          snippet,
          score: 20,
        });
      } catch {
        // Skip if content can't be loaded
      }
    }
  }

  return results;
}
