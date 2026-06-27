// crud.ts — 集合/文章/回收站 CRUD 操作
import { isTauriEnv, tryInvoke, invokeOrFallback, TauriCommands } from "../../bridge/tauri";
import type { Article, Collection, TrashItem } from "./types";
import { genId, browserLoad, browserSave } from "./internal";

const COLLECTIONS_KEY = "aiwriter-collections";
const TRASH_KEY = "aiwriter-trash";
const SEEDED_KEY = "aiwriter-seeded-v1";

/* ─── 种子数据 ─── */

export function seedIfEmpty(): void {
  if (localStorage.getItem(SEEDED_KEY)) return;
  const existing = browserLoad<Collection[]>(COLLECTIONS_KEY, []);
  if (existing.length > 0) return;
  const now = Date.now();
  const demo: Collection = {
    id: genId(),
    title: "示例文集",
    createdAt: now,
    articles: [
      { id: genId(), title: "欢迎使用 InkWise", createdAt: now, updatedAt: now, phase: "planning_tags" },
      { id: genId(), title: "第二篇文章", createdAt: now, updatedAt: now },
    ],
  };
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify([demo]));
  localStorage.setItem(SEEDED_KEY, "1");
}

// ── Tauri ↔ frontend type bridge ──

function fromTauriCollection(raw: Record<string, unknown>): Collection {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    createdAt: Number(raw.created_at ?? raw.createdAt ?? 0),
    articles: Array.isArray(raw.articles) ? raw.articles.map((a: any) => ({
      id: String(a.id ?? ""),
      title: String(a.title ?? ""),
      createdAt: Number(a.created_at ?? a.createdAt ?? 0),
      updatedAt: Number(a.updated_at ?? a.updatedAt ?? 0),
      description: a.description ? String(a.description) : undefined,
      tags: a.tags ? (Array.isArray(a.tags) ? a.tags.map(String) : undefined) : undefined,
      phase: a.phase ? String(a.phase) : undefined,
      blueprint: a.blueprint ? String(a.blueprint) : undefined,
    })) : [],
    linkedFolder: raw.linkedFolder ? String(raw.linkedFolder) : undefined,
  };
}

function toTauriCollection(c: Collection): Record<string, unknown> {
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    articles: c.articles.map((a) => ({
      id: a.id,
      collection_id: c.id,
      title: a.title,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
    })),
    linkedFolder: c.linkedFolder,
  };
}

/* ─── 集合 CRUD ─── */

export async function loadCollections(): Promise<Collection[]> {
  try {
    const raw = await tryInvoke<Record<string, unknown>[]>(TauriCommands.GetCollections);
    if (raw && raw.length > 0) return raw.map(fromTauriCollection);
  } catch {}
  return browserLoad<Collection[]>(COLLECTIONS_KEY, []);
}

export async function saveCollections(collections: Collection[]): Promise<void> {
  browserSave(COLLECTIONS_KEY, collections);
  try {
    await tryInvoke(TauriCommands.SetCollections, { collections: collections.map(toTauriCollection) });
  } catch {}
}

export async function addCollection(title: string): Promise<Collection> {
  const all = await loadCollections();
  const c: Collection = { id: genId(), title, createdAt: Date.now(), articles: [] };
  all.push(c);
  await saveCollections(all);
  return c;
}

export async function renameCollection(id: string, title: string): Promise<void> {
  // 改名：三层存储同步更新（localStorage / Tauri JSON / SQLite）
  const all = await loadCollections();
  const c = all.find((x) => x.id === id);
  if (c) { c.title = title; await saveCollections(all); }
  if (isTauriEnv()) { try { await tryInvoke(TauriCommands.RenameCollectionDb, { id, title }); } catch {} }
}

export async function removeCollection(id: string): Promise<void> {
  const all = await loadCollections();
  const idx = all.findIndex((x) => x.id === id);
  if (idx >= 0) { all.splice(idx, 1); await saveCollections(all); }
}

/* ─── 文章 CRUD ─── */

export async function addArticle(collectionId: string, title: string): Promise<Article | null> {
  const all = await loadCollections();
  const col = all.find((x) => x.id === collectionId);
  if (!col) return null;
  const article: Article = { id: genId(), title, createdAt: Date.now(), updatedAt: Date.now() };
  col.articles.push(article);
  await saveCollections(all);
  return article;
}

export async function renameArticle(collectionId: string, articleId: string, title: string): Promise<void> {
  const all = await loadCollections();
  const a = all.find((x) => x.id === collectionId)?.articles.find((x) => x.id === articleId);
  if (a) { a.title = title; a.updatedAt = Date.now(); await saveCollections(all); }
}

export async function trashArticle(collectionId: string, articleId: string): Promise<void> {
  const all = await loadCollections();
  const col = all.find((x) => x.id === collectionId);
  if (!col) return;
  const idx = col.articles.findIndex((x) => x.id === articleId);
  if (idx === -1) return;
  const [article] = col.articles.splice(idx, 1);
  await saveCollections(all);
  const trash = await loadTrash();
  trash.push({ id: articleId, collectionId, collectionTitle: col.title, title: article.title, deletedAt: Date.now() });
  await saveTrash(trash);
}

/* ─── 回收站 ─── */

export async function loadTrash(): Promise<TrashItem[]> {
  try { return await tryInvoke<TrashItem[]>(TauriCommands.GetTrash); } catch {}
  return browserLoad<TrashItem[]>(TRASH_KEY, []);
}

export async function saveTrash(items: TrashItem[]): Promise<void> {
  browserSave(TRASH_KEY, items);
  try { await tryInvoke(TauriCommands.SetTrash, { items }); } catch {}
}

export async function restoreArticle(trashId: string): Promise<void> {
  const trash = await loadTrash();
  const idx = trash.findIndex((t) => t.id === trashId);
  if (idx === -1) return;
  const [item] = trash.splice(idx, 1);
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

/* ─── 文集文件夹关联 ─── */

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
  const cacheKey = "folder_index:" + c.id;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) return parsed.content || "";
    }
  } catch {}
  if (isTauriEnv()) {
    try {
      const ctx = await invokeOrFallback<string>(TauriCommands.BuildFolderIndex, { path: c.linkedFolder }, () => "");
      if (ctx) {
        try { localStorage.setItem(cacheKey, JSON.stringify({ content: ctx, timestamp: Date.now() })); } catch {}
        return ctx;
      }
    } catch { return ""; }
  }
  return "";
}
