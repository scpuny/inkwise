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

  const essayCol: Collection = {
    id: genId(),
    title: "随笔",
    articles: [
      { id: genId(), title: "秋日的午后", createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 86400000 },
      { id: genId(), title: "城市夜景漫步", createdAt: Date.now() - 86400000 * 7, updatedAt: Date.now() - 86400000 * 2 },
      { id: genId(), title: "一杯咖啡的时间", createdAt: Date.now() - 86400000 * 14, updatedAt: Date.now() - 86400000 * 5 },
    ],
    createdAt: Date.now() - 86400000 * 30,
  };

  const techCol: Collection = {
    id: genId(),
    title: "技术博客",
    articles: [
      { id: genId(), title: "React 状态管理演进", createdAt: Date.now() - 86400000 * 10, updatedAt: Date.now() - 86400000 * 3 },
      { id: genId(), title: "CSS 容器查询指南", createdAt: Date.now() - 86400000 * 20, updatedAt: Date.now() - 86400000 * 8 },
    ],
    createdAt: Date.now() - 86400000 * 60,
  };

  browserSave(COLLECTIONS_KEY, [essayCol, techCol]);
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
